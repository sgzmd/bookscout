
/**
 * Middleware to check if the user is an admin.
 * Assumes req.user is populated by passport.
 */
function isAdmin(req, res, next) {
    // Check if user is authenticated
    if (!req.user) {
        return res.redirect('/auth/google');
    }

    const adminUser = process.env.ADMIN_USER;
    const isDev = process.env.NODE_ENV !== 'production';
    
    // In dev mode, if ADMIN_USER is not set, allow dev-user (dev@example.com)
    // Actually, per requirements, we should just check against ADMIN_USER, 
    // but the task note said "Dev user is admin by default".
    // So if req.user.email is 'dev@example.com' AND we are in dev mode, allow it.
    
    if (req.user.email === adminUser || (isDev && req.user.email === 'dev@example.com')) {
        return next();
    }

    // Access denied
    console.warn(`[Security] Unauthorized admin access attempt by ${req.user.email}`);
    res.status(403).send('Access Denied');
}

module.exports = { isAdmin };
