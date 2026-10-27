# Wispr Flow feature inventory (macOS desktop 1.6.1209)

This is a read-only static inspection of `/Applications/Wispr Flow.app`, done on 2026-10-27. The app was never launched.
Sources:
- `Info.plist`
- `app.asar`, extracted to scratch (`.webpack/main/index.js` plus 9 renderer windows)
- the Swift helper `Resources/swift-helper-app-dist/Wispr Flow.app`
- 175 SQLite migrations in `Resources/migrations/`
- the English i18n tables, which hold about 6,000 strings and are inlined as `JSON.parse(...)` in the renderer bundles
- IPC channel enums, about 1,100 channels across 75 namespaces
- the default-prefs object in main
- about 230 feature-flag names
- the key names (not the values) in `~/Library/Application Support/Wispr Flow/config.json`

No personal data, tokens or transcripts were read.

**Shape of the app:** Electron (bundle id `com.electron.wispr-flow`) plus a Swift helper (`com.electron.wispr-flow.accessibility-mac-app`, LSUIElement). The helper handles accessibility, key taps, paste, the clipboard, BLE, haptics and media control (MediaRemoteAdapter). The URL scheme is `wispr-flow://`. Usage strings cover the microphone, system-audio capture ("to take notes during meetings"), Bluetooth ("BLE mic ring for hands-free dictation") and the camera. The renderer windows are `hub` (the main UI), `status` (the Flow Bar), `overlay`, `contextMenu`, `scratchpad`, `meeting_recorder`, `feature_tour`, `accessibility_drop` and `meeting_ax_inspector`.

**Bottom line on cloud vs local:** there is **no local ASR or LLM** anywhere in the bundle. I found no onnx, ggml, whisper.cpp or CoreML models. Every transcription and every AI step is a cloud call. Local work is limited to audio capture, Opus encoding (WASM worker), accessibility (AX) and context scraping, paste, the SQLite history/cache and the UI.

## 1. Dictation core

