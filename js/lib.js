// Ortak durum, sabitler ve küçük yardımcılar

export const S = {
  uid: null,
  today: "",
  week: "",
  tab: "today",
  users: {},       // uid -> profil
  daily: [],       // bugünün günlük görevleri (herkesin)
  weekly: [],      // bu haftanın haftalık görevleri (herkesin)
  goals: [],       // bırakma hedefleri (herkesin)
  challenges: [],  // ortak meydan okumalar
  comments: [],    // bu haftanın yorumları
  nudges: [],      // bana gelen okunmamış dürtmeler
  group: {},       // grup ayarları (iddia vb.)
  expanded: null,  // Ekip sekmesinde açık olan kişi
  sheet: null,     // açık alt pencere {type, id}
};

/* ---------- metin ve tarih ---------- */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const shiftDay = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return dayKey(d); };
export const weekKey = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };
export const prevWeekKey = () => shiftDay(-7, new Date(S.week + "T12:00:00"));
export const weekdayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // 0 = Pazartesi
export const DAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const money = (n) => "₺" + Math.round(n).toLocaleString("tr-TR");
export const timeOf = (ms) => new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
export const firstName = (uid) => S.users[uid]?.name || "Biri";

/* ---------- puanlar ---------- */
export const P = { task: 10, dayBonus: 20, checkin: 10, crisis: 5, challenge: 10 };

/* ---------- görünüm ---------- */
export const COLORS = ["#4f6bff", "#e5484d", "#12a594", "#f76b15", "#8e4ec6", "#d6409f", "#0090ff", "#46a758"];
export const REACTIONS = ["🔥", "👏", "💪", "😂"];

const svg = (d, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevron: svg('<path d="m9 6 6 6-6 6"/>', "ico sm"),
  repeat: svg('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>', "ico xs"),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', "ico xs"),
  flame: svg('<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 1.5-3 3.5-3 6-1-1-1.5-2-1.5-3.5C7.5 9.5 5 12 5 15c0 4.3 3 7 7 7Z"/>', "ico xs"),
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/>', "ico xs"),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', "ico xs"),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', "ico sm"),
  wind: svg('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>', "ico sm"),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15.3H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9.3 5V5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', "ico"),
};

const initial = (u) => esc((u?.name || "?").trim().charAt(0).toLocaleUpperCase("tr-TR"));
export const avatar = (uid, size = "") => {
  const u = S.users[uid];
  return `<span class="avatar ${size}" style="background:${esc(u?.color || COLORS[0])}">${initial(u)}</span>`;
};

/* ---------- sigara: kilometre taşları ve vücuttaki değişim ---------- */
export const MILESTONES = [[1, "1 gün"], [3, "3 gün"], [7, "1 hafta"], [14, "2 hafta"], [30, "1 ay"], [90, "3 ay"], [180, "6 ay"], [365, "1 yıl"]];

// Dünya Sağlık Örgütü'nün sigarayı bırakmanın faydaları listesine dayanır (dakika cinsinden)
export const SMOKE_TIMELINE = [
  [20, "20 dakika", "Kalp atışı ve tansiyon düşmeye başlar."],
  [12 * 60, "12 saat", "Kandaki karbonmonoksit normal seviyeye iner."],
  [14 * 1440, "2 hafta", "Kan dolaşımı düzelir, akciğer fonksiyonu artmaya başlar."],
  [30 * 1440, "1 ay", "Öksürük ve nefes darlığı azalmaya başlar."],
  [270 * 1440, "9 ay", "Akciğerlerin kendini temizleme kapasitesi belirgin şekilde artar."],
  [365 * 1440, "1 yıl", "Koroner kalp hastalığı riski içen birine göre yarıya iner."],
  [5 * 365 * 1440, "5 yıl", "İnme riski hiç içmemiş birininkine yaklaşır."],
  [10 * 365 * 1440, "10 yıl", "Akciğer kanseri riski içen birine göre yaklaşık yarıya iner."],
];

/* ---------- bildirim balonu ---------- */
let toastTimer;
export function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ---------- türetilmiş veriler ---------- */
export const dailyOf = (uid) => S.daily.filter((t) => t.uid === uid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const weeklyOf = (uid) => S.weekly.filter((t) => t.uid === uid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const goalsOf = (uid) => S.goals.filter((g) => g.uid === uid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const commentsOf = (taskId) => S.comments.filter((c) => c.taskId === taskId).sort((a, b) => a.createdAt - b.createdAt);
export const findTask = (id) => S.daily.find((t) => t.id === id) || S.weekly.find((t) => t.id === id);
export const weeklyDone = (t) => (t.doneDays || []).length >= (t.target || 1);
export const isSmoking = (g) => g.kind ? g.kind === "smoking" : (g.perDay > 0 || /sigara/i.test(g.title || ""));

export function streakOf(uid) {
  const u = S.users[uid];
  if (!u) return 0;
  return u.lastFullDay === S.today || u.lastFullDay === shiftDay(-1) ? u.streak || 0 : 0;
}
export function todayProgress(uid) {
  const d = dailyOf(uid);
  const w = weeklyOf(uid);
  const total = d.length + w.length;
  const done = d.filter((t) => t.done).length + w.filter((t) => (t.doneDays || []).includes(S.today) || weeklyDone(t)).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
export const weekPoints = (uid, wk = S.week) => S.users[uid]?.weekPoints?.[wk] || 0;

export const cleanMs = (g) => Date.now() - (g.lastResetAt || g.startedAt);
export const cleanDays = (g) => Math.floor(cleanMs(g) / 86400000);
export function cleanText(g) {
  const ms = cleanMs(g);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d ? `${d} gün ${h} sa` : `${h} sa ${m} dk`;
}
export const savedMoney = (g) => (g.perDay && g.packPrice ? (cleanMs(g) / 86400000) * (g.perDay / 20) * g.packPrice : 0);
export const notSmoked = (g) => (g.perDay ? Math.floor((cleanMs(g) / 86400000) * g.perDay) : 0);

export function challengeDay(c) {
  const start = new Date(c.startDate + "T00:00:00");
  const now = new Date(S.today + "T00:00:00");
  return Math.floor((now - start) / 86400000) + 1; // 1'den başlar
}
