import {
  describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import request from 'supertest';
import app from '../index';
import { db, init, reset } from '../db';

describe('Books Route', () => {
  const fetchMock = vi.fn();
  global.fetch = fetchMock;

  beforeEach(() => {
    init();
    reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render review form', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'abc',
        volumeInfo: {
          title: 'Test Book',
          authors: ['Author Name'],
          imageLinks: { thumbnail: 'http://img.com/a.jpg' }
        }
      })
    });

    const res = await request(app).get('/books/review/abc');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Test Book');
    expect(res.text).toContain('<form action="/books" method="POST"');
  });

  it('should save a book when logged in', async () => {
    const agent = request.agent(app);

    // Login first
    await agent.get('/auth/dev');

    // Get CSRF Token
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    // Post book
    const bookData = {
      google_books_id: '12345',
      title: 'My Saved Book',
      author: 'Me',
      cover_url: 'http://example.com/cover.jpg',
      rating: 5,
      tags: 'Funny,Adventure',
      notes: 'Great read!',
      _csrf: csrfToken
    };

    const res = await agent.post('/books')
      .type('form')
      .send(bookData);

    expect(res.status).toBe(302); // Redirect
    expect(res.header.location).toBe('/dashboard');

    // Verify in DB
    const savedBook = db.prepare('SELECT * FROM books WHERE title = ?').get('My Saved Book');
    expect(savedBook).toBeDefined();
    expect(savedBook.rating).toBe(5);
    expect(savedBook.user_id).toBe('dev-user');
  });

  it('should reject save if not logged in', async () => {
    // Need a fresh agent to get a CSRF token
    const agent = request.agent(app);
    const page = await agent.get('/');
    const csrfToken = page.text.match(/name="csrf-token" content="(.*?)"/)[1];

    const res = await agent.post('/books')
      .type('form')
      .send({ _csrf: csrfToken }); // Send empty body but with token
    expect(res.status).toBe(401);
  });

  it('should reject save with 0 rating', async () => {
    const agent = request.agent(app);

    // Login
    await agent.get('/auth/dev');

    // Get CSRF Token
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    // Post book with 0 rating
    const bookData = {
      google_books_id: '12345',
      title: 'My Unrated Book',
      author: 'Me',
      cover_url: 'http://example.com/cover.jpg',
      rating: 0,
      tags: 'Test',
      notes: '',
      _csrf: csrfToken
    };

    const res = await agent.post('/books')
      .type('form')
      .send(bookData);

    expect(res.status).toBe(400);
    expect(res.text).toContain('Rating is required');
  });

  it('should delete a book', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    // Create a book first
    await agent.post('/books')
      .type('form')
      .send({
        google_books_id: 'del123',
        title: 'Book to Delete',
        author: 'Deletable Author',
        rating: 3,
        _csrf: csrfToken
      });

    const book = db.prepare('SELECT id FROM books WHERE title = ?').get('Book to Delete');

    // Delete it
    const res = await agent.post(`/books/${book.id}/delete`)
      .type('form')
      .send({ _csrf: csrfToken });

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/dashboard');

    const check = db.prepare('SELECT * FROM books WHERE id = ?').get(book.id);
    expect(check).toBeUndefined();
  });

  it('should handle HTMX delete with client-side redirect', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    // Create a book
    await agent.post('/books')
      .type('form')
      .send({
        google_books_id: 'htmx123',
        title: 'HTMX Book',
        author: 'HTMX Author',
        rating: 4,
        _csrf: csrfToken
      });

    const book = db.prepare('SELECT id FROM books WHERE title = ?').get('HTMX Book');

    // Delete with HTMX header
    const res = await agent.post(`/books/${book.id}/delete`)
      .set('HX-Request', 'true')
      .type('form')
      .send({ _csrf: csrfToken });

    // HTMX requires a 200 OK with HX-Redirect header for a clear client-side redirect
    expect(res.status).toBe(200);
    expect(res.header['hx-redirect']).toBe('/dashboard');
  });
});
