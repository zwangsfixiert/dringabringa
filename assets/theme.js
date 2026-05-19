/* ═══════════════════════════════════════════
   DRINGABRINGA – theme.js v3.1
   AJAX Cart · Toast · Mobile Nav · Live Clock · Free-Ship Bar
   Öffnungszeiten-Sperre · Mobile Optimierungen
════════════════════════════════════════════ */

/* ── ÖFFNUNGSZEITEN ── */
var OPEN_HOUR  = 21;  // 21:00 Uhr
var CLOSE_HOUR = 9;   // 09:00 Uhr

function isShopOpen() {
  var h = new Date().getHours();
  return h >= OPEN_HOUR || h < CLOSE_HOUR;
}

function getMinutesUntilOpen() {
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var openMin = OPEN_HOUR * 60;
  var currentMin = h * 60 + m;
  var diff = openMin - currentMin;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/* Overlay anzeigen wenn geschlossen */
function applyClosedState() {
  var open = isShopOpen();

  /* Alle ATC-Buttons sperren/entsperren */
  document.querySelectorAll(
    '.product-page-atc, .btn-sticky-atc, [onclick*="addToCart"], [onclick*="addToCartSticky"]'
  ).forEach(function(btn) {
    if (!open) {
      btn.disabled = true;
      btn.classList.add('btn-closed');
      if (!btn.dataset.origText) btn.dataset.origText = btn.innerHTML;
      btn.innerHTML = '🔒 Geschlossen · Öffnet um 21:00';
    } else {
      btn.disabled = false;
      btn.classList.remove('btn-closed');
      if (btn.dataset.origText) btn.innerHTML = btn.dataset.origText;
    }
  });

  /* Checkout-Button im Warenkorb */
  var checkoutBtn = document.querySelector('.checkout-btn');
  if (checkoutBtn) {
    if (!open) {
      checkoutBtn.disabled = true;
      checkoutBtn.classList.add('btn-closed');
      if (!checkoutBtn.dataset.origText) checkoutBtn.dataset.origText = checkoutBtn.innerHTML;
      checkoutBtn.innerHTML = '🔒 Geschlossen · Bestellen ab 21:00 Uhr';
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove('btn-closed');
      if (checkoutBtn.dataset.origText) checkoutBtn.innerHTML = checkoutBtn.dataset.origText;
    }
  }

  /* Geschlossen-Banner oben auf der Seite */
  var banner = document.getElementById('closedBanner');
  if (!open) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'closedBanner';
      banner.className = 'closed-banner';
      var diff = getMinutesUntilOpen();
      var hrs  = Math.floor(diff / 60);
      var mins = diff % 60;
      var timeStr = hrs > 0 ? hrs + 'h ' + mins + 'min' : mins + ' Min';
      banner.innerHTML =
        '<span class="closed-banner-icon">🌙</span>' +
        '<span>Derzeit geschlossen – Wir öffnen heute um <strong>21:00 Uhr</strong>' +
        (diff > 0 ? ' (in ' + timeStr + ')' : '') + '</span>' +
        '<span class="closed-banner-sub">Täglich 21:00 – 09:00 Uhr · Wels</span>';
      /* Einfügen direkt unter dem Header */
      var header = document.querySelector('.site-header');
      if (header && header.nextSibling) {
        header.parentNode.insertBefore(banner, header.nextSibling);
      } else {
        document.body.prepend(banner);
      }
    }
  } else {
    if (banner) banner.remove();
  }
}

/* ── TOAST ── */
var toastTimer;
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2800);
}

/* ── FORMAT MONEY ── */
function formatMoney(cents) {
  return (cents / 100).toLocaleString('de-AT', { style: 'currency', currency: 'EUR' });
}

/* ── CART CACHE ── */
var _cartCache = null;
async function getCart() {
  if (_cartCache) return _cartCache;
  var res = await fetch('/cart.js');
  _cartCache = await res.json();
  return _cartCache;
}
function invalidateCart() { _cartCache = null; }

