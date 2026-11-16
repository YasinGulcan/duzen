// Ekranlar: her fonksiyon HTML döndürür, olaylar app.js'te data-act ile yakalanır
import {
  S, esc, ICON, avatar, firstName, REACTIONS, COLORS, DAY_SHORT, MILESTONES, SMOKE_TIMELINE, P,
  dailyOf, weeklyOf, goalsOf, commentsOf, findTask, weeklyDone, isSmoking, streakOf, todayProgress, weekPoints,
  prevWeekKey, cleanText, cleanDays, cleanMs, savedMoney, notSmoked, money, timeOf, challengeDay, shiftDay,
  stepsOf, fmtNum,
} from "./lib.js";

/* ---------- küçük parçalar ---------- */
const section = (title, action = "") => `<div class="section"><h2>${title}</h2>${action}</div>`;
const addBtn = (act, label = "Ekle") => `<button class="link" data-act="${act}">${ICON.plus}${label}</button>`;
const empty = (text, act, label) => `<div class="card empty"><p>${text}</p>${act ? `<button class="btn" data-act="${act}">${label}</button>` : ""}</div>`;

function reactionSummary(item) {
  const counts = {};
  Object.values(item.reactions || {}).forEach((e) => (counts[e] = (counts[e] || 0) + 1));
  return Object.entries(counts).map(([e, n]) => `<span class="pill">${e}${n > 1 ? " " + n : ""}</span>`).join("");
}
function reactionButtons(col, item) {
  const mine = item.reactions?.[S.uid];
  return `<div class="reactions">${REACTIONS.map((e) =>
    `<button class="react ${mine === e ? "on" : ""}" data-act="react" data-col="${col}" data-id="${item.id}" data-e="${e}">${e}</button>`).join("")}</div>`;
}
function ring(pct, label, sub) {
  const r = 34, c = 2 * Math.PI * r;
  return `<div class="ring">
    <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${r}" class="ring-bg"/>
      <circle cx="40" cy="40" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg>
    <div class="ring-text"><b>${label}</b><span>${sub}</span></div></div>`;
}
function taskMeta(t) {
  const bits = [];
  if (t.kind === "weekly") bits.push(`${ICON.calendar} ${(t.doneDays || []).length}/${t.target} bu hafta`);
  else if (t.templateId) bits.push(`${ICON.repeat} ${t.days?.length && t.days.length < 7 ? t.days.map((d) => DAY_SHORT[d]).join(" ") : "her gün"}`);
  const n = commentsOf(t.id).length;
  if (n) bits.push(`${ICON.chat} ${n}`);
  if (t.hasPhoto) bits.push(ICON.camera);
  return bits.join('<span class="dot">·</span>');
}
function taskChecked(t) { return t.kind === "weekly" ? (t.doneDays || []).includes(S.today) : !!t.done; }
function taskFinished(t) { return t.kind === "weekly" ? weeklyDone(t) : !!t.done; }

function taskRow(t, own) {
  const checked = taskChecked(t);
  const meta = taskMeta(t);
  return `<div class="item ${taskFinished(t) ? "finished" : ""}">
    ${own
      ? `<button class="check ${checked ? "on" : ""}" data-act="toggle" data-id="${t.id}" aria-label="tamamla">${ICON.check}</button>`
      : `<span class="check ${checked ? "on" : ""}">${ICON.check}</span>`}
    <button class="item-main" data-act="openTask" data-id="${t.id}">
      <span class="item-title">${esc(t.title)}</span>
      ${meta ? `<span class="item-meta">${meta}</span>` : ""}
    </button>
    <span class="item-side">${reactionSummary(t)}</span>
  </div>`;
}

function nudgeBanner() {
  if (!S.nudges.length) return "";
  const lines = S.nudges.map((n) => {
    const who = esc(firstName(n.from));
    if (n.type === "crisis") return `<b>${who}</b> şu an zorlanıyor (${esc(n.text)}). Bir mesaj at.`;
    if (n.type === "cheer") return `<b>${who}</b>: ${esc(n.text || "Devam, yapıyorsun!")}`;
    return `<b>${who}</b> seni dürttü. Görevlerin bekliyor.`;
  });
  return `<div class="banner">${ICON.bell}<div class="grow">${lines.join("<br>")}</div>
    <button class="link" data-act="seenNudges">Tamam</button></div>`;
}

