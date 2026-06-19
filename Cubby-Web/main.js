/* =========================================================
   CUBBY – Prototyp Interaktion
   Reine Frontend-Demo: Warenkorb via localStorage, kein Backend.
   ========================================================= */
(function () {
  "use strict";

  var CART_KEY = "cubby_cart";

  /* ---------- Helpers ---------- */
  function euro(n) {
    return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
  }
  function cartCount(cart) {
    return cart.reduce(function (sum, i) { return sum + i.qty; }, 0);
  }
  function cartSubtotal(cart) {
    return cart.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
  }

  function addToCart(item) {
    var cart = loadCart();
    var found = cart.find(function (i) { return i.id === item.id; });
    if (found) { found.qty += 1; }
    else { cart.push({ id: item.id, name: item.name, cat: item.cat, price: item.price, img: item.img, qty: 1 }); }
    saveCart(cart);
  }

  /* ---------- Cart count badge (alle Seiten) ---------- */
  function updateCartCount() {
    var count = cartCount(loadCart());
    $all("[data-cart-count]").forEach(function (el) {
      el.textContent = count;
      el.setAttribute("data-empty", count === 0 ? "true" : "false");
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function showToast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.innerHTML = "🛒 " + msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 2200);
  }

  /* ---------- Mobile-Navigation ---------- */
  function initNav() {
    var toggle = $("#navToggle");
    var links = $("#navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $all("a", links).forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Reveal-on-Scroll ---------- */
  function initReveal() {
    var els = $all(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Shop: Filter + Add to Cart ---------- */
  function initShop() {
    var grid = $("#productGrid");
    if (!grid) return;

    // Add to cart
    $all("[data-add]", grid).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".product-card");
        addToCart({
          id: card.getAttribute("data-id"),
          name: card.getAttribute("data-name"),
          cat: card.getAttribute("data-cat-label"),
          price: parseFloat(card.getAttribute("data-price")),
          img: card.getAttribute("data-img")
        });
        showToast(card.getAttribute("data-name") + " hinzugefügt");
        var orig = btn.textContent;
        btn.textContent = "✓ Hinzugefügt";
        btn.classList.add("is-added");
        setTimeout(function () { btn.textContent = orig; btn.classList.remove("is-added"); }, 1400);
      });
    });

    // Filter
    var filters = $("#shopFilters");
    if (filters) {
      filters.addEventListener("click", function (e) {
        var b = e.target.closest(".chip-filter");
        if (!b) return;
        $all(".chip-filter", filters).forEach(function (c) { c.classList.remove("is-active"); });
        b.classList.add("is-active");
        var f = b.getAttribute("data-filter");
        $all(".product-card", grid).forEach(function (card) {
          var show = f === "alle" || card.getAttribute("data-cat") === f;
          card.classList.toggle("hidden", !show);
        });
      });
    }
  }

  /* ---------- Checkout ---------- */
  function initCheckout() {
    var stepsWrap = $("#checkoutSteps");
    if (!stepsWrap) return; // nicht auf Checkout-Seite

    function renderLines(container, removable) {
      var cart = loadCart();
      if (!container) return;
      if (!cart.length) { container.innerHTML = ""; return; }
      container.innerHTML = cart.map(function (i) {
        if (removable) {
          return '<div class="cart-line" data-line="' + i.id + '">' +
            '<img src="' + i.img + '" alt="' + i.name + '" />' +
            '<div><div class="cart-line__title">' + i.name + '</div>' +
            '<div class="cart-line__cat">' + i.cat + '</div>' +
            '<div class="qty"><button data-dec="' + i.id + '" aria-label="weniger">−</button>' +
            '<span>' + i.qty + '</span>' +
            '<button data-inc="' + i.id + '" aria-label="mehr">+</button></div></div>' +
            '<div><div class="cart-line__price">' + euro(i.price * i.qty) + '</div>' +
            '<button class="cart-line__remove" data-remove="' + i.id + '">Entfernen</button></div>' +
            '</div>';
        }
        return '<div class="summary-row"><span>' + i.qty + '× ' + i.name + '</span><span>' + euro(i.price * i.qty) + '</span></div>';
      }).join("");
    }

    function renderSummary() {
      var cart = loadCart();
      var subtotal = cartSubtotal(cart);
      $all("[data-sum-subtotal]").forEach(function (el) { el.textContent = euro(subtotal); });
      $all("[data-sum-total]").forEach(function (el) { el.textContent = euro(subtotal); });
      // Versand bleibt kostenlos in der Demo
    }

    function renderAll() {
      var cart = loadCart();
      renderLines($("#cartLines"), true);
      renderLines($("#cartLinesMini"), false);
      renderSummary();

      var empty = $("#cartEmpty");
      var lines = $("#cartLines");
      if (empty && lines) {
        var isEmpty = cart.length === 0;
        empty.classList.toggle("hidden", !isEmpty);
        lines.classList.toggle("hidden", isEmpty);
      }
      // "Weiter"-Button sperren wenn leer
      $all("[data-needs-items]").forEach(function (b) {
        b.disabled = cart.length === 0;
        b.style.opacity = cart.length === 0 ? "0.5" : "1";
        b.style.pointerEvents = cart.length === 0 ? "none" : "auto";
      });
    }

    // Qty / remove (event delegation)
    var lineWrap = $("#cartLines");
    if (lineWrap) {
      lineWrap.addEventListener("click", function (e) {
        var inc = e.target.getAttribute("data-inc");
        var dec = e.target.getAttribute("data-dec");
        var rem = e.target.getAttribute("data-remove");
        var cart = loadCart();
        if (inc) {
          var a = cart.find(function (i) { return i.id === inc; }); if (a) a.qty += 1;
        } else if (dec) {
          var b = cart.find(function (i) { return i.id === dec; });
          if (b) { b.qty -= 1; if (b.qty < 1) cart = cart.filter(function (i) { return i.id !== dec; }); }
        } else if (rem) {
          cart = cart.filter(function (i) { return i.id !== rem; });
        } else { return; }
        saveCart(cart);
        renderAll();
      });
    }

    // Step navigation
    function goToStep(n) {
      $all("[data-step]").forEach(function (s) {
        s.classList.toggle("hidden", s.getAttribute("data-step") !== String(n));
      });
      $all(".cstep", stepsWrap).forEach(function (c) {
        var dot = parseInt(c.getAttribute("data-step-dot"), 10);
        c.classList.toggle("is-active", dot === n);
        c.classList.toggle("is-done", dot < n);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    $all("[data-goto-step]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goToStep(parseInt(btn.getAttribute("data-goto-step"), 10));
      });
    });

    // Pay option highlight
    var payWrap = $("[data-pay-options]");
    if (payWrap) {
      payWrap.addEventListener("change", function () {
        $all(".pay-option", payWrap).forEach(function (o) {
          o.classList.toggle("is-selected", o.querySelector("input").checked);
        });
      });
    }

    // Submit -> confirmation
    var form = $("#checkoutForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        var orderNo = "CUBBY-" + Math.floor(100000 + Math.random() * 899999);
        var oEl = $("[data-confirm-order]"); if (oEl) oEl.textContent = orderNo;
        var eEl = $("[data-confirm-email]"); if (eEl) eEl.textContent = $("#email").value || "deine E-Mail";
        renderLines($("#confirmLines"), false);
        renderSummary();
        goToStep(3);
        // Warenkorb nach erfolgreicher (Demo-)Bestellung leeren
        saveCart([]);
      });
    }

    renderAll();
  }

  /* ---------- Newsletter (Fake) ---------- */
  function initNewsletter() {
    $all("[data-newsletter]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        form.innerHTML = '<p style="color:#fff;font-weight:600;margin:0">🎉 Danke! Schön, dass wir uns kennenlernen.</p>';
      });
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    updateCartCount();
    initNav();
    initReveal();
    initShop();
    initCheckout();
    initNewsletter();
  });
})();
