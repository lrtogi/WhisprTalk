# WhisprTalk

Your fork of [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT), renamed WhisprTalk.
Repo: https://github.com/lrtogi/WhisprTalk · upstream remote: `upstream`.

Supporting research:

- [wispr-flow-features.md](wispr-flow-features.md): what Wispr Flow 1.6.1209 actually does (static inspection of your installed app)
- [stt-research.md](stt-research.md): best free speech-to-text for dictation and live meetings, late 2026
- [iphone-install.md](iphone-install.md): getting the iOS app onto your phone

## What changed vs upstream

- App name WhisprTalk, bundle id `com.lrtogi.whisprtalk`, permission prompts and UI text in all 11 locales
  (the "OpenWhispr Cloud" service name is kept, since that is the real hosted service)
- Auto-updater points at `lrtogi/WhisprTalk` releases, so it can't silently replace your build with upstream OpenWhispr
- Local signing: no notarization, signed with your `Apple Development: Louis Partogi` cert (`npm run build:mac:local`)
- Default local Whisper model is **Turbo (large-v3-turbo)** instead of Base: much better accuracy and it handles Indonesian
- `cloudflare-worker/`: optional free cloud fallback on your Cloudflare account (Workers AI whisper-large-v3-turbo,
  ~210 min/day free) exposed in the OpenAI format WhisprTalk's Self-Hosted mode speaks

Tests: same 17 failures as a clean upstream checkout, none new.

## Recommended free, local setup

Everything below runs on the Mac. No account needed. Skip "Sign in" during onboarding.

| Use | Setting |
| --- | --- |
| Dictation, English | Transcription → Local → **Parakeet v3 / Orukeet** (fastest, ~6% WER) |
| Dictation, Indonesian or mixed | Transcription → Local → Whisper **Turbo** (Parakeet does not support Indonesian) |
| Live meetings, English | Meeting transcription → local streaming **Nemotron speech streaming (en)** |
| Live meetings, Indonesian | Whisper Turbo (chunked, a few seconds of lag; no free local model streams Indonesian yet) |
| Speaker labels | Local diarization (bundled, on-device) |
| AI cleanup / notes summaries | AI Models → Local (llama.cpp, bundled) with a small model, or free cloud: Groq free tier, or Cloudflare Workers AI (see `cloudflare-worker/README.md`) |
| Calendar (meeting detection + auto-linked notes) | Use **Apple Calendar**: add your Google account in macOS System Settings → Internet Accounts, then enable Apple Calendar in WhisprTalk. Free, no OAuth app needed |

Google Meet / Zoom: WhisprTalk detects the mic going live (Meet in the browser too) and offers to start a note.
It records your mic plus system audio (other participants) locally; no bot joins the call.

## Wispr Flow parity

Wispr Flow has **no local speech recognition at all**: every dictation streams to their servers. WhisprTalk
already covers the core locally:

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
| iOS keyboard | ✅ `openwhispr-mobile` (needs signing, see iphone-install.md) |

Not built yet (backlog, in rough value order):

1. **Paste/copy last transcript hotkey** (Wispr `paste_last_text`). Today: History → copy.
2. **Per-app format presets**: Raw / Casual / all-lowercase per app, beyond Tone & Style.
3. **Polish with diff view** and up to 9 custom transform prompts on hotkeys.
4. **Live translation of the meeting transcript** (dictation translation exists; meetings don't).
5. **Consent chat message**: paste "I'm transcribing this call" into the meeting chat when a note starts.
6. Flow Fetch (voice-recall copied links), Focus Mode, Wispr Memory (per-person files from 90 days of meetings and email).
7. Cross-device sync without OpenWhispr Cloud (e.g. Cloudflare D1/R2). Today sync goes through OpenWhispr Cloud
   (free account) or nothing.

## Rebuild / reinstall

```bash
cd ~/Projects/OpenWhispr
source ~/.nvm/nvm.sh && nvm use 24
npm run prebuild:mac        # first time, or after pulling upstream
CSC_NAME="Apple Development: Louis Partogi (W554539V87)" npm run build:mac:local
```

Then copy `dist/mac-arm64/WhisprTalk.app` to `/Applications` (or open `dist/WhisprTalk-*-arm64.dmg`).

Pull upstream improvements: `git fetch upstream && git merge upstream/main`.
