import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { S, esc, ICON, COLORS, dayKey, weekKey, toast, commentsOf, firstName } from "./lib.js";
import * as D from "./data.js";
import * as V from "./views.js";

const $app = document.getElementById("app");
const $tabs = document.getElementById("tabs");
const $sheet = document.getElementById("sheet");
const $sheetBody = document.getElementById("sheetBody");

if (!D.configured) {
  $app.innerHTML = `<header class="top"><h1>Düzen</h1></header><div class="card empty"><p>Firebase ayarları girilmemiş: <code>js/firebase-config.js</code></p></div>`;
  throw new Error("firebase-config.js doldurulmamış");
}

S.today = dayKey();
S.week = weekKey();
S.apiKey = D.API_KEY;
S.projectId = D.PROJECT_ID;
try { S.pushDismissed = localStorage.getItem("pushDismissed") === S.today; } catch {}

// Bildirim modülü ayrı yüklenir; desteklenmeyen tarayıcıda uygulamanın geri kalanını bozmasın
let pushMod = null;
async function loadPush() {
  try { pushMod ||= await import("./push.js"); S.pushState = await pushMod.pushState(); }
  catch (e) { console.warn(e); S.pushState = "unsupported"; }
  return pushMod;
}

/* ================= GİRİŞ ================= */
const TR_MAP = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
const slug = (u) => u.trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => TR_MAP[c]).replace(/[^a-z0-9._-]/g, "");
const toEmail = (u) => `${slug(u)}@duzen.app`;
let pending = null;

function authError(ex) {
  const c = ex.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Kullanıcı adı veya şifre hatalı.";
  if (c.includes("email-already-in-use")) return "Bu kullanıcı adı alınmış.";
  if (c.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (c.includes("invalid-email")) return "Geçersiz kullanıcı adı.";
  if (c.includes("too-many-requests")) return "Çok fazla deneme, biraz bekle.";
  return `Hata (${c || ex.message})`;
}

function bare(html) { $tabs.hidden = true; closeSheet(); $app.innerHTML = `<div class="auth">${html}</div>`; }

function renderLogin(err = "", mode = "login") {
  const signup = mode === "signup";
  bare(`
    <div class="brand"><div class="logo">${ICON.check}</div><h1>Düzen</h1><p class="muted">Günlük görevler, birlikte.</p></div>
    <form class="card form" id="fLogin">
      <label>Kullanıcı adı</label><input name="user" autocomplete="username" autocapitalize="none" maxlength="20" required>
      <label>Şifre</label><input name="pass" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" required>
      ${signup ? `<label>Grup kodu</label><input name="code" autocapitalize="none" autocomplete="off" required>
        <p class="muted small">Kodu grubu kuran kişiden al. Sadece ilk kayıtta sorulur.</p>` : ""}
      <button class="btn full">${signup ? "Hesap oluştur" : "Giriş yap"}</button>
      ${err ? `<p class="err">${esc(err)}</p>` : ""}
    </form>
    <button class="link center" id="switch">${signup ? "Zaten hesabım var" : "İlk kez mi? Hesap oluştur"}</button>`);
  document.getElementById("switch").onclick = () => renderLogin("", signup ? "login" : "signup");
  const f = document.getElementById("fLogin");
  f.onsubmit = async (e) => {
    e.preventDefault();
    const user = f.user.value.trim();
    if (!slug(user)) return renderLogin("Kullanıcı adında en az bir harf veya rakam olmalı.", mode);
    f.querySelector("button").disabled = true;
    try {
      if (signup) { pending = { name: user, code: f.code.value.trim() }; await createUserWithEmailAndPassword(D.auth, toEmail(user), f.pass.value); }
      else await signInWithEmailAndPassword(D.auth, toEmail(user), f.pass.value);
    } catch (ex) { pending = null; renderLogin(authError(ex), mode); }
  };
}

function renderJoin(err = "") {
  bare(`<div class="brand"><h1>Grup kodu</h1><p class="muted">Gruba katılmak için kodu gir.</p></div>
    <form class="card form" id="fJoin"><input name="code" autocapitalize="none" autocomplete="off" required>
      <button class="btn full">Katıl</button>${err ? `<p class="err">${esc(err)}</p>` : ""}</form>
    <button class="link center" id="out">Çıkış yap</button>`);
  document.getElementById("out").onclick = () => signOut(D.auth);
  document.getElementById("fJoin").onsubmit = (e) => { e.preventDefault(); pending = { ...(pending || {}), code: e.target.code.value.trim() }; start(); };
}

function renderProfileSetup() {
  let color = COLORS[0];
  bare(`<div class="brand"><h1>Hoş geldin</h1><p class="muted">Arkadaşların seni böyle görecek.</p></div>
    <form class="card form" id="fProfile">
      <label>Adın</label><input name="name" maxlength="20" value="${esc(pending?.name || "")}" required>
      <label>Rengin</label>
      <div class="swatches">${COLORS.map((c, i) => `<button type="button" data-color="${c}" class="${i ? "" : "on"}" style="background:${c}" aria-label="renk"></button>`).join("")}</div>
      <button class="btn full">Başla</button></form>`);
  const f = document.getElementById("fProfile");
  f.querySelectorAll("[data-color]").forEach((b) => (b.onclick = () => { f.querySelectorAll("[data-color]").forEach((x) => x.classList.remove("on")); b.classList.add("on"); color = b.dataset.color; }));
  f.onsubmit = async (e) => { e.preventDefault(); await D.createProfile(f.name.value.trim(), color); start(); };
}

async function start() {
  try {
    if (!(await D.isMember())) {
      if (!pending?.code) return renderJoin();
      try { await D.joinGroup(pending.code); }
      catch (ex) { return renderJoin(ex.code === "permission-denied" ? "Grup kodu yanlış." : `Bağlantı hatası (${ex.code || ex.message}). Tekrar dene.`); }
    }
    if (!(await D.hasProfile())) return renderProfileSetup();
    await D.ensureRecurring();
  } catch (ex) {
    console.error(ex);
    return renderJoin(`Bağlantı hatası (${ex.code || ex.message}). Tekrar dene.`);
  }
  D.listen(onData, (e) => { console.error(e); if (e.code === "permission-denied") renderJoin(); });
  loadPush().then((m) => { onData(); m?.refreshPush(); });
}

onAuthStateChanged(D.auth, (user) => {
  D.stopListening();
  if (!user) { S.uid = null; return renderLogin(); }
  S.uid = user.uid;
  $app.innerHTML = `<div class="loading">Yükleniyor…</div>`;
  start();
});

/* ================= ÇİZİM ================= */
let raf = 0;
function onData() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { render(); refreshSheet(); });
}

