// Firebase bağlantısı, canlı dinleyiciler ve tüm yazma işlemleri
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, memoryLocalCache, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, onSnapshot, increment, deleteField, getDocs, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { S, P, shiftDay, weekdayIdx, dailyOf, findTask, cleanDays, toast } from "./lib.js";

export const configured = !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("BURAYA");
export const fb = configured ? initializeApp(firebaseConfig) : null;
export const API_KEY = firebaseConfig.apiKey;
export const PROJECT_ID = firebaseConfig.projectId;
export const auth = configured ? getAuth(fb) : null;
// Bellek içi önbellek + long polling: çoklu sekme, gizli mod ve kısıtlı ağlarda sorun çıkarmaz
const db = configured ? initializeFirestore(fb, { localCache: memoryLocalCache(), experimentalForceLongPolling: true }) : null;

const ref = (...p) => doc(db, ...p);
const col = (name) => collection(db, name);

/* ---------- üyelik ve profil ---------- */
export async function isMember() { return (await getDoc(ref("members", S.uid))).exists(); }
export const joinGroup = (code) => setDoc(ref("members", S.uid), { code, joinedAt: Date.now() });
export async function hasProfile() { return (await getDoc(ref("users", S.uid))).exists(); }
export const createProfile = (name, color) => setDoc(ref("users", S.uid), {
  name, color, points: 0, weekPoints: {}, streak: 0, bestStreak: 0, lastFullDay: "", history: {}, createdAt: Date.now(),
});
export const updateProfile = (data) => updateDoc(ref("users", S.uid), data);

/* ---------- tekrarlayan görevleri bugüne/bu haftaya kopyala ---------- */
export async function ensureRecurring() {
  const snap = await getDocs(query(col("templates"), where("uid", "==", S.uid)));
  const today = weekdayIdx();
  await Promise.all(snap.docs.map(async (d) => {
    const t = d.data();
    if (t.kind === "weekly") {
      const r = ref("tasks", `w_${S.week}_${d.id}`);
      if (!(await getDoc(r)).exists()) {
        await setDoc(r, { uid: S.uid, title: t.title, kind: "weekly", week: S.week, target: t.target || 3, doneDays: [], templateId: d.id, reactions: {}, createdAt: t.createdAt || Date.now() });
      }
    } else {
      const days = t.days?.length ? t.days : [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(today)) return;
      const r = ref("tasks", `${S.today}_${d.id}`);
      if (!(await getDoc(r)).exists()) {
        await setDoc(r, { uid: S.uid, title: t.title, kind: "daily", date: S.today, done: false, days, templateId: d.id, reactions: {}, createdAt: t.createdAt || Date.now() });
      }
    }
  }));
}

/* ---------- canlı dinleyiciler ---------- */
let unsubs = [];
export function stopListening() { unsubs.forEach((u) => u()); unsubs = []; }
export function listen(onChange, onError) {
  stopListening();
  const on = (q, fn) => unsubs.push(onSnapshot(q, (s) => { fn(s); onChange(); }, onError));
  const list = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
  on(col("users"), (s) => { S.users = Object.fromEntries(s.docs.map((d) => [d.id, d.data()])); });
  on(query(col("tasks"), where("date", "==", S.today)), (s) => { S.daily = list(s); });
  on(query(col("tasks"), where("week", "==", S.week)), (s) => { S.weekly = list(s); });
  on(col("goals"), (s) => { S.goals = list(s); });
  on(col("challenges"), (s) => { S.challenges = list(s); });
  on(query(col("comments"), where("week", "==", S.week)), (s) => { S.comments = list(s); });
  on(query(col("nudges"), where("to", "==", S.uid), where("seen", "==", false)), (s) => { S.nudges = list(s); });
  on(ref("group", "settings"), (s) => { S.group = s.exists() ? s.data() : {}; });
}

/* ---------- puan ---------- */
async function addPoints(n) {
  await updateDoc(ref("users", S.uid), { points: increment(n), [`weekPoints.${S.week}`]: increment(n) });
}
async function saveHistory() {
  const mine = dailyOf(S.uid);
  const pct = mine.length ? Math.round((mine.filter((t) => t.done).length / mine.length) * 100) : 0;
  await updateDoc(ref("users", S.uid), { [`history.${S.today}`]: pct });
}

