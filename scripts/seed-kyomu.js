/**
 * Seed: Carta Kyomu Sushi para Foodi
 *
 * Crea categorías y platillos en un negocio existente.
 * Requiere Firebase Admin (misma cuenta de servicio que migrar-negocios-privado).
 *
 * Uso:
 *   node scripts/seed-kyomu.js <businessId>
 *   Ejemplo: node scripts/seed-kyomu.js abc123uidDelDueño
 *
 * businessId = ID del documento en /negocios (normalmente el UID del dueño).
 *
 * Al final imprime "DUDAS Y REVISIONES MANUALES" para ajustar en el admin.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  join(__dirname, "foodi-service-account.json");

if (!existsSync(serviceAccountPath)) {
  console.error("No se encontró la cuenta de servicio. Ver scripts/migrar-negocios-privado-node.js");
  process.exit(1);
}

try {
  initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, "utf8"))) });
} catch (e) {
  if (!e.message?.includes("already exists")) throw e;
}

const db = getFirestore();

// ─── Helper: grupo de electivos ─────────────────────────────────────────────
const grupo = (nombre, tipo, requerido, opciones, limite = null, incluidasGratis = null) => ({
  grupo: nombre,
  tipo,
  requerido,
  limite,
  incluidasGratis,
  opciones: opciones.map((op) =>
    typeof op === "string" ? { ingredienteId: null, nombre: op, extra: 0, incluido: false } : { ingredienteId: null, nombre: op[0], extra: op[1], incluido: op[2] ?? false }
  ),
});

// ─── CATEGORÍAS (orden sugerido en el menú) ─────────────────────────────────
const CATEGORIAS = [
  "Torta de Sushi",
  "Cambios / Extras",
  "Promociones",
  "Cortes",
  "Rolls individual",
  "Rolls Premium",
  "Vegetariano",
  "Sin arroz",
  "Hand Rolls / Gohan",
  "Sushi Burger",
  "Base Han Roll",
  "Acompañamientos",
  "Niguiris",
  "Sashimi",
  "Temaki",
];

// ─── PRODUCTOS: { nombre, descripcion?, precio_base, categorias: [nombres], es_promocion?, grupos? } ───
const PRODUCTOS = [
  // ── Torta de Sushi (con grupos electivos) ──
  {
    nombre: "Torta de Sushi 50 cortes",
    descripcion: "8 rolls compuestos de plaquetas + queso crema + proteína + vegetal. 2 rolls hosomaki de 1 relleno (proteína o vegetal).",
    precio_base: 40000,
    categorias: ["Torta de Sushi"],
    es_promocion: false,
    grupos: [
      grupo("PLAQUETAS", "single", true, [
        ["Nori", 1000],
        ["Pepino", 1300],
        ["Tempura", 1300],
        ["Panko", 1500],
        ["Sésamo", 1500],
        ["Queso crema", 1500],
        ["Palta", 2000],
        ["Salmón", 2000],
      ]),
      grupo("VEGETALES", "single", true, [
        ["Pepino", 300],
        ["Cebollín", 500],
        ["Ciboulette", 500],
        ["Pimientos", 500],
        ["Choclo", 500],
        ["Champiñones", 500],
        ["Palta", 800],
        ["Palmitos", 800],
        ["Espárragos", 1000],
      ]),
      grupo("PROTEÍNAS", "single", true, [
        ["Kanikama", 1000],
        ["Pollo apanado", 1500],
        ["Camarón cocido", 1500],
        ["Pollo teriyaki", 1500],
        ["Salmón crudo", 1800],
        ["Salmón apanado", 1800],
        ["Camarón apanado", 1800],
        ["Salmón ahumado", 1900],
      ]),
      grupo("Hosomaki relleno (1 opción)", "single", true, [
        ["Kanikama", 0],
        ["Pollo teriyaki", 0],
        ["Camarón", 0],
        ["Salmón", 0],
        ["Palta", 0],
        ["Pepino", 0],
      ]),
    ],
  },
  {
    nombre: "Torta de Sushi 100 cortes",
    descripcion: "8 rolls compuestos de plaquetas + queso crema + proteína + vegetal. 2 rolls hosomaki de 1 relleno (proteína o vegetal).",
    precio_base: 65000,
    categorias: ["Torta de Sushi"],
    es_promocion: false,
    grupos: [
      grupo("PLAQUETAS", "single", true, [
        ["Nori", 1000],
        ["Pepino", 1300],
        ["Tempura", 1300],
        ["Panko", 1500],
        ["Sésamo", 1500],
        ["Queso crema", 1500],
        ["Palta", 2000],
        ["Salmón", 2000],
      ]),
      grupo("VEGETALES", "single", true, [
        ["Pepino", 300],
        ["Cebollín", 500],
        ["Ciboulette", 500],
        ["Pimientos", 500],
        ["Choclo", 500],
        ["Champiñones", 500],
        ["Palta", 800],
        ["Palmitos", 800],
        ["Espárragos", 1000],
      ]),
      grupo("PROTEÍNAS", "single", true, [
        ["Kanikama", 1000],
        ["Pollo apanado", 1500],
        ["Camarón cocido", 1500],
        ["Pollo teriyaki", 1500],
        ["Salmón crudo", 1800],
        ["Salmón apanado", 1800],
        ["Camarón apanado", 1800],
        ["Salmón ahumado", 1900],
      ]),
      grupo("Hosomaki relleno (1 opción)", "single", true, [
        ["Kanikama", 0],
        ["Pollo teriyaki", 0],
        ["Camarón", 0],
        ["Salmón", 0],
        ["Palta", 0],
        ["Pepino", 0],
      ]),
    ],
  },
  // ── Cambios / Extras ──
  { nombre: "Extra soya (pote)", precio_base: 800, categorias: ["Cambios / Extras"] },
  { nombre: "Extra soya (sachet)", precio_base: 500, categorias: ["Cambios / Extras"] },
  { nombre: "Extra salsa agridulce", precio_base: 1000, categorias: ["Cambios / Extras"] },
  { nombre: "Agregar salsas a elección", descripcion: "Salsas: spicy, acevichada", precio_base: 1800, categorias: ["Cambios / Extras"] },
  // ── Promociones (contenido fijo en descripción) ──
  { nombre: "PROMOCIÓN 4 - $25.500 (SOLO POLLO)", descripcion: "50 bocados: 10 panko pollo teriyaki queso crema palta, 10 panko pollo teriyaki queso crema cebollín, 10 panko pollo teriyaki queso crema pimiento, 10 panko pollo teriyaki queso crema pepino, 10 hosomaki pollo teriyaki.", precio_base: 25500, categorias: ["Promociones"], es_promocion: true },
  { nombre: "PROMOCIÓN 5 - $30.000", descripcion: "60 bocados: salmón/palta (kanikama, queso crema, camarón, palta), queso crema (pollo teriyaki, queso crema, cebollín, palta), sésamo (kanikama spicy, queso crema, ciboulette), panko (salmón ahumado, queso crema, cebollín, pimiento), tempura (pepino, queso crema, palta, cebollín), hosomaki (kanikama, queso crema).", precio_base: 30000, categorias: ["Promociones"], es_promocion: true },
  { nombre: "FAMILIAR - $40.000", descripcion: "90 bocados: variedad salmón, palta, queso crema, sésamo, panko, tempura, hosomaki.", precio_base: 40000, categorias: ["Promociones"], es_promocion: true },
  // ── Cortes ──
  { nombre: "20 CORTES FRÍOS", descripcion: "10 envueltos en queso crema (pollo teriyaki, queso crema, pimiento). 10 envueltos en palta (camarón, queso crema, cebollín).", precio_base: 12500, categorias: ["Cortes"] },
  { nombre: "20 CORTES MIXTOS", descripcion: "10 palta (camarón, queso crema, cebollín, pimiento). 10 panko (pollo teriyaki, queso crema, palta).", precio_base: 13000, categorias: ["Cortes"] },
  { nombre: "20 CORTES CALIENTES", descripcion: "10 panko (pollo teriyaki, queso crema, pimiento). 10 panko (kanikama, queso crema, palta).", precio_base: 13000, categorias: ["Cortes"] },
  { nombre: "30 CORTES CALIENTES", descripcion: "10 panko pollo teriyaki queso crema pimiento, 10 panko pollo teriyaki queso crema palta, 10 panko camarón queso crema cebollín.", precio_base: 16000, categorias: ["Cortes"] },
  { nombre: "30 CORTES FRÍOS", descripcion: "10 sésamo (pollo teriyaki, queso crema, pimiento), 10 queso crema (camarón, queso crema, cebollín), 10 palta (salmón, queso crema, cebollín).", precio_base: 16800, categorias: ["Cortes"] },
  { nombre: "30 CORTES MIXTOS", descripcion: "10 palta (camarón, queso crema, cebollín), 10 panko (pollo teriyaki, queso crema, palta), 10 palta (salmón, queso crema, pimiento).", precio_base: 17000, categorias: ["Cortes"] },
  { nombre: "PROMOCIÓN 1", descripcion: "50 bocados: palta (salmón, queso crema, cebollín), queso crema (pollo teriyaki, queso crema, cebollín, palta), 2x panko (pollo/camarón), hosomaki (kanikama, queso crema).", precio_base: 21500, categorias: ["Promociones"], es_promocion: true },
  { nombre: "PROMOCIÓN 2", descripcion: "50 bocados: 4x panko (salmón ahumado, pollo teriyaki, camarón apanado, kanikama), hosomaki (kanikama, queso crema).", precio_base: 23500, categorias: ["Promociones"], es_promocion: true },
  { nombre: "PROMOCIÓN 3", descripcion: "50 bocados: salmón (camarón apanado, queso crema, palta), sésamo (kanikama spicy, ciboulette), 2x panko (salmón apanado, pollo teriyaki), hosomaki (kanikama, queso crema).", precio_base: 25500, categorias: ["Promociones"], es_promocion: true },
  // ── Rolls individual ──
  { nombre: "Hosomaki - Palta", precio_base: 3000, categorias: ["Rolls individual"] },
  { nombre: "Hosomaki tempura - Palta", precio_base: 3200, categorias: ["Rolls individual"] },
  { nombre: "Hosomaki - Kanikama", precio_base: 3500, categorias: ["Rolls individual"] },
  { nombre: "Hosomaki - Pollo teriyaki", precio_base: 4000, categorias: ["Rolls individual"] },
  { nombre: "Hosomaki - Camarón", precio_base: 4200, categorias: ["Rolls individual"] },
  { nombre: "Hosomaki - Salmón", precio_base: 4500, categorias: ["Rolls individual"] },
  { nombre: "Hosomaki panko - Salmón", precio_base: 4800, categorias: ["Rolls individual"] },
  { nombre: "Palta - Pollo teriyaki, queso crema, cebollín", precio_base: 5000, categorias: ["Rolls individual"] },
  { nombre: "Palta - Salmón, queso crema, cebollín", precio_base: 6000, categorias: ["Rolls individual"] },
  { nombre: "Palta - Pollo apanado, queso crema, cebollín, palta", precio_base: 6800, categorias: ["Rolls individual"] },
  { nombre: "Palta - Camarón, salmón ahumado, palta", precio_base: 7200, categorias: ["Rolls individual"] },
  { nombre: "Palta - Salmón, queso crema, camarón, ciboulette", precio_base: 7200, categorias: ["Rolls individual"] },
  { nombre: "Queso crema - Camarón apanado, queso crema, cebollín", precio_base: 6000, categorias: ["Rolls individual"] },
  { nombre: "Queso crema - Camarón, kanikama, palta", precio_base: 6200, categorias: ["Rolls individual"] },
  { nombre: "Queso crema - Pollo apanado, queso crema, cebollín, palta", precio_base: 6800, categorias: ["Rolls individual"] },
  { nombre: "Queso crema - Salmón, queso crema, cebollín, palta", precio_base: 7200, categorias: ["Rolls individual"] },
  { nombre: "Queso crema - Salmón ahumado, queso crema, camarón, ciboulette", precio_base: 7200, categorias: ["Rolls individual"] },
  // ── Rolls envueltos en Salmón / Tempura / Sésamo (de la otra hoja) ──
  { nombre: "Salmón - Camarón, queso crema, cebollín", precio_base: 5800, categorias: ["Rolls individual"] },
  { nombre: "Salmón - Camarón, cebollín, palta", precio_base: 6400, categorias: ["Rolls individual"] },
  { nombre: "Salmón - Salmón apanado, queso crema, palta", precio_base: 6800, categorias: ["Rolls individual"] },
  { nombre: "Salmón - Salmón ahumado, queso crema, palta, camarón", precio_base: 8000, categorias: ["Rolls individual"] },
  { nombre: "Tempura - Camarón, queso crema, cebollín, pepino", precio_base: 5800, categorias: ["Rolls individual"] },
  { nombre: "Panko - Pollo apanado, queso crema, pimiento", precio_base: 6000, categorias: ["Rolls individual"] },
  { nombre: "Panko - Pollo apanado, queso crema, palta", precio_base: 6200, categorias: ["Rolls individual"] },
  { nombre: "Panko - Camarón, queso crema, cebollín", precio_base: 6800, categorias: ["Rolls individual"] },
  { nombre: "Tempura - Salmón, queso crema, cebollín", precio_base: 6800, categorias: ["Rolls individual"] },
  { nombre: "Tempura - Kanikama, palta, camarón", precio_base: 6800, categorias: ["Rolls individual"] },
  { nombre: "Panko - Camarón apanado, queso crema, salmón", precio_base: 8000, categorias: ["Rolls individual"] },
  { nombre: "Sésamo - Camarón apanado, queso crema, champiñón", precio_base: 6000, categorias: ["Rolls individual"] },
  { nombre: "Sésamo - Salmón, queso crema, kanikama, ciboulette", precio_base: 6800, categorias: ["Rolls individual"] },
  // ── Rolls Premium ──
  { nombre: "Roll nikkei", descripcion: "Envuelto en palta, coronado con cebolla morada al tempura. Relleno: camarón, queso crema, palta.", precio_base: 8800, categorias: ["Rolls Premium"] },
  { nombre: "Roll eby", descripcion: "Envuelto en camarón. Relleno: kanikama, queso crema, salmón apanado.", precio_base: 8900, categorias: ["Rolls Premium"] },
  { nombre: "Jamón roll", descripcion: "Envuelto en tocino al panko. Relleno: pollo teriyaki, queso crema, pimiento.", precio_base: 9000, categorias: ["Rolls Premium"] },
  { nombre: "Falso acevichado", descripcion: "Envuelto en salmón flambeado con salsa acevichada y toques de togazashi. Relleno: camarón apanado, queso crema, palta.", precio_base: 9900, categorias: ["Rolls Premium"] },
  { nombre: "Hot roll spicy", descripcion: "Envuelto en queso crema con merquén. Relleno: kanikama, queso crema, pimiento, salmón ahumado, ciboulette y salsa spicy.", precio_base: 10000, categorias: ["Rolls Premium"] },
  { nombre: "Kyomu roll", descripcion: "En tempura coronado con tartar de salmón. Relleno: pepino, queso crema, palta, cebollín.", precio_base: 10000, categorias: ["Rolls Premium"] },
  { nombre: "Roll acevichado", descripcion: "Envuelto en palta, coronado con ceviche. Relleno: camarón apanado, queso crema, ciboulette.", precio_base: 12000, categorias: ["Rolls Premium"] },
  // ── Vegetariano ──
  { nombre: "20 CORTES VEGETARIANOS", descripcion: "10 palta/sésamo (palta, queso crema, pimiento, pepino). 10 pepino (espárrago, queso crema, cebollín, palmito).", precio_base: 11500, categorias: ["Vegetariano"] },
  { nombre: "30 CORTES VEGETARIANOS", descripcion: "10 palta/sésamo, 10 pepino, 10 panko (palta, queso crema, pepino, champiñón).", precio_base: 15000, categorias: ["Vegetariano"] },
  { nombre: "50 CORTES VEGETARIANOS", descripcion: "10 palta/sésamo, 10 pepino, 20 panko (variados), 10 hosomaki palta.", precio_base: 22500, categorias: ["Vegetariano"] },
  { nombre: "Roll vegetariano - Queso crema", descripcion: "Champiñones, pimentón asado, choclo, queso crema.", precio_base: 5500, categorias: ["Vegetariano"] },
  { nombre: "Roll vegetariano - Panko", descripcion: "Palta, queso crema, ciboulette, champiñones.", precio_base: 5500, categorias: ["Vegetariano"] },
  { nombre: "Roll vegetariano - Sésamo", descripcion: "Champiñones, queso crema, choclo, palta.", precio_base: 6000, categorias: ["Vegetariano"] },
  { nombre: "Roll vegetariano - Panko (espárrago)", descripcion: "Queso crema, espárrago, pimentón asado, cebollín.", precio_base: 6000, categorias: ["Vegetariano"] },
  { nombre: "Roll vegetariano - Palta", descripcion: "Palmitos, queso crema, espárrago, palta.", precio_base: 6300, categorias: ["Vegetariano"] },
  { nombre: "Roll vegetariano - Pepino", descripcion: "Espárrago, queso crema, cebollín, palmito.", precio_base: 6500, categorias: ["Vegetariano"] },
  // ── Sin arroz (Roll con grupos) ──
  {
    nombre: "Roll sin arroz",
    descripcion: "Queso crema + 4 ingredientes + envoltura a elección.",
    precio_base: 8000,
    categorias: ["Sin arroz"],
    grupos: [
      grupo("Envoltura (PLAQUETAS)", "single", true, [
        ["Nori", 0],
        ["Pepino", 0],
        ["Tempura", 0],
        ["Panko", 0],
        ["Sésamo", 0],
        ["Queso crema", 0],
        ["Palta", 0],
        ["Salmón", 0],
      ]),
      grupo("Ingredientes (4 a elección)", "multiple", true, [
        ["Palta", 0],
        ["Palmito", 0],
        ["Pimiento", 0],
        ["Choclo", 0],
        ["Cebollín", 0],
        ["Ciboulette", 0],
        ["Pollo apanado", 0],
        ["Pollo teriyaki", 0],
        ["Salmón crudo", 0],
        ["Salmón apanado", 0],
        ["Camarón cocido", 0],
        ["Camarón apanado", 0],
        ["Kanikama", 0],
      ], 4, null),
    ],
  },
  // ── Hand Rolls / Gohan ──
  { nombre: "Hand Roll - Kanikama", precio_base: 3500, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Hand Roll - Vegetariano", descripcion: "Choclo, cebollín, pepino, queso crema.", precio_base: 3500, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Hand Roll - Pollo teriyaki", precio_base: 4000, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Hand Roll - Camarón fresco", precio_base: 4000, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Hand Roll - Camarón apanado", precio_base: 4500, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Hand Roll - Salmón apanado", precio_base: 4500, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Gohan - Vegetariano", descripcion: "Base arroz, palta, queso crema, cebollín, choclo, champiñones apanados, palmitos.", precio_base: 7000, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Gohan - Pollo apanado", descripcion: "Base arroz, palta, queso crema, pollo apanado, cebollín, camarón fresco.", precio_base: 8000, categorias: ["Hand Rolls / Gohan"] },
  { nombre: "Gohan - Salmón", descripcion: "Base arroz, palta, queso crema, salmón fresco, cebollín, camarón fresco.", precio_base: 9000, categorias: ["Hand Rolls / Gohan"] },
  // ── Sushi Burger ──
  { nombre: "Sushi Burger - Vegetariana", descripcion: "Incluye papas fritas. Relleno: choclo, queso crema, palta, cebollín.", precio_base: 8000, categorias: ["Sushi Burger"] },
  { nombre: "Sushi Burger - Pollo", descripcion: "Incluye papas fritas. Relleno: pollo, queso crema, cebollín, palta.", precio_base: 9000, categorias: ["Sushi Burger"] },
  { nombre: "Sushi Burger - Camarón", descripcion: "Incluye papas fritas. Relleno: camarón, queso crema, cebollín.", precio_base: 9500, categorias: ["Sushi Burger"] },
  { nombre: "Sushi Burger - Salmón", descripcion: "Incluye papas fritas. Relleno: salmón, queso crema, cebollín, palta.", precio_base: 10300, categorias: ["Sushi Burger"] },
  // ── Base Han Roll (revisar: ¿precio base por opción?) ──
  {
    nombre: "Base Han Roll (a elección)",
    descripcion: "Queso crema + cebollín O queso crema + pimentón. Agregado de palta +$800 opcional. (Revisar precio base en carta.)",
    precio_base: 1000,
    categorias: ["Base Han Roll"],
    grupos: [
      grupo("Base", "single", true, [
        ["Queso crema, cebollín", 0],
        ["Queso crema, pimentón", 0],
      ]),
      grupo("Agregado", "single", false, [["Agregado de palta", 800]]),
    ],
  },
  // ── Acompañamientos ──
  { nombre: "Aros de cebolla (10 un)", precio_base: 2000, categorias: ["Acompañamientos"] },
  { nombre: "Papas fritas (300 gr)", precio_base: 2000, categorias: ["Acompañamientos"] },
  { nombre: "Arrollados primavera (6 un)", precio_base: 2500, categorias: ["Acompañamientos"] },
  { nombre: "Arrollados jamón/queso (6 un)", precio_base: 3500, categorias: ["Acompañamientos"] },
  { nombre: "Gyozas vegetarianas (5 un)", precio_base: 4000, categorias: ["Acompañamientos"] },
  { nombre: "Gyozas de pollo (5 un)", precio_base: 4500, categorias: ["Acompañamientos"] },
  { nombre: "Gyozas de camarón (5 un)", precio_base: 5000, categorias: ["Acompañamientos"] },
  { nombre: "Korokkes del chef (6 un)", precio_base: 5500, categorias: ["Acompañamientos"] },
  { nombre: "Bastones de camarón (7 un)", precio_base: 6000, categorias: ["Acompañamientos"] },
  { nombre: "Bastones de salmón (7 un)", precio_base: 7500, categorias: ["Acompañamientos"] },
  { nombre: "Sashimi de salmón (8 un)", precio_base: 8000, categorias: ["Acompañamientos"] },
  { nombre: "Ceviche de salmón (500 gr)", precio_base: 8500, categorias: ["Acompañamientos"] },
  { nombre: "Ceviche mixto", precio_base: 11000, categorias: ["Acompañamientos"] },
  // ── Niguiris / Sashimi / Temaki ──
  { nombre: "Niguiri de palta (2 un)", precio_base: 2500, categorias: ["Niguiris"] },
  { nombre: "Niguiri de kanikama (2 un)", precio_base: 3000, categorias: ["Niguiris"] },
  { nombre: "Niguiri de camarón (2 un)", precio_base: 3800, categorias: ["Niguiris"] },
  { nombre: "Niguiri de salmón (2 un)", precio_base: 4000, categorias: ["Niguiris"] },
  { nombre: "Sashimi - Salmón", precio_base: 8000, categorias: ["Sashimi"] },
  { nombre: "Temaki - Vegetariano", descripcion: "Relleno tarta vegetariana.", precio_base: 3000, categorias: ["Temaki"] },
  { nombre: "Temaki - Camarón", descripcion: "Camarón furai, queso crema, cebollín, palta.", precio_base: 3500, categorias: ["Temaki"] },
  { nombre: "Temaki - Salmón", descripcion: "Tarta de la casa, salmón, camarón con salsa acevichada.", precio_base: 4000, categorias: ["Temaki"] },
];

async function run() {
  const businessId = process.argv[2];
  if (!businessId) {
    console.error("Uso: node scripts/seed-kyomu.js <businessId>");
    console.error("  businessId = ID del documento en /negocios (ej. UID del dueño de Kyomu)");
    process.exit(1);
  }

  const negocioRef = db.collection("negocios").doc(businessId);
  const negocioSnap = await negocioRef.get();
  if (!negocioSnap.exists) {
    console.error("No existe el negocio con ID:", businessId);
    process.exit(1);
  }

  const catRef = negocioRef.collection("categorias");
  const prodRef = negocioRef.collection("productos");

  const existingCats = await catRef.get();
  const nameToId = {};
  existingCats.docs.forEach((d) => {
    const n = d.data().nombre;
    if (n) nameToId[n] = d.id;
  });

  for (const nombre of CATEGORIAS) {
    if (!nameToId[nombre]) {
      const ref = await catRef.add({ nombre });
      nameToId[nombre] = ref.id;
      console.log("Categoría creada:", nombre);
    }
  }

  for (const p of PRODUCTOS) {
    const categoriaIds = (p.categorias || []).map((c) => nameToId[c]).filter(Boolean);
    if (categoriaIds.length === 0 && (p.categorias || []).length > 0) {
      console.warn("Producto sin categoría resuelta:", p.nombre, "→ categorías:", p.categorias);
    }
    const payload = {
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio_base: p.precio_base,
      categorias: categoriaIds.length ? categoriaIds : [nameToId["Rolls individual"] || nameToId["Acompañamientos"]],
      es_promocion: p.es_promocion ?? false,
      activo: true,
      imagen: "",
      permitirNota: false,
      grupos: p.grupos || [],
    };
    await prodRef.add(payload);
    console.log("Platillo creado:", p.nombre);
  }

  console.log("\n✅ Seed completado.");
  console.log("\n--- DUDAS Y REVISIONES MANUALES ---");
  console.log("1. Torta de Sushi: los grupos PLAQUETAS/VEGETALES/PROTEÍNAS tienen 'extra' según carta. Si el precio base ya incluye alguna opción, marcar 'incluido' en esa opción o ajustar precios.");
  console.log("2. Hosomaki relleno: está como 1 opción entre proteína o vegetal; si la carta exige elegir solo de una lista unificada, revisar nombres.");
  console.log("3. Roll sin arroz: '4 ingredientes' está como múltiple con límite 4; si hay que elegir X de vegetales y Y de proteínas, dividir en dos grupos.");
  console.log("4. Base Han Roll: tiene precio_base $1000 provisional; en la carta no figura precio para la base. Ajustar o eliminar según corresponda.");
  console.log("5. Cebollín vs Ciboulette: se trataron como opciones distintas; unificar si en la carta son lo mismo.");
  console.log("6. Agregar salsas a elección: subopciones (spicy, acevichada) están en descripción; si deben ser grupo electivo, agregar grupo.");
  console.log("7. Orden de categorías en el menú: se crean en el orden de CATEGORIAS; reordenar en el admin si hace falta.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
