const test = require("node:test");
const assert = require("node:assert/strict");

const { runLastTranscriptHotkey } = require("../../src/helpers/lastTranscript");

function run(rows, { copyOnly = false } = {}) {
  const calls = { paste: [], copy: [], notifyEmpty: 0, limits: [] };
  const databaseManager = {
    getTranscriptions: (limit) => {
      calls.limits.push(limit);
      return rows;
    },
  };
  const result = runLastTranscriptHotkey({
    databaseManager,
    copyOnly,
    paste: async (text) => calls.paste.push(text),
    copy: (text) => calls.copy.push(text),
    notifyEmpty: () => (calls.notifyEmpty += 1),
  });
  return result.then((handled) => ({ handled, calls }));
}

test("pastes the newest cleaned text", async () => {
  const { handled, calls } = await run([{ text: "Hello world.", raw_text: "hello world" }]);
  assert.equal(handled, true);
  assert.deepEqual(calls.limits, [1]);
  assert.deepEqual(calls.paste, ["Hello world."]);
  assert.deepEqual(calls.copy, []);
  assert.equal(calls.notifyEmpty, 0);
});

test("falls back to the raw text when there is no cleaned text", async () => {
  const { calls } = await run([{ text: "", raw_text: "raw words" }]);
  assert.deepEqual(calls.paste, ["raw words"]);
});

test("copy-only puts the text on the clipboard without pasting", async () => {
  const { calls } = await run([{ text: "Hello world." }], { copyOnly: true });
  assert.deepEqual(calls.copy, ["Hello world."]);
  assert.deepEqual(calls.paste, []);
});

test("notifies and does nothing when there is no transcript", async () => {
  for (const rows of [[], [{ text: "  ", raw_text: null }]]) {
    const { handled, calls } = await run(rows);
    assert.equal(handled, false);
    assert.equal(calls.notifyEmpty, 1);
    assert.deepEqual(calls.paste, []);
    assert.deepEqual(calls.copy, []);
  }
});