/* ---------- görevler ---------- */
// kind: "daily" (days: [] = her gün) | "weekly" (target: haftada kaç gün) | "once" (sadece bugün)
export async function addTask({ title, kind, days, target }) {
  const now = Date.now();
  if (kind === "once") {
    await addDoc(col("tasks"), { uid: S.uid, title, kind: "daily", date: S.today, done: false, reactions: {}, createdAt: now });
  } else if (kind === "weekly") {
    const tpl = await addDoc(col("templates"), { uid: S.uid, title, kind: "weekly", target, createdAt: now });
    await setDoc(ref("tasks", `w_${S.week}_${tpl.id}`), { uid: S.uid, title, kind: "weekly", week: S.week, target, doneDays: [], templateId: tpl.id, reactions: {}, createdAt: now });
  } else {
    const tpl = await addDoc(col("templates"), { uid: S.uid, title, kind: "daily", days, createdAt: now });
    if (!days.length || days.includes(weekdayIdx())) {
      await setDoc(ref("tasks", `${S.today}_${tpl.id}`), { uid: S.uid, title, kind: "daily", date: S.today, done: false, days, templateId: tpl.id, reactions: {}, createdAt: now });
    }
  }
  await saveHistory();
}

export async function toggleTask(id) {
  const t = findTask(id);
  if (!t || t.uid !== S.uid) return;

  if (t.kind === "weekly") {
    const has = (t.doneDays || []).includes(S.today);
    await updateDoc(ref("tasks", id), { doneDays: has ? arrayRemove(S.today) : arrayUnion(S.today) });
    await addPoints(has ? -P.task : P.task);
    if (!has && (t.doneDays || []).length + 1 === (t.target || 1)) toast("Haftalık hedef tamam");
    return;
  }

  const done = !t.done;
  t.done = done; // anında hesap için yerelde de güncelle
  await updateDoc(ref("tasks", id), { done, doneAt: done ? Date.now() : deleteField() });
  await addPoints(done ? P.task : -P.task);
  await saveHistory();

  const mine = dailyOf(S.uid);
  const u = S.users[S.uid];
  if (done && mine.length && mine.every((x) => x.done) && u.lastFullDay !== S.today) {
    const streak = u.lastFullDay === shiftDay(-1) ? (u.streak || 0) + 1 : 1;
    await updateDoc(ref("users", S.uid), {
      points: increment(P.dayBonus), [`weekPoints.${S.week}`]: increment(P.dayBonus),
      streak, bestStreak: Math.max(streak, u.bestStreak || 0), lastFullDay: S.today,
    });
    toast(`Günün tamam. +${P.dayBonus} puan, seri ${streak} gün`);
  }
}

export async function deleteTask(id, stopRepeat) {
  const t = findTask(id);
  if (!t) return;
  const wasDone = t.kind === "weekly" ? (t.doneDays || []).length : t.done ? 1 : 0;
  await deleteDoc(ref("tasks", id));
  if (stopRepeat && t.templateId) await deleteDoc(ref("templates", t.templateId));
  if (t.hasPhoto) await deleteDoc(ref("photos", id)).catch(() => {});
  if (wasDone) await addPoints(-P.task * wasDone);
  if (t.kind !== "weekly") { S.daily = S.daily.filter((x) => x.id !== id); await saveHistory(); }
}

export async function react(colName, id, emoji) {
  const item = (colName === "goals" ? S.goals : [...S.daily, ...S.weekly]).find((x) => x.id === id);
  if (!item) return;
  const cur = item.reactions?.[S.uid];
  await updateDoc(ref(colName, id), { [`reactions.${S.uid}`]: cur === emoji ? deleteField() : emoji });
}

/* ---------- yorum, fotoğraf, dürtme ---------- */
export const addComment = (taskId, text) => addDoc(col("comments"), { taskId, uid: S.uid, text, week: S.week, pushed: false, createdAt: Date.now() });
export const deleteComment = (id) => deleteDoc(ref("comments", id));

