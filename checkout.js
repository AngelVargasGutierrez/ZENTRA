import { CONFIG } from "./config.js";

const $ = (s, el) => (el || document).querySelector(s);
const sol = n => "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: n % 1 ? 2 : 0 });
const modal = document.getElementById("modal");
let state = null, pollTimer = null, lastFocus = null;

const TEMPLATE = `
<div class="modal__bg" data-close></div>
<div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="mTitle">
  <button class="modal__x" data-close aria-label="Cerrar">×</button>
  <div class="steps-bar" aria-hidden="true"><i></i><i></i><i></i></div>

  <section data-step="1">
    <h2 id="mTitle">Tus datos de envío</h2>
    <div class="m-prod"><b id="mName"></b><span id="mUnit"></span></div>
    <form id="fData" novalidate>
      <label class="f f--qty">Cantidad
        <div class="qty"><button type="button" data-q="-1" aria-label="Menos">−</button><output id="mQty">1</output><button type="button" data-q="1" aria-label="Más">+</button></div>
      </label>
      <label class="f">Nombre completo<input name="name" autocomplete="name" required></label>
      <div class="row2">
        <label class="f">Celular<input name="phone" inputmode="numeric" maxlength="9" placeholder="9 dígitos" autocomplete="tel-national" required></label>
        <label class="f">DNI<input name="dni" inputmode="numeric" maxlength="8" placeholder="8 dígitos" required></label>
      </div>
      <div class="row3">
        <label class="f">Departamento<input name="dep" autocomplete="address-level1" required></label>
        <label class="f">Provincia<input name="prov" autocomplete="address-level2" required></label>
        <label class="f">Distrito<input name="dist" required></label>
      </div>
      <label class="f">Dirección<input name="addr" autocomplete="street-address" required></label>
      <label class="f">Referencia <small>(opcional)</small><input name="ref"></label>
      <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="m-err" id="e1" role="alert"></p>
      <div class="m-total"><span>Total a pagar</span><b id="mTotal1"></b></div>
      <button class="btn btn--lg btn--full" type="submit">Continuar al pago</button>
    </form>
  </section>

  <section data-step="2" hidden>
    <h2>Realiza tu pago</h2>
    <p class="m-sub">Paga exactamente <b id="mTotal2"></b> y sube la captura.</p>
    <div class="pay" id="payTabs" role="tablist"></div>
    <div class="pay__box" id="payBox"></div>
    <label class="f">Captura o comprobante del pago
      <input type="file" id="mFile" accept="image/*" required>
    </label>
    <p class="m-err" id="e2" role="alert"></p>
    <button class="btn btn--lg btn--full" id="bSend" type="button">Ya pagué, enviar pedido</button>
    <button class="m-back" type="button" id="bBack">‹ Volver a mis datos</button>
  </section>

  <section data-step="3" hidden>
    <div class="m-state" id="mState" data-s="pending">
      <div class="m-icon"><i></i></div>
      <h2 id="mStateT">Estamos verificando tu pago</h2>
      <p class="m-sub" id="mStateP">Esto suele tardar unos minutos. No cierres esta ventana.</p>
      <p class="m-code">Pedido <b id="mCode"></b></p>
    </div>
    <button class="btn btn--full" data-close type="button">Cerrar</button>
  </section>
</div>`;

function qtyUpdate() {
  $("#mQty", modal).textContent = state.qty;
  const t = sol(state.p.price * state.qty);
  $("#mTotal1", modal).textContent = t;
  $("#mTotal2", modal).textContent = t;
}
function go(n) {
  modal.querySelectorAll("[data-step]").forEach(s => s.hidden = s.dataset.step !== String(n));
  modal.querySelectorAll(".steps-bar i").forEach((i, k) => i.classList.toggle("on", k < n));
  modal.querySelector(".modal__box").scrollTop = 0;
}
function setErr(id, msg) { $(id, modal).textContent = msg || ""; }

