// Servidor intermedio (Cloudflare Worker) entre la tienda, Telegram y Dropi.
//
// Flujo:
//  1. La tienda envía el pedido + captura del pago  → POST /api/order
//  2. El Worker te manda a Telegram la foto, el monto cobrado, el costo de Dropi y tu ganancia,
//     con botones [✅ Llegó el pago] [❌ No llegó].
//  3. Tú pulsas el botón. Si es ✅ el Worker marca el pedido como pagado y (si lo activas)
//     crea la orden en Dropi. El cliente ve el resultado en su pantalla (GET /api/order/:id).
//
// Secretos (wrangler secret put ...): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET, DROPI_TOKEN
// Variables (wrangler.toml): ALLOWED_ORIGIN, DROPI_ENABLED, DROPI_BASE
// KV: ORDERS

import { PRODUCTS } from "../products.js";
import { COSTS } from "./costs.js";

const METHODS = { yape: "Yape", plin: "Plin", bank: "Transferencia" };
const sol = n => "S/ " + (Math.round(n * 100) / 100).toFixed(2);
const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function cors(env, req) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? origin : (allowed[0] || "null"),
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  };
}
const json = (data, status, h) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...h } });

async function tg(env, method, body, isForm) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : JSON.stringify(body)
  });
  return r.json();
}

function newId() {
  const a = crypto.getRandomValues(new Uint8Array(4));
  return "A1-" + [...a].map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 6).toUpperCase();
}

function validate(o) {
  const c = o?.customer || {}, t = x => String(x ?? "").trim();
  if (!PRODUCTS.find(p => p.id === o?.productId)) return "Producto no válido.";
  if (!Number.isInteger(o.qty) || o.qty < 1 || o.qty > 5) return "Cantidad no válida.";
  if (!METHODS[o.method]) return "Método de pago no válido.";
  if (t(c.name).length < 5 || t(c.name).length > 80) return "Nombre no válido.";
  if (!/^9\d{8}$/.test(t(c.phone))) return "Celular no válido.";
  if (!/^\d{8}$/.test(t(c.dni))) return "DNI no válido.";
  for (const k of ["dep", "prov", "dist"]) if (t(c[k]).length < 2 || t(c[k]).length > 40) return "Ubicación no válida.";
  if (t(c.addr).length < 6 || t(c.addr).length > 160) return "Dirección no válida.";
  if (t(c.ref).length > 160) return "Referencia demasiado larga.";
  return null;
}

async function createOrder(req, env, h) {
  const ip = req.headers.get("CF-Connecting-IP") || "x";
  const rlKey = "rl:" + ip;
  const n = +(await env.ORDERS.get(rlKey) || 0);
  if (n >= 5) return json({ error: "Demasiados intentos. Intenta más tarde." }, 429, h);
  await env.ORDERS.put(rlKey, String(n + 1), { expirationTtl: 600 });

  let fd;
  try { fd = await req.formData(); } catch { return json({ error: "Solicitud no válida." }, 400, h); }
  let o; try { o = JSON.parse(fd.get("order")); } catch { return json({ error: "Pedido no válido." }, 400, h); }
  if (o.hp) return json({ id: "A1-OK" }, 200, h);                       // honeypot: bots

  const err = validate(o); if (err) return json({ error: err }, 400, h);
  const proof = fd.get("proof");
  if (!proof || typeof proof === "string" || !proof.type?.startsWith("image/") || proof.size > 5 * 1024 * 1024)
    return json({ error: "Sube una imagen (máx. 5 MB) del comprobante." }, 400, h);

  // Todo se recalcula en el servidor: el cliente no puede cambiar precios.
  const p = PRODUCTS.find(x => x.id === o.productId), k = COSTS[p.id] || { cost: 0, ship: 0 };
  const total = p.price * o.qty;
  const costDropi = (k.cost + k.ship) * o.qty;       // asumo flete por unidad; ajústalo a tu caso
  const profit = total - costDropi;

  const id = newId();
  const c = Object.fromEntries(Object.entries(o.customer).map(([a, b]) => [a, String(b ?? "").trim()]));
  const order = { id, status: "pending", productId: p.id, productName: p.name, qty: o.qty, method: o.method, customer: c, total, costDropi, profit, createdAt: Date.now() };

  const caption =
`🛒 <b>Pedido ${id}</b>
${esc(p.name)} × ${o.qty}

💰 Cobrado: <b>${sol(total)}</b> (${METHODS[o.method]})
📦 Costo Dropi: ${sol(costDropi)}
📈 Ganancia: <b>${sol(profit)}</b>

👤 ${esc(c.name)}
📱 ${esc(c.phone)} · DNI ${esc(c.dni)}
📍 ${esc(c.addr)}, ${esc(c.dist)}, ${esc(c.prov)}, ${esc(c.dep)}${c.ref ? `\n🧭 ${esc(c.ref)}` : ""}

¿Llegó ${sol(total)} a tu cuenta?`;

  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID);
  form.append("photo", proof, "comprobante.jpg");
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("reply_markup", JSON.stringify({ inline_keyboard: [[
    { text: "✅ Llegó el pago", callback_data: "ok:" + id },
    { text: "❌ No llegó", callback_data: "no:" + id }
  ]] }));
  const res = await tg(env, "sendPhoto", form, true);
  if (!res.ok) return json({ error: "No pudimos enviar el pedido. Escríbenos por WhatsApp." }, 502, h);

  await env.ORDERS.put("order:" + id, JSON.stringify(order), { expirationTtl: 60 * 60 * 24 * 60 });
  return json({ id }, 200, h);
}

