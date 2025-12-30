import {
  describe, it, expect, beforeEach
} from 'vitest';
import request from 'supertest';
import app from '../index'; // Assuming index.js exports app
import { db, init, reset } from '../db';

describe('Admin User Filter', () => {
  beforeEach(() => {
    init();
    reset();
    process.env.ADMIN_USER = 'dev@example.com';

    // Create users
    const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, name, email) VALUES (?, ?, ?)');
    insertUser.run('dev-user', 'Dev Admin', 'dev@example.com');
    insertUser.run('user-a', 'Alice', 'alice@example.com');
    insertUser.run('user-b', 'Bob', 'bob@example.com');

    // Create books
    const insertBook = db.prepare('INSERT INTO books (user_id, title, author, rating) VALUES (?, ?, ?, 5)');
    insertBook.run('user-a', 'Alice Book 1', 'Author A');
    insertBook.run('user-a', 'Alice Book 2', 'Author A');
    insertBook.run('user-b', 'Bob Book 1', 'Author B');
  });

  it('should filter books by user', async () => {
    const agent = request.agent(app);

    // Login as admin (dev)
    await agent.get('/auth/dev');

    // Get all books
    let res = await agent.get('/admin/books');
    expect(res.status).toBe(200);
    // Should contain all books
    expect(res.text).toContain('Alice Book 1');
    expect(res.text).toContain('Bob Book 1');

    // Filter by Alice
    res = await agent.get('/admin/books?user=user-a');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Alice Book 1');
    expect(res.text).not.toContain('Bob Book 1');

    // Filter by Bob
    res = await agent.get('/admin/books?user=user-b');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Alice Book 1');
    expect(res.text).toContain('Bob Book 1');
  });

  it('should show user dropdown options', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');

    const res = await agent.get('/admin/books');
    expect(res.status).toBe(200);
    expect(res.text).toContain('value="user-a"');
    expect(res.text).toContain('Alice');
    expect(res.text).toContain('value="user-b"');
    expect(res.text).toContain('Bob');
  });
});