function pushPrompt() {
  if (S.pushDismissed || !["default", "ios-install"].includes(S.pushState)) return "";
  const ios = S.pushState === "ios-install";
  return `<div class="card prompt">
    <div class="grow"><b>Bildirimleri aç</b>
      <p class="muted small">${ios ? "iPhone'da bildirim için önce Safari'de Paylaş → Ana Ekrana Ekle de, uygulamayı ana ekrandan aç."
        : "Dürtmeler, kriz anları ve akşam hatırlatması telefonuna gelsin."}</p></div>
    <div class="prompt-actions">${ios ? "" : `<button class="btn small" data-act="enablePush">Aç</button>`}
      <button class="link" data-act="dismissPush">Sonra</button></div>
  </div>`;
}

/* ================= BUGÜN ================= */
export function viewToday() {
  const u = S.users[S.uid];
  const daily = dailyOf(S.uid);
  const weekly = weeklyOf(S.uid);
  const prog = todayProgress(S.uid);
  const steps = stepsOf(S.uid);
  const date = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  return `
    <header class="top">
      <div><div class="eyebrow">${date}</div><h1>Bugün</h1></div>
      <button class="icon-btn" data-act="openSettings" aria-label="Ayarlar">${avatar(S.uid)}</button>
    </header>
    ${nudgeBanner()}
    ${pushPrompt()}
    <div class="card summary">
      ${ring(prog.pct, `${prog.done}/${prog.total}`, "tamam")}
      <div class="summary-stats">
        <div><b>${streakOf(S.uid)}</b><span>gün seri</span></div>
        <div><b>${weekPoints(S.uid)}</b><span>puan bu hafta</span></div>
        ${steps != null ? `<div><b>${fmtNum(steps)}</b><span>adım</span></div>` : `<div><b>${u.bestStreak || 0}</b><span>en iyi seri</span></div>`}
      </div>
    </div>

    ${section("Görevler", addBtn("openAddTask"))}
    ${daily.length ? `<div class="card list">${daily.map((t) => taskRow(t, true)).join("")}</div>`
      : empty("Bugün için görev yok.", "openAddTask", "Görev ekle")}

    ${weekly.length ? section("Bu hafta") + `<div class="card list">${weekly.map((t) => taskRow(t, true)).join("")}</div>` : ""}
  `;
}

/* ================= HEDEFLER ================= */
function goalCard(g) {
  const smoking = isSmoking(g);
  const checked = !!g.checkins?.[S.today];
  const saved = savedMoney(g);
  const target = g.saveFor;
  return `<div class="card goal">
    <button class="goal-head" data-act="openGoal" data-id="${g.id}">
      <span class="eyebrow">${esc(g.title)}</span>
      <span class="counter">${cleanText(g)}</span>
      <span class="chev">${ICON.chevron}</span>
    </button>
    <div class="stats3">
      ${smoking && g.perDay ? `<div><b>${money(saved)}</b><span>biriken</span></div><div><b>${notSmoked(g)}</b><span>içilmeyen</span></div>`
        : `<div><b>${Math.max(g.bestDays || 0, cleanDays(g))}</b><span>en iyi (gün)</span></div><div><b>${g.relapses || 0}</b><span>kayma</span></div>`}
      <div><b>${g.crises || 0}</b><span>atlatılan kriz</span></div>
    </div>
    ${target ? `<div class="save">
      <div class="save-row"><span>${esc(target.name)}</span><span>${money(Math.min(saved, target.amount))} / ${money(target.amount)}</span></div>
      <div class="bar"><div style="width:${Math.min(100, (saved / target.amount) * 100)}%"></div></div></div>` : ""}
    <div class="actions">
      <button class="btn ${checked ? "soft" : ""}" data-act="checkin" data-id="${g.id}" ${checked ? "disabled" : ""}>${checked ? "Bugün işaretlendi" : "Bugün temizim"}</button>
      <button class="btn warn" data-act="openCrisis" data-id="${g.id}">${ICON.wind}Kriz anı</button>
    </div>
  </div>`;
}

