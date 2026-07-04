/* =========================================================================
   GTM Playground — app.js
   All interactions push to window.dataLayer (the real thing GTM listens to)
   and mirror each push into the on-page inspector so you can learn offline.
   ========================================================================= */

(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  // --- Inspector plumbing -------------------------------------------------
  var logEl = document.getElementById("log");
  var pushCountEl = document.getElementById("pushCount");
  var pushCount = 0;

  function render(obj) {
    var empty = logEl.querySelector(".log__empty");
    if (empty) empty.remove();

    var entry = document.createElement("div");
    entry.className = "entry entry--new";

    var head = document.createElement("div");
    head.className = "entry__head";

    var evName = document.createElement("span");
    evName.className = "entry__event";
    evName.textContent = obj.event || "(no event key)";

    var time = document.createElement("span");
    time.className = "entry__time";
    time.textContent = new Date().toLocaleTimeString();

    head.appendChild(evName);
    head.appendChild(time);

    var pre = document.createElement("pre");
    pre.textContent = JSON.stringify(obj, null, 2);

    entry.appendChild(head);
    entry.appendChild(pre);
    logEl.insertBefore(entry, logEl.firstChild);

    pushCount++;
    pushCountEl.textContent = pushCount;
    setTimeout(function () { entry.classList.remove("entry--new"); }, 1000);
  }

  /**
   * Central helper: push to the REAL dataLayer AND mirror to the inspector.
   * This is exactly what you'd call in production (minus the render()).
   */
  function dl(obj) {
    window.dataLayer.push(obj);
    render(obj);
    // eslint-disable-next-line no-console
    console.log("[dataLayer.push]", obj);
  }

  // --- 2. Event testers ---------------------------------------------------
  document.querySelectorAll("[data-demo]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var kind = el.getAttribute("data-demo");

      if (kind === "custom") {
        dl({ event: "custom_event", source: "playground", value: 1 });
      }

      if (kind === "cta") {
        dl({
          event: "cta_click",
          button_text: el.textContent.trim(),
          button_id: "cta-primary",
          page_section: "events"
        });
      }

      if (kind === "outbound") {
        e.preventDefault();
        dl({
          event: "click_outbound",
          link_url: "https://example.com",
          link_domain: "example.com"
        });
      }

      // Ecommerce buttons live inside a <article class="product"> with data-*
      if (kind === "view_item" || kind === "add_to_cart") {
        var card = el.closest(".product");
        var item = {
          item_id: card.dataset.id,
          item_name: card.dataset.name,
          price: parseFloat(card.dataset.price),
          quantity: 1
        };
        if (kind === "view_item") {
          // GA4 requires clearing ecommerce before each ecommerce push
          dl({ ecommerce: null });
          dl({ event: "view_item", ecommerce: { currency: "EUR", value: item.price, items: [item] } });
        } else {
          addToCart(item);
        }
      }
    });
  });

  // --- 2b. Form submission ------------------------------------------------
  var form = document.getElementById("demoForm");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    dl({
      event: "form_submit",
      form_id: "demoForm",
      form_name: data.get("name"),
      form_email: data.get("email")
    });
    form.reset();
  });

  // --- 2c. Scroll depth ---------------------------------------------------
  var milestones = [25, 50, 75, 100];
  var fired = {};
  function onScroll() {
    var h = document.documentElement;
    var scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight);
    var pct = Math.min(100, Math.round(scrolled * 100));
    milestones.forEach(function (m) {
      if (pct >= m && !fired[m]) {
        fired[m] = true;
        var pill = document.querySelector('[data-scroll="' + m + '"]');
        if (pill) pill.classList.add("fired");
        dl({ event: "scroll_depth", percent: m });
      }
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // --- 2d. Engagement timer (10s) ----------------------------------------
  var timerPill = document.getElementById("timerPill");
  setTimeout(function () {
    dl({ event: "timer_10s", engaged_seconds: 10 });
    if (timerPill) { timerPill.textContent = "fired ✓"; timerPill.classList.add("fired"); }
  }, 10000);

  // --- 3. Ecommerce cart + purchase --------------------------------------
  var cart = [];
  var cartSummary = document.getElementById("cartSummary");
  var checkoutBtn = document.getElementById("checkoutBtn");

  function addToCart(item) {
    cart.push(item);
    dl({ ecommerce: null });
    dl({ event: "add_to_cart", ecommerce: { currency: "EUR", value: item.price, items: [item] } });
    updateCart();
  }

  function updateCart() {
    var total = cart.reduce(function (s, i) { return s + i.price; }, 0);
    cartSummary.textContent = "Cart: " + cart.length + " item" + (cart.length === 1 ? "" : "s") + " · €" + total.toFixed(2);
    checkoutBtn.disabled = cart.length === 0;
  }

  checkoutBtn.addEventListener("click", function () {
    var total = cart.reduce(function (s, i) { return s + i.price; }, 0);
    dl({ ecommerce: null });
    dl({
      event: "purchase",
      ecommerce: {
        transaction_id: "T-" + (10000 + Math.floor(pushCount * 7 + total)),
        currency: "EUR",
        value: parseFloat(total.toFixed(2)),
        tax: parseFloat((total * 0.2).toFixed(2)),
        shipping: 4.90,
        items: cart.slice()
      }
    });
    cart = [];
    updateCart();
  });

  // --- 4. Inspector toolbar ----------------------------------------------
  document.getElementById("clearLog").addEventListener("click", function () {
    logEl.innerHTML = '<p class="log__empty">Log cleared. Fire something above to repopulate.</p>';
    pushCount = 0;
    pushCountEl.textContent = "0";
  });

  document.getElementById("dumpLog").addEventListener("click", function () {
    // eslint-disable-next-line no-console
    console.log("Full window.dataLayer:", window.dataLayer);
    alert("Full dataLayer dumped to the browser console (open DevTools → Console).");
  });

  // --- GTM status badge ---------------------------------------------------
  var statusEl = document.getElementById("gtmStatus");
  function checkGtm() {
    // Detect whether a real container loaded (google_tag_manager is set by GTM).
    var idUsed = /GTM-XXXXXXX/.test(document.documentElement.innerHTML);
    if (window.google_tag_manager && !idUsed) {
      statusEl.textContent = "GTM loaded ✓";
      statusEl.className = "status status--ok";
    } else if (idUsed) {
      statusEl.textContent = "GTM not configured — using placeholder ID";
      statusEl.className = "status status--off";
    } else {
      statusEl.textContent = "GTM snippet present, container not detected";
      statusEl.className = "status status--off";
    }
  }
  // Give GTM a moment to load, then check.
  setTimeout(checkGtm, 1500);

  // Friendly console welcome
  // eslint-disable-next-line no-console
  console.log("%cGTM Playground ready.", "color:#4f8cff;font-weight:bold");
  console.log("Try: window.dataLayer.push({ event: 'my_test', value: 42 })");
})();
