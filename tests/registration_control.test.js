import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createGoogleVerifyCallback } from '../utils/auth_helper';

// Mock db
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn(() => ({
    get: mockGet,
    run: mockRun
}));
const mockDb = { prepare: mockPrepare };

describe('Google Verify Callback', () => {
    const originalEnv = process.env;
    let googleVerifyCallback;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        googleVerifyCallback = createGoogleVerifyCallback(mockDb);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should allow login if user exists, regardless of ALLOW_REGISTRATION', () => {
        // Setup: user exists
        mockGet.mockReturnValue({ 1: 1 }); // User exists
        process.env.ALLOW_REGISTRATION = 'false';

        const cb = vi.fn();
        const profile = { id: '123', displayName: 'Test', emails: [{ value: 'test@example.com' }] };

        googleVerifyCallback('access', 'refresh', profile, cb);

        expect(mockGet).toHaveBeenCalledWith('123');
        // Should update user
        expect(mockRun).toHaveBeenCalledWith('123', 'Test', 'test@example.com');
        expect(cb).toHaveBeenCalledWith(null, expect.anything());
    });

    it('should allow registration if ALLOW_REGISTRATION is true', () => {
        // Setup: user does NOT exist
        mockGet.mockReturnValue(undefined);
        process.env.ALLOW_REGISTRATION = 'true';

        const cb = vi.fn();
        const profile = { id: '456', displayName: 'New', emails: [{ value: 'new@example.com' }] };

        googleVerifyCallback('access', 'refresh', profile, cb);

        expect(mockRun).toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(null, expect.anything());
    });

    it('should DENY registration if ALLOW_REGISTRATION is false', () => {
        // Setup: user does NOT exist
        mockGet.mockReturnValue(undefined);
        process.env.ALLOW_REGISTRATION = 'false';

        const cb = vi.fn();
        const profile = { id: '789', displayName: 'Blocked', emails: [{ value: 'blocked@example.com' }] };

        googleVerifyCallback('access', 'refresh', profile, cb);

        expect(mockRun).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(expect.any(Error), null);
        expect(cb.mock.calls[0][0].message).toBe('REGISTRATION_CLOSED');
    });

     it('should DENY registration if ALLOW_REGISTRATION is undefined (default closed)', () => {
        // Setup: user does NOT exist
        mockGet.mockReturnValue(undefined);
        delete process.env.ALLOW_REGISTRATION;

        const cb = vi.fn();
        const profile = { id: '789', displayName: 'Blocked', emails: [{ value: 'blocked@example.com' }] };

        googleVerifyCallback('access', 'refresh', profile, cb);

        expect(mockRun).not.toHaveBeenCalled();
        expect(cb).toHaveBeenCalledWith(expect.any(Error), null);
    });
});