function challengeCard(c) {
  const day = challengeDay(c);
  const ended = day > c.days;
  const joined = (c.participants || []).includes(S.uid);
  const checkedToday = !!c.checkins?.[S.uid]?.[S.today];
  const status = ended ? "Bitti" : `Gün ${Math.max(day, 1)} / ${c.days}`;
  const rows = (c.participants || []).map((uid) => {
    const marks = c.checkins?.[uid] || {};
    const count = Object.keys(marks).length;
    const dots = Array.from({ length: c.days }, (_, i) => {
      const k = shiftDay(i, new Date(c.startDate + "T12:00:00"));
      const cls = marks[k] ? "on" : k === S.today ? "today" : k < S.today ? "miss" : "";
      return `<i class="${cls}"></i>`;
    }).join("");
    return `<div class="ch-row">${avatar(uid, "sm")}<div class="dots">${dots}</div><span class="ch-count">${count}</span></div>`;
  }).join("");
  let action = "";
  if (!ended && !joined) action = `<button class="btn" data-act="joinChallenge" data-id="${c.id}">Katıl</button>`;
  else if (!ended && joined) action = `<button class="btn ${checkedToday ? "soft" : ""}" data-act="checkinChallenge" data-id="${c.id}" ${checkedToday ? "disabled" : ""}>${checkedToday ? "Bugün işaretlendi" : "Bugün yaptım"}</button>`;
  return `<div class="card challenge">
    <div class="ch-head"><div><b>${esc(c.title)}</b><div class="muted small">${status} · ${esc(firstName(c.createdBy))} başlattı</div></div>
      ${c.createdBy === S.uid ? `<button class="icon-btn subtle" data-act="deleteChallenge" data-id="${c.id}" aria-label="Sil">${ICON.close}</button>` : ""}</div>
    <div class="ch-grid">${rows}</div>
    ${action ? `<div class="actions">${action}</div>` : ""}
  </div>`;
}

export function viewGoals() {
  const mine = goalsOf(S.uid);
  const others = S.goals.filter((g) => g.uid !== S.uid && S.users[g.uid]);
  const challenges = [...S.challenges].sort((a, b) => (challengeDay(a) > a.days) - (challengeDay(b) > b.days) || b.createdAt - a.createdAt);
  return `
    <header class="top"><div><div class="eyebrow">Bırakma ve meydan okumalar</div><h1>Hedefler</h1></div></header>
    ${nudgeBanner()}
    ${section("Bıraktıklarım", addBtn("openAddGoal", "Yeni"))}
    ${mine.length ? mine.map(goalCard).join("") : empty("Bırakmak istediğin bir alışkanlık için sayaç başlat.", "openAddGoal", "Sayaç başlat")}

    ${section("Meydan okumalar", addBtn("openAddChallenge", "Yeni"))}
    ${challenges.length ? challenges.map(challengeCard).join("") : empty("Ekiple birlikte bir hedef koyun. Örneğin 1 hafta şekersiz.", "openAddChallenge", "Meydan okuma başlat")}

    ${others.length ? section("Ekipten") + `<div class="card list">${others.map((g) => `
      <button class="item item-btn" data-act="openGoal" data-id="${g.id}">
        ${avatar(g.uid, "sm")}
        <span class="item-main static"><span class="item-title">${esc(firstName(g.uid))} · ${esc(g.title)}</span>
          <span class="item-meta">${cleanText(g)} temiz</span></span>
        <span class="item-side">${reactionSummary(g)}${ICON.chevron}</span>
      </button>`).join("")}</div>` : ""}
  `;
}

