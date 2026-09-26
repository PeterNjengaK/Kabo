import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { customerAccounts } from './customers.js';

const dir = resolve(process.env.DATA_DIR || '.data');
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(resolve(dir, 'kabo.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
const customers = customerAccounts(db);
const get = key => { const row = db.prepare('SELECT value FROM documents WHERE key=?').get(key); return row && JSON.parse(row.value); };
const put = (key, val) => db.prepare('INSERT OR REPLACE INTO documents VALUES (?,?)').run(key, JSON.stringify(val));
const rows = table => db.prepare(`SELECT value FROM ${table}`).all().map(r => JSON.parse(r.value));
const saveProduct = p => db.prepare('INSERT OR REPLACE INTO products VALUES (?,?)').run(p.id, JSON.stringify(p));
const categories = ['Shrugs', 'Cardigans', 'Tops', 'Bags', 'Scrunchies', 'Shorts', 'Skirts'];
if (!get('settings')) {
  put('settings', { name: 'Kabo', headline: 'Handmade.\nFor your everyday.', description: 'Crochet clothing and accessories, made by Kabo.', announcement: 'A little texture. A lot of character.', email: '', currency: 'USD', shipping: 5, story: 'Thoughtfully crocheted, one stitch at a time. Kabo creates clothing and accessories that bring a little warmth and individuality to your everyday.' });
  put('discounts', []);
  const names = ['The Everyday Shrug', 'The Olive Cardigan', 'The Cocoa Top', 'The Market Bag', 'The Soft Scrunchie', 'The Weekend Shorts', 'The Sunday Skirt'];
  const prices = [65, 85, 45, 38, 12, 48, 58];
  categories.forEach((category, i) => saveProduct({ id: `p${i + 1}`, name: names[i], category, price: prices[i], stock: 8, active: true, image: i < 5 ? `/assets/product-${i + 1}.png` : '/assets/placeholder.svg', description: 'An illustrative piece from our sample collection. Soft texture, thoughtful details, and a relaxed feel. Final materials, sizing, care instructions, and lead times will be provided with the real collection.', sizes: ['Bags', 'Scrunchies'].includes(category) ? ['One size'] : ['XS', 'S', 'M', 'L', 'XL'] }));
}
if (get('settings').whatsapp === undefined) put('settings', { ...get('settings'), whatsapp: '17079786179' });
if (!get('auth')) {
  const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  put('auth', { salt, hash: scryptSync(password, salt, 64).toString('hex') });
  if (!process.env.ADMIN_PASSWORD) writeFileSync(resolve(dir, 'admin-access.txt'), `Kabo local admin\nOpen http://localhost:${process.env.PORT || 3000}/admin\nPassword: ${password}\nKeep this file private. Change the password in admin Settings.\n`, { mode: 0o600 });
}
const sessions = new Map();
const attempts = new Map();
const messageAttempts = new Map();
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const str = (v, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const num = (v, min, max) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail('Invalid numeric value.'); return v; };
const money = n => Math.round(n * 100) / 100;
function validProduct(body, id) {
  const name = str(body.name, 100); if (!name || !categories.includes(body.category)) fail('A product name and valid category are required.');
  const image = str(body.image, 1000); if (image && !/^\/assets\/[\w.-]+$/.test(image) && !/^https:\/\//.test(image)) fail('Use an HTTPS image URL or a local asset path.');
  const stock = num(body.stock, 0, 100000); if (!Number.isInteger(stock)) fail('Stock must be a whole number.');
  const sizes = Array.isArray(body.sizes) ? [...new Set(body.sizes.map(s => str(s, 30)).filter(Boolean))].slice(0, 20) : [];
  if (!sizes.length) fail('Enter at least one size.');
  const imageList = (value, max) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > max) fail(`Use at most ${max} image paths.`);
    return value.map(v => { const url = str(v, 1000); if (!/^\/assets\/[\w.-]+$/.test(url) && !/^https:\/\//.test(url)) fail('Images must use HTTPS or a local asset path.'); return url; });
  };
  const images = imageList(body.images, 20), images360 = imageList(body.images360, 72);
  if (images360.length && images360.length < 4) fail('A 360° sequence needs at least four ordered images.');
  return { id, name, category: body.category, price: money(num(body.price, 0.01, 100000)), stock, active: body.active === true, image, images, images360, description: str(body.description, 3000), sizes };
}
function quote(body) {
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) fail('Your bag is empty or too large.');
  const products = rows('products'); const totals = new Map();
  const items = body.items.map(item => {
    const p = products.find(p => p.id === item.id && p.active);
    if (!p) fail('A product is no longer available. Please update your bag.');
    const quantity = num(item.quantity, 1, 100); if (!Number.isInteger(quantity)) fail('Invalid quantity.');
    if (!p.sizes.includes(item.size)) fail(`Choose a valid size for ${p.name}.`);
    totals.set(p.id, (totals.get(p.id) || 0) + quantity);
    if (totals.get(p.id) > p.stock) fail(`Only ${p.stock} available for ${p.name}.`);
    return { id: p.id, name: p.name, size: item.size, quantity, price: p.price };
  });
  const subtotal = money(items.reduce((sum, i) => sum + i.price * i.quantity, 0));
  const code = str(body.code, 40).toUpperCase();
  const promo = get('discounts').find(d => d.code === code && d.active);
  if (code && !promo) fail('This discount code is not available.');
  const discount = money(subtotal * (promo?.percent || 0) / 100);
  const shipping = get('settings').shipping;
  return { items, subtotal, discount, shipping, total: money(subtotal - discount + shipping), currency: get('settings').currency, code };
}
async function bodyOf(req) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100000) fail('Request too large.', 413); }
  try { return raw ? JSON.parse(raw) : {}; } catch { fail('Invalid JSON.'); }
}
const server = http.createServer(async (req, res) => {
  const send = (status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); };
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost'); const path = url.pathname;
    const allowedHosts = new Set([`localhost:${process.env.PORT || 3000}`, `127.0.0.1:${process.env.PORT || 3000}`]);
    if (!allowedHosts.has(req.headers.host)) fail('Invalid host.', 403);
    if (path.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== `http://${req.headers.host}`) fail('Request origin rejected.', 403);
      if (await customers.handle(req, path, bodyOf, send)) return;
      const sid = req.headers.cookie?.split('; ').find(c => c.startsWith('kabo_session='))?.slice(13);
      const session = sessions.get(sid); const authenticated = session && session > Date.now();
      if (path === '/api/login' && req.method === 'POST') {
        const key = req.socket.remoteAddress; let attempt = attempts.get(key);
        if (!attempt || Date.now() > attempt.until) { attempt = { count: 0, until: Date.now() + 15 * 60 * 1000 }; attempts.set(key, attempt); }
        if (attempt.count >= 8) fail('Too many attempts. Try again in 15 minutes.', 429);
        const { password } = await bodyOf(req); const auth = get('auth');
        if (typeof password !== 'string' || password.length > 300 || !timingSafeEqual(scryptSync(password, auth.salt, 64), Buffer.from(auth.hash, 'hex'))) { attempt.count++; fail('Incorrect password.', 401); }
        attempts.delete(key); const token = randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 8 * 3600000);
        return send(200, { ok: true }, { 'Set-Cookie': `kabo_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
      }
      if (path === '/api/logout' && req.method === 'POST') { sessions.delete(sid); return send(200, { ok: true }, { 'Set-Cookie': 'kabo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
      if (path === '/api/store' && req.method === 'GET') return send(200, { settings: get('settings'), products: rows('products').filter(p => p.active), categories });
      if (path === '/api/messages' && req.method === 'POST') {
        const b = await bodyOf(req); const name = str(b.name, 100), email = str(b.email, 200), message = str(b.message, 3000);
        if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) fail('Enter your name, email, and message.');
        const key = req.socket.remoteAddress; let rate = messageAttempts.get(key);
        if (!rate || rate.until < Date.now()) rate = { count: 0, until: Date.now() + 600000 };
        if (rate.count >= 5) fail('Please wait a few minutes before sending another message.', 429);
        const messages = get('messages') || []; if (messages.length >= 5000) fail('The inbox is full. Please use WhatsApp.', 503);
        const entry = { id: randomBytes(10).toString('hex'), name, email, message, page: str(b.page, 200), created: new Date().toISOString(), status: 'New', note: '' };
        put('messages', [entry, ...messages]); rate.count++; messageAttempts.set(key, rate);
        return send(201, { ok: true });
      }
      if (path === '/api/quote' && req.method === 'POST') return send(200, quote(await bodyOf(req)));
      if (path === '/api/orders' && req.method === 'POST') {
        const account = customers.current(req); if (!account) fail('Sign in to your account before placing an order.', 401);
        const body = await bodyOf(req); const customer = body.customer || {};
        customer.email = account.email;
        if (!str(customer.name, 100) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(customer.email, 200)) || !str(customer.address, 500)) fail('Enter your name, email, and delivery address.');
        db.exec('BEGIN IMMEDIATE');
        try {
          const order = { ...quote(body), id: `KB-${randomBytes(5).toString('hex').toUpperCase()}`, created: new Date().toISOString(), status: 'New', payment: 'Demo — no payment collected', customer: { name: str(customer.name, 100), email: str(customer.email, 200).toLowerCase(), address: str(customer.address, 500) }, note: str(body.note, 1000) };
          order.userId = account.id;
          order.history = [{ status: 'New', at: order.created }];
          for (const item of order.items) { const p = JSON.parse(db.prepare('SELECT value FROM products WHERE id=?').get(item.id).value); p.stock -= item.quantity; saveProduct(p); }
          db.prepare('INSERT INTO orders VALUES (?,?)').run(order.id, JSON.stringify(order)); db.exec('COMMIT');
          return send(201, { id: order.id, total: order.total });
        } catch (e) { db.exec('ROLLBACK'); throw e; }
      }
      if (!path.startsWith('/api/admin')) fail('Not found.', 404);
      if (!authenticated) fail('Please sign in.', 401);
      if (path === '/api/admin' && req.method === 'GET') return send(200, { settings: get('settings'), products: rows('products'), orders: rows('orders').sort((a,b) => b.created.localeCompare(a.created)), discounts: get('discounts'), messages: get('messages') || [], customers: customers.list(), categories });
      if (path.startsWith('/api/admin/messages/') && req.method === 'PUT') {
        const messages = get('messages') || [], entry = messages.find(m => m.id === path.split('/').pop());
        if (!entry) fail('Message not found.', 404);
        const b = await bodyOf(req); if (!['New', 'Read', 'Resolved'].includes(b.status)) fail('Invalid message status.');
        entry.status = b.status; entry.note = str(b.note, 2000); put('messages', messages); return send(200, entry);
      }
      if (path === '/api/admin/products' && req.method === 'POST') { const p = validProduct(await bodyOf(req), randomBytes(8).toString('hex')); saveProduct(p); return send(201, p); }
      if (path.startsWith('/api/admin/products/')) {
        const id = path.split('/').pop(); if (!db.prepare('SELECT id FROM products WHERE id=?').get(id)) fail('Product not found.', 404);
        if (req.method === 'PUT') { const p = validProduct(await bodyOf(req), id); saveProduct(p); return send(200, p); }
        if (req.method === 'DELETE') { db.prepare('DELETE FROM products WHERE id=?').run(id); return send(200, { ok: true }); }
      }
      if (path.startsWith('/api/admin/orders/') && req.method === 'PUT') {
        const id = path.split('/').pop(); const row = db.prepare('SELECT value FROM orders WHERE id=?').get(id); if (!row) fail('Order not found.', 404);
        const order = JSON.parse(row.value); const body = await bodyOf(req);
        const transitions = { New: ['Making', 'Cancelled'], Making: ['Shipped', 'Cancelled'], Shipped: ['Completed'], Completed: [], Cancelled: [] };
        if (body.status !== order.status && !transitions[order.status].includes(body.status)) fail('This order status transition is not allowed.');
        db.exec('BEGIN IMMEDIATE');
        try {
          if (body.status === 'Cancelled' && order.status !== 'Cancelled') for (const item of order.items) { const row = db.prepare('SELECT value FROM products WHERE id=?').get(item.id); if (row) { const p = JSON.parse(row.value); p.stock += item.quantity; saveProduct(p); } }
          order.history ||= [{ status: order.status, at: order.created }];
          if (order.status !== body.status) order.history.push({ status: body.status, at: new Date().toISOString() });
          order.status = body.status; order.adminNote = str(body.adminNote, 2000);
          order.carrier = str(body.carrier ?? order.carrier, 100); order.tracking = str(body.tracking ?? order.tracking, 150);
          db.prepare('UPDATE orders SET value=? WHERE id=?').run(JSON.stringify(order), id); db.exec('COMMIT'); return send(200, order);
        } catch (e) { db.exec('ROLLBACK'); throw e; }
      }
      if (path === '/api/admin/settings' && req.method === 'PUT') {
        const b = await bodyOf(req); const name = str(b.name, 60); if (!name || !str(b.headline, 150)) fail('Store name and headline are required.');
        if (!['USD', 'GBP', 'EUR', 'ZAR', 'BWP', 'KES'].includes(b.currency)) fail('Choose a supported currency.');
        const settings = { name, headline: str(b.headline, 150), description: str(b.description, 300), announcement: str(b.announcement, 200), story: str(b.story, 3000), email: str(b.email, 200), currency: b.currency, shipping: money(num(b.shipping, 0, 10000)) };
        if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) fail('Enter a valid contact email.');
        settings.whatsapp = str(b.whatsapp ?? get('settings').whatsapp ?? '', 30).replace(/[\s()+-]/g, '');
        if (settings.whatsapp && !/^[1-9]\d{6,14}$/.test(settings.whatsapp)) fail('Use a WhatsApp number with country code, 7–15 digits.');
        put('settings', settings); return send(200, settings);
      }
      if (path === '/api/admin/discounts' && req.method === 'PUT') {
        const b = await bodyOf(req); if (!Array.isArray(b) || b.length > 100) fail('Invalid discounts.');
        const discounts = b.map(d => { const code = str(d.code, 40).toUpperCase(); if (!/^[A-Z0-9_-]+$/.test(code)) fail('Use letters, numbers, underscores, or hyphens in codes.'); return { code, percent: num(d.percent, 1, 100), active: d.active === true }; });
        if (new Set(discounts.map(d => d.code)).size !== discounts.length) fail('Discount codes must be unique.');
        put('discounts', discounts); return send(200, discounts);
      }
      if (path === '/api/admin/password' && req.method === 'PUT') {
        const b = await bodyOf(req); const auth = get('auth');
        if (typeof b.current !== 'string' || b.current.length > 300 || !timingSafeEqual(scryptSync(b.current, auth.salt, 64), Buffer.from(auth.hash, 'hex'))) fail('Current password is incorrect.');
        if (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 200) fail('Use a password between 12 and 200 characters.');
        const salt = randomBytes(16).toString('hex'); put('auth', { salt, hash: scryptSync(b.password, salt, 64).toString('hex') }); sessions.clear();
        if (existsSync(resolve(dir, 'admin-access.txt'))) writeFileSync(resolve(dir, 'admin-access.txt'), 'Password changed in admin. Use your updated password.\n');
        return send(200, { ok: true }, { 'Set-Cookie': 'kabo_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      }
      fail('Not found.', 404);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') fail('Method not allowed.', 405);
    let pageStatus = 200;
    const storefront = path === '/' || path === '/shop' || path === '/account' || path.startsWith('/collections/') || path.startsWith('/products/');
    if (path.startsWith('/collections/') && !categories.some(c => '/collections/' + c.toLowerCase() === path)) pageStatus = 404;
    if (path.startsWith('/products/') && !rows('products').some(p => p.active && '/products/' + p.id === path)) pageStatus = 404;
    const route = storefront ? '/index.html' : path === '/admin' || path === '/admin/' ? '/admin.html' : path;
    const publicDir = resolve('public'); const file = resolve(publicDir, '.' + decodeURIComponent(route));
    if (!file.startsWith(publicDir + '/') && !file.startsWith(publicDir + '\\')) fail('Forbidden.', 403);
    let data; try { data = readFileSync(file); } catch { fail('Not found.', 404); }
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    res.writeHead(pageStatus, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) { send(e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' }); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Kabo: http://localhost:${process.env.PORT || 3000}\nAdmin: /admin — initial credentials in .data/admin-access.txt (unless ADMIN_PASSWORD was supplied).`));
