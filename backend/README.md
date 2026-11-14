# Conectar compra → Telegram → Dropi

La tienda (GitHub Pages) no puede guardar secretos. Por eso hay un servidor mínimo gratis (Cloudflare Worker) que:
1. recibe el pedido y la captura del pago,
2. te lo manda a Telegram con el monto cobrado, el costo de Dropi y tu ganancia,
3. al pulsar **✅ Llegó el pago**, marca el pedido como pagado (y crea la orden en Dropi si lo activas),
4. el cliente ve en su pantalla «¡Pago confirmado!».

## 1. Bot de Telegram (5 min)
1. En Telegram habla con **@BotFather** → `/newbot` → guarda el **token**.
2. Escríbele cualquier mensaje a tu bot nuevo.
3. Habla con **@userinfobot** para saber tu **chat id** (un número).

## 2. Cloudflare (10 min)
```bash
npm i -g wrangler
wrangler login
cd backend
wrangler kv namespace create ORDERS        # copia el id a wrangler.toml
# edita wrangler.toml: ALLOWED_ORIGIN = "https://TU-USUARIO.github.io"
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # inventa una clave larga
wrangler deploy                               # te da https://zentra-api.xxx.workers.dev
```
Conecta Telegram con el Worker (cambia los 3 valores):
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://zentra-api.xxx.workers.dev/api/telegram" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
Luego en `config.js` pon `API_URL` con la URL del Worker y completa tus datos de Yape/Plin/banco en `PAY`.

## 3. Tus costos
Edita `backend/costs.js` con el costo y flete reales de cada producto en Dropi. Los precios de venta están en `products.js`. Los `id` deben coincidir.

## 4. Dropi automático (opcional, después)
Dropi Perú no publica una API abierta que haya podido verificar. Hasta confirmarla:
- Deja `DROPI_ENABLED = "false"`. El bot te dice cuánto pagar en Dropi y tú creas la orden a mano.
- Pide a Dropi soporte la **documentación de la API de integraciones**, la URL y cómo generar tu token.
- Corrige `createDropiOrder` en `worker.js` según esa documentación, completa los `dropiId` en `costs.js`, ejecuta `wrangler secret put DROPI_TOKEN` y cambia a `"true"`.

## Seguridad
- Nunca pegues tokens en la página ni en el repositorio.
- Solo tu usuario de Telegram puede aprobar pedidos.
- El servidor recalcula el precio: el cliente no puede cambiarlo.
- Pasarela con tarjeta (Culqi, Mercado Pago, Niubiz) se puede agregar después: confirmaría el pago sola, sin que tú pulses el botón.
