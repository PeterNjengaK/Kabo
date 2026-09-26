import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export function customerAccounts(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS customer_sessions (token TEXT PRIMARY KEY, customer_id TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const rates = new Map();
  const error = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  const text = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
  const digest = value => createHash('sha256').update(value).digest('hex');
  const emailOf = value => { const email = text(value, 200).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error('Enter a valid email address.'); return email; };
  const passwordOf = value => { if (typeof value !== 'string' || value.length < 12 || value.length > 200) error('Use a password between 12 and 200 characters.'); return value; };
  const hashPassword = password => { const salt = randomBytes(16).toString('hex'); return { salt, hash: scryptSync(password, salt, 64).toString('hex') }; };
  const verify = (password, user) => typeof password === 'string' && password.length <= 200 && timingSafeEqual(scryptSync(password, user.salt, 64), Buffer.from(user.hash, 'hex'));
  const publicUser = user => ({ id: user.id, name: user.name, email: user.email, address: user.address, created: user.created });
  const save = user => db.prepare('INSERT OR REPLACE INTO customers VALUES (?,?,?)').run(user.id, user.email, JSON.stringify(user));
  const byId = id => { const row = db.prepare('SELECT value FROM customers WHERE id=?').get(id); return row && JSON.parse(row.value); };
  const tokenOf = req => req.headers.cookie?.split(/;\s*/).find(c => c.startsWith('kabo_customer='))?.slice(14);
  const clearCookie = { 'Set-Cookie': 'kabo_customer=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' };
  function current(req) {
    const token = tokenOf(req); if (!token) return null;
    const session = db.prepare('SELECT customer_id FROM customer_sessions WHERE token=? AND expires>?').get(digest(token), Date.now());
    return session ? byId(session.customer_id) : null;
  }
  function session(req, user) {
    db.prepare('DELETE FROM customer_sessions WHERE expires<=?').run(Date.now());
    const old = tokenOf(req); if (old) db.prepare('DELETE FROM customer_sessions WHERE token=?').run(digest(old));
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO customer_sessions VALUES (?,?,?)').run(digest(token), user.id, Date.now() + 7 * 86400000);
    return { 'Set-Cookie': `kabo_customer=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800` };
  }
  const orderView = o => ({ id: o.id, created: o.created, status: o.status, items: o.items, subtotal: o.subtotal, discount: o.discount, shipping: o.shipping, total: o.total, currency: o.currency, payment: o.payment, customer: o.customer, note: o.note, tracking: o.tracking || '', carrier: o.carrier || '', history: o.history || [{ status: o.status, at: o.created }] });
  async function handle(req, path, bodyOf, send) {
    if (!path.startsWith('/api/customer/')) return false;
    if (['/api/customer/register', '/api/customer/login'].includes(path) && req.method === 'POST') {
      const key = req.socket.remoteAddress; let rate = rates.get(key);
      if (!rate || rate.until < Date.now()) rate = { count: 0, until: Date.now() + 900000 };
      if (rate.count >= 12) error('Too many attempts. Try again in 15 minutes.', 429);
      rate.count++; rates.set(key, rate);
      const b = await bodyOf(req); const email = emailOf(b.email);
      const row = db.prepare('SELECT value FROM customers WHERE email=?').get(email);
      if (path.endsWith('/register')) {
        const name = text(b.name, 100); if (!name) error('Enter your name.');
        const password = passwordOf(b.password);
        if (row) error('An account already uses this email. Please sign in.', 409);
        const user = { id: randomBytes(16).toString('hex'), email, name, address: '', created: new Date().toISOString(), ...hashPassword(password) };
        save(user); send(201, { user: publicUser(user) }, session(req, user)); return true;
      }
      const user = row && JSON.parse(row.value);
      if (!user || !verify(b.password, user)) error('Email or password is incorrect.', 401);
      rates.delete(key); send(200, { user: publicUser(user) }, session(req, user)); return true;
    }
    if (path === '/api/customer/logout' && req.method === 'POST') {
      const token = tokenOf(req); if (token) db.prepare('DELETE FROM customer_sessions WHERE token=?').run(digest(token));
      send(200, { ok: true }, clearCookie); return true;
    }
    const user = current(req); if (!user) error('Sign in to your account to continue.', 401);
    if (path === '/api/customer/me' && req.method === 'GET') { send(200, { user: publicUser(user) }); return true; }
    if (path === '/api/customer/profile' && req.method === 'PUT') {
      const b = await bodyOf(req); const name = text(b.name, 100); if (!name) error('Enter your name.');
      user.name = name; user.address = text(b.address, 500); save(user); send(200, { user: publicUser(user) }); return true;
    }
    if (path === '/api/customer/password' && req.method === 'PUT') {
      const b = await bodyOf(req); if (!verify(b.current, user)) error('Current password is incorrect.');
      Object.assign(user, hashPassword(passwordOf(b.password))); save(user);
      db.prepare('DELETE FROM customer_sessions WHERE customer_id=?').run(user.id);
      send(200, { ok: true }, clearCookie); return true;
    }
    if ((path === '/api/customer/orders' || path.startsWith('/api/customer/orders/')) && req.method === 'GET') {
      const orders = db.prepare('SELECT value FROM orders').all().map(row => JSON.parse(row.value)).filter(o => o.userId === user.id);
      if (path === '/api/customer/orders') send(200, { orders: orders.sort((a,b) => b.created.localeCompare(a.created)).map(orderView) });
      else { const order = orders.find(o => o.id === path.split('/').pop()); if (!order) error('Order not found.', 404); send(200, { order: orderView(order) }); }
      return true;
    }
    error('Not found.', 404);
  }
  return { current, handle, list: () => db.prepare('SELECT value FROM customers').all().map(r => publicUser(JSON.parse(r.value))) };
}
