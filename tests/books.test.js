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
});
