/**
 * Personalization layer that Whisper/LLM cleanup cannot infer:
 * - dictionary terms for names/jargon (fed into Whisper as initial prompt)
 * - spoken snippets that expand into URLs/templates
 * - destination app + writing style for the reasoner
 * - structural voice commands ("new paragraph")
 *
 * Filler removal and self-corrections stay with the reasoning model.
 * Local um/uh stripping is only an offline fallback when no LLM is available.
 */

const FILLER_PATTERN =
  /(?<=^|[\s,;:—-])(?:um+|uh+|er+|ah+|hmm+)(?=[\s,;.!?—-]|$)/gi;

const VOICE_COMMANDS = [
  { pattern: /\bnew\s+paragraph\b/gi, replacement: "\n\n" },
  { pattern: /\bnew\s+line\b/gi, replacement: "\n" },
];

const STYLE_INSTRUCTIONS = {
  auto: "Match the tone of the destination: casual for chat, formal for email, precise for code.",
  formal: "Write in complete, professional sentences suitable for work email or documents.",
  casual: "Write like a friendly chat message. Contractions are fine. Keep it concise.",
  "very-casual": "Keep it informal and short. Light punctuation. Do not over-polish.",
  code: "Preserve identifiers, file names, punctuation, and technical terms. Do not rewrite into prose.",
};

const APP_CATEGORIES = [
  { category: "messages", match: /slack|discord|whatsapp|messages|telegram|signal|imessage|teams/i },
  { category: "email", match: /mail|gmail|outlook|spark|superhuman/i },
  { category: "code", match: /code|cursor|terminal|iterm|warp|vscode|xcode|intellij|zed|ghostty/i },
  { category: "work", match: /notion|docs|linear|jira|confluence|figma|obsidian/i },
];

const DESTINATION_THEMES = {
  messages: { label: "Chat", accent: "#fbbf24" },
  email: { label: "Mail", accent: "#60a5fa" },
  code: { label: "Code", accent: "#4ade80" },
  work: { label: "Docs", accent: "#a78bfa" },
  other: { label: "Anywhere", accent: "#e5e5e5" },
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(text) {
  if (!text || typeof text !== "string") return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/([.!?])\s+([A-Z])/g, "$1 $2")
    .replace(/^\s+|\s+$/g, "");
}

function collapseRepeatedWords(text) {
  return String(text || "").replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1");
}

function stripFillers(text) {
  return String(text || "").replace(FILLER_PATTERN, " ");
}

function applyVoiceCommands(text) {
  let result = String(text || "");
  for (const command of VOICE_COMMANDS) {
    result = result.replace(command.pattern, command.replacement);
  }
  return result;
}

function sortDictionary(entries) {
  return [...(entries || [])]
    .filter((entry) => entry && entry.word && entry.replacement)
    .sort((a, b) => {
      const starDiff = Number(Boolean(b.starred)) - Number(Boolean(a.starred));
      if (starDiff !== 0) return starDiff;
      return String(b.word).length - String(a.word).length;
    });
}

function applyDictionary(text, entries) {
  let result = String(text || "");
  for (const entry of sortDictionary(entries)) {
    const word = String(entry.word).trim();
    const replacement = String(entry.replacement);
    if (!word) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    result = result.replace(pattern, replacement);
  }
  return result;
}

