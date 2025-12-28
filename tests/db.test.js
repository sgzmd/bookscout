import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, init } from '../db';

describe('Database Schema', () => {
  beforeEach(() => {
    // In-memory DB for testing would be better, but for now we rely on the file.
    // Actually, better-sqlite3 relies on the constructor.
    // To test safely, we should probably mock the path or use :memory: if the module allowed injection.
    // For this simple setup, we'll just run init and check tables.
    init();
  });

  it('should create users table', () => {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    const table = stmt.get();
    expect(table).toBeDefined();
  });

  it('should create books table', () => {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='books'");
    const table = stmt.get();
    expect(table).toBeDefined();
  });
});
