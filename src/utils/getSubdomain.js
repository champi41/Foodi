export const getSubdomain = () => {
  const hostname = window.location.hostname; // ej: "pizzeria.lvh.me"

  // Si estamos en localhost puro, no hay subdominio
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  const parts = hostname.split(".");

  // Si la URL es pizzeria.lvh.me, las partes son ["pizzeria", "lvh", "me"]
  // El subdominio es la primera parte.
  if (parts.length >= 2) {
    return parts[0];
  }

  return null;
};
