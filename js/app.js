import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, memoryLocalCache, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, where, onSnapshot, increment, deleteField, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $app = document.getElementById("app");
const $tabs = document.getElementById("tabs");
const $toast = document.getElementById("toast");

/* ---------- yardımcılar ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); };
const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d); };
const money = (n) => "₺" + Math.round(n).toLocaleString("tr-TR");

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($toast.hidden = true), 2600);
}

const COLORS = ["#4f6bff", "#e5484d", "#12a594", "#f76b15", "#8e4ec6", "#d6409f", "#0090ff", "#46a758"];
const REACTIONS = ["🔥", "👏", "💪", "😂"];
const ICON = {
  check: '<svg class="ico" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  repeat: '<svg class="ico sm" viewBox="0 0 24 24"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
  flame: '<svg class="ico sm" viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 1.5-3 3.5-3 6-1-1-1.5-2-1.5-3.5C7.5 9.5 5 12 5 15c0 4.3 3 7 7 7Z"/></svg>',
  close: '<svg class="ico sm" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const initial = (u) => esc((u?.name || "?").trim().charAt(0).toLocaleUpperCase("tr-TR"));
const avatar = (u) => `<div class="avatar" style="background:${esc(u?.color || COLORS[0])}">${initial(u)}</div>`;
const TASK_POINTS = 10;
const DAY_BONUS = 20;
const MILESTONES = [[1, "1 gün"], [3, "3 gün"], [7, "1 hafta"], [14, "2 hafta"], [30, "1 ay"], [90, "3 ay"], [180, "6 ay"], [365, "1 yıl"]];

/* ---------- kurulum kontrolü ---------- */
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("BURAYA")) {
  $app.innerHTML = `
    <h1>Düzen</h1>
    <div class="card">
      <b>Kurulum gerekiyor</b>
      <p class="muted">Firebase ayarları henüz girilmemiş. <code>js/firebase-config.js</code> dosyasını
      KURULUM.md'deki adımlara göre doldur.</p>
    </div>`;
  throw new Error("firebase-config.js doldurulmamış");
}

const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
// Bellek içi önbellek: çoklu sekme / gizli mod / iOS ana ekran uygulamasında IndexedDB sorunlarını önler.
// Uzun yoklama (long polling) bazı ağların ve içerik engelleyicilerin akış bağlantısını kesmesine karşı.
const db = initializeFirestore(fb, { localCache: memoryLocalCache(), experimentalForceLongPolling: true });

/* ---------- durum ---------- */
const S = {
  uid: null,
  email: null,
  today: dayKey(),
  tab: "today",
  users: {},     // uid -> profil
  tasks: [],     // bugünün tüm görevleri (herkesin)
  goals: [],     // herkesin bırakma hedefleri
  confirmRelapse: null,
  unsubs: [],
};
const me = () => S.users[S.uid];
const tasksOf = (uid) => S.tasks.filter((t) => t.uid === uid).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
const goalsOf = (uid) => S.goals.filter((g) => g.uid === uid);
function streakOf(u) {
  if (!u) return 0;
  return u.lastFullDay === S.today || u.lastFullDay === shiftDay(-1) ? u.streak || 0 : 0;
}

/* ---------- giriş ---------- */
// Kullanıcı adı → Firebase'in istediği e-posta biçimi (kullanıcı bunu hiç görmez)
const TR_MAP = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
const slug = (u) => u.trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => TR_MAP[c]).replace(/[^a-z0-9._-]/g, "");
const toEmail = (u) => `${slug(u)}@duzen.app`;
let pending = null; // kayıt sırasında girilen ad ve grup kodu