/* ================= EKİP ================= */
function feed() {
  const ev = [];
  S.daily.forEach((t) => { if (t.done && t.doneAt) ev.push({ at: t.doneAt, uid: t.uid, html: `<b>${esc(t.title)}</b> görevini bitirdi`, id: t.id }); });
  S.comments.forEach((c) => {
    const t = findTask(c.taskId);
    if (c.createdAt > Date.now() - 86400000 && t) ev.push({ at: c.createdAt, uid: c.uid, html: `<b>${esc(t.title)}</b> için yorum: “${esc(c.text)}”`, id: t.id });
  });
  ev.sort((a, b) => b.at - a.at);
  if (!ev.length) return "";
  return section("Bugün olanlar") + `<div class="card list">${ev.slice(0, 15).map((e) => `
    <button class="item item-btn" data-act="openTask" data-id="${e.id}">${avatar(e.uid, "sm")}
      <span class="item-main static"><span class="item-title regular">${esc(firstName(e.uid))} ${e.html}</span>
      <span class="item-meta">${timeOf(e.at)}</span></span></button>`).join("")}</div>`;
}

export function viewTeam() {
  const ids = Object.keys(S.users).sort((a, b) => (a === S.uid ? -1 : b === S.uid ? 1 : weekPoints(b) - weekPoints(a)));
  return `
    <header class="top"><div><div class="eyebrow">Bugün kim ne durumda</div><h1>Ekip</h1></div></header>
    ${nudgeBanner()}
    <div class="people">${ids.map((uid) => {
      const u = S.users[uid];
      const own = uid === S.uid;
      const p = todayProgress(uid);
      const open = S.expanded === uid;
      const tasks = [...dailyOf(uid), ...weeklyOf(uid)];
      return `<div class="card person ${open ? "open" : ""}">
        <div class="person-head">
          <button class="person-main" data-act="expand" data-id="${uid}">
            ${avatar(uid)}
            <span class="grow"><b>${esc(u.name)}${own ? " <span class='muted'>(sen)</span>" : ""}</b>
              <span class="item-meta">${p.done}/${p.total} bugün · ${streakOf(uid)} gün seri${stepsOf(uid) != null ? ` · ${fmtNum(stepsOf(uid))} adım` : ""}</span></span>
            <span class="pct">${p.pct}%</span>
          </button>
          ${!own && p.pct < 100 ? `<button class="btn small soft" data-act="nudge" data-id="${uid}">Dürt</button>` : ""}
        </div>
        <div class="bar"><div style="width:${p.pct}%"></div></div>
        ${open ? `<div class="person-body">
          ${tasks.length ? `<div class="list">${tasks.map((t) => taskRow(t, own)).join("")}</div>` : `<p class="muted small">Bugün görev eklememiş.</p>`}
          ${goalsOf(uid).map((g) => `<button class="mini-goal" data-act="openGoal" data-id="${g.id}"><span>${esc(g.title)}</span><b>${cleanText(g)}</b></button>`).join("")}
        </div>` : ""}
      </div>`;
    }).join("")}</div>
    ${feed()}
  `;
}

/* ================= HAFTA ================= */
function heatRow(uid) {
  const h = S.users[uid]?.history || {};
  const cells = Array.from({ length: 28 }, (_, i) => {
    const k = shiftDay(i - 27);
    const v = h[k];
    const lvl = v == null ? "" : v >= 100 ? "l4" : v >= 66 ? "l3" : v >= 33 ? "l2" : v > 0 ? "l1" : "l0";
    return `<i class="${lvl} ${k === S.today ? "today" : ""}" title="${k}${v != null ? ": %" + v : ""}"></i>`;
  }).join("");
  return `<div class="heat-row">${avatar(uid, "sm")}<div class="heat">${cells}</div></div>`;
}

