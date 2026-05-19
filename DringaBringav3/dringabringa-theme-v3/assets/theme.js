/* ═══════════════════════════════════════════
   DRINGABRINGA – theme.js v3
   AJAX Cart · Toast · Mobile Nav · Live Clock · Free-Ship Bar
════════════════════════════════════════════ */

/* ── TOAST ── */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ── FORMAT MONEY ── */
function formatMoney(cents) {
  return (cents / 100).toLocaleString('de-AT', { style: 'currency', currency: 'EUR' });
}

/* ── CART CACHE ── */
let _cartCache = null;
async function getCart() {
  if (_cartCache) return _cartCache;
  const res = await fetch('/cart.js');
  _cartCache = await res.json();
  return _cartCache;
}
function invalidateCart() { _cartCache = null; }

/* ── UPDATE CART UI ── */
function updateCartUI(count, totalPrice) {
  // Count badges
  document.querySelectorAll('.cart-count').forEach(el => { el.textContent = count; });

  // Total in header
  document.querySelectorAll('.cart-total').forEach(el => {
    el.textContent = count > 0 ? formatMoney(totalPrice) : '';
    el.style.display = count > 0 ? '' : 'none';
  });

  // Aria label
  document.querySelectorAll('.cart-link').forEach(el => {
    el.setAttribute('aria-label', 'Warenkorb – ' + count + ' Artikel');
  });

  // Free-ship progress bar in header
  updateFreeShipBar(totalPrice);
}

/* ── FREE-SHIP BAR ── */
function updateFreeShipBar(totalCents) {
  const THRESHOLD = 2000; // € 20.00
  const bar = document.getElementById('fdsBar');
  if (!bar) return;

  const pct = Math.min(Math.round((totalCents / THRESHOLD) * 100), 100);
  const fill = bar.querySelector('.fds-fill');
  const label = bar.querySelector('.fds-label');

  if (fill) fill.style.width = pct + '%';

  if (totalCents >= THRESHOLD) {
    bar.classList.add('reached');
    if (label) label.innerHTML = '🎉 Gratis-Lieferung inklusive!';
  } else {
    bar.classList.remove('reached');
    const remaining = formatMoney(THRESHOLD - totalCents);
    if (label) label.innerHTML = 'Noch <strong>' + remaining + '</strong> bis zur Gratis-Lieferung';
  }
}

/* ── ADD TO CART ── */
async function addToCart(btn) {
  const variantId = btn.dataset.variantId;
  const title = btn.dataset.productTitle || 'Produkt';
  if (!variantId) return;

  btn.textContent = '…';
  btn.disabled = true;

  try {
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    });
    if (!res.ok) throw new Error('Fehler');

    invalidateCart();
    const cart = await getCart();
    updateCartUI(cart.item_count, cart.total_price);
    updateCartQtyBadge(variantId, cart);

    btn.textContent = '✓';
    btn.classList.add('added');
    showToast('✅ ' + title + ' zum Warenkorb hinzugefügt');

    setTimeout(() => {
      btn.textContent = '+';
      btn.classList.remove('added');
      btn.disabled = false;
    }, 1400);

  } catch (err) {
    console.error(err);
    showToast('❌ Fehler – bitte nochmal versuchen');
    btn.textContent = '+';
    btn.disabled = false;
  }
}

/* ── REMOVE FROM CART ── */
async function removeFromCart(btn) {
  const variantId = btn.dataset.variantId;
  const title = btn.dataset.productTitle || 'Produkt';
  if (!variantId) return;

  btn.textContent = '…';
  btn.disabled = true;

  try {
    const cart = await getCart();
    const item = cart.items.find(i => String(i.variant_id) === String(variantId));

    if (!item) { btn.textContent = '−'; btn.disabled = false; return; }

    const newQty = item.quantity - 1;
    const res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.key, quantity: newQty })
    });
    if (!res.ok) throw new Error();

    invalidateCart();
    const updatedCart = await getCart();
    updateCartUI(updatedCart.item_count, updatedCart.total_price);
    updateCartQtyBadge(variantId, updatedCart);

    btn.textContent = '✓';
    showToast(newQty === 0 ? '🗑️ ' + title + ' entfernt' : '➖ ' + title + ' reduziert');

    setTimeout(() => { btn.textContent = '−'; btn.disabled = false; }, 1400);

  } catch (err) {
    console.error(err);
    showToast('❌ Fehler – bitte nochmal versuchen');
    btn.textContent = '−';
    btn.disabled = false;
  }
}

