import {
  describe, it, expect, vi, beforeEach, afterEach
} from 'vitest';
import request from 'supertest';
import app from '../index';
import { db, init, reset } from '../db';
import { sanitizeTag } from '../utils/tags';

describe('Tags System', () => {
  // Reset DB before tests
  beforeEach(() => {
    init();
    reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizeTag should clean and format tags', () => {
    expect(sanitizeTag('  adventure  ')).toBe('Adventure');
    expect(sanitizeTag('SCARY')).toBe('Scary');
    expect(sanitizeTag('sci-fi')).toBe('Scifi'); // "only letters" rule. User said "only letters".
    expect(sanitizeTag('wild robot')).toBe('Wild Robot'); // Spaces allowed? Logic allows spaces.
    expect(sanitizeTag('funny123')).toBe('Funny'); // Numbers removed
    expect(sanitizeTag('!!Cool!!')).toBe('Cool');
    expect(sanitizeTag('')).toBe('');
  });

  it('should return sorted tags for user', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev'); // Login as dev-user

    // Insert some books with tags directly into DB (or via POST)
    // Let's use POST to verify the full flow including sanitization

    // Book 1: Adventure, Funny
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    await agent.post('/books')
      .type('form')
      .send({
        google_books_id: '1',
        title: 'B1',
        author: 'A1',
        rating: 5,
        tags: 'Adventure,Funny',
        _csrf: csrfToken
      });

    // Book 2: Funny, Scary
    await agent.post('/books')
      .type('form')
      .send({
        google_books_id: '2',
        title: 'B2',
        author: 'A2',
        rating: 5,
        tags: 'funny, Scary ', // Messy input
        _csrf: csrfToken
      });

    // Fetch tags
    const res = await agent.get('/books/tags');
    expect(res.status).toBe(200);

    const tags = res.body;
    // Expected: Funny (2), Adventure (1), Scary (1).
    // Plus PREDEFINED_TAGS merged.
    // Funny should be top.
    // Adventure and Scary have count 1, so sorted alphabetically?
    // PREDEFINED_TAGS have 0 count (if not used).

    expect(tags[0]).toBe('Funny');
    expect(tags).toContain('Adventure');
    expect(tags).toContain('Scary');

    // "Robots" is predefined but not used. Should be in list, but lower?
    // Actually, logic said: count used tags. Then merge PREDEFINED_TAGS.
    // So Predefined tags have count 0? Or do we assume count 0?
    // Implementation: `const countA = tagCounts[a] || 0;`
    // So used tags (>0) come first.

    expect(tags.indexOf('Funny')).toBeLessThan(tags.indexOf('Robots'));
  });

  it('should sanitize tags on submission', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/dev');

    // Post with messy tags
    const dashboard = await agent.get('/dashboard');
    const csrfToken = dashboard.text.match(/name="csrf-token" content="(.*?)"/)[1];

    await agent.post('/books')
      .type('form')
      .send({
        google_books_id: '3',
        title: 'B3',
        author: 'A3',
        rating: 4,
        tags: '  super   cool , 123bad ',
        _csrf: csrfToken
      });

    // Verify in DB
    const stmt = db.prepare("SELECT tags FROM books WHERE title = 'B3'");
    const row = stmt.get();
    // 'Super Cool' and 'Bad'
    expect(row.tags).toBe('Super Cool,Bad');
  });
});