export function viewWeek() {
  const ranked = Object.keys(S.users).sort((a, b) => weekPoints(b) - weekPoints(a));
  const prev = prevWeekKey();
  const prevRanked = Object.keys(S.users).filter((u) => S.users[u].weekPoints?.[prev] != null).sort((a, b) => weekPoints(a, prev) - weekPoints(b, prev));
  const loser = prevRanked.length > 1 ? prevRanked[0] : null;
  const bet = S.group.bet;
  return `
    <header class="top"><div><div class="eyebrow">Pazartesiden beri</div><h1>Bu hafta</h1></div></header>
    <div class="card bet">
      <div class="grow"><div class="eyebrow">İddia</div>
        <b>${bet ? `Haftanın sonuncusu ${esc(bet)}` : "Henüz iddia yok"}</b>
        ${loser ? `<div class="muted small">Geçen hafta en az puan: ${esc(firstName(loser))} (${weekPoints(loser, prev)})</div>` : ""}</div>
      <button class="link" data-act="openBet">${bet ? "Değiştir" : "Belirle"}</button>
    </div>

    ${section("Sıralama")}
    <div class="card list">${ranked.map((uid, i) => `
      <div class="item rank">
        <span class="pos ${i === 0 ? "first" : ""}">${i + 1}</span>${avatar(uid, "sm")}
        <span class="item-main static"><span class="item-title">${esc(S.users[uid].name)}</span>
          <span class="item-meta">${ICON.flame} ${streakOf(uid)} gün seri · toplam ${S.users[uid].points || 0}</span></span>
        <b class="score">${weekPoints(uid)}</b>
      </div>`).join("")}</div>

    ${section("Son 4 hafta")}
    <div class="card heat-card">
      ${ranked.map(heatRow).join("")}
      <div class="legend"><span>Az</span><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>Tam</span></div>
    </div>

    <p class="footnote">Görev ${P.task} · günü bitirmek +${P.dayBonus} · temiz gün ${P.checkin} · atlatılan kriz ${P.crisis} · meydan okuma ${P.challenge} puan</p>
  `;
}

/* ================= ALT PENCERELER ================= */
const sheetHead = (title) => `<div class="sheet-head"><h3>${title}</h3><button class="icon-btn subtle" data-act="closeSheet" aria-label="Kapat">${ICON.close}</button></div>`;

export function sheetAddTask() {
  return `${sheetHead("Yeni görev")}
  <form id="fAddTask" class="form">
    <input name="title" placeholder="Ne yapacaksın?" maxlength="80" required autocomplete="off">
    <div class="seg" data-group="kind">
      <button type="button" data-v="daily" class="on">Her gün</button>
      <button type="button" data-v="days">Belirli günler</button>
      <button type="button" data-v="weekly">Haftalık</button>
      <button type="button" data-v="once">Sadece bugün</button>
    </div>
    <div class="opt" data-show="days"><label>Hangi günler?</label>
      <div class="chips">${DAY_SHORT.map((d, i) => `<button type="button" class="chip" data-day="${i}">${d}</button>`).join("")}</div></div>
    <div class="opt" data-show="weekly"><label>Haftada kaç gün?</label>
      <div class="chips single">${[1, 2, 3, 4, 5, 6].map((n) => `<button type="button" class="chip ${n === 3 ? "on" : ""}" data-target="${n}">${n}</button>`).join("")}</div></div>
    <button class="btn full">Ekle</button>
  </form>`;
}

export function sheetAddGoal() {
  return `${sheetHead("Yeni bırakma hedefi")}
  <form id="fAddGoal" class="form">
    <div class="seg" data-group="gkind">
      <button type="button" data-v="smoking" class="on">Sigara</button>
      <button type="button" data-v="other">Başka bir şey</button>
    </div>
    <div class="opt show" data-show="other"><label>Neyi bırakıyorsun?</label><input name="title" maxlength="40" placeholder="Örn. şeker, kola, sosyal medya"></div>
    <div class="opt show" data-show="smoking">
      <div class="two"><div><label>Günde kaç tane?</label><input name="perDay" type="number" min="0" inputmode="numeric" placeholder="20"></div>
      <div><label>Paket fiyatı (₺)</label><input name="packPrice" type="number" min="0" inputmode="decimal" placeholder="100"></div></div>
      <p class="muted small">Biriken parayı ve içilmeyen sigarayı hesaplamak için. Boş bırakabilirsin.</p>
    </div>
    <button class="btn full">Sayacı şimdi başlat</button>
  </form>`;
}

