/**
 * Helpers para delivery por distancia (Google Geocoding + Routes API)
 */

/**
 * Geocodifica una dirección con Google Geocoding API
 * @param {string} direccion - Dirección completa
 * @returns {Promise<{ lat: number, lng: number, formatted: string } | null>}
 */
/**
 * Normaliza la dirección para mejorar resultados en Chile (Geocoding suele
 * necesitar país explícito para direcciones cortas como "Calle X 123 Frutillar").
 */
const normalizarDireccionChile = (direccion) => {
  const d = (direccion || "").trim();
  if (!d) return d;
  const sinChile = !/,\s*chile\s*$/i.test(d) && !/\bchile\s*$/i.test(d);
  return sinChile ? `${d}, Chile` : d;
};

export const geocodificar = async (direccion) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return null;
  const direccionNormalizada = normalizarDireccionChile(direccion);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccionNormalizada)}&region=cl&language=es&components=country:CL&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) return null;
  const { lat, lng } = data.results[0].geometry.location;
  return {
    lat,
    lng,
    formatted: data.results[0].formatted_address,
  };
};

/**
 * Distancia en línea recta (Haversine) en km.
 * Se usa para asignar el rango de precio para que coincida con los círculos del mapa.
 * @param {{ lat: number, lng: number }} origen
 * @param {{ lat: number, lng: number }} destino
 * @returns {number} km
 */
export const distanciaLineaRectaKm = (origen, destino) => {
  const R = 6371; // radio Tierra en km
  const dLat = ((destino.lat - origen.lat) * Math.PI) / 180;
  const dLng = ((destino.lng - origen.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origen.lat * Math.PI) / 180) *
      Math.cos((destino.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calcula distancia en km entre dos puntos con Routes API (por carretera)
 * @param {{ lat: number, lng: number }} origen
 * @param {{ lat: number, lng: number }} destino
 * @returns {Promise<number | null>} km o null si falla
 */
export const calcularDistanciaKm = async (origen, destino) => {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) return null;
  const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
  const body = {
    origin: {
      location: {
        latLng: { latitude: origen.lat, longitude: origen.lng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: destino.lat, longitude: destino.lng },
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.legs.distanceMeters",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.routes?.length) return null;
  const route = data.routes[0];
  // Routes API v2: puede venir en route.distanceMeters o en route.legs[].distanceMeters
  let meters = route.distanceMeters;
  if (meters == null && route.legs?.length) {
    meters = route.legs.reduce((sum, leg) => sum + (leg.distanceMeters || 0), 0);
  }
  if (meters == null || typeof meters !== "number") return null;
  return Math.round(meters) / 1000;
};

/**
 * Encuentra el rango de precio según la distancia
 * @param {number} km
 * @param {Array<{ kmDesde: number, kmHasta: number, precio: number, label: string }>} rangos
 * @param {number} kmMaximo
 * @returns {{ kmDesde: number, kmHasta: number, precio: number, label: string } | null}
 */
export const encontrarRango = (km, rangos, kmMaximo) => {
  const kmNum = Number(km);
  const maxNum = Number(kmMaximo);
  if (Number.isNaN(kmNum) || kmNum > maxNum) return null;
  return (
    rangos.find((r) => {
      const desde = Number(r.kmDesde);
      const hasta = Number(r.kmHasta);
      return !Number.isNaN(desde) && !Number.isNaN(hasta) && kmNum >= desde && kmNum < hasta;
    }) ?? null
  );
};
