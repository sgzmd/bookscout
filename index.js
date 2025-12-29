require('dotenv').config();
const express = require('express');
const path = require('path');
const { init } = require('./db');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Initialize DB
init();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust First Proxy
app.set('trust proxy', 1);

// Middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session setup (use a real secret in prod)
app.use(session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const searchRouter = require('./routes/search');
app.use('/search', searchRouter);
const booksRouter = require('./routes/books');
app.use('/books', booksRouter);

const adminRouter = require('./routes/admin');
app.use('/admin', adminRouter);

// Mock Auth for Dev
if (process.env.NODE_ENV !== 'production') {
    app.get('/auth/dev', (req, res, next) => {
        // Simple security check: restrict dev access by date
        const requiredAccessDate = process.env.DEV_USER_ACCESS;
        const today = new Date().toISOString().split('T')[0];
        
        if (process.env.NODE_ENV !== 'test' && requiredAccessDate !== today) {
             return res.status(403).send('Dev access expired or invalid. Check DEV_USER_ACCESS env var.');
        }

        const user = { id: 'dev-user', name: 'Dev User', email: 'dev@example.com' };
        try {
            const stmt = require('./db').db.prepare('INSERT OR REPLACE INTO users (id, name, email) VALUES (?, ?, ?)');
            stmt.run(user.id, user.name, user.email);
        } catch (err) {
            console.error('Failed to upsert dev user:', err);
            return next(err);
        }

        // Log in as a dev user
        req.login(user, (err) => {
            if (err) { return next(err); }
            return res.redirect('/dashboard');
        });
    });
}

const { createGoogleVerifyCallback } = require('./utils/auth_helper');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  createGoogleVerifyCallback(require('./db').db)
));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', function(req, res, next) {
    passport.authenticate('google', function(err, user, info) {
        if (err) {
            if (err.message === 'REGISTRATION_CLOSED') {
                return res.redirect('/?error=registration_closed');
            }
            console.error('Auth error:', err);
            return res.redirect('/?error=auth_failed');
        }
        if (!user) { return res.redirect('/'); }
        
        req.logIn(user, function(err) {
            if (err) { return next(err); }
            return res.redirect('/dashboard');
        });
    })(req, res, next);
});

// Serialize/Deserialize User (Mock for now)
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});


// Routes
app.get('/', (req, res, next) => {
    res.render('index', { 
        user: req.user || null,
        error: req.query.error || null
    }, (err, html) => {
        if (err) return next(err);
        res.render('layout', { body: html });
    });
});

app.get('/dashboard', (req, res, next) => {
    if (!req.user) return res.redirect('/');
    
    // Fetch user's books
    const stmt = require('./db').db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC');
    const books = stmt.all(req.user.id);

    res.render('dashboard', { user: req.user, books }, (err, html) => {
        if (err) return next(err);
        res.render('layout', { body: html });
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
