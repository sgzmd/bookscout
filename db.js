const Database = require('better-sqlite3');
const path = require('path');

let db;
if (process.env.NODE_ENV === 'test') {
    if (!global.__TEST_DB_INSTANCE__) {
        global.__TEST_DB_INSTANCE__ = new Database(':memory:');
        global.__TEST_DB_INSTANCE__.pragma('journal_mode = WAL');
    }
    db = global.__TEST_DB_INSTANCE__;
} else {
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'bookscout.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
}

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

const reset = () => {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('Reset is only allowed in test environment');
    }
    db.prepare('DELETE FROM books').run();
    db.prepare('DELETE FROM users').run();
};


module.exports = { db, init, reset };
