import { CONFIG } from "./config.js";
import { PRODUCTS } from "./products.js";
import { openCheckout } from "./checkout.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sol = n => "S/ " + n.toLocaleString("es-PE");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* WhatsApp: solo para dudas. Un número al azar por visita. */
const WA = CONFIG.WHATSAPP[Math.floor(Math.random() * CONFIG.WHATSAPP.length)];
const wa = msg => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
$("#yr").textContent = new Date().getFullYear();
$$("[data-wa-generic]").forEach(a => { a.href = wa(`Hola ${CONFIG.STORE}, tengo una duda sobre sus productos.`); a.target = "_blank"; a.rel = "noopener"; });
const fw = $("#footWa");
if (fw) fw.textContent = "Dudas por WhatsApp: " + CONFIG.WHATSAPP.map(n => "+" + n.slice(0, 2) + " " + n.slice(2)).join(" · ");

/* ---------- catálogo ---------- */
const grid = $("#grid");
function art(p) {
  if (p.img) return `<img src="${p.img}" alt="${p.name}" width="400" height="400" loading="lazy" decoding="async">`;
  const vb = p.symbol === "laptop" ? ' viewBox="0 0 240 200"' : "";
  return `<svg${vb} style="color:${p.color};${p.symbol === "laptop" ? "width:84%" : ""}" aria-hidden="true"><use href="#p-${p.symbol}"/></svg>`;
}
function render(cat = "Todos") {
  const list = cat === "Todos" ? PRODUCTS : PRODUCTS.filter(p => p.cat === cat);
  grid.innerHTML = list.map((p, i) => `
    <article class="card" style="--i:${i * 0.06}s;--tint:${p.tint}">
      <div class="card__art"><span class="badge">CALIDAD A1</span>${art(p)}</div>
      <div class="card__body">
        <span class="card__cat">${p.cat}</span>
        <h3>${p.name}</h3>
        <p class="card__desc">${p.desc}</p>
        <div class="card__foot">
          <div class="price">${sol(p.price)}${p.was ? `<s>${sol(p.was)}</s>` : ""}</div>
          <button class="btn btn--sm" data-buy="${p.id}">Comprar</button>
        </div>
      </div>
    </article>`).join("");
}
render();
grid.addEventListener("click", e => {
  const b = e.target.closest("[data-buy]"); if (!b) return;
  openCheckout(PRODUCTS.find(p => p.id === b.dataset.buy));
});

const tabs = $$("#tabs button");
function setTab(cat) {
  tabs.forEach(b => b.setAttribute("aria-selected", String(b.dataset.cat === cat)));
  render(cat);
}
tabs.forEach(b => b.addEventListener("click", () => setTab(b.dataset.cat)));
$$("[data-filter]").forEach(a => a.addEventListener("click", () => setTab(a.dataset.filter)));

/* ---------- nav ---------- */
const nav = $("#nav"), burger = $("#burger"), links = $("#navLinks");
burger.addEventListener("click", () => {
  const open = links.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", open);
});
links.addEventListener("click", e => { if (e.target.closest("a")) { links.classList.remove("is-open"); burger.setAttribute("aria-expanded", false); } });

/* ---------- reveal al hacer scroll ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
}), { threshold: .15, rootMargin: "0px 0px -6% 0px" });
$$("[data-reveal]").forEach(el => io.observe(el));

/* ---------- historia A1 (pin + scroll) ---------- */
const story = $(".story"), steps = $$("#steps li"), vis = $$(".story__visual .v"), prog = $("#prog");
let ticking = false;
function onScroll() {
  nav.classList.toggle("is-solid", scrollY > 24);
  const r = story.getBoundingClientRect();
  const total = story.offsetHeight - innerHeight;
  const p = Math.min(1, Math.max(0, -r.top / total));
  prog.style.transform = `scaleX(${p})`;
  const idx = Math.min(steps.length - 1, Math.floor(p * steps.length * .999));
  steps.forEach((s, i) => s.classList.toggle("is-on", i === idx));
  vis.forEach((v, i) => v.classList.toggle("is-on", i === idx));
  ticking = false;
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

/* ---------- parallax del hero con el mouse ---------- */
const stage = $(".hero__stage");
if (stage && !reduce && matchMedia("(pointer:fine)").matches) {
  addEventListener("pointermove", e => {
    const x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5);
    $$(".float", stage).forEach(f => {
      const d = +f.dataset.depth;
      f.style.transform = `translate(${x * d * -1}px,${y * d * -1}px)`;
    });
  }, { passive: true });
}

/* ---------- estrellas / partículas del hero ---------- */
(function stars() {
  const c = $("#stars"); if (!c || reduce) return;
  const ctx = c.getContext("2d"); let w, h, pts = [], raf;
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = Array.from({ length: Math.round(w * h / 14000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + .3, v: Math.random() * .25 + .05, a: Math.random() }));
  }
  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.y -= p.v; p.a += .015; if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
      ctx.globalAlpha = .12 + .38 * Math.abs(Math.sin(p.a));
      ctx.fillStyle = "#0071e3"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }
  size(); tick();
  addEventListener("resize", size);
  document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden) tick(); });
})();
