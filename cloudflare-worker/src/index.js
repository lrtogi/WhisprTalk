// OpenAI-compatible /audio/transcriptions on Cloudflare Workers AI (free tier: 10k neurons/day
// ≈ 210 min/day of whisper-large-v3-turbo). WhisprTalk's Self-Hosted mode sends no auth header,
// so the secret lives in the path: Server URL = https://<worker>/<ACCESS_TOKEN>
import { Buffer } from "node:buffer";

const MODEL = "@cf/openai/whisper-large-v3-turbo";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const [token, ...rest] = url.pathname.split("/").filter(Boolean);
    if (!env.ACCESS_TOKEN || token !== env.ACCESS_TOKEN) return new Response("Not found", { status: 404 });

    const route = rest.join("/").replace(/^v1\//, "");
    if (request.method === "GET" && route === "models") {
      return Response.json({ object: "list", data: [{ id: MODEL, object: "model" }] });
    }
    if (request.method !== "POST" || route !== "audio/transcriptions") {
      return new Response("Not found", { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return Response.json({ error: "missing file" }, { status: 400 });

    const input = { audio: Buffer.from(await file.arrayBuffer()).toString("base64"), vad_filter: true };
    const language = form.get("language");
    const prompt = form.get("prompt");
    if (language) input.language = language;
    if (prompt) input.initial_prompt = prompt;

    try {
      const result = await env.AI.run(MODEL, input);
      return Response.json({ text: (result.text || "").trim() });
    } catch (err) {
      return Response.json({ error: { message: String(err?.message || err) } }, { status: 502 });
    }
  },
};
