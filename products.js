// Catálogo PÚBLICO (precios de venta en soles).
// El servidor recalcula el total con estos mismos precios; el costo de Dropi vive aparte en backend/costs.js.
// Mantén los `id` iguales en ambos archivos.
// img: foto principal (carpeta fotos/). gallery: otras fotos del proveedor por si quieres usarlas.
// tint: color del brillo suave debajo de la foto en la tarjeta.
// Precios: `price` = precio sugerido por Dropi; `was` = precio tachado de referencia (cámbialo o bórralo si no quieres mostrarlo).

export const PRODUCTS = [
  {
    id: "ahorrador-energia", name: "Ahorrador de Energía", cat: "Hogar",
    img: "fotos/ahorrador-1.jpg", gallery: ["fotos/ahorrador-2.jpg", "fotos/ahorrador-3.jpg", "fotos/ahorrador-4.jpg"],
    tint: "#34c759", price: 100, was: 139,
    desc: "Se enchufa y listo: estabiliza el voltaje y ayuda a optimizar el consumo de casa u oficina."
  },
  {
    id: "mini-afeitador", name: "Mini Afeitador Shaver", cat: "Cuidado personal",
    img: "fotos/afeitador-1.jpg", gallery: ["fotos/afeitador-2.jpg", "fotos/afeitador-3.jpg", "fotos/afeitador-4.jpg", "fotos/afeitador-5.jpg"],
    tint: "#0071e3", price: 59, was: 79,
    desc: "Del tamaño de un bolsillo, recargable por USB. Ideal para el carro, la oficina o viajes."
  },
  {
    id: "audifono-arete", name: "Audífonos Estilo Arete", cat: "Audio",
    img: "fotos/audifono-arete-1.jpg", gallery: [],
    tint: "#7d5cff", price: 65, was: 89,
    desc: "Diseño de clip que no entra al oído. Bluetooth, estuche de carga y cable incluido. Negro o blanco."
  }
];
