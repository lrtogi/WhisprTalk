# Free speech-to-text for OpenWhispr (as of 27 October 2026)

Question: which free speech-to-text (STT) setup works best on an Apple Silicon Mac, and ideally on iPhone, for (a) push-to-talk dictation and (b) live multi-speaker meeting transcription? The languages are English plus other languages, including Indonesian. The note also covers what most people use and which free cloud tiers exist.

Sources are primary (model cards, READMEs, vendor docs, the sherpa-onnx release API). The numbers are what those sources report. I did not run any benchmarks for this note.

## TL;DR

1. **Indonesian is the deciding constraint.** None of the NVIDIA models in the registry (Parakeet v3, Parakeet Unified, Nemotron, Orukeet), nor Cohere, Voxtral Realtime, Kyutai or Moonshine, supports Indonesian. Whisper does locally, and so does Qwen3-ASR, which is not wired in yet.
2. **Dictation default:** keep Parakeet TDT v3 or Orukeet (the registry's `recommended`) for English and EU languages. When the language is `id` or anything outside their list, fall back to **Whisper large-v3-turbo q5_0**.
3. **Live meetings:**
   - English: use a native streaming transducer. The current entry is `nemotron-speech-streaming-en-0.6b`. Consider adding `parakeet-unified-en-0.6b` streaming-560ms, which has a better WER at the same latency.
   - Other languages except Indonesian: `nemotron-3.5-asr-streaming-0.6b`, already in the registry.
   - Indonesian: no free local model streams it natively. Use VAD-chunked Whisper turbo, accept a lag of a few seconds, and re-transcribe the full recording after the meeting.
4. **Free cloud:**
   - Groq `whisper-large-v3-turbo` is the most generous and is already in the registry.
   - Cloudflare Workers AI Whisper turbo gives about 214 audio-minutes a day for free.
   - Deepgram Nova-3 on Workers AI gives only about 12 to 21 free minutes a day, which is not enough for meetings.

## What OpenWhispr already ships

From [`src/models/modelRegistryData.json`](../../src/models/modelRegistryData.json):

| Registry id | Runtime | Langs | id? | Source |
|---|---|---|---|---|
| `parakeet-tdt-0.6b-v3` | sherpa offline, nemo_transducer | 25 EU | no | sherpa-onnx `asr-models` release |
| `parakeet-unified-en-0.6b` | sherpa offline | en | no | same |
| `nemotron-speech-streaming-en-0.6b` (560 ms) | sherpa **online** | en | no | same |
| `nemotron-3.5-asr-streaming-0.6b` (560 ms) | sherpa **online** | 15 in registry (card: 32 out of the box) | no | same |
| `cohere-transcribe-03-2026` | sherpa offline (custom type) | 14 | no | same |
| `orukeet-v0.1.0` (recommended) | sherpa offline | 25 EU | no | HF `oruk/orukeet` |
| whisper `tiny`…`large`, `turbo` | whisper.cpp ggml (f16 only) | 99 | **yes** | HF `ggerganov/whisper.cpp` |

Other relevant pieces in the app:

- Diarization uses pyannote-seg-3.0 with CAM++ (sherpa).
- The sherpa model types handled are `transducer`/`nemo_transducer` and `cohere-transcribe` ([`src/helpers/parakeetModelInfo.js`](../../src/helpers/parakeetModelInfo.js)). Whisper-in-sherpa, Qwen3-ASR and CTC models would each need a new branch there.
- The online runtime is a single stream ([`src/helpers/parakeetWsServer.js`](../../src/helpers/parakeetWsServer.js)).
- The Whisper `recommended` flag sits on `base` (142 MB), which is weak for anything but English.
- The mobile app already uses FluidAudio and whisper.rn.

## Model comparison

The English WER is the average over the Open ASR Leaderboard (OAL) English sets, as reported on each model card. In May 2026 the leaderboard dropped TED-LIUM, so averages from different snapshots differ by a few tenths. The live CSV is gated (HTTP 401), so I could not pull a single snapshot.

| Model | Params / size | Eng. WER (OAL avg) | Streaming | Languages (Indonesian?) | License |
|---|---|---|---|---|---|
| Whisper large-v3-turbo | 809M; ggml f16 1.6 GB, q5_0 547 MiB, q8_0 874 MB | ~7.7 (not re-verified) | No (needs a wrapper) | 99 (**yes**) | MIT |
| Parakeet TDT 0.6B v2 | 0.6B; sherpa int8 482 MB | 6.05 | Chunked only | en | CC-BY-4.0 |
| Parakeet TDT 0.6B v3 | 0.6B; sherpa int8 487 MB | 6.34 | Chunked only | 25 EU (no) | CC-BY-4.0 |
| Parakeet Unified EN 0.6B | 0.6B; sherpa int8 501 MB | 5.91 offline; 6.52 at 0.56 s; 7.35 at 0.24 s | **Native** | en | NVIDIA Open Model License |
| Nemotron Speech Streaming EN | 0.6B; 464 MB | 6.92 offline; 7.09 at 0.56 s | **Native**, 80 ms to 1.12 s | en | NVIDIA |
| Nemotron 3.5 ASR Streaming | 0.6B; 475 MB | FLEURS-en 7.91 at 1.12 s | **Native** | 32 locales (no) | OpenMDW-1.1 |
| Canary-1b-v2 | 978M | 7.15 (RTFx 749) | No | 25 EU (no) | CC-BY-4.0 |
| Cohere Transcribe | 2B; 1.7 GB | 5.42 (Mar 2026) | No | 14 (no) | Apache-2.0 |
| Qwen3-ASR-0.6B / 1.7B | sherpa int8 879 MB (0.6B) | LS 2.11/4.55 (0.6B), 1.63/3.38 (1.7B) | vLLM only | 30 + 22 dialects (**yes**, also ms) | Apache-2.0 |
| Moonshine Streaming Tiny/Small/Medium | tiny to medium | 12.00 / 7.84 / 6.65 | **Native** | en, es, de, ja, zh, ar, ko, vi, uk, tl (no) | MIT (streaming) |
| Kyutai STT 1B / 2.6B | 1B / 2.6B | n/a here | **Native**, 0.5 s / 2.5 s delay; MLX for Mac and iPhone | en+fr / en (no) | CC-BY-4.0 |
| Voxtral Mini 4B Realtime | 4B, BF16 | FLEURS avg 8.72 at 480 ms (en 4.90) | **Native**, 80 ms to 2.4 s | 13 (no) | Apache-2.0 |
| Omnilingual ASR CTC 300M / 1B | sherpa int8 292 / 787 MB | CER-based | No | 1600+ (**yes**) | Apache-2.0 |
| Apple SpeechAnalyzer / SpeechTranscriber | OS-managed assets | not published | Yes (async stream) | runtime `supportedLocales` (check `id`) | Free API, macOS/iOS 26+ |

Multilingual accuracy, from the [Qwen3-ASR card](https://huggingface.co/Qwen/Qwen3-ASR-1.7B), FLEURS averages: Whisper large-v3 5.27, Qwen3-ASR-0.6B 7.57, Qwen3-ASR-1.7B 4.90. So for languages other than English, **Whisper large-v3 still beats Qwen3-ASR-0.6B**, and only the 1.7B model clearly passes it.

### Speed on Apple Silicon

- **Parakeet TDT v3 (Core ML on the Neural Engine, M4 Pro):** overall RTFx about 146–156× on FLEURS, about 2.5% average WER ([FluidAudio Benchmarks](https://github.com/FluidInference/FluidAudio/blob/main/Documentation/Benchmarks.md)). That is about 0.4 s for a 60 s clip.
- **Parakeet Unified EN** streams on Core ML on M-series. The int8 encoder fails on A16 iPhones (same doc).
- **Whisper turbo** cuts the decoder from 32 layers to 4 ([card](https://huggingface.co/openai/whisper-large-v3-turbo)). whisper.cpp ships a Core ML encoder for it (`ggml-large-v3-turbo-encoder.mlmodelc.zip`, 1.17 GB). I found no first-party M-series RTF figure, so measure it in-app.
- **Distil-Whisper in whisper.cpp:** chunked long-form decoding is not implemented, so quality can be sub-optimal ([whisper.cpp models README](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md)). Distil models are also English-focused, so skip them.

## Streaming approaches

1. **Native streaming transducers.** Nemotron, Parakeet Unified streaming, zipformer, Moonshine, Kyutai and Voxtral Realtime work this way. Encoder state is cached, the model processes only new audio, partial results stay stable, and the compute cost per second is flat. This is the best option for live captions. OpenWhispr already runs sherpa `online` models through its WebSocket server.
2. **Whisper with a streaming policy.** whisper_streaming (LocalAgreement-n) re-decodes a growing buffer. Its own README says it is "becoming outdated" and replaced by **SimulStreaming** (AlignAtt), which is about 5× faster ([whisper_streaming](https://github.com/ufal/whisper_streaming), [SimulStreaming](https://github.com/ufal/SimulStreaming)). Both are Python/PyTorch, so a port to whisper.cpp would be custom work.
3. **VAD-chunked offline decoding (pseudo-streaming).** Cut audio at pauses and decode each segment with Parakeet or Whisper. This is the pragmatic choice for languages with no streaming model (Indonesian) and for final meeting notes. Expect a lag of a few seconds and no partial words.

For meetings, the realistic free pipeline is:

- live captions from route 1 (or route 3 for Indonesian), and
- a post-meeting offline pass over the full recording with the best offline model, plus the existing pyannote+CAM++ diarization.

## What most people use

Hugging Face downloads over the last 30 days, read from the HF API on 27 October 2026:

| Model | 30-day downloads |
|---|---|
| `argmaxinc/whisperkit-coreml` | 11.9M |
| `openai/whisper-large-v3-turbo` | 5.8M |
| `openai/whisper-large-v3` | 3.5M |
| `mistralai/Voxtral-Mini-4B-Realtime-2602` | 2.0M |
| `Qwen/Qwen3-ASR-1.7B` | 1.35M |
| `Qwen/Qwen3-ASR-0.6B` | 0.84M |
| `nvidia/parakeet-tdt-0.6b-v3` | 575k (plus FluidAudio Core ML 296k and ONNX 130k) |

- **Whisper is still the most used overall.**
- For Mac dictation apps, the trend is **Parakeet through FluidAudio**: VoiceInk, Spokenly, Dictate Anywhere, BoltAI and Slipbox are listed as Parakeet users in the [FluidAudio README](https://github.com/FluidInference/FluidAudio).
- The top of the leaderboard has moved to 2B-class encoder plus LLM-decoder models: Cohere Transcribe 5.42; IBM claims 5.06 for Granite Speech 5.0 2B and 4.94 for Qwen3-ASR-1.7B. These are too heavy for low-latency push-to-talk.

## Free cloud options

| Option | Free allowance | Streaming | Indonesian | Notes |
|---|---|---|---|---|
| **Groq** `whisper-large-v3-turbo` / `-v3` | 20 RPM, 2K RPD, 7,200 audio-s/hour, 28,800 audio-s/day (about 8 h/day). The page labels these "base limits", so confirm at console.groq.com. | No (batch, 216× / 189× real time) | Yes | 25 MB per file on the free tier; minimum billed length 10 s. Already in the registry. [Rate limits](https://console.groq.com/docs/rate-limits), [STT](https://console.groq.com/docs/speech-to-text) |
| **Cloudflare Workers AI** `@cf/openai/whisper-large-v3-turbo` | 10,000 Neurons/day free; 46.63 Neurons per audio-minute, so **about 214 min/day** | No (batch) | Yes | Has `vad_filter`, `initial_prompt` and `language` parameters. [Model](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/), [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| **Workers AI** `@cf/deepgram/nova-3` | 472.73 Neurons/min over HTTP (about 21 min/day); 836.36 over WebSocket (about **12 min/day**) | Yes (WebSocket) | per Deepgram | [Model](https://developers.cloudflare.com/workers-ai/models/nova-3/) |
| **Workers AI** `@cf/deepgram/flux` | 700 Neurons/min, about 14 min/day | Yes (WebSocket, end-of-turn detection) | English | Built for voice agents. [Model](https://developers.cloudflare.com/workers-ai/models/flux/) |

Paid Workers AI is $0.011 per 1,000 Neurons, which works out to about $0.0005/min for Whisper turbo.

## Recommendations for OpenWhispr

**Defaults**

- **Dictation (Mac):**
  - Keep `orukeet-v0.1.0` / `parakeet-tdt-0.6b-v3` for English and EU languages: fastest on Apple Silicon and around 6% English WER.
  - Make Whisper **turbo q5_0** the multilingual fallback, and use it automatically when `language` is outside Parakeet's `supportedLanguages`, for example `id`.
  - Move the Whisper `recommended` flag from `base` to `turbo` (q5_0).
- **Live meetings:**
  - English: `nemotron-speech-streaming-en-0.6b`, or the new `parakeet-unified-en` streaming entry below.
  - Supported non-English languages: `nemotron-3.5-asr-streaming-0.6b`.
  - Indonesian or code-switched speech: VAD-chunked `turbo-q5_0`.
  - In every case, re-transcribe the full meeting with turbo or Parakeet after the meeting, then diarize.
- **iPhone:**
  - FluidAudio Parakeet (Neural Engine) for English and EU languages, and whisper.rn turbo q5_0 for Indonesian. Both are already in openwhispr-mobile.
  - Apple `SpeechTranscriber` (iOS/macOS 26) works without a model download. Check `supportedLocales` for `id-ID` at runtime; I did not verify it here. On the Mac it would need a Swift helper from Electron.

**Registry additions that are drop-in.** These use formats the app already loads.

| Proposed id | URL | Why |
|---|---|---|
| `turbo-q5_0` (whisper) | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin` (547 MiB, sha1 `e050f7970618a659205450ad97eb95a18d69c9ee`) | About a third of the f16 size; Indonesian support; best multilingual choice per MB |
| `turbo-q8_0` (whisper) | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q8_0.bin` (874 MB) | Closer to f16 quality |
| `parakeet-unified-en-0.6b-streaming` (`runtime: online`) | `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-unified-en-0.6b-int8-streaming-560ms.tar.bz2` (501 MB; 240 ms and 1120 ms variants also exist) | WER 6.52 at 0.56 s, against Nemotron EN's 7.09. Check that the online loader accepts its file layout. |
| `parakeet-tdt-0.6b-v2` | `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2` (482 MB) | English-only users: 6.05 vs 6.34 for v3 |
| `parakeet-tdt-110m-en` | `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet_tdt_transducer_110m-en-36000-int8.tar.bz2` (108 MB) | Small English model for low-RAM Macs |

**Worth adding, but they need a new model-type branch** in `parakeetModelInfo.js` and the sherpa recognizer config:

- **Qwen3-ASR-0.6B**, Apache-2.0, supports Indonesian and Malay: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-qwen3-asr-0.6B-int8-2026-03-25.tar.bz2` (879 MB). This is the only non-Whisper local option that covers Indonesian with punctuation. Benchmark it against turbo on Indonesian audio first, because its FLEURS multilingual average (7.57) is worse than Whisper large-v3 (5.27).
- **Omnilingual 300M CTC v2**: `.../sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-v2-int8-2026-02-05.tar.bz2` (292 MB). Long-tail language coverage only; it is a CTC model, so expect weaker formatting.

**Skip for now**

- Voxtral Realtime: 4B BF16, too heavy for push-to-talk, and no Indonesian.
- Kyutai: English and French only.
- Moonshine: no Indonesian; its streaming models are not in sherpa releases.
- Canary-1b-v2: no sherpa build. Parakeet covers the same languages faster.
- Distil-Whisper.

## Open questions

- I did not verify Indonesian WER for Whisper turbo against Qwen3-ASR-0.6B. Run both on a FLEURS `id_id` sample plus real meeting audio.
- I did not check whether `SpeechTranscriber` supports `id-ID`.
- I could not read the live OAL snapshot (the CSV is gated). The OAL figures above come from the model cards.

## Sources

- Model cards:
  - [parakeet-tdt-0.6b-v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3)
  - [v2](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2)
  - [parakeet-unified-en](https://huggingface.co/nvidia/parakeet-unified-en-0.6b)
  - [nemotron-3.5-asr-streaming](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b)
  - [canary-1b-v2](https://huggingface.co/nvidia/canary-1b-v2)
  - [whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo)
  - [Qwen3-ASR](https://huggingface.co/Qwen/Qwen3-ASR-1.7B)
  - [Voxtral-Mini-4B-Realtime](https://huggingface.co/mistralai/Voxtral-Mini-4B-Realtime-2602)
  - [Voxtral-Mini-3B](https://huggingface.co/mistralai/Voxtral-Mini-3B-2507)
  - [Kyutai DSM](https://github.com/kyutai-labs/delayed-streams-modeling)
  - [Omnilingual ASR](https://github.com/facebookresearch/omnilingual-asr)
- [Moonshine README](https://github.com/moonshine-ai/moonshine) and its [accuracy page](https://moonshine-voice.readthedocs.io/en/latest/models/accuracy/)
- [sherpa-onnx asr-models release](https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models), read through the GitHub API on 27 October 2026
- [whisper.cpp models](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md) and the [HF ggml repo](https://huggingface.co/ggerganov/whisper.cpp/tree/main)
- [WhisperKit / Argmax OSS](https://github.com/argmaxinc/WhisperKit) and [FluidAudio](https://github.com/FluidInference/FluidAudio)
- Apple docs: [SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer), [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber), [DictationTranscriber](https://developer.apple.com/documentation/speech/dictationtranscriber)
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) (changelog: TED-LIUM removed on 20 May 2026)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [Groq docs](https://console.groq.com/docs/rate-limits)