| Feature | How it works (evidence) | Cloud or local |
|---|---|---|
| Push-to-talk | Shortcut action `ptt` ("Hold to say something short"). The status state is `ACTIVE_PTT`. | Capture local, ASR cloud |
| Hands-free / toggle ("POPO") | Action `popo` ("Dictate hands-free by pressing this hotkey to start and stop"). Lock sound is `popo-lock.wav`. Deeplinks start and stop hands-free mode. An onboarding experiment tests `ptt-first` vs `popo-first`. | Same |
| Triple-tap to start Notetaker | `notetakerTripleTapShortcutEnabled`: "Press your dictation key three times quickly to join a meeting or start Notetaker". | Local trigger |
| Configurable shortcuts | Shortcut actions: `ptt`, `popo`, `dismiss`, `paste_last_text`, `copy_last_text`, `command`, `lens`, `note`, `polish`, `open_scratchpad`, `undo`, `polish_prompt_1..9`, `view_diff`, `enter_rebind`, `toggle_focus_mode`, `open_meeting_recorder`, plus voice presets (`learned_voice`, `team_voice`…). Mouse shortcuts ("Introducing: Mouse Shortcuts"), an MX Master setup screen, and Caps Lock as the dictation key on Windows (`windows-caps-lock-shortcut`). | Local |
| Streaming ASR transport | gRPC streaming to `inference.wisprflow.com`. The allow-listed hosts are `model-v31pl413.grpc.api.baseten.co` and `wispr-ai-prod--prod-grpc-server-flowgrpcserver.us-east.modal.direct`. The active host is fetched from `https://inference-info.wisprflow.com/dictation_url.txt`. Headers are `baseten-model-id`, `x-baseten-environment` and `disable-formatting`. Transport modes are `grpc`, `http_race` and `http_fallback`, with `voice_actions_realtime` as another mode. Flags: `use-opus`, `stream-text`, `grpc-geo`, `use-candidate-asr`. | **Cloud** (Baseten / Modal GPUs) |
| "Canto" speech model | Launch modal: "Canto is Wispr Flow's new speech model for real-world dictation… even when you speak quietly or there's noise". | Cloud |
| Formatting in the ASR pass | The server pipeline stages are `transcribe`, `align`, `format`, `lowercase_sentences`, `slack_tagging` and `email_signature`. The client sends `disable-formatting` when the format is Raw. List formatting distinguishes `unordered_bullet`, `ordered_bullet` and `end_of_list`. | Cloud |
| Whisper (quiet speech) support | There is no separate mode, only the `usedWhisperMode` stat plus a mic quiz ("get close to your mic and whisper as softly as you can!") and mic recommendations for whispering. Quiet speech is handled by the Canto model. | Cloud |
| Languages / auto-detect | There are 105 language entries, including `hien` (Hinglish), `dech` (Swiss German), en-GB and en-CA. Prefs: `selectedLanguages`, `usedLanguages`, `effectiveLanguages`. "Select the languages you speak for better accuracy." There is a `language-picker-retirement-notice` flag and a `WrongLanguageSetting` notification. | Cloud |
| Paste into any app | The helper's `PasteText` / `PasteOutcome` / `PasteBlocked` routines, clipboard restore (`DisableClipboardRestore`), `remote-viewer-paste`, `trailing-boundary-nbsp`, the `SecureInputBlockingShortcuts` notification and a `paste.wav` sound. | Local |
| Paste / copy last transcript, undo | Shortcut actions `paste_last_text`, `copy_last_text` and `undo`. | Local |
| "Press enter" voice command | `pressEnterCommandEnabled`: "Automatically press enter when you say 'press enter' at the end of a dictation". | Local + cloud ASR |
| Stacked messages | `stackedMessagesEnabled`: "Split dictation into separate messages in messaging apps". | Cloud formatting |
| Email signature | `emailAutoSignature` and `emailSignatureOption` (`spoken_with_flow` / `written_with_flow`): "Add a Flow signature when dictating an email". | Cloud pipeline stage |
| Slack @-tagging | `slack-tagging` flag and the `SLACK_TAGGING` pipeline stage. | Cloud |
| Creator mode | "Show 'Dictating with Wispr Flow' when dictating". | Local |
| Audio handling | Mute or pause media while dictating (`shouldMuteAudio`, `shouldPauseAudio` via MediaRemoteAdapter). Ranked mic priority (`rankedAudioDevices`). Clamshell built-in-mic warnings, AirPods warning, audio-quality and no-audio notifications. | Local |
| Hardware integrations | BLE mic ring (`ble-mic-ring`; helper `BLEAudioManager`, `BleStartPairing`). Jabra wear detection ("switch to Jabra mic when worn"). Haptics. | Local |
| Sounds | Dictation start/stop, paste and achievement sounds, with about 20 selectable sound packs (`selectedSoundFolder`, assets/sounds/v1..v12). | Local |
| Flow Bar (status pill) | Movable or dockable (`statusDockEdge`, `can-drag-flow-bar`), hideable (`hideFlowBarPermanently`), with live WPM and audio level (`status:currentWPM`, `status:audioLevel`). | Local |
| Typing reminder | Nudges you to dictate when it detects typing: "Select where the Flow Bar reminder appears". | Local detection |
| Focus Mode | "Block distracting apps and websites with opt+f" (`focusModeBlockedApps`, `focusModeBlockedUrls`). | Local |
| Max length / backlog recovery | `maxRecordingLengthMs`, `dictation-long-backlog-recovery`, the `TranscriptIncomplete` notice, and a `LongDictationNotetakerPrompt` that suggests switching to Notetaker. | Local |
| Offline behaviour | Dictation shows `NoInternet` / `degraded-network-notification`. Only Notetaker records offline ("audio will be saved on this device and transcribed when you're back online"). | Needs cloud |

