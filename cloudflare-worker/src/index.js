// WhisprTalk's private cloud on the user's free Cloudflare account.
// OpenAI-compatible surface so the Mac app (Self-Hosted transcription + Custom
// reasoning) and the iPhone app (BYOK Custom server) can both point at it:
//   POST /<token>/audio/transcriptions  -> Workers AI whisper-large-v3-turbo
//   POST /<token>/chat/completions      -> Workers AI chat model (stream or not)
//   GET  /<token>/models
//   GET  /<token>/transcripts?limit=50  -> shared transcript log (D1), newest first
// Free plan: 10,000 neurons/day ≈ 210 audio minutes; the secret lives in the path
// because the app's Self-Hosted mode sends no Authorization header.
import { Buffer } from "node:buffer";

const ASR_MODEL = "@cf/openai/whisper-large-v3-turbo";
const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const json = (data, status = 200) => Response.json(data, { status });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [token, ...rest] = url.pathname.split("/").filter(Boolean);
    if (!env.ACCESS_TOKEN || token !== env.ACCESS_TOKEN) return new Response("Not found", { status: 404 });
    const route = rest.join("/").replace(/^v1\//, "");

    if (request.method === "GET" && route === "models") {
      return json({
        object: "list",
        data: [ASR_MODEL, CHAT_MODEL].map((id) => ({ id, object: "model", owned_by: "cloudflare" })),
      });
    }
    if (request.method === "GET" && route === "transcripts") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 500);
      const { results } = await env.DB.prepare(
        "SELECT id, created_at, source, language, text FROM transcripts ORDER BY id DESC LIMIT ?"
      )
        .bind(limit)
        .all();
      return json(results);
    }
    if (request.method === "POST" && route === "audio/transcriptions") return transcribe(request, env);
    if (request.method === "POST" && route === "chat/completions") return chat(request, env);
    return new Response("Not found", { status: 404 });
  },
};

async function transcribe(request, env) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: { message: "missing file" } }, 400);
  const input = { audio: Buffer.from(await file.arrayBuffer()).toString("base64"), vad_filter: true };
  const language = form.get("language");
  const prompt = form.get("prompt");
  if (language) input.language = language;
  if (prompt) input.initial_prompt = prompt;
  try {
    const result = await env.AI.run(ASR_MODEL, input);
    const text = (result.text || "").trim();
    if (text) {
      // Fire-and-forget log; a D1 hiccup must not fail the dictation.
      await env.DB.prepare("INSERT INTO transcripts (source, language, text) VALUES (?, ?, ?)")
        .bind(request.headers.get("user-agent")?.slice(0, 120) || null, language || null, text)
        .run()
        .catch(() => {});
    }
    return json({ text });
  } catch (err) {
    return json({ error: { message: String(err?.message || err) } }, 502);
  }
}

async function chat(request, env) {
  const body = await request.json().catch(() => null);
  if (!body?.messages) return json({ error: { message: "missing messages" } }, 400);
  const model = body.model?.startsWith("@cf/") ? body.model : CHAT_MODEL;
  const input = {
    messages: body.messages,
    max_tokens: body.max_tokens ?? 2048,
    temperature: body.temperature,
    stream: Boolean(body.stream),
  };
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  let result;
  try {
    result = await env.AI.run(model, input);
  } catch (err) {
    return json({ error: { message: String(err?.message || err) } }, 502);
  }

  if (!input.stream) {
    return json({
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message: { role: "assistant", content: result.response ?? "" }, finish_reason: "stop" }],
      usage: result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  }

  // Workers AI streams `data: {"response":"..."}` SSE; rewrap each token as an OpenAI chunk.
  const chunk = (delta, finish = null) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  const transform = new TransformStream({
    start(controller) {
      controller.enqueue(encoder.encode(chunk({ role: "assistant", content: "" })));
    },
    transform(bytes, controller) {
      buffer += decoder.decode(bytes, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const token = JSON.parse(line.slice(6)).response;
          if (token) controller.enqueue(encoder.encode(chunk({ content: token })));
        } catch {}
      }
    },
    flush(controller) {
      controller.enqueue(encoder.encode(chunk({}, "stop") + "data: [DONE]\n\n"));
    },
  });
  return new Response(result.pipeThrough(transform), {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}
