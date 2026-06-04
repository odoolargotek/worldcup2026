// notifications.js — Pedir permiso push + guardar token FCM en Firestore
import { messaging, db, VAPID_KEY } from './firebase-config.js';
import { getToken, onMessage }       from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

/**
 * Llama esta función al hacer login exitoso.
 * Pide permiso al usuario, obtiene el token FCM y lo guarda en Firestore.
 */
export async function initPushNotifications(userId) {
  try {
    // Registrar service worker
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Pedir permiso
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Permiso denegado por el usuario.');
      return;
    }

    // Obtener token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) {
      console.warn('[FCM] No se pudo obtener el token.');
      return;
    }

    // Guardar en Firestore
    await setDoc(doc(db, 'fcm_tokens', userId), {
      token,
      user_uid:   userId,
      platform:   navigator.platform || 'web',
      updated_at: serverTimestamp()
    }, { merge: true });

    console.info('[FCM] Token guardado correctamente.');

    // Notificaciones en primer plano (app abierta)
    onMessage(messaging, (payload) => {
      showInAppToast(payload.notification?.title, payload.notification?.body, payload.data?.url);
    });

  } catch (err) {
    console.error('[FCM] Error iniciando push:', err);
  }
}

/**
 * Toast in-app para cuando la app está abierta (foreground)
 */
export function showInAppToast(title = '', body = '', url = null) {
  // Eliminar toast anterior si existe
  document.getElementById('fcmToast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'fcmToast';
  toast.style.cssText = `
    position: fixed; top: 70px; right: 16px; z-index: 9999;
    background: linear-gradient(135deg, #1e293b, #273549);
    border: 1px solid rgba(22,163,74,0.5);
    border-left: 4px solid #22c55e;
    border-radius: 12px;
    padding: 14px 18px;
    max-width: 320px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    display: flex; gap: 12px; align-items: flex-start;
    animation: toastIn 0.3s ease;
    cursor: ${url ? 'pointer' : 'default'};
    font-family: 'Inter', sans-serif;
  `;

  toast.innerHTML = `
    <div style="font-size:1.6rem;line-height:1">⚽</div>
    <div style="flex:1">
      <div style="font-weight:700;color:#f1f5f9;font-size:0.9rem;margin-bottom:3px">${title}</div>
      <div style="color:#94a3b8;font-size:0.8rem;line-height:1.4">${body}</div>
    </div>
    <button onclick="document.getElementById('fcmToast').remove()" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:0;line-height:1">×</button>
  `;

  if (url) toast.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') window.location.href = url;
  });

  // Inyectar animación si no existe
  if (!document.getElementById('fcmToastStyle')) {
    const style = document.createElement('style');
    style.id = 'fcmToastStyle';
    style.textContent = `
      @keyframes toastIn {
        from { opacity:0; transform: translateX(40px); }
        to   { opacity:1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto-cerrar en 6 segundos
  setTimeout(() => toast.remove(), 6000);
}