## 2. AI formatting, cleanup, styles, transforms

| Feature | How it works (evidence) | Cloud or local |
|---|---|---|
| Per-app transcription format | Options are "Apply AI formatting", "No AI formatting", "Casual messaging" (capitalize proper nouns only) and "All lowercase". Stored as `defaultTranscriptionFormat` and `appTranscriptionFormats[]`. | Cloud |
| Auto Cleanup levels | None ("exactly what you said"), Light ("filler words and grammar"), Medium ("clarity and conciseness"), High ("rewrites for brevity and polish"). Stored as `autoCleanup.level`; "applies to all your dictations". | Cloud LLM |
| Styles per app category | Categories are personal messages, work messages, email and other. Tones are `formal`, `casual`, `veryCasual`, `excited`, `genz`. App-category enums: email, ai, work, personal_messaging, document, terminal. `styleDetectionEnabled`: "Automatically set messaging style". | Cloud |
| Undo AI edit | "go to the three dots next to a recent dictation… click 'Undo AI edit'" (`history:toggleAiEdit`, migration `history-revert-ai`). Raw and formatted text are both stored. | Local history |
| Polish | "Polish rewrites your text to sound clearer, in your voice." Works on the selection or the last dictation, with a diff viewer (`view_diff`, `contextMenu:showDiff`) and feedback. Settings: `polishInstructions` (custom rules, e.g. "always write in Spanish"), `polishAutoPaste`, `auto-polish-on-short-text`. Calls `/api/v1/polish/upload` and `transform/*`. | Cloud LLM |
| Transforms (custom prompts) | Named transforms bound to up to 9 shortcuts (`polish_prompt_1..9`). Endpoints: `/api/v1/transform/apply/stream`, `/apply/dynamic/stream` and `/suggestions`. "Auto Apply" runs the selected transform on every dictation. Includes "Translate to any language". | Cloud LLM |
| My Voice / learned voice | `userVoices`, `personalizationStyles`, writing examples ("Add examples of your writing… match your voice"), `/api/v1/learned-preferences/generate` and `user_voice_preferences`. Email preferences: "Wispr Flow reads your most recent sent emails to learn your writing preferences" (Gmail). | Cloud |
| Voice profile / insights | A server-generated profile (superpower, persona, catch phrase, most-removed word…). Stats, heatmap, weekly team ranks, streaks, WPM, per-app stats. | Cloud |

## 3. Command / Instruct (voice agent)

| Feature | How it works (evidence) | Cloud or local |
|---|---|---|
| Command Mode (beta, paid) | "Select text and ask Flow or Perplexity"; "Enable advanced voice commands". Gated on `commandModeEnabled` and a paid subscription. The shortcut handler logs as "Wispr Lens". | Cloud LLM |
| Instruct Mode | "Dictate instructions to draft replies using screen context". Example prompts: "draft a reply to this", "make this more concise", "Polish this", and "No exclamations in email" (teaches style). Shows a chat panel (`instructChat:*`), stores tool-call history, and `auto-detect-instruct-mode` classifies whether an utterance is a dictation or an instruction. | Cloud LLM |
| Voice-controlled settings | Routes `dictation`, `instruct`, `transform`, `updateSettings` and `modelIsUnsure`, with an "UpdateSettingsConfirmation" notification. Classifier prompt: "whether the user is changing transform settings or expressing a general voice preference". | Cloud |
| Models named in client | `claude-haiku-4-5`, `claude-sonnet-4-5`, `claude-opus-4-6`, `gpt-oss-120b` (Cerebras via OpenRouter, provider_order `["cerebras"]`), `google/gemini-3.5-flash-lite` (OpenRouter), `gpt-realtime-2` and `gpt-5.5` (realtime voice actions at `/api/v1/voice-actions/realtime`). These are passed as `{provider:{kind,model}}` to Wispr's backend; the client holds no LLM keys. | **Cloud, proxied by api.wisprflow.ai** |
| Context awareness | The request carries app name, URL, bundle ID, the textbox's before/selected/after text, up to 1,000 chars of AX-parsed window words, and `nearestTexts`. `useAxContext` (default on): "use limited, relevant text content from the app… to spell names correctly". `shouldOCRScreenCapture` takes a screenshot with mouse-highlight (Screen Recording permission). Browser detection covers Arc, Atlas, Brave, Chrome, Comet, Dia, Edge, Firefox, Opera, Safari, Vivaldi and Zen. | Gathered locally, used in cloud |
| Vibe coding | "Variable recognition (VS Code, Cursor, Windsurf)" reads the open file via IDE screen-reader mode. "File Tagging in Chat (Cursor & Windsurf)" (`ideFileTagging`). Plus `coding-cli-detection`. | Local read, cloud use |
| Flow Fetch | Clipboard-monitored history of copied links (`links` table, pin/enrich). Alt+K picker or "ask Flow to Fetch your link" to paste a link by voice. | Local + cloud enrich |

