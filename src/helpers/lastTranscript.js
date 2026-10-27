// "Paste last transcript" / "Copy last transcript" hotkeys (Settings → Hotkeys).
// The source of truth is the newest row in the transcriptions table: its
// cleaned `text` over `raw_text`.

function getLastTranscriptText(databaseManager) {
  const row = databaseManager?.getTranscriptions?.(1)?.[0];
  const text = (row?.text || row?.raw_text || "").trim();
  return text || null;
}

// `paste` is the dictation paste path, `copy` the clipboard only, and
// `notifyEmpty` the toast shown when there is no transcript yet.
async function runLastTranscriptHotkey({ databaseManager, copyOnly, paste, copy, notifyEmpty }) {
  const text = getLastTranscriptText(databaseManager);
  if (!text) {
    notifyEmpty();
    return false;
  }
  if (copyOnly) copy(text);
  else await paste(text);
  return true;
}

module.exports = { getLastTranscriptText, runLastTranscriptHotkey };
