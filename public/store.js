import { api, escape as e, money, toast, bindDialogs } from './shared.js';
import { brand } from './brand.js';
import { cards, collectionUrl, preparePage, renderProductPage } from './catalog.js';
import { initContact } from './contact.js';
import { currentCustomer, requireAccount, initAccount } from './account.js';
let data, category = 'All', code = '', page;
let cart; try { cart = JSON.parse(localStorage.getItem('kabo-bag') || '[]'); if(!Array.isArray(cart)) cart = []; cart = cart.filter(i => typeof i.id === 'string' && typeof i.size === 'string' && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 100); } catch { cart = []; }
const $ = s => document.querySelector(s);
const price = n => money(n, data.settings.currency);
function save() { try { localStorage.setItem('kabo-bag', JSON.stringify(cart)); } catch { toast('Browser storage is unavailable; your cart lasts for this visit.'); } $('#bag-count').textContent = cart.reduce((n, i) => n + i.quantity, 0); }
function renderProducts() {
  if(!$('#products') || page?.product || page?.missing) return;
  const search = $('#search').value.toLowerCase();
  let products = data.products.filter(p => (category === 'All' || p.category === category) && (p.name + ' ' + p.category).toLowerCase().includes(search));
  const sort = $('#sort').value;
  if(sort === 'low') products.sort((a,b) => a.price-b.price);
  if(sort === 'high') products.sort((a,b) => b.price-a.price);
  if(sort === 'name') products.sort((a,b) => a.name.localeCompare(b.name));
  $('#products').innerHTML = cards(products,data.settings.currency);
  if($('#results-count')) $('#results-count').textContent = products.length + (products.length === 1 ? ' piece' : ' pieces');
  fallbackImages();
}
function fallbackImages() { document.querySelectorAll('img').forEach(img => { img.onerror = () => { img.onerror = null; img.src = '/assets/placeholder.svg'; }; }); }
function addToBag(p,size) {
  p=data.products.find(item=>item.id===p.id);
  if(!p || !p.active || !p.sizes.includes(size)){toast('This option is no longer available. Please refresh the page.');return false;}
  if(cart.filter(i=>i.id===p.id).reduce((n,i)=>n+i.quantity,0)>=p.stock) {toast('You already have all available stock in your cart.');return false;}
  const item=cart.find(i=>i.id===p.id && i.size===size);
  if(item)item.quantity++;else cart.push({id:p.id,size,quantity:1});
  save();toast(p.name+' added to your cart');return true;
}
async function renderBag() {
  const content = $('#bag-content');
  if(!cart.length) { content.innerHTML = '<div class="empty"><div class="success-mark">✳</div><h3>A little room for something lovely.</h3><p>Your cart is empty.</p><button class="button" id="continue">Explore the collection ↗</button></div>'; $('#continue').onclick = () => { $('#bag-dialog').close(); location.href='/shop'; }; return; }
  content.innerHTML = cart.map((i, index) => { const p = data.products.find(p => p.id === i.id); return `<div class="bag-item"><img src="${e(p?.image || '/assets/placeholder.svg')}" alt="${e(p?.name || 'Unavailable product')}"><div><h3>${e(p?.name || 'Unavailable product')}</h3><p>${e(i.size)} · ${p ? price(p.price) : 'Remove to continue'}</p><div class="quantity"><button data-qty="${index}" data-change="-1" aria-label="Decrease quantity">−</button><span>${i.quantity}</span><button data-qty="${index}" data-change="1" aria-label="Increase quantity">+</button></div><button class="remove" data-remove="${index}">Remove</button></div></div>`; }).join('') + `<form class="inline-form" id="promo"><input name="code" value="${e(code)}" placeholder="Discount code" aria-label="Discount code"><button>Apply</button></form><div id="quote" class="bag-summary">Calculating your total…</div>`;
  content.querySelectorAll('[data-qty]').forEach(b => b.onclick = () => { const i = cart[Number(b.dataset.qty)]; const p = data.products.find(p => p.id === i.id); if(Number(b.dataset.change) > 0 && (!p || cart.filter(x => x.id === i.id).reduce((n,x) => n+x.quantity,0) >= p.stock)) return toast('No more stock available.'); i.quantity += Number(b.dataset.change); cart = cart.filter(i => i.quantity > 0); save(); renderBag(); });
  content.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { cart.splice(Number(b.dataset.remove),1); save(); renderBag(); });
  $('#promo').onsubmit = ev => { ev.preventDefault(); code = new FormData(ev.target).get('code').trim(); renderBag(); };
  fallbackImages();
  try { const q = await api('/api/quote', 'POST', {items:cart,code}); if(!$('#quote')) return; $('#quote').innerHTML = `<div class="summary-line"><span>Subtotal</span><span>${price(q.subtotal)}</span></div>${q.discount ? `<div class="summary-line"><span>Discount</span><span>−${price(q.discount)}</span></div>` : ''}<div class="summary-line"><span>Delivery</span><span>${price(q.shipping)}</span></div><div class="summary-line total"><span>Total</span><span>${price(q.total)}</span></div><p class="notice">This store is a preview. Checkout creates a demo order; no payment is collected. Please use fictional contact details.</p><button class="button wide" id="checkout">Try demo checkout <span>↗</span></button>`; $('#checkout').onclick = checkout; } catch(err) { if($('#quote')) $('#quote').innerHTML = `<p class="error">${e(err.message)}</p>`; }
}
async function checkout() {
  let account;
  try { account=await currentCustomer(); } catch(err) {toast(err.message);return;}
  if(!account){$('#bag-dialog').close();requireAccount(()=>{$('#bag-dialog').showModal();checkout();});return;}
  $('#bag-content').innerHTML = `<button class="text-link" id="back-bag">← Back to cart</button><h3 class="checkout-title">Delivery details</h3><p class="notice">Demo checkout only. Use fictional details. No payment will be taken.</p><form id="checkout-form"><label class="field">Full name<input name="name" required maxlength="100" autocomplete="name"></label><label class="field">Email<input name="email" type="email" required maxlength="200" autocomplete="email"></label><label class="field">Delivery address<textarea name="address" required maxlength="500" autocomplete="street-address"></textarea></label><label class="field">Order note (optional)<textarea name="note" maxlength="1000"></textarea></label><p id="checkout-error" class="error" role="alert"></p><button class="button wide">Place demo order <span>↗</span></button></form>`;
  $('#back-bag').onclick = renderBag;
  $('#checkout-form [name="name"]').value=account.name;
  $('#checkout-form [name="email"]').value=account.email;
  $('#checkout-form [name="email"]').readOnly=true;
  $('#checkout-form [name="address"]').value=account.address;
  $('#checkout-form').onsubmit = async ev => { ev.preventDefault(); const button = ev.target.querySelector('button'); button.disabled = true; const f = Object.fromEntries(new FormData(ev.target)); try { const order = await api('/api/orders','POST',{items:cart,code,customer:{name:f.name,email:f.email,address:f.address},note:f.note}); cart=[];code='';save(); $('#bag-content').innerHTML = `<div class="success-mark">✓</div><h2>A little joy is on the list.</h2><p>Demo order <strong>${e(order.id)}</strong> was created.</p><p class="notice">No payment was collected. This is a preview order and will not be fulfilled. You can follow its status in your account.</p><a class="button wide" href="/account">View my orders ↗</a>`; data = await api('/api/store'); renderProducts(); } catch(err) { if($('#checkout-error')) { $('#checkout-error').textContent=err.message; button.disabled=false; } } };
}
async function init() {
  bindDialogs(); $('#year').textContent=new Date().getFullYear(); save();
  try {
    data=await api('/api/store'); const settings=data.settings;
    document.title=settings.name+' — Handmade for your everyday';
    document.querySelectorAll('.wordmark').forEach(el=>{el.innerHTML=brand(settings.name);el.setAttribute('aria-label',settings.name+' home');});
    $('#headline').textContent=settings.headline;$('#description').textContent=settings.description;$('#announcement').textContent=settings.announcement;$('#story-text').textContent=settings.story;
    if(settings.email){const link=document.createElement('a');link.href='mailto:'+settings.email;link.textContent=settings.email;$('#contact-link').replaceChildren(link);}
    page=preparePage(data);category=page.category;
    $('#categories').innerHTML='<a href="/shop" data-category="All">All pieces</a>'+data.categories.map(c=>'<a href="'+collectionUrl(c)+'" data-category="'+e(c)+'">'+e(c)+'</a>').join('');
    $('#categories').querySelectorAll('a').forEach(link=>{const active=location.pathname !== '/' && !page.account && link.dataset.category===category;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');});
    if(page.product)renderProductPage(page.product,data,addToBag);
    if($('#search')){const q=new URLSearchParams(location.search).get('q');if(q)$('#search').value=q;$('#search').oninput=renderProducts;$('#sort').onchange=renderProducts;$('#sort').parentElement.insertAdjacentHTML('beforebegin','<span id="results-count" class="results-count" aria-live="polite"></span>');}
    $('#search-toggle').onclick=()=>{if(page.product||page.missing)location.href='/shop?search=1';else{$('#collection').scrollIntoView();$('#search').focus({preventScroll:true});}};
    $('#bag-open').onclick=()=>{renderBag();$('#bag-dialog').showModal();};
    initContact(settings);await initAccount();renderProducts();fallbackImages();
    document.addEventListener('submit',ev=>{const form=ev.target.closest('[data-quick-add]');if(!form)return;ev.preventDefault();const p=data.products.find(p=>p.id===form.dataset.quickAdd);if(p && addToBag(p,new FormData(form).get('size'))){const b=form.querySelector('button');b.textContent='Added ✓';setTimeout(()=>{if(b.isConnected)b.innerHTML='Add to cart <span>+</span>';},1600);}});
    if(new URLSearchParams(location.search).has('search'))$('#search')?.focus();
  }catch(err){const target=$('#products')||$('main');target.innerHTML='<p class="error">Unable to load the collection. '+e(err.message)+' Please refresh to try again.</p>';}
}
init();