function renderLogin(err = "", mode = "login") {
  $tabs.hidden = true;
  const signup = mode === "signup";
  $app.innerHTML = `
    <div class="center" style="padding-bottom:16px"><div class="logo">${ICON.check}</div><h1>Düzen</h1>
      <div class="muted">Günlük görevler, birlikte.</div></div>
    <form class="card" id="loginForm">
      <label>Kullanıcı adı</label><input name="user" autocomplete="username" autocapitalize="none" maxlength="20" required>
      <label>Şifre</label><input name="pass" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" required>
      ${signup ? `<label>Grup kodu</label><input name="code" autocapitalize="none" required>
        <div class="tag">Kodu grubu kuran kişiden al. Sadece ilk kayıtta sorulur.</div>` : ""}
      <button class="full">${signup ? "Hesap oluştur" : "Giriş yap"}</button>
      <button type="button" class="plain full" id="switch">${signup ? "Zaten hesabım var" : "İlk kez mi? Hesap oluştur"}</button>
      ${err ? `<div class="err">${esc(err)}</div>` : ""}
    </form>`;
  const form = document.getElementById("loginForm");
  document.getElementById("switch").onclick = () => renderLogin("", signup ? "login" : "signup");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = form.user.value.trim();
    const pass = form.pass.value;
    if (!slug(user)) return renderLogin("Kullanıcı adında en az bir harf veya rakam olmalı.", mode);
    try {
      if (signup) {
        pending = { name: user, code: form.code.value.trim() };
        await createUserWithEmailAndPassword(auth, toEmail(user), pass);
      } else {
        await signInWithEmailAndPassword(auth, toEmail(user), pass);
      }
    } catch (ex) {
      pending = null;
      renderLogin(authError(ex), mode);
    }
  });
}

function renderJoin(err = "") {
  $tabs.hidden = true;
  $app.innerHTML = `
    <h1>Grup kodu</h1><p class="muted">Gruba katılmak için kodu gir.</p>
    <form class="card" id="joinForm">
      <input name="code" autocapitalize="none" required>
      <button class="full">Katıl</button>
      <button type="button" class="plain full" id="out">Çıkış yap</button>
      ${err ? `<div class="err">${esc(err)}</div>` : ""}
    </form>`;
  document.getElementById("out").onclick = () => signOut(auth);
  document.getElementById("joinForm").onsubmit = (e) => {
    e.preventDefault();
    pending = { ...(pending || {}), code: e.target.code.value.trim() };
    start();
  };
}

function authError(ex) {
  const c = ex.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Kullanıcı adı veya şifre hatalı.";
  if (c.includes("email-already-in-use")) return "Bu kullanıcı adı alınmış.";
  if (c.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (c.includes("invalid-email")) return "Geçersiz kullanıcı adı.";
  if (c.includes("too-many-requests")) return "Çok fazla deneme, biraz bekle.";
  return "Hata: " + (ex.message || c);
}

/* ---------- profil oluşturma ---------- */
function renderProfileSetup() {
  $tabs.hidden = true;
  let pick = COLORS[0];
  $app.innerHTML = `
    <h1>Hoş geldin</h1><p class="muted">Arkadaşların seni böyle görecek.</p>
    <form class="card" id="pf">
      <label>Adın</label><input name="name" maxlength="20" value="${esc(pending?.name || "")}" required>
      <label>Rengin</label>
      <div class="swatches">${COLORS.map((c, i) => `<button type="button" data-av="${c}" class="${i ? "" : "sel"}" style="background:${c}" aria-label="renk"></button>`).join("")}</div>
      <button class="full">Başla</button>
    </form>`;
  const f = document.getElementById("pf");
  f.querySelectorAll("[data-av]").forEach((b) => (b.onclick = () => {
    f.querySelectorAll("[data-av]").forEach((x) => x.classList.remove("sel"));
    b.classList.add("sel");
    pick = b.dataset.av;
  }));
  f.onsubmit = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, "users", S.uid), {
      name: f.name.value.trim(), color: pick, points: 0, weekPoints: {},
      streak: 0, bestStreak: 0, lastFullDay: "", createdAt: Date.now(),
    });
    start();
  };
}

/* ---------- veri ---------- */
async function ensureRecurringTasks() {
  const snap = await getDocs(query(collection(db, "templates"), where("uid", "==", S.uid)));
  await Promise.all(snap.docs.map(async (t) => {
    const ref = doc(db, "tasks", `${S.today}_${t.id}`);
    const ex = await getDoc(ref);
    if (!ex.exists()) {
      await setDoc(ref, { uid: S.uid, title: t.data().title, date: S.today, done: false, templateId: t.id, reactions: {}, createdAt: t.data().createdAt || Date.now() });
    }
  }));
}

