const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'bookscout.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const init = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, -- Google Sub ID
        email TEXT,
        name TEXT
    );

    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        title TEXT,
        author TEXT,
        cover_url TEXT,
        google_books_id TEXT,
        rating INTEGER,
        notes TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
};

module.exports = { db, init };
