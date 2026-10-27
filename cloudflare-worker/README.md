# WhisprTalk Cloud (Cloudflare Worker)

WhisprTalk's only cloud: a Worker on your own free Cloudflare account. Nothing else leaves the Mac or
the iPhone. It is deployed on the **WhisprTalk** account as `whisprtalk-asr`
(https://whisprtalk-asr.whisprtalk.workers.dev), with a D1 database `whisprtalk-transcripts`.

Everything lives under `/<ACCESS_TOKEN>/`, an OpenAI-compatible base URL, because WhisprTalk's
Self-Hosted transcription mode sends no auth header:

| Route | What it does | Model |
| --- | --- | --- |
| `POST audio/transcriptions` | multipart `file` (+ `language`, `prompt`) → `{"text": ...}`; logs the text to D1 | `@cf/openai/whisper-large-v3-turbo` |
| `POST chat/completions` | OpenAI chat format, `stream: true` supported | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (or any `@cf/...` id you pass) |
| `GET models` | model list | |
| `GET transcripts?limit=50` | the shared transcript log, newest first (Mac and iPhone both write to it) | |

Free plan: 10,000 neurons/day ≈ **210 audio minutes/day** of Whisper, shared with the chat calls.
Past that Cloudflare returns an error until the daily reset; switch the affected scope to a local model
in Settings if that happens.

## Where the token is

- `.env.local` (repo root) → `VITE_WHISPRTALK_CLOUD_URL=https://whisprtalk-asr.whisprtalk.workers.dev/<token>`
  (git-ignored; baked into the Mac build so the onboarding "WhisprTalk Cloud" card is one click)
- Worker secret `ACCESS_TOKEN` (`npx wrangler secret put ACCESS_TOKEN`)
- Rotate: generate a new one (`openssl rand -hex 24`), put it in both places, rebuild the Mac app,
  update the iPhone's Custom server URL.

## Use in WhisprTalk

- **Mac onboarding:** pick the "WhisprTalk Cloud" card. It sets Self-Hosted transcription for dictation,
  meetings and uploads, and the same URL as the Custom reasoning provider.
- **Mac Settings later:** Transcription → Self-Hosted → Server URL = the URL above, Model empty.
  AI Models → Custom → Base URL = the same URL, API key = anything, Model = `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- **iPhone:** AI Models → workflow → Bring Your Own Key → Custom → same base URL, same model id;
  transcription workflows use the same URL (the app posts to `audio/transcriptions`).

## Redeploy

```bash
cd cloudflare-worker
npx wrangler deploy
```

Schema changes: edit `schema.sql`, then `npx wrangler d1 execute whisprtalk-transcripts --remote --file schema.sql`.