function renderPay(key) {
  const P = CONFIG.PAY, box = $("#payBox", modal);
  modal.querySelectorAll("#payTabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === key));
  box.textContent = "";
  const rows = key === "bank"
    ? [["Banco", P.bank.bank], ["Cuenta", P.bank.account], ["CCI", P.bank.cci], ["Titular", P.bank.holder]]
    : [["Número", P[key].number], ["A nombre de", P[key].holder]];
  rows.forEach(([k, v]) => {
    const r = document.createElement("div"); r.className = "pay__row";
    const a = document.createElement("span"); a.textContent = k;
    const b = document.createElement("b"); b.textContent = v;
    const c = document.createElement("button"); c.type = "button"; c.textContent = "Copiar"; c.className = "copy";
    c.addEventListener("click", async () => { try { await navigator.clipboard.writeText(v); c.textContent = "¡Copiado!"; setTimeout(() => c.textContent = "Copiar", 1400); } catch {} });
    r.append(a, b, c); box.append(r);
  });
  if (P[key].qr) {
    const q = document.createElement("div"); q.className = "pay__qr";
    const img = document.createElement("img"); img.src = P[key].qr; img.alt = "Código QR de " + P[key].label; img.width = 220; img.height = 220; img.decoding = "async";
    img.addEventListener("error", () => q.remove());
    const t = document.createElement("span"); t.textContent = "Escanea el QR desde " + P[key].label + " o usa el número de arriba.";
    q.append(img, t); box.append(q);
  }
  state.method = key;
}

export function openCheckout(product) {
  lastFocus = document.activeElement;
  state = { p: product, qty: 1, method: "yape", id: null };
  modal.innerHTML = TEMPLATE; modal.hidden = false;
  document.body.style.overflow = "hidden";
  $("#mName", modal).textContent = product.name;
  $("#mUnit", modal).textContent = sol(product.price) + " c/u";
  const tabs = $("#payTabs", modal);
  Object.entries(CONFIG.PAY).forEach(([k, v]) => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.k = k; b.setAttribute("role", "tab"); b.textContent = v.label;
    b.addEventListener("click", () => renderPay(k)); tabs.append(b);
  });
  renderPay("yape"); qtyUpdate(); go(1);
  requestAnimationFrame(() => modal.classList.add("is-open"));
  $("input[name=name]", modal).focus();

  modal.addEventListener("click", onClick);
  $("#fData", modal).addEventListener("submit", onStep1);
  $("#bSend", modal).addEventListener("click", onSend);
  $("#bBack", modal).addEventListener("click", () => go(1));
}
function close() {
  clearInterval(pollTimer);
  modal.classList.remove("is-open"); modal.hidden = true; modal.innerHTML = "";
  document.body.style.overflow = "";
  modal.removeEventListener("click", onClick);
  if (lastFocus) lastFocus.focus();
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) close(); });

function onClick(e) {
  if (e.target.closest("[data-close]")) return close();
  const q = e.target.closest("[data-q]");
  if (q) { state.qty = Math.min(5, Math.max(1, state.qty + +q.dataset.q)); qtyUpdate(); }
}

function onStep1(e) {
  e.preventDefault();
  const f = new FormData(e.target), v = k => (f.get(k) || "").toString().trim();
  if (v("name").length < 5 || !v("name").includes(" ")) return setErr("#e1", "Escribe tu nombre y apellido.");
  if (!/^9\d{8}$/.test(v("phone"))) return setErr("#e1", "El celular debe tener 9 dígitos y empezar con 9.");
  if (!/^\d{8}$/.test(v("dni"))) return setErr("#e1", "El DNI debe tener 8 dígitos.");
  if (!v("dep") || !v("prov") || !v("dist")) return setErr("#e1", "Completa departamento, provincia y distrito.");
  if (v("addr").length < 6) return setErr("#e1", "Escribe tu dirección completa.");
  setErr("#e1");
  state.customer = { name: v("name"), phone: v("phone"), dni: v("dni"), dep: v("dep"), prov: v("prov"), dist: v("dist"), addr: v("addr"), ref: v("ref") };
  state.hp = v("website");
  go(2);
}

async function onSend() {
  const file = $("#mFile", modal).files[0];
  if (!file) return setErr("#e2", "Sube la captura de tu pago para continuar.");
  if (file.size > 5 * 1024 * 1024) return setErr("#e2", "La imagen pesa más de 5 MB.");
  setErr("#e2");
  const btn = $("#bSend", modal); btn.disabled = true; btn.textContent = "Enviando…";

  if (!CONFIG.API_URL) {           // modo demo: no hay servidor configurado
    state.id = "DEMO-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    showPending(); return demoNote();
  }
  try {
    const fd = new FormData();
    fd.append("order", JSON.stringify({ productId: state.p.id, qty: state.qty, method: state.method, customer: state.customer, hp: state.hp }));
    fd.append("proof", file);
    const r = await fetch(CONFIG.API_URL + "/api/order", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo enviar el pedido.");
    state.id = j.id; showPending(); poll();
  } catch (err) {
    setErr("#e2", err.message + " Si el problema sigue, escríbenos por WhatsApp.");
    btn.disabled = false; btn.textContent = "Ya pagué, enviar pedido";
  }
}

function showPending() { $("#mCode", modal).textContent = state.id; go(3); }
function demoNote() { $("#mStateP", modal).textContent = "Modo demo: el servidor aún no está conectado, este pedido no se envió."; }

function poll() {
  clearInterval(pollTimer);
  let tries = 0;
  pollTimer = setInterval(async () => {
    if (modal.hidden) return clearInterval(pollTimer);
    if (++tries > 360) return clearInterval(pollTimer);    // ~30 min
    try {
      const r = await fetch(`${CONFIG.API_URL}/api/order/${state.id}`);
      const { status } = await r.json();
      const st = $("#mState", modal);
      if (status === "paid") {
        clearInterval(pollTimer); st.dataset.s = "ok";
        $("#mStateT", modal).textContent = "¡Pago confirmado!";
        $("#mStateP", modal).textContent = "Estamos preparando tu pedido. Te escribiremos con la guía de seguimiento.";
      } else if (status === "rejected") {
        clearInterval(pollTimer); st.dataset.s = "bad";
        $("#mStateT", modal).textContent = "No pudimos ver tu pago";
        $("#mStateP", modal).textContent = "Escríbenos por WhatsApp con tu código de pedido y lo revisamos.";
      }
    } catch {}
  }, 5000);
}
