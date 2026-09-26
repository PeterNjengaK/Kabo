import { escape as e, money } from './shared.js';
export const collectionUrl = category => '/collections/' + category.toLowerCase();
export const productUrl = product => '/products/' + encodeURIComponent(product.id);
export function cards(products, currency) {
  return products.map(p => `<article class="product-tile"><a class="product-card" href="${productUrl(p)}" data-product="${e(p.id)}"><div class="product-image"><img src="${e(p.image || '/assets/placeholder.svg')}" alt="${e(p.name)}" loading="lazy">${p.stock === 0 ? '<span class="tag">SOLD OUT</span>' : ''}<span class="card-discover">Discover the piece <span>↗</span></span></div><div class="product-info"><span>${e(p.name)}</span><span>${money(p.price, currency)}</span></div><span class="product-category">${e(p.category)} · Handmade crochet</span></a><form class="quick-add" data-quick-add="${e(p.id)}">${p.sizes.length>1?`<select name="size" required aria-label="Size for ${e(p.name)}"><option value="">Size</option>${p.sizes.map(s=>`<option>${e(s)}</option>`).join('')}</select>`:`<input type="hidden" name="size" value="${e(p.sizes[0])}">`}<button ${p.stock?'':'disabled'} aria-label="Add ${e(p.name)} to cart">${p.stock?'Add to cart <span>+</span>':'Sold out'}</button></form></article>`).join('') || '<p class="empty">No pieces found. Try another category or search.</p>';
}
const descriptions = {
  Shrugs: ['The finishing touch.', 'Soft layers, open textures, and a little warmth. Discover crochet shrugs to make the everyday your own.'],
  Cardigans: ['A softer kind of layer.', 'Considered textures and easy silhouettes. Cardigans to reach for, again and again.'],
  Tops: ['Texture takes the lead.', 'Expressive crochet tops with a relaxed point of view. A little character for whatever the day holds.'],
  Bags: ['Carry a little character.', 'From everyday essentials to spontaneous plans. Discover bags with texture, charm, and a handmade touch.'],
  Scrunchies: ['Small piece. Lovely detail.', 'Soft crochet accents for a simple finishing touch. Find your favourite shade and make it yours.'],
  Shorts: ['Easy days, thoughtfully made.', 'Relaxed crochet shorts for a wardrobe with a little more texture.'],
  Skirts: ['Made to move with you.', 'Discover crochet skirts with expressive stitches and an easy sense of style.']
};
export function preparePage(data) {
  const path = location.pathname;
  if(path === '/account') { document.body.classList.add('inner-page');document.querySelector('main').innerHTML='<p class="empty">Opening your account…</p>';return {category:'All',account:true}; }
  if(path === '/') return { category: 'All', product: null };
  document.body.classList.add('inner-page');
  document.querySelector('.hero').hidden = true;
  document.querySelector('#story').hidden = true;
  const product = path.startsWith('/products/') ? data.products.find(p => productUrl(p) === path) : null;
  const category = path.startsWith('/collections/') ? data.categories.find(c => collectionUrl(c) === path) : 'All';
  if((path.startsWith('/products/') && !product) || !category) {
    document.querySelector('main').innerHTML = '<section class="not-found section"><span class="eyebrow">A LITTLE DETOUR / 404</span><h1>This piece isn’t here.</h1><p>It may have moved or is no longer available.</p><a class="button" href="/shop">Explore the collection ↗</a></section>';
    document.title = 'Page not found — ' + data.settings.name;
    return { category:'All', missing:true };
  }
  if(product) { document.querySelector('#collection').hidden = true; return { category:product.category, product }; }
  const title = category === 'All' ? 'The collection.' : category + '.';
  const [subtitle, description] = descriptions[category] || ['Made by hand. Chosen by you.', 'Discover crochet clothing and accessories with a personal touch. Find something that feels like you.'];
  const intro = document.createElement('section');intro.className='collection-intro';
  intro.innerHTML=`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/shop">Shop</a>${category !== 'All' ? `<span>/</span><span aria-current="page">${e(category)}</span>` : ''}</nav><div class="collection-intro-content"><div><span class="eyebrow">THE KABO COLLECTION</span><h1>${e(title)}</h1></div><div><h2>${e(subtitle)}</h2><p>${e(description)}</p></div></div>`;
  document.querySelector('#collection').before(intro);document.title=`${category === 'All' ? 'Shop all' : category} — ${data.settings.name}`;
  document.querySelector('#collection .section-heading').hidden=true;
  document.querySelector('meta[name="description"]').content=description;
  return {category,product:null};
}
export function renderProductPage(p, data, addToBag) {
  const photos = [...new Set([p.image, ...(p.images || [])].filter(Boolean))];if(!photos.length)photos.push('/assets/placeholder.svg');
  const frames=p.images360 || [];
  const section=document.createElement('section');section.className='product-page';section.id='product-page';
  section.innerHTML=`<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="${collectionUrl(p.category)}">${e(p.category)}</a><span>/</span><span aria-current="page">${e(p.name)}</span></nav><div class="product-page-layout"><div class="product-gallery"><div class="gallery-stage"><div class="gallery-track" id="gallery-track" tabindex="0" aria-label="Product photos. Swipe or use the photo buttons.">${photos.map((src,i)=>`<img src="${e(src)}" alt="${e(p.name)} — photo ${i+1}" ${i?'loading="lazy"':'fetchpriority="high"'}>`).join('')}</div>${photos.length>1?'<button class="gallery-arrow prev" id="gallery-prev" aria-label="Previous photo">←</button><button class="gallery-arrow next" id="gallery-next" aria-label="Next photo">→</button>':''}<span class="gallery-counter" id="gallery-counter">01 / ${String(photos.length).padStart(2,'0')}</span></div><div class="gallery-thumbs" aria-label="Choose product photo">${photos.map((src,i)=>`<button data-photo="${i}" aria-label="Show photo ${i+1}" aria-pressed="${i===0}"><img src="${e(src)}" alt="" loading="lazy"></button>`).join('')}${frames.length>=4?'<button class="spin-open" id="spin-open">↻<small>360° VIEW</small></button>':''}</div><p class="gallery-hint">${photos.length>1?'Swipe through the details. Select a thumbnail for a closer look.':'A closer look at the handmade details.'}</p></div><div class="product-purchase"><span class="eyebrow">KABO / ${e(p.category).toUpperCase()}</span><h1>${e(p.name)}</h1><div class="product-price">${money(p.price,data.settings.currency)}<span>Sample collection</span></div><p class="product-intro">A little texture. A piece of you.</p><form id="add-form"><fieldset class="size-options"><legend>Choose your size</legend>${p.sizes.map((s,i)=>`<label><input type="radio" name="size" value="${e(s)}" ${i===0?'checked':''} required><span>${e(s)}</span></label>`).join('')}</fieldset><p class="availability">${p.stock ? `${p.stock} available · Handmade crochet` : 'Currently sold out'}</p><button class="button wide" ${p.stock?'':'disabled'}>${p.stock?'Add to cart':'Sold out'} <span>+</span></button><p class="added-message" id="added-message" role="status"></p></form><div class="product-promises"><span>✳ Made by hand</span><span>◇ A considered detail</span></div><details class="product-accordion" open><summary>About this piece</summary><p>${e(p.description)}</p></details><details class="product-accordion"><summary>Delivery & ordering</summary><p>Delivery is ${money(data.settings.shipping,data.settings.currency)} per order. This is a preview collection; checkout creates a demo order and no payment is collected.</p></details><details class="product-accordion"><summary>Sizing & care</summary><p>Available sizes: ${e(p.sizes.join(', '))}. Measurements, fibre composition, and care instructions will be confirmed with the real collection. Message the studio if you have a question.</p></details><button class="text-link product-question" id="product-question">A question about this piece? <span>↗</span></button></div></div></section><section class="section related"><div class="section-heading"><div><span class="eyebrow">A LITTLE MORE TO LOVE</span><h2>Lovely alongside.</h2></div><a class="text-link" href="/shop">Explore all ↗</a></div><div class="product-grid">${cards(data.products.filter(x=>x.id!==p.id).slice(0,4),data.settings.currency)}</div></section>`;
  document.querySelector('main').prepend(section);
  document.title=`${p.name} — ${data.settings.name}`;document.querySelector('meta[name="description"]').content=p.description.slice(0,160);
  document.querySelector('#add-form').onsubmit=ev=>{ev.preventDefault();const size=new FormData(ev.target).get('size');if(addToBag(p,size))document.querySelector('#added-message').textContent='Added to your cart. A lovely choice.';};
  document.querySelector('#product-question').onclick=()=>document.querySelector('#chat-toggle').click();
  const track=document.querySelector('#gallery-track');let current=0;
  const go=i=>{current=(i+photos.length)%photos.length;track.scrollTo({left:current*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>go(Number(b.dataset.photo)));
  if(photos.length>1){document.querySelector('#gallery-prev').onclick=()=>go(current-1);document.querySelector('#gallery-next').onclick=()=>go(current+1);}
  track.onkeydown=ev=>{if(['ArrowLeft','ArrowRight'].includes(ev.key)){ev.preventDefault();go(current+(ev.key==='ArrowLeft'?-1:1));}};
  track.onscroll=()=>{current=Math.round(track.scrollLeft/track.clientWidth);document.querySelector('#gallery-counter').textContent=`${String(current+1).padStart(2,'0')} / ${String(photos.length).padStart(2,'0')}`;document.querySelectorAll('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.photo)===current)));};
  if(frames.length>=4)document.querySelector('#spin-open').onclick=()=>openSpin(p,frames);
}
function openSpin(p,frames){
  let dialog=document.querySelector('#spin-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='spin-dialog';dialog.className='spin-dialog';document.body.append(dialog);}
  dialog.innerHTML=`<button class="dialog-close" aria-label="Close 360 viewer">×</button><span class="eyebrow">EXPLORE EVERY ANGLE</span><h2>${e(p.name)}</h2><div class="spin-stage" id="spin-stage"><img id="spin-image" src="${e(frames[0])}" alt="${e(p.name)} — rotation frame 1" draggable="false"></div><p id="spin-state" role="status">Loading rotation photos…</p><label class="field">Drag the image or move the slider to rotate<input id="spin-range" type="range" min="0" max="${frames.length-1}" value="0" aria-label="Product rotation angle" disabled></label>`;
  dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.showModal();
  let frame=0,start=0,origin=0,ready=false;
  const show=i=>{if(!ready)return;frame=(i+frames.length)%frames.length;const img=document.querySelector('#spin-image');img.src=frames[frame];img.alt=`${p.name} — rotation frame ${frame+1}`;document.querySelector('#spin-range').value=frame;document.querySelector('#spin-range').setAttribute('aria-valuetext',`${Math.round(frame/frames.length*360)} degrees`);document.querySelector('#spin-state').textContent=`${Math.round(frame/frames.length*360)}° · ${frame+1} of ${frames.length}`;};
  document.querySelector('#spin-range').oninput=ev=>show(Number(ev.target.value));
  const stage=document.querySelector('#spin-stage');stage.onpointerdown=ev=>{if(!ready)return;start=ev.clientX;origin=frame;stage.setPointerCapture(ev.pointerId);};stage.onpointermove=ev=>{if(stage.hasPointerCapture(ev.pointerId))show(origin+Math.round((ev.clientX-start)/12));};stage.onpointerup=ev=>{if(stage.hasPointerCapture(ev.pointerId))stage.releasePointerCapture(ev.pointerId);};
  Promise.all(frames.map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=src;}))).then(()=>{if(!dialog.open)return;ready=true;document.querySelector('#spin-range').disabled=false;show(0);}).catch(()=>{if(dialog.open)document.querySelector('#spin-state').textContent='Some rotation photos could not load. Please try again later.';});
}