function listen() {
  S.unsubs.forEach((u) => u());
  const onErr = (e) => {
    console.error(e);
    if (e.code === "permission-denied") {
      $tabs.hidden = true;
      renderJoin();
    }
  };
  S.unsubs = [
    onSnapshot(collection(db, "users"), (s) => {
      S.users = Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
      render();
    }, onErr),
    onSnapshot(query(collection(db, "tasks"), where("date", "==", S.today)), (s) => {
      S.tasks = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }, onErr),
    onSnapshot(collection(db, "goals"), (s) => {
      S.goals = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    }, onErr),
  ];
}

async function addPoints(n) {
  await updateDoc(doc(db, "users", S.uid), { points: increment(n), [`weekPoints.${weekKey()}`]: increment(n) });
}

/* ---------- eylemler ---------- */
async function addTask(title, repeat) {
  const base = { uid: S.uid, title, date: S.today, done: false, reactions: {}, createdAt: Date.now() };
  if (repeat) {
    const tpl = await addDoc(collection(db, "templates"), { uid: S.uid, title, createdAt: base.createdAt });
    await setDoc(doc(db, "tasks", `${S.today}_${tpl.id}`), { ...base, templateId: tpl.id });
  } else {
    await addDoc(collection(db, "tasks"), base);
  }
}

async function toggleTask(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t || t.uid !== S.uid) return;
  const done = !t.done;
  t.done = done; // anında hesap için yerel güncelle
  await updateDoc(doc(db, "tasks", id), { done, doneAt: done ? Date.now() : deleteField() });
  await addPoints(done ? TASK_POINTS : -TASK_POINTS);

  const mine = tasksOf(S.uid);
  const u = me();
  if (done && mine.length && mine.every((x) => x.done) && u.lastFullDay !== S.today) {
    const streak = u.lastFullDay === shiftDay(-1) ? (u.streak || 0) + 1 : 1;
    await updateDoc(doc(db, "users", S.uid), {
      points: increment(DAY_BONUS),
      [`weekPoints.${weekKey()}`]: increment(DAY_BONUS),
      streak, bestStreak: Math.max(streak, u.bestStreak || 0), lastFullDay: S.today,
    });
    toast(`Günün tamam. +${DAY_BONUS} puan, seri ${streak} gün`);
  }
}

async function deleteTask(id) {
  const t = S.tasks.find((x) => x.id === id);
  if (!t) return;
  await deleteDoc(doc(db, "tasks", id));
  if (t.templateId) await deleteDoc(doc(db, "templates", t.templateId));
  if (t.done) await addPoints(-TASK_POINTS);
}

async function react(col, id, emoji) {
  const item = (col === "tasks" ? S.tasks : S.goals).find((x) => x.id === id);
  if (!item) return;
  const cur = item.reactions?.[S.uid];
  await updateDoc(doc(db, col, id), { [`reactions.${S.uid}`]: cur === emoji ? deleteField() : emoji });
}

async function addGoal(f) {
  const now = Date.now();
  await addDoc(collection(db, "goals"), {
    uid: S.uid, title: f.title,
    startedAt: now, lastResetAt: now, bestDays: 0, relapses: 0,
    perDay: Number(f.perDay) || 0, packPrice: Number(f.packPrice) || 0,
    checkins: {}, reactions: {}, createdAt: now,
  });
}

async function checkinGoal(id) {
  const g = S.goals.find((x) => x.id === id);
  if (!g || g.checkins?.[S.today]) return;
  await updateDoc(doc(db, "goals", id), { [`checkins.${S.today}`]: true });
  await addPoints(TASK_POINTS);
  toast("Kaydedildi. +" + TASK_POINTS);
}

async function relapseGoal(id) {
  const g = S.goals.find((x) => x.id === id);
  if (!g) return;
  const days = cleanDays(g);
  await updateDoc(doc(db, "goals", id), {
    lastResetAt: Date.now(), relapses: increment(1), bestDays: Math.max(g.bestDays || 0, days),
  });
  toast("Sayaç sıfırlandı. En iyi rekorun duruyor.");
}

