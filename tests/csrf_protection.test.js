import {
  describe, it, expect
} from 'vitest';
import request from 'supertest';
import app from '../index';

describe('CSRF Protection', () => {
  it('should reject POST request without CSRF token', async () => {
    // We expect 403 Forbidden
    const res = await request(app).post('/books').send({
      title: 'Hacked Book'
    });
    expect(res.status).toBe(403);
    expect(res.text).toContain('invalid csrf token');
  });

  it('should reject POST request with invalid CSRF token', async () => {
    const res = await request(app).post('/books').send({
      title: 'Hacked Book',
      _csrf: 'invalid-token'
    });
    expect(res.status).toBe(403);
  });

  it('should allow GET requests without token', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});