function render() {
  if (!S.uid || !S.users[S.uid]) return;
  $tabs.hidden = false;
  $tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.tab === S.tab));
  const y = window.scrollY;
  $app.innerHTML = S.tab === "goals" ? V.viewGoals() : S.tab === "team" ? V.viewTeam() : S.tab === "week" ? V.viewWeek() : V.viewToday();
  window.scrollTo(0, y);
}

/* ================= ALT PENCERE ================= */
let crisisTimer = null;
const SHEETS = { addTask: V.sheetAddTask, addGoal: V.sheetAddGoal, addChallenge: V.sheetAddChallenge, bet: V.sheetBet, settings: V.sheetSettings, task: V.sheetTask, goal: V.sheetGoal, crisis: V.sheetCrisis, health: V.sheetHealth };

function openSheet(type, id) {
  S.sheet = { type, id };
  $sheetBody.innerHTML = SHEETS[type](id);
  $sheet.hidden = false;
  document.body.classList.add("locked");
  requestAnimationFrame(() => $sheet.classList.add("show"));
  if (type === "task") loadTaskPhoto(id);
  if (type === "crisis") startBreathing();
  const first = $sheetBody.querySelector("input[name=title], input[name=bet]");
  if (first) setTimeout(() => first.focus(), 250);
}
function closeSheet() {
  if (!S.sheet) return;
  S.sheet = null;
  clearInterval(crisisTimer);
  $sheet.classList.remove("show");
  document.body.classList.remove("locked");
  setTimeout(() => { if (!S.sheet) { $sheet.hidden = true; $sheetBody.innerHTML = ""; } }, 200);
}
// Canlı veri gelince açık pencereyi güncelle (yazılan yorumu silmeden)
function refreshSheet() {
  if (!S.sheet) return;
  const { type, id } = S.sheet;
  if (type === "task") {
    const input = $sheetBody.querySelector("#fComment input");
    const typed = input?.value || "";
    const photo = $sheetBody.querySelector("#photoBox")?.innerHTML;
    const focused = document.activeElement === input;
    $sheetBody.innerHTML = V.sheetTask(id);
    const box = $sheetBody.querySelector("#photoBox");
    if (box && photo && photo.includes("<img")) box.innerHTML = photo;
    const ni = $sheetBody.querySelector("#fComment input");
    if (ni) { ni.value = typed; if (focused) ni.focus(); }
  } else if (type === "goal") {
    if (!$sheetBody.contains(document.activeElement) || document.activeElement === document.body) $sheetBody.innerHTML = V.sheetGoal(id);
  }
}
$sheet.addEventListener("click", (e) => { if (e.target === $sheet) closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

async function loadTaskPhoto(id) {
  const box = $sheetBody.querySelector("#photoBox");
  const t = [...S.daily, ...S.weekly].find((x) => x.id === id);
  if (!box || !t?.hasPhoto) return;
  try {
    const src = await D.loadPhoto(id);
    if (S.sheet?.id === id && src) $sheetBody.querySelector("#photoBox").innerHTML = `<img src="${src}" alt="Kanıt fotoğrafı">`;
  } catch { box.innerHTML = ""; }
}

function startBreathing() {
  let left = 180, phase = 0;
  const text = () => $sheetBody.querySelector("#breathText");
  const timer = () => $sheetBody.querySelector("#breathTimer");
  clearInterval(crisisTimer);
  crisisTimer = setInterval(() => {
    left--; phase = (phase + 1) % 10; // 4 sn al, 6 sn ver
    if (text()) text().textContent = phase < 4 ? "Nefes al" : "Yavaşça ver";
    if (timer()) timer().textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Süre doldu";
    if (left <= 0) clearInterval(crisisTimer);
  }, 1000);
}

/* ================= FOTOĞRAF ================= */
function compressImage(file, max = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
document.addEventListener("change", async (e) => {
  const input = e.target.closest("input[data-photo]");
  if (!input?.files?.[0]) return;
  const id = input.dataset.photo;
  try {
    toast("Fotoğraf yükleniyor…");
    let data = await compressImage(input.files[0]);
    if (data.length > 700000) data = await compressImage(input.files[0], 700, 0.55);
    await D.savePhoto(id, data);
    const box = $sheetBody.querySelector("#photoBox");
    if (box) box.innerHTML = `<img src="${data}" alt="Kanıt fotoğrafı">`;
    toast("Fotoğraf eklendi");
  } catch (ex) { console.error(ex); toast("Fotoğraf eklenemedi"); }
});

/* ================= OLAYLAR ================= */
$tabs.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  S.tab = b.dataset.tab;
  window.scrollTo(0, 0);
  render();
});

const confirmOnce = new Set(); // iki dokunuşla onay
function needsConfirm(b, key, label) {
  if (confirmOnce.has(key)) { confirmOnce.delete(key); return false; }
  confirmOnce.add(key);
  const old = b.textContent;
  b.textContent = label;
  setTimeout(() => { if (confirmOnce.delete(key) && b.isConnected) b.textContent = old; }, 3500);
  return true;
}

document.addEventListener("click", async (e) => {
  // segment ve çip seçimleri (form içi, çizim gerektirmez)
  const seg = e.target.closest(".seg button");
  if (seg) {
    const wrap = seg.parentElement;
    wrap.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === seg));
    const form = seg.closest("form");
    form.querySelectorAll(".opt").forEach((o) => o.classList.toggle("show", o.dataset.show === seg.dataset.v));
    return;
  }
  const chip = e.target.closest(".chips:not(.static) .chip");
  if (chip) {
    const wrap = chip.parentElement;
    if (wrap.classList.contains("single")) wrap.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === chip));
    else chip.classList.toggle("on");
    return;
  }
  const sw = e.target.closest(".swatches button");
  if (sw && $sheet.contains(sw)) { sw.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === sw)); return; }

  const b = e.target.closest("[data-act]");
  if (!b) return;
  const { act, id } = b.dataset;
  try {
    switch (act) {
      case "openAddTask": return openSheet("addTask");
      case "openAddGoal": return openSheet("addGoal");
      case "openAddChallenge": return openSheet("addChallenge");
      case "openBet": return openSheet("bet");
      case "openSettings": return openSheet("settings");
      case "openTask": return openSheet("task", id);
      case "openGoal": return openSheet("goal", id);
      case "closeSheet": return closeSheet();
      case "openCrisis": {
        openSheet("crisis", id);
        const g = S.goals.find((x) => x.id === id);
        D.crisisAlert(g?.title || "Kriz anı").catch(console.error);
        return;
      }
      case "crisisDone": closeSheet(); if (id) await D.crisisSurvived(id); toast("Tebrikler, bir krizi daha atlattın"); return;
      case "toggle": return D.toggleTask(id);
      case "react": return D.react(b.dataset.col, id, b.dataset.e);
      case "expand": S.expanded = S.expanded === id ? null : id; return render();
      case "nudge": b.disabled = true; await D.nudge(id); return toast(`${firstName(id)} dürtüldü`);
      case "cheer": b.disabled = true; await D.nudge(id, "cheer", "Devam, yapıyorsun!"); return toast("Destek mesajı gönderildi");
      case "seenNudges": return D.markNudgesSeen();
      case "checkin": return D.checkinGoal(id);
      case "joinChallenge": return D.joinChallenge(id);
      case "checkinChallenge": return D.checkinChallenge(id);
      case "deleteChallenge": if (needsConfirm(b, act + id, "Sil?")) return; return D.deleteChallenge(id);
      case "deleteComment": return D.deleteComment(id);
      case "deleteTask": if (needsConfirm(b, act + id, "Emin misin? Tekrar dokun")) return; closeSheet(); return D.deleteTask(id, false);
      case "stopTask": if (needsConfirm(b, act + id, "Emin misin? Tekrar dokun")) return; closeSheet(); return D.deleteTask(id, true);
      case "relapse": if (needsConfirm(b, act + id, "Emin misin? Tekrar dokun")) return; closeSheet(); return D.relapseGoal(id);
      case "deleteGoal": if (needsConfirm(b, act + id, "Kalıcı olarak silinsin mi? Tekrar dokun")) return; closeSheet(); return D.deleteGoal(id);
      case "logout": closeSheet(); return signOut(D.auth);
      case "enablePush": {
        const m = await loadPush();
        if (!m || S.pushState === "unsupported") return toast("Bu tarayıcı bildirimleri desteklemiyor");
        b.disabled = true;
        const res = await m.enablePush();
        S.pushState = res;
        toast(res === "granted" ? "Bildirimler açık" : "İzin verilmedi");
        render();
        if (S.sheet?.type === "settings") $sheetBody.innerHTML = V.sheetSettings();
        return;
      }
      case "dismissPush":
        S.pushDismissed = true;
        try { localStorage.setItem("pushDismissed", S.today); } catch {}
        return render();
      case "openHealth":
        openSheet("health");
        if (!S.healthKey) { S.healthKey = await D.getHealthKey(); if (S.sheet?.type === "health") $sheetBody.innerHTML = V.sheetHealth(); }
        return;
      case "copy": {
        const text = document.getElementById(b.dataset.target)?.textContent || "";
        try { await navigator.clipboard.writeText(text); toast("Kopyalandı"); }
        catch { toast("Kopyalanamadı, uzun basıp kopyala"); }
        return;
      }
    }
  } catch (ex) {
    console.error(ex);
    toast(`Bir hata oldu (${ex.code || ex.message})`);
  }
});