/* ---------- hedef hesapları ---------- */
const cleanMs = (g) => Date.now() - (g.lastResetAt || g.startedAt);
const cleanDays = (g) => Math.floor(cleanMs(g) / 86400000);
function cleanText(g) {
  const ms = cleanMs(g);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d ? `${d} gün ${h} sa` : `${h} sa ${m} dk`;
}

/* ---------- görünümler ---------- */
function reactsHtml(col, item, canReact) {
  const counts = {};
  Object.values(item.reactions || {}).forEach((e) => (counts[e] = (counts[e] || 0) + 1));
  const mineE = item.reactions?.[S.uid];
  if (canReact) {
    return `<div class="reacts">${REACTIONS.map((e) =>
      `<button class="react ${mineE === e ? "mine" : ""}" data-act="react" data-col="${col}" data-id="${item.id}" data-e="${e}">${e}${counts[e] ? " " + counts[e] : ""}</button>`).join("")}</div>`;
  }
  const list = Object.entries(counts);
  return list.length ? `<div class="reacts">${list.map(([e, n]) => `<span class="react">${e} ${n}</span>`).join("")}</div>` : "";
}

function whoReacted(item) {
  const names = Object.entries(item.reactions || {}).map(([uid, e]) => `${e} ${esc(S.users[uid]?.name || "?")}`);
  return names.length ? `<div class="tag">${names.join(" · ")}</div>` : "";
}

function goalCard(g, own) {
  const days = cleanDays(g);
  const saved = g.perDay && g.packPrice ? (cleanMs(g) / 86400000) * (g.perDay / 20) * g.packPrice : 0;
  const notSmoked = g.perDay ? Math.floor((cleanMs(g) / 86400000) * g.perDay) : 0;
  const checked = !!g.checkins?.[S.today];
  const confirming = S.confirmRelapse === g.id;
  return `
    <div class="card goal">
      <div class="row spread">
        <div><div class="tag">${own ? "" : esc(S.users[g.uid]?.name || "") + " · "}${esc(g.title)}</div><div class="counter">${cleanText(g)}</div></div>
        ${own ? `<button class="plain small" data-act="delGoal" data-id="${g.id}" title="Hedefi sil">${ICON.close}</button>` : ""}
      </div>
      ${saved || notSmoked ? `<div class="stats">
        ${saved ? `<div class="stat"><b>${money(saved)}</b><span>biriken para</span></div>` : ""}
        ${notSmoked ? `<div class="stat"><b>${notSmoked}</b><span>içilmeyen</span></div>` : ""}
        <div class="stat"><b>${Math.max(g.bestDays || 0, days)}</b><span>en iyi (gün)</span></div>
      </div>` : ""}
      <div class="badges">${MILESTONES.map(([n, l]) => `<span class="badge ${days >= n ? "on" : "off"}">${l}</span>`).join("")}</div>
      ${own ? `
        <div class="row" style="margin-top:12px">
          <button class="grow ${checked ? "ghost" : ""}" data-act="checkin" data-id="${g.id}" ${checked ? "disabled" : ""}>${checked ? "Bugün işaretlendi" : "Bugün de temizim"}</button>
          <button class="danger" data-act="relapse" data-id="${g.id}">${confirming ? "Emin misin?" : "Kaydım"}</button>
        </div>${whoReacted(g)}` : reactsHtml("goals", g, true)}
    </div>`;
}