/* ── UPDATE CART UI ── */
function updateCartUI(count, totalPrice) {
  document.querySelectorAll('.cart-count').forEach(function(el) { el.textContent = count; });
  document.querySelectorAll('.cart-total').forEach(function(el) {
    el.textContent = count > 0 ? formatMoney(totalPrice) : '';
    el.style.display = count > 0 ? '' : 'none';
  });
  document.querySelectorAll('.cart-link').forEach(function(el) {
    el.setAttribute('aria-label', 'Warenkorb – ' + count + ' Artikel');
  });
  updateFreeShipBar(totalPrice);
}

/* ── FREE-SHIP BAR ── */
function updateFreeShipBar(totalCents) {
  var THRESHOLD = 2000;
  var bar = document.getElementById('fdsBar');
  if (!bar) return;
  var pct  = Math.min(Math.round((totalCents / THRESHOLD) * 100), 100);
  var fill = bar.querySelector('.fds-fill');
  var label = bar.querySelector('.fds-label');
  if (fill) fill.style.width = pct + '%';
  if (totalCents >= THRESHOLD) {
    bar.classList.add('reached');
    if (label) label.innerHTML = '🎉 Gratis-Lieferung inklusive!';
  } else {
    bar.classList.remove('reached');
    var remaining = formatMoney(THRESHOLD - totalCents);
    if (label) label.innerHTML = 'Noch <strong>' + remaining + '</strong> bis zur Gratis-Lieferung';
  }
}

/* ── ADD TO CART (mit Öffnungszeiten-Check) ── */
async function addToCart(btn) {
  if (!isShopOpen()) {
    showToast('🔒 Derzeit geschlossen. Wir öffnen um 21:00 Uhr!');
    return;
  }
  var variantId = btn.dataset.variantId;
  var title = btn.dataset.productTitle || 'Produkt';
  if (!variantId) return;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    var res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: variantId, quantity: 1 })
    });
    if (!res.ok) throw new Error('Fehler');
    invalidateCart();
    var cart = await getCart();
    updateCartUI(cart.item_count, cart.total_price);
    updateCartQtyBadge(variantId, cart);
    btn.textContent = '✓';
    btn.classList.add('added');
    showToast('✅ ' + title + ' zum Warenkorb hinzugefügt');
    setTimeout(function() {
      btn.textContent = '+';
      btn.classList.remove('added');
      btn.disabled = false;
    }, 1400);
  } catch(err) {
    console.error(err);
    showToast('❌ Fehler – bitte nochmal versuchen');
    btn.textContent = '+';
    btn.disabled = false;
  }
}

/* ── REMOVE FROM CART ── */
async function removeFromCart(btn) {
  var variantId = btn.dataset.variantId;
  var title = btn.dataset.productTitle || 'Produkt';
  if (!variantId) return;
  btn.textContent = '…';
  btn.disabled = true;
  try {
    var cart = await getCart();
    var item  = cart.items.find(function(i) { return String(i.variant_id) === String(variantId); });
    if (!item) { btn.textContent = '−'; btn.disabled = false; return; }
    var newQty = item.quantity - 1;
    var res = await fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.key, quantity: newQty })
    });
    if (!res.ok) throw new Error();
    invalidateCart();
    var updatedCart = await getCart();
    updateCartUI(updatedCart.item_count, updatedCart.total_price);
    updateCartQtyBadge(variantId, updatedCart);
    btn.textContent = '✓';
    showToast(newQty === 0 ? '🗑️ ' + title + ' entfernt' : '➖ ' + title + ' reduziert');
    setTimeout(function() { btn.textContent = '−'; btn.disabled = false; }, 1400);
  } catch(err) {
    console.error(err);
    showToast('❌ Fehler – bitte nochmal versuchen');
    btn.textContent = '−';
    btn.disabled = false;
  }
}

