/**
 * Migración: copiar datos sensibles a /negocios/{id}/privado/config
 *
 * IMPORTANTE: Las reglas de Firestore solo permiten escribir en /privado/config
 * al dueño del negocio (request.auth.uid == negocioId). Por tanto este script
 * en el navegador solo funciona si inicias sesión como el dueño de CADA negocio
 * (o si solo tienes un negocio y eres tú el dueño). Si tienes varios negocios
 * con distintos dueños, verás "Missing or insufficient permissions".
 *
 * Para migrar todos los negocios de una vez, usa el script Node con Admin SDK:
 *   scripts/migrar-negocios-privado-node.js
 * (requiere cuenta de servicio de Firebase; no depende de las reglas de cliente).
 *
 * Uso de este script en consola (solo si eres dueño del único negocio):
 * 1. Abre la app, F12, consola. Inicia sesión con el usuario dueño del negocio.
 * 2. Sustituye firebaseConfig, EMAIL_SUPERADMIN y PASSWORD abajo.
 * 3. Pega y ejecuta.
 *
 * El script NO borra los campos sensibles del documento principal.
 */

(async () => {
  const firebaseConfig = {
    apiKey: "TU_VITE_FIREBASE_API_KEY",
    authDomain: "TU_VITE_FIREBASE_AUTH_DOMAIN",
    projectId: "TU_VITE_FIREBASE_PROJECT_ID",
    storageBucket: "TU_VITE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "TU_VITE_FIREBASE_MESSAGING_SENDER_ID",
    appId: "TU_VITE_FIREBASE_APP_ID",
  };

  const EMAIL_SUPERADMIN = "TU_EMAIL_SUPERADMIN";
  const PASSWORD_SUPERADMIN = "TU_PASSWORD";

  const { initializeApp, getApps } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"
  );
  const {
    getFirestore,
    collection,
    getDocs,
    doc,
    setDoc,
  } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
  );
  const { getAuth, signInWithEmailAndPassword } = await import(
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
  );

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  await signInWithEmailAndPassword(auth, EMAIL_SUPERADMIN, PASSWORD_SUPERADMIN);

  const negociosSnap = await getDocs(collection(db, "negocios"));

  for (const negocioDoc of negociosSnap.docs) {
    const data = negocioDoc.data();
    const privadoRef = doc(db, "negocios", negocioDoc.id, "privado", "config");

    await setDoc(
      privadoRef,
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

  console.log("✅ Migración completa. No se han borrado campos del documento principal.");
})();