function viewToday() {
  const u = me();
  const mine = tasksOf(S.uid);
  const doneN = mine.filter((t) => t.done).length;
  const pct = mine.length ? Math.round((doneN / mine.length) * 100) : 0;
  const date = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  return `
    <div class="row spread">
      <div><div class="muted small">${date}</div><h1>Selam ${esc(u.name)}</h1></div>
      <button class="plain small" data-act="logout">Çıkış</button>
    </div>
    <div class="stats">
      <div class="stat"><b>${doneN}/${mine.length}</b><span>bugün</span></div>
      <div class="stat"><b>${streakOf(u)}</b><span>gün seri</span></div>
      <div class="stat"><b>${u.weekPoints?.[weekKey()] || 0}</b><span>bu hafta</span></div>
    </div>
    <div class="progress"><div style="width:${pct}%"></div></div>

    <h2>Görevlerim</h2>
    <div class="card">
      ${mine.length ? mine.map((t) => `
        <div class="task ${t.done ? "done" : ""}">
          <button class="tick ${t.done ? "on" : ""}" data-act="toggle" data-id="${t.id}" aria-label="tamamla">${t.done ? ICON.check : ""}</button>
          <div class="grow"><div class="title">${esc(t.title)}</div>
            ${t.templateId ? `<span class="tag">${ICON.repeat} her gün</span>` : ""}${whoReacted(t)}</div>
          <button class="plain small" data-act="delTask" data-id="${t.id}" title="${t.templateId ? "Sil (tekrarı da durdurur)" : "Sil"}">${ICON.close}</button>
        </div>`).join("") : `<div class="muted">Bugün için görev yok.</div>`}
    </div>
    <form class="card" id="addTask">
      <div class="row"><input name="title" placeholder="Yeni görev… (örn. 30 dk kitap)" maxlength="80" required>
        <button>Ekle</button></div>
      <label class="check"><input type="checkbox" name="repeat" checked> Her gün tekrarla</label>
    </form>

    <h2>Bırakma hedeflerim</h2>
    ${goalsOf(S.uid).map((g) => goalCard(g, true)).join("")}
    <details class="card">
      <summary>+ Yeni bırakma hedefi</summary>
      <form id="addGoal">
        <label>Neyi bırakıyorsun?</label><input name="title" value="Sigara" maxlength="40" required>
        <label>Günde kaç tane içiyordun? (isteğe bağlı)</label><input name="perDay" type="number" min="0" inputmode="numeric" placeholder="20">
        <label>Paket fiyatı ₺ (isteğe bağlı)</label><input name="packPrice" type="number" min="0" inputmode="decimal" placeholder="100">
        <button class="full">Sayacı başlat</button>
      </form>
    </details>`;
}

function viewFriends() {
  const ids = Object.keys(S.users).sort((a, b) => (a === S.uid ? -1 : b === S.uid ? 1 : 0));
  return `<h1>Ekip</h1><p class="muted">Bugün kim ne yaptı</p>` + ids.map((uid) => {
    const u = S.users[uid];
    const ts = tasksOf(uid);
    const doneN = ts.filter((t) => t.done).length;
    const pct = ts.length ? Math.round((doneN / ts.length) * 100) : 0;
    const own = uid === S.uid;
    return `
      <div class="card">
        <div class="row">
          ${avatar(u)}
          <div class="grow"><b>${esc(u.name)}${own ? " (sen)" : ""}</b>
            <div class="tag">${ICON.flame} ${streakOf(u)} gün seri · ${u.weekPoints?.[weekKey()] || 0} puan bu hafta</div></div>
          <b>${pct}%</b>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        ${ts.map((t) => `
          <div class="task ${t.done ? "done" : ""}">
            <span class="tick ${t.done ? "on" : ""}" style="display:grid;place-items:center">${t.done ? ICON.check : ""}</span>
            <div class="grow"><div class="title">${esc(t.title)}</div>${t.done ? reactsHtml("tasks", t, !own) : ""}</div>
          </div>`).join("") || `<div class="muted small">Bugün henüz görev eklememiş.</div>`}
      </div>
      ${goalsOf(uid).map((g) => goalCard(g, own)).join("")}`;
  }).join("");
}

function viewRank() {
  const wk = weekKey();
  const list = Object.entries(S.users)
    .map(([uid, u]) => ({ uid, ...u, wp: u.weekPoints?.[wk] || 0 }))
    .sort((a, b) => b.wp - a.wp);
  return `<h1>Sıralama</h1><p class="muted">Bu hafta, pazartesiden beri. Görev ${TASK_POINTS} puan, günü bitirmek +${DAY_BONUS}.</p>
    ${list.map((u, i) => `
      <div class="card rank">
        <div class="pos">${i + 1}</div>
        ${avatar(u)}
        <div class="grow"><b>${esc(u.name)}</b><div class="tag">Toplam ${u.points || 0} · en iyi seri ${u.bestStreak || 0} gün</div></div>
        <b>${u.wp}</b>
      </div>`).join("")}`;
}

