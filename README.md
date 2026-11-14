# ZENTRA

Tienda de gadgets de calidad A1 (dropshipping con Dropi). Sitio estático: HTML, CSS y módulos JS.

- Local: `abrir-tienda.bat` y abre http://localhost:8080
- Publicación: GitHub Pages, automática en cada push a `main` (ver `.github/workflows/pages.yml`).
- Backend de pedidos: Cloudflare Worker en `backend/` (ver `backend/README.md`). Copia `backend/costs.example.js` a `backend/costs.js` con tus costos reales; ese archivo no se sube.