export function sheetAddChallenge() {
  return `${sheetHead("Yeni meydan okuma")}
  <form id="fAddChallenge" class="form">
    <input name="title" placeholder="Örn. 1 hafta şekersiz" maxlength="60" required autocomplete="off">
    <label>Kaç gün sürsün?</label>
    <div class="chips single">${[3, 7, 14, 21, 30].map((n) => `<button type="button" class="chip ${n === 7 ? "on" : ""}" data-len="${n}">${n} gün</button>`).join("")}</div>
    <p class="muted small">Bugün başlar. Ekipten herkes katılabilir.</p>
    <button class="btn full">Başlat</button>
  </form>`;
}

export function sheetBet() {
  return `${sheetHead("Haftalık iddia")}
  <form id="fBet" class="form">
    <label>Haftanın sonuncusu ne yapsın?</label>
    <input name="bet" value="${esc(S.group.bet || "")}" placeholder="Örn. herkese kahve ısmarlar" maxlength="60" autocomplete="off">
    <button class="btn full">Kaydet</button>
  </form>`;
}

export function sheetSettings() {
  const u = S.users[S.uid];
  return `${sheetHead("Profil")}
  <form id="fSettings" class="form">
    <label>Adın</label><input name="name" value="${esc(u.name)}" maxlength="20" required>
    <label>Rengin</label>
    <div class="swatches">${COLORS.map((c) => `<button type="button" data-color="${c}" class="${c === u.color ? "on" : ""}" style="background:${c}" aria-label="renk"></button>`).join("")}</div>
    <button class="btn full">Kaydet</button>
  </form>

  <h4>Bildirimler</h4>
  ${pushSettings()}

  <h4>iPhone Sağlık</h4>
  <div class="setting-row"><div class="grow">Adım sayın her akşam otomatik gelsin.<div class="muted small">${stepsOf(S.uid) != null ? `Bugün: ${fmtNum(stepsOf(S.uid))} adım` : "Henüz bağlı değil"}</div></div>
    <button class="btn small soft" data-act="openHealth">Kur</button></div>

  <button class="btn full ghost" data-act="logout" style="margin-top:24px">Çıkış yap</button>`;
}

function pushSettings() {
  const s = S.pushState;
  if (s === "granted") return `<div class="setting-row"><div class="grow">Açık<div class="muted small">Dürtme, kriz, destek, yorum ve 21:00 hatırlatması.</div></div>
    <button class="btn small ghost" data-act="enablePush">Yenile</button></div>`;
  if (s === "denied") return `<p class="muted small">Bildirimler engellenmiş. Telefonun Ayarlar → Bildirimler → Düzen bölümünden izin ver.</p>`;
  if (s === "ios-install") return `<p class="muted small">iPhone'da bildirim almak için Safari'de Paylaş → Ana Ekrana Ekle de, sonra uygulamayı ana ekrandaki simgeden aç.</p>`;
  if (s === "unsupported") return `<p class="muted small">Bu tarayıcı bildirimleri desteklemiyor.</p>`;
  return `<div class="setting-row"><div class="grow">Kapalı</div><button class="btn small" data-act="enablePush">Aç</button></div>`;
}

