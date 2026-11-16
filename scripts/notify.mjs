// GitHub Actions tarafından 5 dakikada bir çalıştırılır.
// 1) Bekleyen dürtme / kriz / destek bildirimlerini gönderir
// 2) Görevlere gelen yorumları görev sahibine bildirir
// 3) iPhone Kestirmeler'den gelen adım sayılarını profillere işler
// 4) 21:00'de görevi kalanlara hatırlatma, pazartesi 10:00'da haftalık sonuç gönderir
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const fcm = getMessaging();

/* ---------- Türkiye saatine göre tarih ---------- */
const TZ = "Europe/Istanbul";
function trParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: p.weekday };
}
const now = trParts();
function shiftDate(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const dayIdx = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[now.weekday];
const thisWeek = shiftDate(now.date, -dayIdx);
const prevWeek = shiftDate(thisWeek, -7);

/* ---------- kullanıcılar ve cihaz anahtarları ---------- */
const users = Object.fromEntries((await db.collection("users").get()).docs.map((d) => [d.id, d.data()]));
const name = (uid) => users[uid]?.name || "Biri";
const tokens = {};
for (const d of (await db.collection("tokens").get()).docs) {
  const { uid } = d.data();
  (tokens[uid] ||= []).push(d.id);
}

let sent = 0;
async function push(uid, title, body, url = "./") {
  const list = tokens[uid] || [];
  if (!list.length) return;
  const res = await fcm.sendEachForMulticast({
    tokens: list,
    data: { title, body, url },
    webpush: { headers: { Urgency: "high", TTL: "43200" } },
  });
  res.responses.forEach((r, i) => {
    if (r.success) { sent++; return; }
    const code = r.error?.code || "";
    console.warn("gönderilemedi:", code);
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token") || code.includes("invalid-argument")) {
      db.collection("tokens").doc(list[i]).delete().catch(() => {});
    }
  });
}

/* ---------- 1) dürtme, kriz, destek ---------- */
const STALE = Date.now() - 6 * 3600 * 1000;
for (const d of (await db.collection("nudges").where("pushed", "==", false).get()).docs) {
  const n = d.data();
  if (n.createdAt > STALE) {
    if (n.type === "crisis") await push(n.to, `${name(n.from)} zorlanıyor`, `${n.text || "Kriz anı"}. Bir mesaj at, yalnız olmadığını bilsin.`);
    else if (n.type === "cheer") await push(n.to, name(n.from), n.text || "Devam, yapıyorsun!");
    else await push(n.to, `${name(n.from)} seni dürttü`, "Görevlerin bekliyor.");
  }
  await d.ref.update({ pushed: true });
}

/* ---------- 2) yorumlar ---------- */
for (const d of (await db.collection("comments").where("pushed", "==", false).get()).docs) {
  const c = d.data();
  if (c.createdAt > STALE) {
    const task = (await db.collection("tasks").doc(c.taskId).get()).data();
    if (task && task.uid !== c.uid) await push(task.uid, `${name(c.uid)} yorum yaptı`, `${task.title}: ${c.text}`);
  }
  await d.ref.update({ pushed: true });
}

/* ---------- 3) iPhone Sağlık adımları ---------- */
for (const d of (await db.collection("healthInbox").get()).docs) {
  const key = (await db.collection("healthKeys").doc(d.id).get()).data();
  if (!key?.uid || !users[key.uid]) continue;
  const steps = Math.round(Number(d.data().steps) || 0);
  const date = trParts(d.updateTime.toDate()).date;
  if (users[key.uid].steps?.[date] !== steps) {
    await db.collection("users").doc(key.uid).update({ [`steps.${date}`]: steps });
  }
}

/* ---------- 4a) akşam hatırlatması (21:00) ---------- */
if (now.hour === 21) {
  const today = (await db.collection("tasks").where("date", "==", now.date).get()).docs.map((d) => d.data());
  const goals = (await db.collection("goals").get()).docs.map((d) => d.data());
  for (const uid of Object.keys(users)) {
    if (users[uid].reminded === now.date) continue;
    const left = today.filter((t) => t.uid === uid && !t.done).length;
    const goalLeft = goals.filter((g) => g.uid === uid && !g.checkins?.[now.date]).length;
    const parts = [];
    if (left) parts.push(`${left} görevin kaldı`);
    if (goalLeft) parts.push("bugünkü temiz günü işaretlemedin");
    if (parts.length) await push(uid, "Gün bitmeden", parts.join(", ").replace(/^./, (c) => c.toLocaleUpperCase("tr-TR")) + ".");
    await db.collection("users").doc(uid).update({ reminded: now.date });
  }
}

/* ---------- 4b) pazartesi haftalık sonuç (10:00) ---------- */
if (dayIdx === 0 && now.hour === 10) {
  const settingsRef = db.collection("group").doc("settings");
  const settings = (await settingsRef.get()).data() || {};
  if (settings.announced !== prevWeek) {
    const ranked = Object.keys(users).sort((a, b) => (users[b].weekPoints?.[prevWeek] || 0) - (users[a].weekPoints?.[prevWeek] || 0));
    if (ranked.length > 1) {
      const first = ranked[0], last = ranked[ranked.length - 1];
      const bet = settings.bet ? ` İddia: ${settings.bet}.` : "";
      for (const uid of ranked) {
        await push(uid, "Geçen haftanın sonucu", `Birinci ${name(first)}, sonuncu ${name(last)}.${bet}`);
      }
    }
    await settingsRef.set({ announced: prevWeek }, { merge: true });
  }
}

console.log(`tamam: ${now.date} ${now.hour}:00, ${sent} bildirim gönderildi`);