function render() {
  if (!S.uid || !me()) return;
  // Form yazılırken yeniden çizip girdiyi silme
  const a = document.activeElement;
  if (a && (a.tagName === "INPUT") && $app.contains(a) && a.value) return;
  const openDetails = $app.querySelector("details")?.open;
  $tabs.hidden = false;
  $tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === S.tab));
  $app.innerHTML = S.tab === "friends" ? viewFriends() : S.tab === "rank" ? viewRank() : viewToday();
  const det = $app.querySelector("details");
  if (det && openDetails) det.open = true;
}

/* ---------- olaylar ---------- */
$tabs.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  S.tab = b.dataset.tab;
  S.confirmRelapse = null;
  window.scrollTo(0, 0);
  render();
});

$app.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const { act, id } = b.dataset;
  try {
    if (act === "toggle") await toggleTask(id);
    else if (act === "delTask") await deleteTask(id);
    else if (act === "react") await react(b.dataset.col, id, b.dataset.e);
    else if (act === "checkin") await checkinGoal(id);
    else if (act === "relapse") {
      if (S.confirmRelapse === id) { S.confirmRelapse = null; await relapseGoal(id); }
      else { S.confirmRelapse = id; render(); setTimeout(() => { if (S.confirmRelapse === id) { S.confirmRelapse = null; render(); } }, 4000); }
    } else if (act === "delGoal") {
      if (b.dataset.sure) await deleteDoc(doc(db, "goals", id));
      else { b.dataset.sure = "1"; b.textContent = "Sil?"; }
    } else if (act === "logout") await signOut(auth);
  } catch (ex) {
    console.error(ex);
    toast("Bir hata oldu: " + (ex.code || ex.message));
  }
});

$app.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    if (f.id === "addTask") {
      const title = f.title.value.trim();
      if (!title) return;
      const repeat = f.repeat.checked;
      f.reset(); f.repeat.checked = repeat;
      document.activeElement?.blur();
      await addTask(title, repeat);
    } else if (f.id === "addGoal") {
      const data = Object.fromEntries(new FormData(f));
      f.reset();
      document.activeElement?.blur();
      await addGoal(data);
      toast("Sayaç başladı");
    }
  } catch (ex) {
    console.error(ex);
    toast("Bir hata oldu: " + (ex.code || ex.message));
  }
});

// Gün değişince yenile; sayaçlar için dakikada bir yeniden çiz
setInterval(() => {
  if (dayKey() !== S.today) location.reload();
  else if (S.uid) render();
}, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && dayKey() !== S.today) location.reload();
});

/* ---------- başlat ---------- */
async function start() {
  // 1) Grup üyeliği: yoksa grup koduyla katıl
  try {
    const m = await getDoc(doc(db, "members", S.uid));
    if (!m.exists()) {
      if (!pending?.code) return renderJoin();
      try {
        await setDoc(doc(db, "members", S.uid), { code: pending.code, joinedAt: Date.now() });
      } catch (ex) {
        console.error(ex);
        return renderJoin(ex.code === "permission-denied" ? "Grup kodu yanlış." : `Bağlantı hatası (${ex.code || ex.message}). Tekrar dene.`);
      }
    }
  } catch (ex) {
    console.error(ex);
    return renderJoin(`Bağlantı hatası (${ex.code || ex.message}). Tekrar dene.`);
  }
  // 2) Profil
  try {
    const p = await getDoc(doc(db, "users", S.uid));
    if (!p.exists()) return renderProfileSetup();
    await ensureRecurringTasks();
  } catch (ex) {
    console.error(ex);
  }
  listen();
}

onAuthStateChanged(auth, (user) => {
  S.unsubs.forEach((u) => u());
  S.unsubs = [];
  if (!user) { S.uid = null; return renderLogin(); }
  S.uid = user.uid;
  S.email = user.email;
  $app.innerHTML = `<div class="center muted">Yükleniyor…</div>`;
  start();
});