## 4. Dictionary, snippets, notes

| Feature | How it works (evidence) | Cloud or local |
|---|---|---|
| Personal dictionary | Manual words and replacements (`to_replace`, `replacement_html`), starring, sorting, and bulk import from CSV/JSON. Sources: `manual`, `app_context`, `user_edits`, `bulk_import`, `ios_contacts`, `meeting_summary`, `meeting_transcript`. | Synced to cloud |
| Auto-learn from corrections | `shouldAutoLearnWords`: "Adds corrected words automatically". The app watches post-paste edits (`content-observation`, edit-distance, divergence-score columns) and shows "Flow learned this word automatically ✨". | Local observe, cloud learn |
| Snippets (text expansion) | "Save shortcuts to speak the things you type all the time… Just speak and Flow expands them". Supports rich-text snippets and bulk import. | Synced |
| Team / department / org vocab & snippets | `/api/v1/dictionary/team|shared`, `department-scoped-*` and `enterprise-snippet-governance` flags; "Delete from organization vocabulary?". | Cloud (Teams plan) |
| Contacts | `/api/v1/contacts`, `wispr-contacts` flag, and global profile sharing (job title, LinkedIn) visible to people who have your email. | Cloud |
| History | Full dictation history with audio replay (`history:getAudioForTranscript`), retry transcript, feedback, archive, delete all, and e2e latency columns. | Local SQLite, optional cloud sync |
| Scratchpad / Notes | A floating notes window for dictating and transforming text ("Drop a to-do list, polish a message…"). Has tabs, pinned notes, version history (`note_versions`), image attachments, and "Access your Scratchpad notes anywhere" (cloud sync). | Local + cloud sync |
| Tasks / To-dos | A `todos` table extracted from meetings, with actions `todos:sendEmail` and `todos:addCalendar` (`/api/v1/automations/send-email|add-calendar`). | Cloud automations |

## 5. Notetaker (meetings), the largest surface in the app

