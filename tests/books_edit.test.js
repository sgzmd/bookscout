import {
  describe, it, expect, beforeEach
} from 'vitest';
import request from 'supertest';
import app from '../index';
import { db, init, reset } from '../db';

// Helper to add a book
const addBook = (userId, title = 'Test Book') => {
  const stmt = db.prepare(`
        INSERT INTO books (user_id, title, author, cover_url, google_books_id, rating, tags, notes)
        VALUES (?, ?, 'Author', 'url', 'gid', 5, 'Tag', 'Note')
    `);
  return stmt.run(userId, title).lastInsertRowid;
};

describe('Book Edit & Delete', () => {
  beforeEach(() => {
    init();
    reset();
    // Create dev user
    db.prepare('INSERT OR REPLACE INTO users (id, name, email) VALUES (?, ?, ?)').run('dev-user', 'Dev User', 'dev@example.com');
  });

  it('should pre-fill details on edit page', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');

    const bookId = addBook('dev-user', 'Editable Book');

    const res = await agent
      .get(`/books/${bookId}/edit`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Editable Book');
    expect(res.text).toContain('Update Review'); // Button text
    expect(res.text).toContain('Delete Book'); // Delete button presence
  });

  it('should update a book', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');
    const bookId = addBook('dev-user');

    // Get CSRF Token
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    const res = await agent.post(`/books/${bookId}/edit`)
      .type('form')
      .send({
        rating: 4,
        tags: 'Updated',
        notes: 'New notes',
        _csrf: csrfToken
      });

    expect(res.status).toBe(302);

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    expect(book.rating).toBe(4);
    expect(book.tags).toBe('Updated');
    expect(book.notes).toBe('New notes');
  });

  it('should delete a book', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');
    const bookId = addBook('dev-user', 'Delete Me');

    // Get CSRF Token
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    // Delete uses hx-post which expects cleaner handling, but standard form post mock also works if route accepts it
    // The route handler doesn't distinguish between hx and standard post for body content usually,
    // BUT the route logic might check headers or body.
    // Wait, the delete button uses `hx-post`.
    // HTMX typically sends `X-CSRF-Token` header.
    // The view layout sets the header.
    // In supertest, we should send the header or the body parameter (if `csurf` accepts both).
    // `csurf` defaults to checking req.body._csrf, req.query._csrf, and headers.
    // So sending in body is fine. But wait, `hx-post` implies no body for delete?
    // It's a button. HTMX sends a POST. If no params, body is empty.
    // So for delete, we likely need to send it via Header or Body.
    // Let's send header to better simulate HTMX.
    const res = await agent.post(`/books/${bookId}/delete`)
      .set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(302);

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    expect(book).toBeUndefined();
  });

  it('should prevent editing others books', async () => {
    // Create another user
    db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run('other-user', 'Other');
    const otherBookId = addBook('other-user', 'Other Book');

    const agent = request.agent(app);
    await agent.get('/auth/dev'); // Logged in as dev-user

    // Get CSRF Token
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    // Try to edit other user's book
    const res = await agent.post(`/books/${otherBookId}/edit`)
      .type('form')
      .send({ rating: 1, _csrf: csrfToken });
    expect(res.status).toBe(404); // Should treat as not found or unauthorized (logic returns 404 for changes=0)
  });
});
