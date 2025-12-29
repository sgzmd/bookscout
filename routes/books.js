const express = require('express');

const router = express.Router();
const { db } = require('../db');
const { PREDEFINED_TAGS, sanitizeTag } = require('../utils/tags');

// GET /books/tags - Fetch sorted tags for user
router.get('/tags', (req, res) => {
  if (!req.user) return res.json(PREDEFINED_TAGS); // Fallback if not logged in

  try {
    // 1. Fetch user's tags
    const stmt = db.prepare('SELECT tags FROM books WHERE user_id = ?');
    const rows = stmt.all(req.user.id);

    // 2. Count frequencies
    const tagCounts = {};

    // Initialize with predefined tags (count 0 to ensure they appear if not used yet?
    // Or just merge them later?
    // The plan said "Merge with static PREDEFINED_TAGS".
    // Let's count used tags first.
    rows.forEach((row) => {
      if (row.tags) {
        row.tags.split(',').forEach((tag) => {
          const t = tag.trim();
          if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      }
    });

    // 3. Create unique list
    const allTags = new Set([...Object.keys(tagCounts), ...PREDEFINED_TAGS]);

    // 4. Sort
    const sortedTags = Array.from(allTags).sort((a, b) => {
      const countA = tagCounts[a] || 0;
      const countB = tagCounts[b] || 0;

      // Sort by frequency DESC
      if (countB !== countA) return countB - countA;

      // Then alphabetical ASC
      return a.localeCompare(b);
    });

    res.json(sortedTags);
  } catch (error) {
    console.error('Fetch tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /books/review/:google_id - Show review form
router.get('/review/:google_id', async (req, res) => {
  const { google_id } = req.params;

  // Fetch book details from Google API
  // In a real app, we might want to cache this or pass data from search to avoid double fetch.
  // For this prototype, re-fetching is fine.
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const url = `https://www.googleapis.com/books/v1/volumes/${google_id}?key=${apiKey || ''}`;

    // Mock for test/dev if needed
    // Mock for test/dev if needed
    if (process.env.NODE_ENV === 'test' && !apiKey) {
      // We'll rely on global fetch mock in tests
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch book details');
    const data = await response.json();

    const book = {
      google_id: data.id,
      title: data.volumeInfo.title,
      author: data.volumeInfo.authors ? data.volumeInfo.authors[0] : 'Unknown',
      cover_url: data.volumeInfo.imageLinks?.thumbnail || data.volumeInfo.imageLinks?.smallThumbnail || 'https://via.placeholder.com/128x192?text=No+Cover'
    };

    res.render('review', { book, isEdit: false }, (err, html) => {
      if (err) throw err;
      res.render('layout', { body: html });
    });
  } catch (error) {
    console.error('Review load error:', error);
    res.status(500).send('Error loading book details');
  }
});

// POST /books - Save book
router.post('/', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');

  const {
    google_books_id, title, author, cover_url, rating, tags, notes
  } = req.body;

  // Sanitize tags
  const sanitizedTags = (tags || '').split(',').map((tag) => sanitizeTag(tag)).filter(Boolean).join(',');

  try {
    const stmt = db.prepare(`
            INSERT INTO books (user_id, title, author, cover_url, google_books_id, rating, tags, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

    stmt.run(req.user.id, title, author, cover_url, google_books_id, rating, sanitizedTags, notes);

    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Save book error:', error);
    res.status(500).send('Error saving book');
  }
});

// GET /books/:id/edit - Show edit form
router.get('/:id/edit', (req, res) => {
  if (!req.user) return res.redirect('/');
  const { id } = req.params;

  try {
    const stmt = db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?');
    const book = stmt.get(id, req.user.id);

    if (!book) return res.status(404).send('Book not found');

    // Transform for view (ensure it matches the google book structure expected by review.ejs partially)
    // actually review.ejs expects `book` object.
    // We might need to adjust review.ejs to handle both Google Book structure and DB Book structure.
    // DB structure: google_books_id, title, author, cover_url, rating, tags, notes.
    // Review.ejs uses: book.google_id (for hidden input), title, author, cover_url.

    // Map DB fields to what review.ejs might expect if it differs, or standardise.
    // existing review.ejs expects `book.google_id`. Our DB has `google_books_id`.
    book.google_id = book.google_books_id;

    res.render('review', { book, isEdit: true }, (err, html) => {
      if (err) throw err;
      res.render('layout', { body: html });
    });
  } catch (error) {
    console.error('Edit load error:', error);
    res.status(500).send('Error loading book');
  }
});

// POST /books/:id/edit - Update book
router.post('/:id/edit', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');
  const { id } = req.params;
  const { rating, tags, notes } = req.body;

  // Sanitize tags
  const sanitizedTags = (tags || '').split(',').map((tag) => sanitizeTag(tag)).filter(Boolean).join(',');

  try {
    const stmt = db.prepare(`
            UPDATE books 
            SET rating = ?, tags = ?, notes = ?
            WHERE id = ? AND user_id = ?
        `);

    const info = stmt.run(rating, sanitizedTags, notes, id, req.user.id);

    if (info.changes === 0) return res.status(404).send('Book not found');

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).send('Error updating book');
  }
});

// POST /books/:id/delete - Delete book
router.post('/:id/delete', (req, res) => {
  if (!req.user) return res.status(401).send('Unauthorized');
  const { id } = req.params;

  try {
    const stmt = db.prepare('DELETE FROM books WHERE id = ? AND user_id = ?');
    const info = stmt.run(id, req.user.id);

    if (info.changes === 0) return res.status(404).send('Book not found');

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).send('Error deleting book');
  }
});

module.exports = router;
