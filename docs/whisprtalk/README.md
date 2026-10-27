# WhisprTalk

Your fork of [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT), renamed WhisprTalk.
Repo: https://github.com/lrtogi/WhisprTalk (branch `whisprtalk`) · upstream remote: `upstream`.

Supporting docs:

- [wispr-flow-features.md](wispr-flow-features.md): what Wispr Flow 1.6.1209 actually does (static inspection of your installed app)
- [stt-research.md](stt-research.md): best free speech-to-text for dictation and live meetings, late 2026
- [iphone-install.md](iphone-install.md): the iPhone build and what it takes to put it on your phone
- [../../cloudflare-worker/README.md](../../cloudflare-worker/README.md): WhisprTalk Cloud, your private Cloudflare Worker

## What leaves your devices

Nothing, except calls to **your own Cloudflare Worker** when a scope is set to WhisprTalk Cloud, plus
one-time model downloads from Hugging Face / GitHub and update checks against `lrtogi/WhisprTalk`
releases. No OpenWhispr account, no OpenWhispr Cloud, no telemetry. `VITE_OPENWHISPR_API_URL` is unset,
so the sign-in paths are dead.

## What changed vs upstream

- App name WhisprTalk, bundle id `com.lrtogi.whisprtalk`, permission prompts and UI text (English updated; other locales still say WhisprTalk but keep upstream copy)
- Auto-updater points at `lrtogi/WhisprTalk` releases
- **Ad-hoc code signing**, no Apple team involved (`"identity": null`), no notarization
- Default local Whisper model: **Turbo (large-v3-turbo)** instead of Base
- Onboarding "cloud" card is now **WhisprTalk Cloud** = your Cloudflare Worker. One click sets Self-Hosted
  transcription for dictation, meetings and uploads, and Workers AI Llama 3.3 as the AI cleanup/notes model.
  The URL (with token) comes from the git-ignored `.env.local` (repo root) at build time.
- `cloudflare-worker/`: the Worker (Whisper large-v3-turbo ASR, OpenAI-compatible chat proxy, D1 transcript log)
- `electron-builder.json` no longer packs `openwhispr-mobile/`, `cloudflare-worker/`, `docs/`
- **Paste last transcript / Copy last transcript** hotkeys (Settings → Hotkeys, unset by default)
- **Per-app transcription format** in Settings → Tone & Style: AI (default), Raw (no cleanup pass),
  Casual (proper nouns only, no trailing period), Lowercase

Tests: same 17 failures as a clean upstream checkout, none new.

## Recommended setup

**Mac, first launch:** onboarding → "WhisprTalk Cloud" card. That is the "all transcription through our
Cloudflare" setup you asked for. Later, in Settings:

| Use | Setting |
| --- | --- |
| Dictation and uploads | WhisprTalk Cloud (default from onboarding) |
| Meetings, English, long or many per day | Switch Meetings → Local → **Nemotron speech streaming (en)** or Parakeet v3: real-time, unlimited, no daily cap. The cloud path is batch Whisper with ~2–3 s lag and a **210 min/day** free cap shared with dictation |
| Speaker labels | Local diarization (bundled, on-device) |
| AI cleanup / notes | WhisprTalk Cloud (Workers AI) or Local (llama.cpp, bundled) |
| Calendar | Apple Calendar (add your Google account in macOS System Settings → Internet Accounts). No Google OAuth app needed |

Google Meet / Zoom: WhisprTalk detects the mic going live and offers to start a note. It records your mic
plus system audio locally; no bot joins. Offline meetings: start a note manually (meeting hotkey).

**iPhone:** On-Device transcription (Whisper/Parakeet) and, for cloud, AI Models → Bring Your Own Key →
Custom → the same Worker URL. Dictation keyboard needs a paid Apple team (App Groups), so the free-team
build has no keyboard; see iphone-install.md.

**Shared between Mac and iPhone today:** everything transcribed through the Worker lands in the D1 log
(`GET <url>/transcripts`). Full notes sync between devices is not built (OpenWhispr's sync backend
`openwhispr-api` is closed source), see backlog.

## Wispr Flow parity

Wispr Flow has **no local speech recognition at all**; every dictation streams to their servers.

| Wispr Flow | WhisprTalk |
| --- | --- |
| Push-to-talk / hands-free hotkey, paste at cursor | ✅ Dictation hotkey (tap or hold), auto-paste |
| Auto cleanup, tone/style per app category | ✅ AI cleanup + Tone & Style per app |
| Personal dictionary, auto-learn from corrections, snippets | ✅ Custom dictionary, edit monitor, snippets |
| Command / Instruct mode with screen context | ✅ Voice Assistant hotkey, edits selected text, optional screenshot context |
| "Press enter" voice command | ✅ |
| Notetaker: bot-free capture, live transcript, speakers, summaries, calendar | ✅ Meetings + live diarization + voice fingerprints + note templates/actions |
| Ask Anything over meetings | ✅ Notes chat + local semantic search (Qdrant) |
| Granola import, hide overlays from screen share | ✅ |
| Dictation translation | ✅ Translation hotkey |
| iOS app | ✅ `openwhispr-mobile` (keyboard extension needs a paid team) |

Backlog (not built yet, in rough value order):

1. **Polish with diff view** and up to 9 custom transform prompts on hotkeys.
2. **Live translation of the meeting transcript**.
3. **Consent chat message** when a note starts in a meeting.
4. **Notes sync Mac ↔ iPhone through the Worker** (D1/R2). The log endpoint is the seed.
5. Flow Fetch, Focus Mode, Wispr Memory.

## Rebuild / reinstall

```bash
cd ~/Projects/OpenWhispr
source ~/.nvm/nvm.sh && nvm use 24
npm run prebuild:mac        # first time, or after pulling upstream
npm run build:mac:local
```

Then copy `dist/mac-arm64/WhisprTalk.app` to `/Applications` (or open `dist/WhisprTalk-*-arm64.dmg`).
`.env.local` (repo root) must contain `VITE_WHISPRTALK_CLOUD_URL` for the cloud card to work.

Pull upstream improvements: `git fetch upstream && git merge upstream/main`.
