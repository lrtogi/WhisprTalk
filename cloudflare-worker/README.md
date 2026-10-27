# WhisprTalk free cloud fallback (Cloudflare Workers AI)

Optional. WhisprTalk runs fully local by default. Deploy this if you want a free cloud
transcription fallback (e.g. on a slow machine, or from the iPhone app) using your free
Cloudflare account: `whisper-large-v3-turbo`, ~210 audio minutes/day on the free plan.

## Deploy (one time)

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler secret put ACCESS_TOKEN   # paste a long random string, e.g. `openssl rand -hex 24`
npx wrangler deploy
```

## Use in WhisprTalk

Settings → Transcription → Cloud → **Self-Hosted**:

- Server URL: `https://whisprtalk-asr.<your-subdomain>.workers.dev/<ACCESS_TOKEN>`
- Model: leave empty

Smoke test:

```bash
curl -F file=@sample.wav https://whisprtalk-asr.<sub>.workers.dev/<ACCESS_TOKEN>/audio/transcriptions
```

## Free LLM cleanup via Workers AI (no Worker needed)

Settings → AI Models → Custom (OpenAI-compatible):

- Base URL: `https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1`
- API key: a Cloudflare API token with the *Workers AI* permission
- Model: e.g. `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

Both share the same 10,000 neurons/day free allowance.