export function sheetHealth() {
  const key = S.healthKey;
  if (!key) return `${sheetHead("iPhone Sağlık")}<p class="muted">Hazırlanıyor…</p>`;
  const url = `https://firestore.googleapis.com/v1/projects/${S.projectId}/databases/(default)/documents/healthInbox/${key}?key=${S.apiKey}`;
  const body = `{"fields":{"steps":{"doubleValue":DEGER}}}`;
  return `${sheetHead("iPhone Sağlık")}
    <p class="muted small">iPhone'daki <b>Kestirmeler</b> uygulamasıyla bir kez kurarsın, sonra her akşam adım sayın kendiliğinden gelir. Bu bağlantı sana özel; kimseyle paylaşma.</p>
    <ol class="steps">
      <li><b>Kestirmeler</b> → sağ üst <b>+</b> → yeni kestirme.</li>
      <li><b>Sağlık Örneklerini Bul</b> eylemini ekle. Tür: <b>Adımlar</b>, Başlangıç Tarihi: <b>Bugün</b>, Gruplama: <b>Gün</b>.</li>
      <li><b>Sağlık Örneğinin Ayrıntılarını Al</b> ekle, <b>Değer</b>'i seç.</li>
      <li><b>Metin</b> ekle ve aşağıdaki metni yapıştır. <code>DEGER</code> yazan yeri silip yerine önceki adımdaki <b>Değer</b> değişkenini koy.
        <div class="copy"><code id="hBody">${esc(body)}</code><button class="btn small ghost" data-act="copy" data-target="hBody">Kopyala</button></div></li>
      <li><b>URL'nin İçeriğini Al</b> ekle. URL olarak bunu yapıştır:
        <div class="copy"><code id="hUrl">${esc(url)}</code><button class="btn small ghost" data-act="copy" data-target="hUrl">Kopyala</button></div>
        Yöntem: <b>PATCH</b>. Başlıklar: <b>Content-Type</b> = <b>application/json</b>. İstek Gövdesi: <b>Dosya</b> → <b>Metin</b>.</li>
      <li>Kestirmeyi bir kez çalıştır. Birkaç dakika içinde adımların burada görünür.</li>
      <li><b>Otomasyon</b> sekmesi → <b>+</b> → <b>Günün Saati</b> → 23:30, Her Gün, <b>Hemen Çalıştır</b> → bu kestirmeyi seç. İstersen 21:00 için bir tane daha ekle.</li>
    </ol>
    <p class="footnote">Adımlar en geç 5-15 dakika içinde işlenir.</p>`;
}

