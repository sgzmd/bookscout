const express = require('express');

const router = express.Router();
const { Parser } = require('json2csv');
const { db } = require('../db');
const { isAdmin } = require('../middleware/admin');

// Protect all admin routes
router.use(isAdmin);

// Helper to render with admin layout
const renderAdminView = (res, view, data) => {
  res.render(view, data, (err, html) => {
    if (err) {
      console.error(`Error rendering ${view}:`, err);
      return res.status(500).send('Error rendering view');
    }
    res.render('admin/layout', { body: html, currentPath: data.currentPath || '/admin' });
  });
};

// GET /admin - Redirect to books
router.get('/', (req, res) => {
  res.redirect('/admin/books');
});

// GET /admin/books - All Books Registry
router.get('/books', (req, res) => {
  const {
    sort = 'created_at', order = 'desc', filter, user: userId
  } = req.query;

  let query = `
        SELECT books.*, users.email as user_email, users.name as user_name 
        FROM books 
        LEFT JOIN users ON books.user_id = users.id
    `;

  // Fetch all users for the filter dropdown
  let allUsers = [];
  try {
    const usersStmt = db.prepare('SELECT id, name, email FROM users ORDER BY name ASC, email ASC');
    allUsers = usersStmt.all();
  } catch (err) {
    console.error('Error fetching users for filter:', err);
  }

  // Simple filter implementation
  const params = [];
  const conditions = [];

  if (filter) {
    conditions.push('(books.title LIKE ? OR books.author LIKE ? OR users.email LIKE ?)');
    const wildcard = `%${filter}%`;
    params.push(wildcard, wildcard, wildcard);
  }

  if (userId) {
    conditions.push('books.user_id = ?');
    params.push(userId);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  // Validate sort and order to prevent SQL injection
  const validSorts = ['title', 'author', 'created_at', 'rating'];
  const safeSort = validSorts.includes(sort) ? sort : 'created_at';
  const safeOrder = ['asc', 'desc'].includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';

  query += ` ORDER BY ${safeSort} ${safeOrder}`;

  try {
    const stmt = db.prepare(query);
    const books = stmt.all(...params);
    renderAdminView(res, 'admin/books', {
      books,
      user: req.user,
      currentPath: '/admin/books',
      query: req.query,
      validSorts,
      allUsers,
      selectedUser: userId
    });
  } catch (err) {
    console.error('Admin books error:', err);
    res.status(500).send('Error fetching books');
  }
});

// GET /admin/books/export - CSV Export
router.get('/books/export', (req, res) => {
  try {
    const stmt = db.prepare(`
            SELECT books.id, books.title, books.author, books.rating, books.tags, books.created_at, 
                   users.email as user_email, users.name as user_name
            FROM books 
            LEFT JOIN users ON books.user_id = users.id
            ORDER BY books.created_at DESC
        `);
    const books = stmt.all();

    const fields = ['id', 'title', 'author', 'rating', 'tags', 'created_at', 'user_email', 'user_name'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(books);

    res.header('Content-Type', 'text/csv');
    res.attachment('books-registry.csv');
    return res.send(csv);
  } catch (err) {
    console.error('CSV Export error:', err);
    res.status(500).send('Error exporting CSV');
  }
});

// GET /admin/users - Users List
router.get('/users', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM users');
    const users = stmt.all();
    renderAdminView(res, 'admin/users', {
      users,
      user: req.user,
      currentPath: '/admin/users'
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).send('Error fetching users');
  }
});

// GET /admin/settings - Placeholder
router.get('/settings', (req, res) => {
  renderAdminView(res, 'admin/settings', {
    user: req.user,
    currentPath: '/admin/settings'
  });
});

module.exports = router;
