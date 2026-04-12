// Stub DatabaseManager - works without better-sqlite3
// Stores transcriptions in memory only (no persistence)
// To enable persistence, install better-sqlite3: npm rebuild better-sqlite3

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

class DatabaseManager {
  constructor() {
    this.db = null;
    this.memoryStore = []; // Fallback in-memory storage
    this.nextId = 1;
    this.initDatabase();
  }

  initDatabase() {
    if (!Database) {
      console.log("📝 Using in-memory storage for transcriptions");
      return true;
    }

    try {
      const dbFileName =
        process.env.NODE_ENV === "development" ? "transcriptions-dev.db" : "transcriptions.db";

      const dbPath = path.join(app.getPath("userData"), dbFileName);

      this.db = new Database(dbPath);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transcriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      return true;
    } catch (error) {
      console.error("Database initialization failed:", error.message);
      console.log("📝 Falling back to in-memory storage");
      this.db = null;
      return true;
    }
  }

  saveTranscription(text) {
    try {
      if (this.db) {
      const stmt = this.db.prepare("INSERT INTO transcriptions (text) VALUES (?)");
      const result = stmt.run(text);
      const fetchStmt = this.db.prepare("SELECT * FROM transcriptions WHERE id = ?");
      const transcription = fetchStmt.get(result.lastInsertRowid);
      return { id: result.lastInsertRowid, success: true, transcription };
      }

      // In-memory fallback
      const transcription = {
        id: this.nextId++,
        text,
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

      // In-memory fallback
      return this.memoryStore.slice(0, limit);
    } catch (error) {
      console.error("Error getting transcriptions:", error.message);
      throw error;
    }
  }

  clearTranscriptions() {
    try {
      if (this.db) {
      const stmt = this.db.prepare("DELETE FROM transcriptions");
      const result = stmt.run();
      return { cleared: result.changes, success: true };
      }

      // In-memory fallback
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

      // In-memory fallback
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

  cleanup() {
    console.log("Starting database cleanup...");
    try {
      if (this.db) {
      const dbPath = path.join(
        app.getPath("userData"),
        process.env.NODE_ENV === "development" ? "transcriptions-dev.db" : "transcriptions.db"
      );
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log("✅ Database file deleted:", dbPath);
      }
      }
      this.memoryStore = [];
    } catch (error) {
      console.error("❌ Error deleting database file:", error);
    }
  }
}

module.exports = DatabaseManager;
