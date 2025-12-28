import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import { db } from '../db';
import fs from 'fs';

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
        db.prepare('DELETE FROM books').run();
        db.prepare('DELETE FROM users').run();
        // Create dev user
        db.prepare('INSERT OR REPLACE INTO users (id, name, email) VALUES (?, ?, ?)').run('dev-user', 'Dev User', 'dev@example.com');
    });

    it('should pre-fill details on edit page', async () => {
        const agent = request.agent(app);
        await agent.get('/auth/dev');
        
        const bookId = addBook('dev-user', 'Editable Book');

        const res = await agent.get(`/books/${bookId}/edit`);
        expect(res.status).toBe(200);
        expect(res.text).toContain('Editable Book');
        expect(res.text).toContain('Update Review'); // Button text
        expect(res.text).toContain('Delete Book'); // Delete button presence
    });

    it('should update a book', async () => {
        const agent = request.agent(app);
        await agent.get('/auth/dev');
        const bookId = addBook('dev-user');

        const res = await agent.post(`/books/${bookId}/edit`)
            .type('form')
            .send({
                rating: 4,
                tags: 'Updated',
                notes: 'New notes'
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

        const res = await agent.post(`/books/${bookId}/delete`);
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

        // Try to edit other user's book
        const res = await agent.post(`/books/${otherBookId}/edit`).send({ rating: 1 });
        expect(res.status).toBe(404); // Should treat as not found or unauthorized (logic returns 404 for changes=0)
    });
});