// ---- Dropi ------------------------------------------------------------------------------------
// ⚠️ SIN VERIFICAR: la documentación oficial de Dropi Perú no estaba pública. La URL, el método de
// autenticación y los nombres de campo de abajo son una suposición basada en documentación de
// terceros. Confírmalos con el soporte/panel de Dropi antes de poner DROPI_ENABLED="true".
// Como el cliente YA pagó, la orden no debe cobrar recaudo (rate_type "SIN RECAUDO"): verifícalo.
async function createDropiOrder(env, o) {
  const k = COSTS[o.productId];
  if (!k?.dropiId) return { ok: false, msg: "Falta `dropiId` de este producto en backend/costs.js." };
  const body = {
    type: "FINAL_ORDER",
    rate_type: "SIN RECAUDO",
    total_order: o.total,
    name: o.customer.name,
    phone: o.customer.phone,
    dni: o.customer.dni,
    country: "PERU",
    state: o.customer.dep,
    city: o.customer.prov,
    district: o.customer.dist,
    dir: o.customer.addr,
    notes: `${o.customer.ref || ""} | Pedido tienda ${o.id}`.trim(),
    products: [{ id: k.dropiId, price: o.total / o.qty, quantity: o.qty }]
  };
  try {
    const r = await fetch((env.DROPI_BASE || "https://api.dropi.pe") + "/api/orders/myorder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.DROPI_TOKEN },
      body: JSON.stringify(body)
    });
    const t = await r.text();
    return { ok: r.ok, msg: `HTTP ${r.status}: ${t.slice(0, 300)}` };
  } catch (e) { return { ok: false, msg: "Error de red: " + e.message }; }
}

async function webhook(req, env) {
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) return new Response("no", { status: 403 });
  const u = await req.json();
  const cb = u.callback_query;
  if (!cb) return new Response("ok");
  // Solo TÚ puedes aprobar pedidos.
  if (String(cb.from.id) !== String(env.TELEGRAM_CHAT_ID)) {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "No autorizado." });
    return new Response("ok");
  }
  const [act, id] = String(cb.data || "").split(":");
  const raw = await env.ORDERS.get("order:" + id);
  if (!raw || !["ok", "no"].includes(act)) { await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Pedido no encontrado." }); return new Response("ok"); }
  const o = JSON.parse(raw);
  if (o.status !== "pending") { await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: "Este pedido ya fue procesado." }); return new Response("ok"); }

  o.status = act === "ok" ? "paid" : "rejected";          // se guarda ANTES de llamar a Dropi: evita duplicados
  await env.ORDERS.put("order:" + id, JSON.stringify(o), { expirationTtl: 60 * 60 * 24 * 60 });
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: act === "ok" ? "Pago confirmado" : "Pago rechazado" });

  let note;
  if (act === "no") note = "❌ <b>Pago NO recibido.</b> Se avisó al cliente.";
  else if (env.DROPI_ENABLED === "true") {
    const d = await createDropiOrder(env, o);
    o.dropi = d; await env.ORDERS.put("order:" + id, JSON.stringify(o), { expirationTtl: 60 * 60 * 24 * 60 });
    note = d.ok ? `✅ <b>Pago confirmado y orden creada en Dropi.</b>\n<code>${esc(d.msg)}</code>`
                : `⚠️ <b>Pago confirmado, pero Dropi falló.</b> Crea la orden a mano.\n<code>${esc(d.msg)}</code>`;
  } else {
    note = `✅ <b>Pago confirmado.</b> Crea la orden en Dropi con tu saldo: pagas ${sol(o.costDropi)} y te quedan ${sol(o.profit)}.`;
  }
  await tg(env, "editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
  await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", reply_to_message_id: cb.message.message_id, text: `Pedido ${id}\n${note}` });
  return new Response("ok");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), c = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c.headers });

    if (url.pathname === "/api/telegram" && req.method === "POST") return webhook(req, env);

    if (url.pathname === "/api/order" && req.method === "POST") {
      if (!c.ok) return json({ error: "Origen no permitido." }, 403, c.headers);
      return createOrder(req, env, c.headers);
    }
    const m = url.pathname.match(/^\/api\/order\/(A1-[A-Z0-9]+)$/);
    if (m && req.method === "GET") {
      const raw = await env.ORDERS.get("order:" + m[1]);
      return json({ status: raw ? JSON.parse(raw).status : "unknown" }, 200, c.headers);
    }
    return json({ ok: true }, 200, c.headers);
  }
};
