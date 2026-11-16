// Telefon bildirimleri (Firebase Cloud Messaging, Web Push)
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { fb, saveToken } from "./data.js";
import { VAPID_KEY } from "./push-config.js";

export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
export const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// "unsupported" | "ios-install" | "default" | "granted" | "denied"
export async function pushState() {
  if (isIOS && !isStandalone) return "ios-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  try { if (!(await isSupported())) return "unsupported"; } catch { return "unsupported"; }
  return Notification.permission;
}

async function registerToken() {
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(fb), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (token) await saveToken(token);
  return token;
}

// Kullanıcı dokunuşuyla çağrılmalı (iOS bunu zorunlu tutuyor)
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm;
  await registerToken();
  return "granted";
}

// İzin zaten verilmişse açılışta anahtarı tazele (anahtarlar zamanla değişebilir)
export async function refreshPush() {
  try { if ((await pushState()) === "granted") await registerToken(); } catch (e) { console.warn("push yenilenemedi", e); }
}