export async function savePhoto(taskId, dataUrl) {
  await setDoc(ref("photos", taskId), { uid: S.uid, data: dataUrl, createdAt: Date.now() });
  await updateDoc(ref("tasks", taskId), { hasPhoto: true });
}
export async function loadPhoto(taskId) {
  const s = await getDoc(ref("photos", taskId));
  return s.exists() ? s.data().data : null;
}

export const nudge = (to, type = "nudge", text = "") => addDoc(col("nudges"), { from: S.uid, to, type, text, seen: false, pushed: false, createdAt: Date.now() });
export const markNudgesSeen = () => Promise.all(S.nudges.map((n) => updateDoc(ref("nudges", n.id), { seen: true })));

/* ---------- bırakma hedefleri ---------- */
export async function addGoal({ title, kind, perDay, packPrice }) {
  const now = Date.now();
  await addDoc(col("goals"), {
    uid: S.uid, title, kind, startedAt: now, lastResetAt: now, bestDays: 0, relapses: 0, crises: 0,
    perDay: Number(perDay) || 0, packPrice: Number(packPrice) || 0, checkins: {}, reactions: {}, createdAt: now,
  });
}
export async function checkinGoal(id) {
  const g = S.goals.find((x) => x.id === id);
  if (!g || g.checkins?.[S.today]) return;
  await updateDoc(ref("goals", id), { [`checkins.${S.today}`]: true });
  await addPoints(P.checkin);
  toast(`Kaydedildi. +${P.checkin}`);
}
export async function relapseGoal(id) {
  const g = S.goals.find((x) => x.id === id);
  if (!g) return;
  await updateDoc(ref("goals", id), { lastResetAt: Date.now(), relapses: increment(1), bestDays: Math.max(g.bestDays || 0, cleanDays(g)) });
  toast("Sayaç sıfırlandı. En iyi rekorun duruyor.");
}
export async function crisisSurvived(id) {
  await updateDoc(ref("goals", id), { crises: increment(1) });
  await addPoints(P.crisis);
}
export const crisisAlert = (goalTitle) =>
  Promise.all(Object.keys(S.users).filter((u) => u !== S.uid).map((u) => nudge(u, "crisis", goalTitle)));
export const setSaveFor = (id, name, amount) =>
  updateDoc(ref("goals", id), { saveFor: name && amount ? { name, amount: Number(amount) } : deleteField() });
export const deleteGoal = (id) => deleteDoc(ref("goals", id));

/* ---------- ortak meydan okumalar ---------- */
export const addChallenge = ({ title, days }) => addDoc(col("challenges"), {
  title, days: Number(days), startDate: S.today, createdBy: S.uid, participants: [S.uid], checkins: {}, createdAt: Date.now(),
});
export const joinChallenge = (id) => updateDoc(ref("challenges", id), { participants: arrayUnion(S.uid) });
export async function checkinChallenge(id) {
  await updateDoc(ref("challenges", id), { [`checkins.${S.uid}.${S.today}`]: true });
  await addPoints(P.challenge);
  toast(`Kaydedildi. +${P.challenge}`);
}
export const deleteChallenge = (id) => deleteDoc(ref("challenges", id));

/* ---------- bildirim cihaz anahtarı ---------- */
export const saveToken = (token) => setDoc(ref("tokens", token), { uid: S.uid, ua: navigator.userAgent.slice(0, 120), updatedAt: Date.now() });

/* ---------- iPhone Sağlık anahtarı ---------- */
// Kestirmeler bu gizli anahtarla healthInbox/{anahtar} belgesine adım sayısını yazar; GitHub Actions profile işler
export async function getHealthKey() {
  const snap = await getDocs(query(col("healthKeys"), where("uid", "==", S.uid)));
  if (!snap.empty) return snap.docs[0].id;
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const key = Array.from(bytes, (b) => "abcdefghijkmnopqrstuvwxyz23456789"[b % 33]).join("");
  await setDoc(ref("healthKeys", key), { uid: S.uid, createdAt: Date.now() });
  return key;
}

/* ---------- grup ayarları ---------- */
export const setBet = (bet) => setDoc(ref("group", "settings"), { bet }, { merge: true });
