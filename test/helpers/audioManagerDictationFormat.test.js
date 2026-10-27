const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererServer, installBrowserGlobals } = require("../lib/rendererTestHarness");

const RAW = "hey Sarah are you around this evening";
const CLEANED = "Hey Sarah, are you around this evening?";

// Tone & Style's per-app format: `raw` skips cleanup, `casual` extends the
// cleanup prompt, `lowercase` post-processes, `ai` changes nothing.
test("dictation cleanup honors the format picked for the app it was captured in", async (t) => {
  const { window } = installBrowserGlobals(t, { window: { dispatchEvent() {} } });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  t.after(() => delete navigator.onLine);
  const vite = await createRendererServer(t, {
    cachePrefix: "openwhispr-audio-dictation-format-",
    mockModules: {
      "/utils/logger":
        "export default { debug() {}, info() {}, warn() {}, error() {}, logReasoning() {} };",
    },
  });
  const AudioManager = (await vite.ssrLoadModule("/helpers/audioManager.js")).default;
  const service = (await vite.ssrLoadModule("/services/ReasoningService.ts")).default;
  t.after(() => service.destroy());
  const prompts = await vite.ssrLoadModule("/config/prompts.ts");
  const { useSettingsStore } = await vite.ssrLoadModule("/stores/settingsStore.ts");
  const { usePolicyStore } = await vite.ssrLoadModule("/stores/policyStore.ts");
  usePolicyStore.setState({ status: "unmanaged", policy: null });
  useSettingsStore.setState({
    isSignedIn: true,
    useCleanupModel: true,
    cleanupMode: "openwhispr",
    cleanupCloudMode: "openwhispr",
    useDictationAgent: false,
    customPrompts: { cleanup: "" },
    preferredLanguage: "en",
    dataRetentionEnabled: true,
    toneStyleEnabled: true,
    toneStyles: { personal: "casual", work: "casual", email: "formal", other: "formal" },
    toneFormats: { personal: "raw", work: "casual", email: "lowercase", other: "ai" },
  });
  window.electronAPI.cloudTranscribe = async () => ({ success: true, text: RAW });
  let capturedCategory;
  window.electronAPI.captureDictationAppCategory = async () => capturedCategory;
  const reasonRequests = [];
  window.electronAPI.cloudReason = async (_text, options) => {
    reasonRequests.push(options);
    return { success: true, text: CLEANED };
  };
  const createManager = () =>
    Object.assign(Object.create(AudioManager.prototype), {
      voiceAgentRequested: false,
      translationRequested: false,
      pendingCleanupFailure: null,
      getEffectiveSttLanguage: () => "en",
      getWhisperPrompt: () => null,
      isDictionaryEcho: () => false,
      isReasoningAvailable: async () => true,
      finalizeChineseScript: async (text) => text,
    });
  const dictate = async (category) => {
    capturedCategory = category;
    const manager = createManager();
    manager.beginToneStyleCapture();
    return (await manager.processWithOpenWhisprCloud(new Blob(["synthetic audio"]))).text;
  };

  await t.test("ai cleans up as before and names no format", async () => {
    assert.equal(await dictate("other"), CLEANED);
    assert.equal(reasonRequests.length, 1);
    assert.equal("format" in reasonRequests[0], false);
  });

  await t.test("raw skips cleanup and keeps the transcript", async () => {
    assert.equal(await dictate("personal"), RAW);
    assert.equal(reasonRequests.length, 1);
  });

  await t.test("lowercase lowercases the cleaned-up text", async () => {
    assert.equal(await dictate("email"), CLEANED.toLowerCase());
    assert.equal(reasonRequests.length, 2);
  });

  await t.test("casual reaches local and BYOK cleanup through the prompt", async () => {
    capturedCategory = "work";
    const manager = createManager();
    manager.beginToneStyleCapture();
    const toneStyle = await manager.consumeToneStyle();
    assert.deepEqual(toneStyle, { appCategory: "work", tone: "casual", format: "casual" });
    const prompt = prompts.getCleanupSystemPrompt(null, [], "en", "en", toneStyle);
    assert.match(prompt, /Format it casually: capitalize only proper nouns and the word "I"/);
    assert.doesNotMatch(
      prompts.getCleanupSystemPrompt(null, [], "en", "en", { appCategory: "work", tone: "casual" }),
      /Format it casually/
    );
  });

  await t.test("raw mints no combined cleanup", async () => {
    const manager = Object.assign(createManager(), {
      sttConfig: { orukeetPipeline: "gemma12" },
      getCleanupLanguage: () => "en",
    });
    useSettingsStore.setState({ useLocalWhisper: false, cloudTranscriptionMode: "openwhispr" });
    const settings = useSettingsStore.getState();
    assert.equal(
      manager.getPipelineCleanupOptions(settings, { appCategory: "personal" }),
      undefined
    );
    assert.equal(
      manager.getPipelineCleanupOptions(settings, { appCategory: "email" }).tone,
      "formal"
    );
  });
});