function expandSnippets(text, snippets) {
  let result = String(text || "");
  const sorted = [...(snippets || [])]
    .filter((snippet) => snippet && snippet.cue && snippet.expansion != null)
    .sort((a, b) => String(b.cue).length - String(a.cue).length);

  for (const snippet of sorted) {
    const cue = String(snippet.cue).trim();
    if (!cue) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(cue)}\\b`, "gi");
    result = result.replace(pattern, String(snippet.expansion));
  }
  return result;
}

function buildVocabularyPrompt(dictionary, limit = 40) {
  const terms = sortDictionary(dictionary)
    .slice(0, limit)
    .map((entry) => String(entry.replacement || entry.word).trim())
    .filter(Boolean);

  if (terms.length === 0) return "";
  return terms.join(", ");
}

function categorizeApp(appName) {
  if (!appName) return "other";
  const found = APP_CATEGORIES.find((item) => item.match.test(appName));
  return found ? found.category : "other";
}

function getDestinationTheme(appName) {
  const category = categorizeApp(appName);
  return { category, ...(DESTINATION_THEMES[category] || DESTINATION_THEMES.other) };
}

function resolveWritingStyle(style, activeApp, appStyles = {}) {
  if (style && style !== "auto") return style;
  const category = categorizeApp(activeApp);
  if (appStyles[category]) return appStyles[category];
  if (category === "messages") return "casual";
  if (category === "email" || category === "work") return "formal";
  if (category === "code") return "code";
  return "auto";
}

function buildFlowPromptContext({
  dictionary = [],
  snippets = [],
  style = "auto",
  activeApp = null,
  appStyles = {},
} = {}) {
  const resolvedStyle = resolveWritingStyle(style, activeApp, appStyles);
  const parts = [];

  parts.push(STYLE_INSTRUCTIONS[resolvedStyle] || STYLE_INSTRUCTIONS.auto);

  if (activeApp) {
    parts.push(`The user is currently dictating into: ${activeApp}.`);
  }

  const vocab = sortDictionary(dictionary)
    .slice(0, 40)
    .map((entry) => `${entry.word} → ${entry.replacement}`);
  if (vocab.length > 0) {
    parts.push(`Spell these terms exactly:\n${vocab.join("\n")}`);
  }

  const snippetHints = [...(snippets || [])]
    .filter((snippet) => snippet?.cue)
    .slice(0, 20)
    .map((snippet) => `"${snippet.cue}" → ${snippet.expansion}`);
  if (snippetHints.length > 0) {
    parts.push(`If a spoken cue matches a snippet, expand it:\n${snippetHints.join("\n")}`);
  }

  return parts.join("\n\n");
}

const STOP_WORDS = new Set(
  "a an the and or but to of in on for with at by from as is was are were be this that it um uh like just so if".split(
    " "
  )
);

const REWRITE_PATTERN =
  /\b(make this|rewrite|rephrase|shorten|summarize|more professional|more casual|more formal|fix this|edit this|translate this|convert this|improve this|bullet(?:\s+point)?s?|turn this)\b/i;

function tokenizeWords(text) {
  return String(text || "")
    .replace(/[^\p{L}\p{N}'’-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(left, right) {
  const a = String(left);
  const b = String(right);
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[a.length][b.length];
}

function isRewriteInstruction(text, agentName = null) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (agentName && value.toLowerCase().includes(String(agentName).toLowerCase())) return true;
  return REWRITE_PATTERN.test(value);
}

function buildRewritePrompt(selectedText, instruction) {
  return `The user highlighted this text:\n"""\n${selectedText}\n"""\n\nSpoken instruction:\n${instruction}\n\nReturn ONLY the replacement text. Do not wrap it in quotes. Keep the original language unless asked to translate.`;
}

function suggestDictionaryEntries(rawText, finalText, existing = [], limit = 3) {
  const rawWords = tokenizeWords(rawText);
  const finalWords = tokenizeWords(finalText);
  const known = new Set(
    (existing || []).flatMap((entry) => [
      String(entry.word || "").toLowerCase(),
      String(entry.replacement || "").toLowerCase(),
    ])
  );
  const seen = new Set();
  const suggestions = [];

  for (const finalWord of finalWords) {
    const finalLower = finalWord.toLowerCase();
    if (finalWord.length < 3 || STOP_WORDS.has(finalLower) || known.has(finalLower)) continue;

    let best = null;
    let bestDist = Infinity;
    for (const rawWord of rawWords) {
      const rawLower = rawWord.toLowerCase();
      if (rawLower === finalLower) {
        best = null;
        bestDist = 0;
        break;
      }
      if (STOP_WORDS.has(rawLower) || rawWord.length < 3) continue;
      const dist = levenshtein(rawLower, finalLower);
      const allowed = Math.max(1, Math.floor(Math.max(rawWord.length, finalWord.length) * 0.4));
      if (dist > 0 && dist <= allowed && dist < bestDist) {
        best = rawWord;
        bestDist = dist;
      }
    }

    if (!best || bestDist === 0) continue;
    const key = best.toLowerCase();
    if (seen.has(key) || known.has(key)) continue;
    seen.add(key);
    suggestions.push({ word: best, replacement: finalWord });
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

function processDictation(
  text,
  { dictionary = [], snippets = [], localPolish = false, didReason = false } = {}
) {
  let result = String(text || "").trim();
  if (!result) return "";

  result = applyVoiceCommands(result);
  result = applyDictionary(result, dictionary);
  result = expandSnippets(result, snippets);

  if (localPolish && !didReason) {
    result = stripFillers(result);
    result = collapseRepeatedWords(result);
  }

  result = normalizeWhitespace(result);
  return result;
}

export {
  DESTINATION_THEMES,
  FILLER_PATTERN,
  STYLE_INSTRUCTIONS,
  applyDictionary,
  applyVoiceCommands,
  buildFlowPromptContext,
  buildRewritePrompt,
  buildVocabularyPrompt,
  categorizeApp,
  collapseRepeatedWords,
  countWords,
  expandSnippets,
  getDestinationTheme,
  isRewriteInstruction,
  normalizeWhitespace,
  processDictation,
  resolveWritingStyle,
  stripFillers,
  suggestDictionaryEntries,
};
