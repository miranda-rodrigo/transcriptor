import { useEffect, useMemo, useState } from "react";
import { BookMarked, Plus, Star, Trash2, Wand2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import type { DictionaryEntry, Snippet } from "../types/electron";

const STYLE_OPTIONS = [
  {
    id: "auto",
    label: "Follow the app",
    sample: "Tone shifts with Slack, Mail, Cursor…",
  },
  {
    id: "formal",
    label: "Formal",
    sample: "Could you review the timeline by Thursday?",
  },
  {
    id: "casual",
    label: "Casual",
    sample: "Can you check the timeline by Thursday?",
  },
  {
    id: "very-casual",
    label: "Very casual",
    sample: "mind checking the timeline thursday?",
  },
  {
    id: "code",
    label: "Code",
    sample: "Rename getUser to fetchProfile in auth.ts",
  },
] as const;

const APP_STYLE_ROWS = [
  { id: "messages", label: "Chat", hint: "Slack, iMessage, WhatsApp" },
  { id: "email", label: "Mail", hint: "Mail, Outlook, Superhuman" },
  { id: "code", label: "Code", hint: "Cursor, Terminal, Xcode" },
  { id: "work", label: "Docs", hint: "Notion, Linear, Figma" },
] as const;

type StyleId = (typeof STYLE_OPTIONS)[number]["id"];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function PersonalizationPage() {
  const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [word, setWord] = useState("");
  const [replacement, setReplacement] = useState("");
  const [cue, setCue] = useState("");
  const [expansion, setExpansion] = useState("");
  const [writingStyle, setWritingStyle] = useState<StyleId>(
    () => (localStorage.getItem("writingStyle") as StyleId) || "auto"
  );
  const [appStyles, setAppStyles] = useState<Record<string, StyleId>>(() =>
    readJson("appWritingStyles", {})
  );
  const [query, setQuery] = useState("");

  const loadLists = async () => {
    const [nextDictionary, nextSnippets] = await Promise.all([
      window.electronAPI.getDictionary?.() ?? [],
      window.electronAPI.getSnippets?.() ?? [],
    ]);
    setDictionary(nextDictionary || []);
    setSnippets(nextSnippets || []);
  };

  useEffect(() => {
    void loadLists();
  }, []);

  const filteredDictionary = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return dictionary;
    return dictionary.filter(
      (entry) =>
        entry.word.toLowerCase().includes(needle) ||
        entry.replacement.toLowerCase().includes(needle)
    );
  }, [dictionary, query]);

  const persistStyle = (next: StyleId) => {
    setWritingStyle(next);
    localStorage.setItem("writingStyle", next);
    window.dispatchEvent(new Event("openwhispr-localstorage-updated"));
  };

  const persistAppStyle = (category: string, next: StyleId) => {
    const updated = { ...appStyles, [category]: next };
    setAppStyles(updated);
    localStorage.setItem("appWritingStyles", JSON.stringify(updated));
    window.dispatchEvent(new Event("openwhispr-localstorage-updated"));
  };

  const addDictionaryEntry = async () => {
    if (!word.trim() || !replacement.trim()) return;
    await window.electronAPI.saveDictionaryEntry?.({
      word: word.trim(),
      replacement: replacement.trim(),
    });
    setWord("");
    setReplacement("");
    await loadLists();
  };

  const addSnippet = async () => {
    if (!cue.trim() || !expansion.trim()) return;
    await window.electronAPI.saveSnippet?.({ cue: cue.trim(), expansion });
    setCue("");
    setExpansion("");
    await loadLists();
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Voice memory</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Sound like you. Land in the right app.
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Whisper already hears the words. This layer tells it how to spell your people, what to
          expand, and which tone to use in Slack versus Mail.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h4 className="flex items-center gap-2 text-base font-medium text-foreground">
              <BookMarked className="h-4 w-4 text-accent" />
              Dictionary
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Names and jargon are injected into Whisper before it transcribes, not cleaned up after.
            </p>
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="max-w-[180px]"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={word}
            onChange={(event) => setWord(event.target.value)}
            placeholder="What Whisper hears"
          />
          <Input
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            placeholder="How it should be spelled"
            onKeyDown={(event) => {
              if (event.key === "Enter") void addDictionaryEntry();
            }}
          />
          <Button onClick={() => void addDictionaryEntry()} disabled={!word.trim() || !replacement.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {filteredDictionary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add client names, product terms, or the spelling Whisper keeps missing.
            </p>
          ) : (
            filteredDictionary.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
              >
                <span className="text-muted-foreground">{entry.word}</span>
                <span className="text-muted-foreground/50">→</span>
                <span className="font-medium text-foreground">{entry.replacement}</span>
                <button
                  className="text-muted-foreground transition hover:text-accent"
                  onClick={() =>
                    void window.electronAPI
                      .saveDictionaryEntry?.({ ...entry, starred: !entry.starred })
                      .then(loadLists)
                  }
                  title="Prioritize this spelling"
                >
                  <Star
                    className="h-3.5 w-3.5"
                    fill={entry.starred ? "currentColor" : "none"}
                  />
                </button>
                <button
                  className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  onClick={() =>
                    void window.electronAPI.deleteDictionaryEntry?.(entry.id).then(loadLists)
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h4 className="flex items-center gap-2 text-base font-medium text-foreground">
            <Wand2 className="h-4 w-4 text-accent" />
            Spoken shortcuts
          </h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Say the cue. OpenWhispr pastes the full block — links, bios, replies.
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
          <Input
            value={cue}
            onChange={(event) => setCue(event.target.value)}
            placeholder='Cue, e.g. "my calendar"'
          />
          <Textarea
            value={expansion}
            onChange={(event) => setExpansion(event.target.value)}
            placeholder="Expansion"
            className="min-h-[88px]"
          />
          <div className="flex justify-end">
            <Button onClick={() => void addSnippet()} disabled={!cue.trim() || !expansion.trim()}>
              Save shortcut
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-secondary/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">“{snippet.cue}”</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{snippet.expansion}</p>
              </div>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void window.electronAPI.deleteSnippet?.(snippet.id).then(loadLists)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h4 className="text-base font-medium text-foreground">Tone</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            The reasoner already cleans speech. Tone tells it who you are in that app.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {STYLE_OPTIONS.map((option) => {
            const selected = writingStyle === option.id;
            return (
              <button
                key={option.id}
                onClick={() => persistStyle(option.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-muted-foreground/40"
                }`}
              >
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{option.sample}</p>
              </button>
            );
          })}
        </div>

        {writingStyle === "auto" && (
          <div className="overflow-hidden rounded-2xl border border-border">
            {APP_STYLE_ROWS.map((row, index) => (
              <div
                key={row.id}
                className={`flex items-center justify-between gap-4 px-4 py-3 ${
                  index !== 0 ? "border-t border-border" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
                <select
                  value={appStyles[row.id] || (row.id === "messages" ? "casual" : row.id === "code" ? "code" : "formal")}
                  onChange={(event) => persistAppStyle(row.id, event.target.value as StyleId)}
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  {STYLE_OPTIONS.filter((option) => option.id !== "auto").map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
