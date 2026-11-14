// Configuración pública de la tienda (esto SÍ se publica en GitHub Pages).
// NUNCA pongas aquí tokens de Dropi ni de Telegram: van como secretos en el servidor (ver backend/README.md).

export const CONFIG = {
  STORE: "ZENTRA",

  // WhatsApp solo para dudas. Se elige uno al azar en cada visita para repartir las consultas.
  WHATSAPP: ["51965421414", "51902324915"],

  // URL del servidor intermedio (Cloudflare Worker), p. ej. "https://zentra.tuusuario.workers.dev".
  // Vacío = modo demo: el formulario funciona pero NO envía el pedido a ningún lado.
  API_URL: "",

  // Datos donde el cliente te paga. COMPLETA con tus datos reales antes de publicar.
  // qr: ruta de la imagen de tu código QR (captura desde la app). Si el archivo no existe, simplemente no se muestra.
  PAY: {
    yape:  { label: "Yape",  number: "902324915", holder: "COMPLETAR", qr: "fotos/qr-yape.jpg" },
    plin:  { label: "Plin",  number: "902324915", holder: "COMPLETAR", qr: "fotos/qr-plin.jpg" },
    bank:  { label: "Transferencia", bank: "COMPLETAR", account: "COMPLETAR", cci: "COMPLETAR", holder: "COMPLETAR" }
  }
};
