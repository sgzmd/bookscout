import {
  describe, it, expect, vi, afterEach
} from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Search Route', () => {
  // Mock global fetch
  const fetchMock = vi.fn();
  global.fetch = fetchMock;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return nothing for short queries', async () => {
    const res = await request(app).get('/search?q=ab');
    expect(res.text).toBe('');
  });

  it('should return book results for valid query', async () => {
    // Mock success response
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: '123',
            volumeInfo: {
              title: 'Test Book',
              authors: ['Test Author'],
              imageLinks: { thumbnail: 'http://example.com/cover.jpg' }
            }
          }
        ]
      })
    });

    const res = await request(app).get('/search?q=testing');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Test Book');
    expect(res.text).toContain('Test Author');
    // Verify partial rendering
    expect(res.text).toContain('hx-get="/books/review/123"');
  });

  it('should handle API errors gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });

    const res = await request(app).get('/search?q=error');
    expect(res.status).toBe(502);
    expect(res.text).toContain('Error fetching books');
  });

  it('should handle empty results', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ totalItems: 0 }) // items is undefined
    });

    const res = await request(app).get('/search?q=empty');
    expect(res.status).toBe(200);
    expect(res.text).toContain('No books found');
  });
});
