/**
 * Migración: copiar datos sensibles a /negocios/{id}/privado/config
 *
 * Usa Firebase Admin SDK (ignora reglas de seguridad). Ejecutar UNA SOLA VEZ.
 *
 * Pasos:
 * 1. Instalar: npm install firebase-admin
 * 2. En Firebase Console: Proyecto > Configuración > Cuentas de servicio
 *    > "Generar nueva clave privada". Guarda el JSON (ej. foodi-service-account.json)
 *    en la raíz del proyecto o en scripts/ (NO subas este archivo a git).
 * 3. Ejecutar:
 *    node scripts/migrar-negocios-privado-node.js
 *    O con la ruta del JSON:
 *    set GOOGLE_APPLICATION_CREDENTIALS=./foodi-service-account.json
 *    node scripts/migrar-negocios-privado-node.js
 *
 * No borra campos del documento principal.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ruta al JSON de la cuenta de servicio (cambiar si lo guardas en otro sitio)
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  join(__dirname, "foodi-service-account.json");

if (!existsSync(serviceAccountPath)) {
  console.error(
    "No se encontró la cuenta de servicio. Opciones:\n" +
      "  1. Guarda el JSON como scripts/foodi-service-account.json\n" +
      "  2. O define GOOGLE_APPLICATION_CREDENTIALS con la ruta al JSON\n" +
      "Ejemplo: set GOOGLE_APPLICATION_CREDENTIALS=./mi-clave.json && node scripts/migrar-negocios-privado-node.js"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(serviceAccountPath, "utf8")
);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const negociosSnap = await db.collection("negocios").get();

  for (const negocioDoc of negociosSnap.docs) {
    const data = negocioDoc.data();
    const privadoRef = db
      .collection("negocios")
      .doc(negocioDoc.id)
      .collection("privado")
      .doc("config");

    await privadoRef.set(
      {
        rut: data.rut || "",
        razonSocial: data.razonSocial || "",
        giro: data.giro || "",
        datosBancarios: data.datosBancarios || {},
        coordenadasLocal:
          data.deliveryConfig?.coordenadasLocal ?? null,
      },
      { merge: true }
    );

    console.log(`✓ Migrado: ${data.nombre || negocioDoc.id}`);
  }

  console.log(
    "✅ Migración completa. No se han borrado campos del documento principal."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
