/**
 * send-push.js
 * ─────────────────────────────────────────────────────────────
 * Script para enviar notificaciones push FCM a TODOS los suscriptores
 * directamente desde la consola del navegador en admin.html
 *
 * USO:
 *   1. Abre admin.html (con tu usuario admin logueado)
 *   2. Abre DevTools → Console (F12)
 *   3. Pega TODO el script, ajusta TITULO / CUERPO / URL al inicio
 *   4. Presiona Enter
 *
 * REQUISITO:
 *   Necesitas un Server Key de FCM (Legacy) o un Access Token OAuth2.
 *   Más fácil: usa el SERVER_KEY de Firebase Console →
 *   Project Settings → Cloud Messaging → Cloud Messaging API (Legacy)
 *   Si está deshabilitado, actívalo primero desde la consola de Firebase.
 * ─────────────────────────────────────────────────────────────
 */

(async () => {

  // ───────────────────────────────────────────────
  // ✏️  EDITA ESTOS 4 VALORES ANTES DE EJECUTAR
  // ───────────────────────────────────────────────
  const SERVER_KEY = 'PEGA_AQUI_TU_SERVER_KEY_DE_FIREBASE';  // ⚠️ Reemplazar
  const TITULO     = '🎉 ¡Nueva fase! Ronda de 32';
  const CUERPO     = 'Ya empieza la eliminatoria del Mundial 2026. Únete al nuevo grupo y pronostica los 16 cruces. ¡El primer partido es mañana!';
  const URL_CLICK  = 'https://worldcup2026-8f27b.web.app/dashboard.html';
  // ───────────────────────────────────────────────

  if (SERVER_KEY.startsWith('PEGA_AQUI')) {
    console.error('❌ Debes reemplazar SERVER_KEY con tu clave real de Firebase Cloud Messaging.');
    console.info('👉 Ve a: Firebase Console → Project Settings → Cloud Messaging → Server key');
    return;
  }

  // ── Leer todos los tokens de Firestore ──
  const { collection, getDocs } = await import(
    'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js'
  );
  const { db } = await import('/js/firebase-config.js');

  const snap = await getDocs(collection(db, 'fcm_tokens'));
  const tokens = snap.docs.map(d => d.data().token).filter(Boolean);

  if (tokens.length === 0) {
    console.warn('⚠️ No hay tokens registrados en fcm_tokens. Nadie tiene las notificaciones activadas.');
    return;
  }

  console.log(`📣 Enviando push a ${tokens.length} dispositivo(s)...`);

  // FCM Legacy API permite hasta 1000 tokens por request (multicast)
  const BATCH = 1000;
  let ok = 0, fail = 0;

  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'key=' + SERVER_KEY,
        },
        body: JSON.stringify({
          registration_ids: batch,
          notification: {
            title: TITULO,
            body:  CUERPO,
            icon:  '/icons/icon-192.png',
            click_action: URL_CLICK,
          },
          data: {
            url: URL_CLICK,
          },
          android:  { priority: 'high' },
          apns:     { headers: { 'apns-priority': '10' } },
          webpush:  { fcmOptions: { link: URL_CLICK } },
        }),
      });

      const json = await res.json();
      ok   += json.success || 0;
      fail += json.failure || 0;

      // Limpiar tokens inválidos automáticamente
      if (json.results) {
        const { doc, deleteDoc } = await import(
          'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js'
        );
        json.results.forEach((r, idx) => {
          if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
            const uid = snap.docs[i + idx]?.id;
            if (uid) {
              deleteDoc(doc(db, 'fcm_tokens', uid));
              console.log(`  🧹 Token inválido eliminado: uid=${uid}`);
            }
          }
        });
      }

      console.log(`  ✅ Batch ${Math.floor(i/BATCH)+1}: ${json.success} ok, ${json.failure} fallidos`);
    } catch (err) {
      console.error(`  ❌ Error en batch ${Math.floor(i/BATCH)+1}:`, err.message);
    }
  }

  console.log(`\n📨 Push enviado: ${ok} exitosos / ${fail} fallidos de ${tokens.length} total`);
  if (fail > 0) console.info('💡 Los fallidos suelen ser dispositivos que desinstalaron la app o revocaron el permiso.');
})();