/* ── CART QTY BADGE on product cards ── */
function updateCartQtyBadge(variantId, cart) {
  const item = cart.items.find(i => String(i.variant_id) === String(variantId));
  const qty = item ? item.quantity : 0;

  // Find the product card that has a button with this variantId
  document.querySelectorAll('[data-variant-id="' + variantId + '"]').forEach(btn => {
    const card = btn.closest('.product-card');
    if (!card) return;

    let badge = card.querySelector('.cart-qty-badge');
    if (qty > 0) {
      card.classList.add('in-cart');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'cart-qty-badge';
        const wrap = card.querySelector('.product-img-wrap');
        if (wrap) wrap.appendChild(badge);
      }
      badge.textContent = qty;
    } else {
      card.classList.remove('in-cart');
      if (badge) badge.remove();
    }
  });
}

/* ── LIVE CLOCK + OPEN/CLOSED STATUS ── */
function updateStatusBadge() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const isOpen = h >= 21 || h < 9;

  // Time until close (9:00) or open (21:00)
  let timeStr = '';
  if (isOpen) {
    const closeH = h >= 21 ? 33 : 9;
    const totalMin = closeH * 60 - (h * 60 + m);
    const rh = Math.floor(totalMin / 60);
    const rm = totalMin % 60;
    timeStr = 'Offen · Noch ' + rh + 'h ' + rm + 'm';
  } else {
    const openMin = 21 * 60 - (h * 60 + m);
    const oh = Math.floor(openMin / 60);
    const om = openMin % 60;
    timeStr = 'Öffnet in ' + oh + 'h ' + om + 'm';
  }

  // Header badge
  const badge = document.querySelector('.header-badge');
  if (badge) {
    badge.classList.toggle('closed', !isOpen);
    const span = badge.querySelector('.badge-text');
    if (span) span.textContent = timeStr + ' · ' + hh + ':' + mm;
    else badge.innerHTML = '<div class="live-dot"></div>' + timeStr + ' · ' + hh + ':' + mm;
  }

  // Hero badge
  const heroBadge = document.getElementById('heroBadge');
  if (heroBadge) {
    heroBadge.classList.toggle('closed', !isOpen);
    const span = heroBadge.querySelector('.hero-badge-text');
    if (isOpen) {
      if (span) span.textContent = 'Jetzt geöffnet · Lieferung in 25 Min';
    } else {
      if (span) span.textContent = 'Öffnet heute um 21:00 Uhr · ' + timeStr;
    }
  }
}

updateStatusBadge();
setInterval(updateStatusBadge, 30000);

/* ── MOBILE NAV ── */
function closeMobileNav() {
  const nav     = document.getElementById('mobileNav');
  const overlay = document.getElementById('mobileNavOverlay');
  const btn     = document.getElementById('burgerBtn');
  if (nav)     { nav.classList.remove('open'); nav.setAttribute('aria-hidden', 'true'); }
  if (overlay) { overlay.classList.remove('open'); }
  if (btn)     { btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Menü öffnen'); }
  document.body.classList.remove('nav-open');
}

document.addEventListener('DOMContentLoaded', function () {
  // Mobile nav
  const btn     = document.getElementById('burgerBtn');
  const nav     = document.getElementById('mobileNav');
  const overlay = document.getElementById('mobileNavOverlay');

  if (btn && nav) {
    btn.addEventListener('click', function () {
      const isOpen = nav.classList.contains('open');
      if (isOpen) {
        closeMobileNav();
      } else {
        nav.classList.add('open');
        nav.setAttribute('aria-hidden', 'false');
        if (overlay) overlay.classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Menü schließen');
        document.body.classList.add('nav-open');
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMobileNav();
  });

  // Init free-ship bar from server-rendered data attribute
  const fdsBar = document.getElementById('fdsBar');
  if (fdsBar) {
    const total = parseInt(fdsBar.dataset.total || '0', 10);
    updateFreeShipBar(total);
  }
});