export function sheetTask(id) {
  const t = findTask(id);
  if (!t) return `${sheetHead("Görev")}<p class="muted">Bu görev artık yok.</p>`;
  const own = t.uid === S.uid;
  const comments = commentsOf(id);
  const checked = taskChecked(t);
  let kindText = "Sadece bugün";
  if (t.kind === "weekly") kindText = `Haftada ${t.target} gün · bu hafta ${(t.doneDays || []).length} kez`;
  else if (t.templateId) kindText = t.days?.length && t.days.length < 7 ? t.days.map((d) => DAY_SHORT[d]).join(", ") : "Her gün";
  return `${sheetHead(esc(t.title))}
    <div class="task-info">${own ? "" : `${avatar(t.uid, "sm")} <b>${esc(firstName(t.uid))}</b> · `}${kindText}
      ${t.done && t.doneAt ? ` · ${timeOf(t.doneAt)}'de bitti` : ""}</div>
    ${own ? `<button class="btn full ${checked ? "soft" : ""}" data-act="toggle" data-id="${t.id}">
      ${t.kind === "weekly" ? (checked ? "Bugün yapıldı, geri al" : "Bugün yaptım") : checked ? "Tamamlandı, geri al" : "Tamamla"}</button>` : ""}

    <div id="photoBox" class="photo-box">${t.hasPhoto ? `<div class="muted small">Fotoğraf yükleniyor…</div>` : ""}</div>
    ${own ? `<label class="btn full ghost file">${ICON.camera} ${t.hasPhoto ? "Fotoğrafı değiştir" : "Kanıt fotoğrafı ekle"}
      <input type="file" accept="image/*" data-photo="${t.id}" hidden></label>` : ""}

    ${own ? (Object.keys(t.reactions || {}).length ? `<div class="who">${Object.entries(t.reactions).map(([uid, e]) => `<span class="pill">${e} ${esc(firstName(uid))}</span>`).join("")}</div>` : "")
      : reactionButtons("tasks", t)}

    <h4>Yorumlar</h4>
    <div id="commentList">${commentList(comments)}</div>
    <form id="fComment" class="comment-form" data-task="${t.id}">
      <input name="text" placeholder="Yorum yaz…" maxlength="200" autocomplete="off" required>
      <button class="btn">Gönder</button>
    </form>

    ${own ? `<div class="danger">
      <button class="link danger-link" data-act="deleteTask" data-id="${t.id}">${t.templateId ? "Sadece bugünkünü sil" : "Görevi sil"}</button>
      ${t.templateId ? `<button class="link danger-link" data-act="stopTask" data-id="${t.id}">Tekrarı durdur ve sil</button>` : ""}
    </div>` : ""}`;
}

export function commentList(comments) {
  if (!comments.length) return `<p class="muted small">Henüz yorum yok.</p>`;
  return comments.map((c) => `<div class="comment">${avatar(c.uid, "sm")}
    <div class="grow"><b>${esc(firstName(c.uid))}</b> <span class="muted small">${timeOf(c.createdAt)}</span><div>${esc(c.text)}</div></div>
    ${c.uid === S.uid ? `<button class="icon-btn subtle" data-act="deleteComment" data-id="${c.id}" aria-label="Sil">${ICON.close}</button>` : ""}</div>`).join("");
}

export function sheetGoal(id) {
  const g = S.goals.find((x) => x.id === id);
  if (!g) return `${sheetHead("Hedef")}<p class="muted">Bu hedef artık yok.</p>`;
  const own = g.uid === S.uid;
  const mins = cleanMs(g) / 60000;
  const days = cleanDays(g);
  const timeline = isSmoking(g) ? `<h4>Vücudunda neler değişiyor</h4><ol class="timeline">${SMOKE_TIMELINE.map(([m, label, text]) =>
    `<li class="${mins >= m ? "done" : ""}"><b>${label}</b><span>${text}</span></li>`).join("")}</ol>
    <p class="footnote">Kaynak: Dünya Sağlık Örgütü, sigarayı bırakmanın sağlığa faydaları.</p>` : "";
  return `${sheetHead(own ? esc(g.title) : `${esc(firstName(g.uid))} · ${esc(g.title)}`)}
    <div class="big-counter">${cleanText(g)}<span>temiz</span></div>
    <div class="chips static">${MILESTONES.map(([n, l]) => `<span class="chip ${days >= n ? "on" : ""}">${l}</span>`).join("")}</div>
    ${own ? "" : reactionButtons("goals", g) + `<button class="btn full soft" data-act="cheer" data-id="${g.uid}">Destek mesajı gönder</button>`}
    ${timeline}
    ${own && isSmoking(g) && g.perDay ? `<h4>Biriktirme hedefi</h4>
      <form id="fSave" class="form" data-goal="${g.id}">
        <div class="two"><input name="name" placeholder="Ne alacaksın?" value="${esc(g.saveFor?.name || "")}" maxlength="30">
        <input name="amount" type="number" min="1" inputmode="decimal" placeholder="Tutar ₺" value="${g.saveFor?.amount || ""}"></div>
        <button class="btn full ghost">Kaydet</button>
      </form>` : ""}
    ${own ? `<div class="danger">
      <button class="link danger-link" data-act="relapse" data-id="${g.id}">Kaydım, sayacı sıfırla</button>
      <button class="link danger-link" data-act="deleteGoal" data-id="${g.id}">Hedefi sil</button>
    </div>` : ""}`;
}

export function sheetCrisis(id) {
  const g = S.goals.find((x) => x.id === id);
  return `${sheetHead("Kriz anı")}
    <p class="muted center-text">İstek genelde birkaç dakikada geçer. Daireyle birlikte nefes al.</p>
    <div class="breath"><div class="breath-circle"></div><div class="breath-text" id="breathText">Nefes al</div></div>
    <div class="breath-timer" id="breathTimer">3:00</div>
    <p class="muted small center-text">Ekibe haber verildi.</p>
    <button class="btn full" data-act="crisisDone" data-id="${g?.id || ""}">Atlattım</button>`;
}