| Feature | How it works (evidence) | Cloud or local |
|---|---|---|
| Bot-free meeting capture | Records the mic plus system audio ("Nothing joins the call"; NSAudioCaptureUsageDescription). Meeting detection uses AX, the audio session, the process API and a running-apps heuristic for Zoom, Google Meet, Teams and Slack huddles. Auto-start, auto-end, and a max-length setting. | Capture local |
| Live transcript | Providers `primary: soniox|wispr-chorus`, `shadow`, and `fallback: soniox|wispr-chorus|open-ai`. Audio is chunked as Opus via a multipart upload. Records offline and uploads later. | Cloud |
| Refined transcript + speakers | "After the meeting, Wispr will improve the transcript & label speakers". Speaker split/reassign, a voice-playback speaker editor, and participant names read from the meeting UI (AX). | Cloud |
| Summaries / quick summary | Notes, Summary, Transcript, Tasks and Docs tabs. Candidate summary, quick summary while refining, summary feedback, and `summary-model-comparison`. | Cloud LLM |
| Live translation (beta) | "Translate the live transcript to your preferred language". | Cloud |
| Ask Anything + Skills | A chat over your meetings ("type / for Skills"). Custom `/command` Skills with a limit, and a filesystem tool bridge (`notetakerAsk:runFilesystemTool`). Gmail can add context. | Cloud LLM |
| Calendar + pre-meeting briefs | Google and Outlook calendars with join reminders (15 s, 1 min or 2 min before). Notetaker can add a notice to the calendar event, and an agentic "preread" builds briefs from Slack, Notion and Gmail connectors. | Cloud |
| Consent chat message | "When the Notetaker starts, lets everyone in the call know you're transcribing it": the helper pastes a message into the meeting chat (`ConsentChatPasteboard`). | Local paste |
| Hide from screen share | "Notepad and Flow Bar won't appear in screenshots or when you share your screen". | Local |
| Sharing & folders | Share links (anyone with link / domain / invited only), auto-share with attendees, and shared folders with grants, rules and roles (owner/contributor/viewer). Org insights. | Cloud |
| Imports | Granola (reads the local install plus CSV) and Otter (archive/TXT). | Local parse, cloud store |
| Wispr MCP server | `https://api.wisprflow.ai/connect/mcp`: "allows your AI tools to search your notes, answer questions and take actions from your calls… does not have access to your dictations". Targets Claude, ChatGPT, Gemini and Cursor. | Cloud |
| Connectors | Google Calendar, Outlook, Gmail, Slack, Notion, GitHub, Linear and LinkedIn. Admins can block them. | Cloud OAuth |
| Wispr Memory | "Flow reads your last 90 days of meetings and the people on your calendar, plus your email… keeps one file per person". Has a file tree, runs, diffs, blame and search (Temporal workflows). | Cloud |
| Retention | Notetaker transcript retention (auto-delete after N), with `notetaker-retention` org policies. | Cloud + local |

## 6. Accounts, teams, privacy, platforms

| Feature | How it works (evidence) | Cloud or local |
|---|---|---|
| Plans | Basic, Pro, Student (free for students), Team and Business ("SSO, SOC 2…"). Stripe plus RevenueCat, a weekly word limit (`WeeklyWordsLimitReached`), trials, referrals and a student leaderboard. | Cloud |
| Enterprise / teams | Invites, join requests, domain capture, roles (admin, member, superadmin, it_admin), WorkOS auth/SSO, managed config, app deny list (`AppDictationBlocked`) and cost centers. | Cloud |
| Privacy controls | Cloud sync toggle ("Stores… transcripts, audio… on Wispr servers"). Local storage policy: `store_normally`, `delete_after_24h` or `never_store`. "Improve the model for everyone" (training opt-in). HIPAA BAA sign/revoke. Data export by email. | Cloud + local |
| Cross-device sync | WebSocket at `/api/v1/sync/ws`, plus notes, meetings, todos and dictionary sync. | Cloud |
| Mobile (iOS / Android) | The desktop app only references it: "Dictation in any language in any app on Mac, Windows, iOS and Android", a QR download, `register_device`, `notification/send-ios` and `ios_contacts` as a dictionary source. No iOS keyboard binary is on this Mac, so mobile-only features were not inspected. | n/a |
| Windows | Shared codebase (C# helper, Windows notetaker flags). | — |
| UI localization | Hub UI in about 20 locales (`localization-framework` flag, `uiLocale`, `emailLocale`). | Local |
| Extension system (gated) | `extension-system` flag, `extensionBootstrap.js`, extension panels/tabs/keybinds/settings in Scratchpad, and an "ExtensionsHome" page. Not yet user-visible. | Local |
| Telemetry | Sentry, PostHog (`ph.wisprflow.ai`), a Braintrust LLM-tracing SDK bundled in main, and detailed latency metrics. | Cloud |
