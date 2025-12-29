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
    secret: 'keyboard cat',
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

app.get('/dashboard', (req, res) => {
    if (!req.user) return res.redirect('/');
    
    // Fetch user's books
    const stmt = require('./db').db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC');
    const books = stmt.all(req.user.id);

    const dashboardHtml = `
        <div class="max-w-4xl mx-auto py-8 px-4">
            <h1 class="text-3xl font-bold text-emerald-900 mb-6">Welcome back, ${req.user.name}!</h1>
            <!-- Search Bar -->
            <div class="mb-8 relative">
                <input 
                    type="text" 
                    name="q" 
                    placeholder="What did you read today?" 
                    class="w-full p-4 pl-12 rounded-full border-2 border-emerald-100 focus:border-emerald-400 focus:ring-0 text-lg shadow-sm transition-all"
                    hx-get="/search" 
                    hx-trigger="keyup changed delay:500ms" 
                    hx-target="#search-results" 
                    hx-indicator="#loading"
                >
                <!-- Search Icon -->
                <svg class="absolute left-4 top-5 w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                
                <!-- Loading Indicator -->
                <div id="loading" class="htmx-indicator absolute right-5 top-5">
                    <svg class="animate-spin h-6 w-6 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>

                <!-- Dropdown Results -->
                <div id="search-results" class="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl overflow-hidden empty:hidden"></div>
            </div>
            
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                ${books.length > 0 ? books.map(book => `
                    <div class="bg-white rounded-2xl shadow-soft overflow-hidden hover:shadow-lg transition-shadow group">
                        <div class="relative aspect-[2/3] overflow-hidden">
                            <img src="${book.cover_url}" class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" alt="${book.title}">
                            
                            <!-- Rating Badge -->
                            <div class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-emerald-600 shadow-sm flex items-center">
                                <span class="text-yellow-400 mr-1">★</span> ${book.rating}
                            </div>
                            
                            <!-- Edit Button -->
                            <a href="/books/${book.id}/edit" class="absolute top-2 left-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-slate-500 hover:text-emerald-600 shadow-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" title="Edit Review">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </a>
                        </div>
                        <div class="p-4">
                            <h3 class="font-bold text-slate-800 leading-tight mb-1 truncate">${book.title}</h3>
                            <p class="text-xs text-slate-500 truncate">${book.author}</p>
                            ${book.tags ? `
                                <div class="mt-3 flex flex-wrap gap-1">
                                    ${book.tags.split(',').slice(0, 2).map(tag => `<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-full uppercase tracking-wider font-bold">${tag}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('') : '<p class="text-slate-500 col-span-full text-center py-12">No books yet. Start searching above!</p>'}
            </div>
        </div>
    `;
    res.render('layout', { body: dashboardHtml });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