document.addEventListener("submit", async (e) => {
  const f = e.target;
  e.preventDefault();
  try {
    if (f.id === "fAddTask") {
      const title = f.title.value.trim();
      const v = f.querySelector(".seg .on")?.dataset.v || "daily";
      if (!title) return;
      const days = [...f.querySelectorAll("[data-day].on")].map((c) => Number(c.dataset.day));
      if (v === "days" && !days.length) return toast("En az bir gün seç");
      const target = Number(f.querySelector("[data-target].on")?.dataset.target || 3);
      closeSheet();
      await D.addTask({ title, kind: v === "days" ? "daily" : v, days: v === "days" ? days : [], target });
    } else if (f.id === "fAddGoal") {
      const kind = f.querySelector(".seg .on")?.dataset.v || "smoking";
      const title = kind === "smoking" ? "Sigara" : f.title.value.trim();
      if (!title) return toast("Neyi bıraktığını yaz");
      closeSheet();
      await D.addGoal({ title, kind, perDay: kind === "smoking" ? f.perDay.value : 0, packPrice: kind === "smoking" ? f.packPrice.value : 0 });
      toast("Sayaç başladı");
    } else if (f.id === "fAddChallenge") {
      const title = f.title.value.trim();
      if (!title) return;
      const days = Number(f.querySelector("[data-len].on")?.dataset.len || 7);
      closeSheet();
      await D.addChallenge({ title, days });
    } else if (f.id === "fBet") {
      closeSheet();
      await D.setBet(f.bet.value.trim());
    } else if (f.id === "fSettings") {
      const color = f.querySelector("[data-color].on")?.dataset.color || S.users[S.uid].color;
      closeSheet();
      await D.updateProfile({ name: f.name.value.trim(), color });
    } else if (f.id === "fSave") {
      await D.setSaveFor(f.dataset.goal, f.name.value.trim(), f.amount.value);
      toast("Kaydedildi");
    } else if (f.id === "fComment") {
      const text = f.text.value.trim();
      if (!text) return;
      f.text.value = "";
      await D.addComment(f.dataset.task, text);
    }
  } catch (ex) {
    console.error(ex);
    toast(`Bir hata oldu (${ex.code || ex.message})`);
  }
});

// Gün/hafta değişince yenile; sayaçlar için dakikada bir çiz
setInterval(() => {
  if (dayKey() !== S.today) location.reload();
  else if (S.uid && !S.sheet) render();
}, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && dayKey() !== S.today) location.reload(); });
