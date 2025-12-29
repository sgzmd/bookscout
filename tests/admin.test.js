
const request = require('supertest');
const app = require('../index');
const { db, reset } = require('../db');

describe('Admin Panel', () => {
    beforeAll(() => {
        // Setup initial data
        process.env.ADMIN_USER = 'admin@example.com';
        reset();

        const insertUser = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
        insertUser.run('admin-id', 'Admin User', 'admin@example.com');
        insertUser.run('user-id', 'Regular User', 'user@example.com');

        const insertBook = db.prepare('INSERT INTO books (user_id, title, author, rating) VALUES (?, ?, ?, ?)');
        insertBook.run('user-id', 'Test Book', 'Test Author', 5);
    });

    // Mock authentication middleware for testing
    // Since passport middleware is used, we might need a way to mock req.user.
    // However, supertest doesn't easily mock req.user without modifying the app code or using a middleware override.
    // A common strategy is to use a test-only middleware that sets req.user based on a header if in test mode.
    // Or we can rely on existing session mechanisms if we can simulate login.
    // But since `index.js` has `/auth/dev` which logs in a user... 
    // Wait, `/auth/dev` logs in `dev@example.com`. 
    // I can perhaps modify `index.js` or `middleware/admin.js` to accept a mock user in 
    // test environment? Or I can just use a library like `supertest-session`?
    
    // Simplest approach for this agentic environment: 
    // I will mock the passport.deserializeUser or similar? No that's hard.
    // Actually, `index.js` uses `passport.session()`.
    
    // Let's rely on the fact that `isAdmin` middleware checks `req.user`.
    // I can simple unit test the middleware or the routes if I can inject the user.
    
    // Alternative: Create a test helper that logs in.
    // But `isAdmin` checks `req.user.email`.
    
    // Let's try to simulate login via session if possible, OR
    // Just for these tests, I'll assume we can't easily mock the session without more setup.
    // I will try to hit the route and expect 302 (redirect to login) if not logged in.
    
    it('should redirect unauthenticated users', async () => {
        const res = await request(app).get('/admin');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/auth/google');
    });

    // To test authenticated access, I'd need to mock the session or use a tool that supports it.
    // Given the constraints and the codebase, maybe I can just verify the middleware logic separately?
    // OR I can use the `mock-user` pattern if I can modify `index.js` slightly to look for a test header?
    // Unlikely to want to modify production code for that.
    
    // HACK: I will temporarily modify `middleware/admin.js` to allow a backdoor header ONLY for test env?
    // Or I can just write a unit test for the middleware specifically.
});

// Unit test for middleware
const { isAdmin } = require('../middleware/admin');

describe('Admin Middleware', () => {
    const next = vi.fn();
    const res = {
        redirect: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_USER = 'admin@example.com';
    });

    it('should redirect if no user', () => {
        const req = {};
        isAdmin(req, res, next);
        expect(res.redirect).toHaveBeenCalledWith('/auth/google');
    });

    it('should allow if email matches ADMIN_USER', () => {
        const req = { user: { email: 'admin@example.com' } };
        isAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should allow dev user in dev mode', () => {
        process.env.NODE_ENV = 'development'; // Simulate dev
        const req = { user: { email: 'dev@example.com' } };
        isAdmin(req, res, next);
        expect(next).toHaveBeenCalled();
        process.env.NODE_ENV = 'test'; // Reset
    });

    it('should deny if email does not match', () => {
        const req = { user: { email: 'other@example.com' } };
        isAdmin(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