/* ── CART QTY BADGE ── */
function updateCartQtyBadge(variantId, cart) {
  var item = cart.items.find(function(i) { return String(i.variant_id) === String(variantId); });
  var qty  = item ? item.quantity : 0;
  document.querySelectorAll('[data-variant-id="' + variantId + '"]').forEach(function(btn) {
    var card = btn.closest('.product-card');
    if (!card) return;
    var badge = card.querySelector('.cart-qty-badge');
    if (qty > 0) {
      card.classList.add('in-cart');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'cart-qty-badge';
        var wrap = card.querySelector('.product-img-wrap');
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
  var now  = new Date();
  var h    = now.getHours();
  var m    = now.getMinutes();
  var hh   = String(h).padStart(2, '0');
  var mm   = String(m).padStart(2, '0');
  var open = isShopOpen();

  var timeStr = '';
  if (open) {
    var closeH   = h >= OPEN_HOUR ? 33 : CLOSE_HOUR;
    var totalMin = closeH * 60 - (h * 60 + m);
    var rh = Math.floor(totalMin / 60);
    var rm = totalMin % 60;
    timeStr = 'Offen · Noch ' + rh + 'h ' + rm + 'm';
  } else {
    var openMin = getMinutesUntilOpen();
    var oh = Math.floor(openMin / 60);
    var om = openMin % 60;
    timeStr = oh > 0 ? 'Öffnet in ' + oh + 'h ' + om + 'm' : 'Öffnet in ' + om + ' Min';
  }

  var badge = document.querySelector('.header-badge');
  if (badge) {
    badge.classList.toggle('closed', !open);
    var span = badge.querySelector('.badge-text');
    if (span) span.textContent = timeStr + ' · ' + hh + ':' + mm;
    else badge.innerHTML = '<div class="live-dot"></div>' + timeStr + ' · ' + hh + ':' + mm;
  }

  var heroBadge = document.getElementById('heroBadge');
  if (heroBadge) {
    heroBadge.classList.toggle('closed', !open);
    var hspan = heroBadge.querySelector('.hero-badge-text');
    if (open) {
      if (hspan) hspan.textContent = 'Jetzt geöffnet · Lieferung in 25 Min';
    } else {
      if (hspan) hspan.textContent = 'Geschlossen · ' + timeStr;
    }
  }

  /* Geschlossen-Zustand auf Buttons anwenden */
  applyClosedState();
}

updateStatusBadge();
setInterval(updateStatusBadge, 30000);

/* ── MOBILE NAV ── */
function closeMobileNav() {
  var nav     = document.getElementById('mobileNav');
  var overlay = document.getElementById('mobileNavOverlay');
  var btn     = document.getElementById('burgerBtn');
  if (nav)     { nav.classList.remove('open'); nav.setAttribute('aria-hidden', 'true'); }
  if (overlay) { overlay.classList.remove('open'); }
  if (btn)     { btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Menü öffnen'); }
  document.body.classList.remove('nav-open');
}

document.addEventListener('DOMContentLoaded', function() {
  /* Mobile nav */
  var btn     = document.getElementById('burgerBtn');
  var nav     = document.getElementById('mobileNav');
  var overlay = document.getElementById('mobileNavOverlay');

  if (btn && nav) {
    btn.addEventListener('click', function() {
      var isOpen = nav.classList.contains('open');
      if (isOpen) {
        closeMobileNav();
      } else {
        nav.classList.add('open'); nav.setAttribute('aria-hidden', 'false');
        if (overlay) overlay.classList.add('open');
        btn.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Menü schließen');
        document.body.classList.add('nav-open');
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMobileNav();
  });

  /* Freeship bar */
  var fdsBar = document.getElementById('fdsBar');
  if (fdsBar) {
    var total = parseInt(fdsBar.dataset.total || '0', 10);
    updateFreeShipBar(total);
  }

  /* Öffnungszeiten beim Start anwenden */
  applyClosedState();
});
