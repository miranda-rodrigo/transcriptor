// DatabaseManager - SQLite when better-sqlite3 is available, otherwise in-memory
let Database;
try {
  Database = require("better-sqlite3");
} catch (e) {
  console.warn("⚠️ better-sqlite3 not available - using in-memory storage (no persistence)");
  Database = null;
}

const path = require("path");
const fs = require("fs");
const { app } = require("electron");
const { countWords } = require("../utils/flowEngine");

class DatabaseManager {
  constructor() {
    this.db = null;
    this.memoryStore = [];
    this.memoryDictionary = [];
    this.memorySnippets = [];
    this.nextId = 1;
    this.nextDictionaryId = 1;
    this.nextSnippetId = 1;
    this.initDatabase();
  }

  getDbPath() {
    const dbFileName =
      process.env.NODE_ENV === "development" ? "transcriptions-dev.db" : "transcriptions.db";
    return path.join(app.getPath("userData"), dbFileName);
  }

  initDatabase() {
    if (!Database) {
      console.log("📝 Using in-memory storage for transcriptions");
      return true;
    }

    try {
      this.db = new Database(this.getDbPath());
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transcriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS dictionary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          replacement TEXT NOT NULL,
          starred INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS snippets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cue TEXT NOT NULL,
          expansion TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.ensureColumn("transcriptions", "word_count", "INTEGER DEFAULT 0");
      this.db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_dictionary_word ON dictionary(word COLLATE NOCASE);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_cue ON snippets(cue COLLATE NOCASE);
      `);
      return true;
    } catch (error) {
      console.error("Database initialization failed:", error.message);
      console.log("📝 Falling back to in-memory storage");
      this.db = null;
      return true;
    }
  }

  ensureColumn(table, column, definition) {
    if (!this.db) return;
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all();
    if (columns.some((item) => item.name === column)) return;
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  saveTranscription(text) {
    try {
      const wordCount = countWords(text);
      if (this.db) {
        const stmt = this.db.prepare("INSERT INTO transcriptions (text, word_count) VALUES (?, ?)");
        const result = stmt.run(text, wordCount);
        const fetchStmt = this.db.prepare("SELECT * FROM transcriptions WHERE id = ?");
        const transcription = fetchStmt.get(result.lastInsertRowid);
        return { id: result.lastInsertRowid, success: true, transcription };
      }

      const transcription = {
        id: this.nextId++,
        text,
        word_count: wordCount,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      this.memoryStore.unshift(transcription);
      return { id: transcription.id, success: true, transcription };
    } catch (error) {
      console.error("Error saving transcription:", error.message);
      throw error;
    }
  }

  getTranscriptions(limit = 50) {
    try {
      if (this.db) {
        const stmt = this.db.prepare("SELECT * FROM transcriptions ORDER BY timestamp DESC LIMIT ?");
        return stmt.all(limit);
      }
      return this.memoryStore.slice(0, limit);
    } catch (error) {
      console.error("Error getting transcriptions:", error.message);
      throw error;
    }
  }

  getDictationStats() {
    const rows = this.db
      ? this.db.prepare("SELECT text, word_count, timestamp, created_at FROM transcriptions").all()
      : this.memoryStore;

    const toLocalDay = (value) => {
      const date = new Date(String(value || "").endsWith("Z") ? value : `${value}Z`);
      if (Number.isNaN(date.getTime())) return null;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const today = toLocalDay(new Date().toISOString());
    let totalWords = 0;
    let wordsToday = 0;
    const days = new Set();

    for (const row of rows) {
      const words = Number(row.word_count) || countWords(row.text);
      totalWords += words;
      const day = toLocalDay(row.timestamp || row.created_at);
      if (day) days.add(day);
      if (day === today) wordsToday += words;
    }

    let streakDays = 0;
    if (days.size > 0) {
      const cursor = new Date();
      const hasToday = days.has(today);
      if (!hasToday) cursor.setDate(cursor.getDate() - 1);
      while (true) {
        const key = toLocalDay(cursor.toISOString());
        if (!days.has(key)) break;
        streakDays += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    return {
      transcriptionCount: rows.length,
      totalWords,
      wordsToday,
      streakDays,
    };
  }

  clearTranscriptions() {
    try {
      if (this.db) {
        const stmt = this.db.prepare("DELETE FROM transcriptions");
        const result = stmt.run();
        return { cleared: result.changes, success: true };
      }
      const cleared = this.memoryStore.length;
      this.memoryStore = [];
      return { cleared, success: true };
    } catch (error) {
      console.error("Error clearing transcriptions:", error.message);
      throw error;
    }
  }

  deleteTranscription(id) {
    try {
      if (this.db) {
        const stmt = this.db.prepare("DELETE FROM transcriptions WHERE id = ?");
        const result = stmt.run(id);
        console.log(`🗑️ Deleted transcription ${id}, affected rows: ${result.changes}`);
        return { success: result.changes > 0, id };
      }
      const index = this.memoryStore.findIndex((t) => t.id === id);
      if (index !== -1) {
        this.memoryStore.splice(index, 1);
        return { success: true, id };
      }
      return { success: false, id };
    } catch (error) {
      console.error("❌ Error deleting transcription:", error);
      throw error;
    }
  }

  getDictionary() {
    if (this.db) {
      return this.db
        .prepare("SELECT * FROM dictionary ORDER BY starred DESC, length(word) DESC, word COLLATE NOCASE")
        .all();
    }
    return [...this.memoryDictionary].sort((a, b) => Number(b.starred) - Number(a.starred));
  }

  saveDictionaryEntry({ id, word, replacement, starred = false }) {
    const normalizedWord = String(word || "").trim();
    const normalizedReplacement = String(replacement || "").trim();
    if (!normalizedWord || !normalizedReplacement) {
      throw new Error("Dictionary word and replacement are required");
    }

    if (this.db) {
      const existing = id
        ? this.db.prepare("SELECT * FROM dictionary WHERE id = ?").get(id)
        : this.db.prepare("SELECT * FROM dictionary WHERE word = ? COLLATE NOCASE").get(normalizedWord);
      if (existing) {
        this.db
          .prepare("UPDATE dictionary SET word = ?, replacement = ?, starred = ? WHERE id = ?")
          .run(normalizedWord, normalizedReplacement, starred ? 1 : 0, existing.id);
        return this.db.prepare("SELECT * FROM dictionary WHERE id = ?").get(existing.id);
      }
      const result = this.db
        .prepare("INSERT INTO dictionary (word, replacement, starred) VALUES (?, ?, ?)")
        .run(normalizedWord, normalizedReplacement, starred ? 1 : 0);
      return this.db.prepare("SELECT * FROM dictionary WHERE id = ?").get(result.lastInsertRowid);
    }

    const existing = this.memoryDictionary.find(
      (entry) =>
        (id && entry.id === id) || entry.word.toLowerCase() === normalizedWord.toLowerCase()
    );
    if (existing) {
      existing.word = normalizedWord;
      existing.replacement = normalizedReplacement;
      existing.starred = Boolean(starred);
      return existing;
    }
    const entry = {
      id: this.nextDictionaryId++,
      word: normalizedWord,
      replacement: normalizedReplacement,
      starred: Boolean(starred),
      created_at: new Date().toISOString(),
    };
    this.memoryDictionary.unshift(entry);
    return entry;
  }

  deleteDictionaryEntry(id) {
    if (this.db) {
      const result = this.db.prepare("DELETE FROM dictionary WHERE id = ?").run(id);
      return { success: result.changes > 0, id };
    }
    const index = this.memoryDictionary.findIndex((entry) => entry.id === id);
    if (index === -1) return { success: false, id };
    this.memoryDictionary.splice(index, 1);
    return { success: true, id };
  }

  getSnippets() {
    if (this.db) {
      return this.db.prepare("SELECT * FROM snippets ORDER BY length(cue) DESC, cue COLLATE NOCASE").all();
    }
    return [...this.memorySnippets];
  }

  saveSnippet({ id, cue, expansion }) {
    const normalizedCue = String(cue || "").trim();
    const normalizedExpansion = String(expansion ?? "");
    if (!normalizedCue) {
      throw new Error("Snippet cue is required");
    }

    if (this.db) {
      const existing = id
        ? this.db.prepare("SELECT * FROM snippets WHERE id = ?").get(id)
        : this.db.prepare("SELECT * FROM snippets WHERE cue = ? COLLATE NOCASE").get(normalizedCue);
      if (existing) {
        this.db
          .prepare("UPDATE snippets SET cue = ?, expansion = ? WHERE id = ?")
          .run(normalizedCue, normalizedExpansion, existing.id);
        return this.db.prepare("SELECT * FROM snippets WHERE id = ?").get(existing.id);
      }
      const result = this.db
        .prepare("INSERT INTO snippets (cue, expansion) VALUES (?, ?)")
        .run(normalizedCue, normalizedExpansion);
      return this.db.prepare("SELECT * FROM snippets WHERE id = ?").get(result.lastInsertRowid);
    }

    const existing = this.memorySnippets.find(
      (snippet) => (id && snippet.id === id) || snippet.cue.toLowerCase() === normalizedCue.toLowerCase()
    );
    if (existing) {
      existing.cue = normalizedCue;
      existing.expansion = normalizedExpansion;
      return existing;
    }
    const snippet = {
      id: this.nextSnippetId++,
      cue: normalizedCue,
      expansion: normalizedExpansion,
      created_at: new Date().toISOString(),
    };
    this.memorySnippets.unshift(snippet);
    return snippet;
  }

  deleteSnippet(id) {
    if (this.db) {
      const result = this.db.prepare("DELETE FROM snippets WHERE id = ?").run(id);
      return { success: result.changes > 0, id };
    }
    const index = this.memorySnippets.findIndex((snippet) => snippet.id === id);
    if (index === -1) return { success: false, id };
    this.memorySnippets.splice(index, 1);
    return { success: true, id };
  }

  cleanup() {
    console.log("Starting database cleanup...");
    try {
      if (this.db) {
        const dbPath = this.getDbPath();
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
          console.log("✅ Database file deleted:", dbPath);
        }
      }
      this.memoryStore = [];
      this.memoryDictionary = [];
      this.memorySnippets = [];
    } catch (error) {
      console.error("❌ Error deleting database file:", error);
    }
  }
}

module.exports = DatabaseManager;
