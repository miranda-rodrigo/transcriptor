const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  applyDictionary,
  buildVocabularyPrompt,
  categorizeApp,
  collapseRepeatedWords,
  countWords,
  expandSnippets,
  getDestinationTheme,
  processDictation,
  resolveWritingStyle,
  stripFillers,
  isRewriteInstruction,
  suggestDictionaryEntries,
} = require("./flowEngine");

describe("flowEngine", () => {
  it("only strips obvious fillers as an offline fallback", () => {
    assert.equal(stripFillers("um hello uh there").replace(/\s+/g, " ").trim(), "hello there");
    assert.equal(stripFillers("the hum of the engine").includes("hum"), true);
  });

  it("collapses repeated words", () => {
    assert.equal(collapseRepeatedWords("the the launch"), "the launch");
  });

  it("turns spoken layout commands into real line breaks", () => {
    const result = processDictation("hello new line world");
    assert.equal(result, "hello\nworld");
  });

  it("replaces dictionary terms as whole words, longest first", () => {
    const result = applyDictionary("open whispr and openwhispr", [
      { word: "open whispr", replacement: "OpenWhispr" },
      { word: "openwhispr", replacement: "OpenWhispr" },
    ]);
    assert.equal(result, "OpenWhispr and OpenWhispr");
  });

  it("expands spoken snippet cues", () => {
    const result = expandSnippets("send my calendar please", [
      { cue: "my calendar", expansion: "https://cal.com/ada" },
    ]);
    assert.equal(result, "send https://cal.com/ada please");
  });

  it("categorizes apps and resolves destination style", () => {
    assert.equal(categorizeApp("Slack"), "messages");
    assert.equal(categorizeApp("Mail"), "email");
    assert.equal(categorizeApp("Cursor"), "code");
    assert.equal(resolveWritingStyle("auto", "Slack"), "casual");
    assert.equal(resolveWritingStyle("formal", "Slack"), "formal");
    assert.equal(getDestinationTheme("Slack").accent, "#fbbf24");
  });

  it("applies names and snippets without pretending to rewrite the sentence", () => {
    const result = processDictation("tell Cheyene my calendar", {
      dictionary: [{ word: "Cheyene", replacement: "Cheyenne" }],
      snippets: [{ cue: "my calendar", expansion: "https://cal.com/ada" }],
    });
    assert.equal(result, "tell Cheyenne https://cal.com/ada");
  });

  it("counts words and builds a whisper vocabulary prompt", () => {
    assert.equal(countWords("one two three"), 3);
    assert.equal(
      buildVocabularyPrompt([{ word: "cheyene", replacement: "Cheyenne" }]),
      "Cheyenne"
    );
  });

  it("detects rewrite instructions and close spelling corrections", () => {
    assert.equal(isRewriteInstruction("make this shorter"), true);
    assert.equal(isRewriteInstruction("hello team"), false);
    assert.equal(isRewriteInstruction("hey Jarvis, rewrite this", "Jarvis"), true);
    const suggestions = suggestDictionaryEntries("tell Cheyene hello", "tell Cheyenne hello");
    assert.deepEqual(suggestions, [{ word: "Cheyene", replacement: "Cheyenne" }]);
  });
});
