import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import { db } from '../db';

describe('Books Route', () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    beforeEach(() => {
        db.prepare('DELETE FROM books').run();
        db.prepare('DELETE FROM users').run();
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
        
        // Post book
        const bookData = {
            google_books_id: '12345',
            title: 'My Saved Book',
            author: 'Me',
            cover_url: 'http://example.com/cover.jpg',
            rating: 5,
            tags: 'Funny,Adventure',
            notes: 'Great read!'
        };

        const res = await agent.post('/books')
            .type('form')
            .send(bookData);

        expect(res.status).toBe(302); // Redirect
        expect(res.header['location']).toBe('/dashboard');

        // Verify in DB
        const savedBook = db.prepare('SELECT * FROM books WHERE title = ?').get('My Saved Book');
        expect(savedBook).toBeDefined();
        expect(savedBook.rating).toBe(5);
        expect(savedBook.user_id).toBe('dev-user');
    });

    it('should reject save if not logged in', async () => {
        const res = await request(app).post('/books').send({});
        expect(res.status).toBe(401);
    });
});
