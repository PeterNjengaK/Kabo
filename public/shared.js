export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const money = (amount, currency = 'USD') => new Intl.NumberFormat('en', { style:'currency', currency }).format(amount);
export async function api(path, method = 'GET', body) {
  const response = await fetch(path, { method, headers: body === undefined ? {} : { 'Content-Type':'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status:response.status });
  return data;
}
let timer;
export function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => el.classList.remove('visible'), 4000); }
export function bindDialogs() { document.querySelectorAll('dialog').forEach(dialog => { dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close()); dialog.addEventListener('click', e => { if(e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } }); }); }
