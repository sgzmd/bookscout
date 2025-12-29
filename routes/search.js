const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 3) {
    return res.send(''); // Return nothing if query is too short
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    // Fallback or error if no key? For now, let's assume key might be missing or we handle it.
    // If testing, we might mock this function entirely.

    let books = [];

    if (process.env.NODE_ENV === 'test' || !apiKey) {
      // Mock response if no key or in test (unless we mock fetch)
      // But relying on "no key" to mock might be confusing.
      // Better to use a separate service/function we can mock.
      // For simplicity in this script:

      // If we are strictly following "Mock the API in tests", we should mocking global.fetch in vitest.
      // Here, we'll try to fetch if key exists.
    }

    const url = `https://www.googleapis.com/books/v1/volumes?q=${
      encodeURIComponent(query)}&key=${apiKey || ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('Google Books API error:', response.statusText);
      return res.status(502).send('<div class="p-4 text-red-500">Error fetching books</div>');
    }

    const data = await response.json();

    books = (data.items || []).map((item) => ({
      google_id: item.id,
      title: item.volumeInfo.title,
      author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown',
      cover_url: item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail || 'https://via.placeholder.com/128x192?text=No+Cover'
    }));

    res.render('partials/search-results', { books });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('<div class="p-4 text-red-500">Search failed</div>');
  }
});

module.exports = router;
