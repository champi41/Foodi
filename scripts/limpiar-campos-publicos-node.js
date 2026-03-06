/**
 * Limpieza: borrar campos sensibles del documento público /negocios/{id}
 *
 * Ejecutar DESPUÉS de la migración y de haber comprobado que todo funciona.
 * Usa la misma cuenta de servicio que migrar-negocios-privado-node.js.
 *
 * Elimina del documento principal:
 *   - rut, razonSocial, giro, datosBancarios
 *   - deliveryConfig.coordenadasLocal (el resto de deliveryConfig se mantiene)
 *
 * Pasos:
 * 1. Misma cuenta de servicio: scripts/foodi-service-account.json
 *    (o GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON).
 * 2. Ejecutar: npm run limpiar:publico
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  join(__dirname, "foodi-service-account.json");

if (!existsSync(serviceAccountPath)) {
  console.error(
    "No se encontró la cuenta de servicio. Usa el mismo JSON que para migrar:privado.\n" +
      "  scripts/foodi-service-account.json\n" +
      "  o define GOOGLE_APPLICATION_CREDENTIALS"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

// Evitar "app already exists" si se ejecutó otro script antes en el mismo proceso
try {
  initializeApp({ credential: cert(serviceAccount) });
} catch (e) {
  if (!e.message?.includes("already exists")) throw e;
}

const db = getFirestore();

async function main() {
  const negociosSnap = await db.collection("negocios").get();

  for (const negocioDoc of negociosSnap.docs) {
    const ref = negocioDoc.ref;
    const data = negocioDoc.data();

    const updates = {
      rut: FieldValue.delete(),
      razonSocial: FieldValue.delete(),
      giro: FieldValue.delete(),
      datosBancarios: FieldValue.delete(),
    };

    if (data.deliveryConfig && "coordenadasLocal" in data.deliveryConfig) {
      updates["deliveryConfig.coordenadasLocal"] = FieldValue.delete();
    }

    await ref.update(updates);
    console.log(`✓ Limpiado: ${data.nombre || negocioDoc.id}`);
  }

  console.log("✅ Limpieza completa. Los datos sensibles ya no están en el documento público.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
