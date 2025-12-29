/**
 * Creates the Google Strategy Verify Callback with injected DB
 * 
 * @param {object} db - Database instance
 * @returns {function} Verify callback
 */
function createGoogleVerifyCallback(db) {
    return function googleVerifyCallback(accessToken, refreshToken, profile, cb) {
        const user = {
            id: profile.id,
            name: profile.displayName,
            email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null
        };
        
        try {
            // Check if user exists
            const existing = db.prepare('SELECT 1 FROM users WHERE id = ?').get(user.id);
            
            if (!existing) {
                const allowRegistration = process.env.ALLOW_REGISTRATION === 'true';
                if (!allowRegistration) {
                    return cb(new Error('REGISTRATION_CLOSED'), null);
                }
            }

            // Insert or update
            const stmt = db.prepare('INSERT OR REPLACE INTO users (id, name, email) VALUES (?, ?, ?)');
            stmt.run(user.id, user.name, user.email);
            return cb(null, user);
        } catch (err) {
            console.error("Error upserting user:", err);
            return cb(err);
        }
    };
}

module.exports = { createGoogleVerifyCallback };
