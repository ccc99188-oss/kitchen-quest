// 共用：存檔、導覽列、各頁面邏輯
const KEY = "kitchen-quest-save-v1";

const defaultState = () => ({
  name: "", avatar: "🧑‍🍳", xp: 0, coins: 0,
  quests: {},       // id -> "pending" | "done"
  doneAt: {},       // id -> 日期
  creatures: [],
  notes: {},
  badges: {},
  unlockAll: false,
  log: []
});

function load() {
  try { return Object.assign(defaultState(), JSON.parse(localStorage.getItem(KEY)) || {}); }
  catch (e) { return defaultState(); }
}
let S = load();
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

const $ = (sel) => document.querySelector(sel);
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const allQuests = () => ISLANDS.flatMap(i => i.quests.map(q => Object.assign({ island: i.id }, q)));
const findQuest = (id) => allQuests().find(q => q.id === id);
const doneCount = () => Object.values(S.quests).filter(v => v === "done").length;
const islandUnlocked = (isl) => S.unlockAll || doneCount() >= isl.unlockNeed;

function levelInfo() {
  let cur = LEVELS[0], next = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (S.xp >= LEVELS[i].xp) { cur = LEVELS[i]; next = LEVELS[i + 1] || null; }
  }
  const lv = LEVELS.indexOf(cur) + 1;
  const pct = next ? Math.round((S.xp - cur.xp) / (next.xp - cur.xp) * 100) : 100;
  return { lv, title: cur.title, next, pct };
}

function addLog(text) {
  S.log.unshift({ t: new Date().toLocaleDateString("zh-TW"), text });
  S.log = S.log.slice(0, 50);
}

function giveCreature(id) {
  if (!id || S.creatures.includes(id)) return null;
  S.creatures.push(id);
  const c = CREATURES.find(x => x.id === id);
  addLog(`獲得食靈「${c.name}」`);
  return c;
}

function toast(html, ms = 2600) {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.innerHTML = html; t.className = "show";
  clearTimeout(t._h); t._h = setTimeout(() => t.className = "", ms);
}

function showCreatureModal(c) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-box pop">
    <div class="big-emoji">${c.emoji}</div>
    <h2>新夥伴加入！</h2>
    <p><b>${esc(c.name)}</b>（${esc(c.type)}）${"⭐".repeat(c.rarity)}</p>
    <p class="muted">${esc(c.text)}</p>
    <button class="btn">太棒了！</button></div>`;
  m.querySelector("button").onclick = () => m.remove();
  document.body.appendChild(m);
}

// ---------- 導覽列 ----------
const NAV = [
  ["index.html", "🗺️", "航海圖"],
  ["plate.html", "🍽️", "餐盤挑戰"],
  ["collection.html", "📖", "食靈圖鑑"],
  ["recipes.html", "📒", "食譜本"],
  ["safety.html", "🛡️", "安全守則"],
  ["parent.html", "👨‍👩‍👦", "家長區"]
];

function renderNav(active) {
  const li = levelInfo();
  const pending = Object.values(S.quests).filter(v => v === "pending").length;
  const header = document.createElement("header");
  header.innerHTML = `
    <div class="topbar">
      <a class="logo" href="index.html">🏴‍☠️ 廚房冒險王</a>
      <div class="stats">
        <span title="等級">${S.avatar} Lv.${li.lv} ${esc(li.title)}</span>
        <span title="經驗值">✨ ${S.xp}</span>
        <span title="金幣">🪙 ${S.coins}</span>
      </div>
    </div>
    <nav>${NAV.map(([href, e, t]) =>
      `<a href="${href}" class="${active === href ? "active" : ""}">${e}<span>${t}${href === "parent.html" && pending ? ` <b class="badge">${pending}</b>` : ""}</span></a>`
    ).join("")}</nav>`;
  document.body.prepend(header);
}

// ---------- 首頁：航海圖 ----------
function pageHome() {
  const main = $("#main");
  if (!S.name) {
    const avatars = ["🧑‍🍳", "🏴‍☠️", "🦖", "🐱", "🐼", "🤖", "🦊", "🐸"];
    main.innerHTML = `<section class="card center">
      <h1>⛵ 歡迎來到食材群島！</h1>
      <p>這裡有四座島，每座島都有料理任務。完成任務就能升級、賺金幣，還能收集「食靈」夥伴！</p>
      <label>船長，你的名字是？<br><input id="nm" maxlength="12" placeholder="輸入暱稱"></label>
      <p>選一個角色：</p>
      <div class="avatar-pick">${avatars.map((a, i) => `<button class="av ${i === 0 ? "sel" : ""}" data-a="${a}">${a}</button>`).join("")}</div>
      <button class="btn big" id="start">出航！</button></section>`;
    let av = avatars[0];
    main.querySelectorAll(".av").forEach(b => b.onclick = () => {
      main.querySelectorAll(".av").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel"); av = b.dataset.a;
    });
    $("#start").onclick = () => {
      const n = $("#nm").value.trim();
      if (!n) { toast("請先輸入名字喔！"); return; }
      S.name = n; S.avatar = av; addLog("開始冒險！"); save(); location.reload();
    };
    return;
  }

  const li = levelInfo();
  const total = allQuests().length;
  const today = pickTodayQuest();
  main.innerHTML = `
    <section class="card hero">
      <div class="hero-av">${S.avatar}</div>
      <div class="grow">
        <h1>${esc(S.name)}${S.name.endsWith("船長") ? "" : " 船長"}</h1>
        <p>Lv.${li.lv}「${esc(li.title)}」${li.next ? `・再 ${li.next.xp - S.xp} 經驗升級` : "・已達最高等級！"}</p>
        <div class="bar"><div style="width:${li.pct}%"></div></div>
        <p class="muted">已完成 ${doneCount()} / ${total} 個任務・收集 ${S.creatures.length} / ${CREATURES.length} 隻食靈</p>
      </div>
    </section>
    ${today ? `<section class="card today">
      <h2>🎯 今日推薦任務</h2>
      <a class="quest-link" href="island.html?id=${today.island}#${today.id}">${today.emoji} ${esc(today.title)}　<span class="muted">${today.safety} +${today.xp}✨</span></a>
    </section>` : ""}
    <h2 class="sec-title">🗺️ 航海圖</h2>
    <div class="map">${ISLANDS.map(isl => {
      const open = islandUnlocked(isl);
      const d = isl.quests.filter(q => S.quests[q.id] === "done").length;
      return `<a class="island ${open ? "" : "locked"}" style="--c:${isl.color}" href="${open ? `island.html?id=${isl.id}` : "#"}" data-need="${isl.unlockNeed}">
        <div class="isl-emoji">${open ? isl.emoji : "🔒"}</div>
        <div class="isl-name">${esc(isl.name)}</div>
        <div class="muted">${esc(isl.stage)}</div>
        <div class="bar small"><div style="width:${Math.round(d / isl.quests.length * 100)}%"></div></div>
        <div class="muted">${open ? `${d} / ${isl.quests.length} 完成` : `完成 ${isl.unlockNeed} 個任務解鎖`}</div>
      </a>`;
    }).join("")}</div>
    <section class="card"><h2>📜 航海日誌</h2>
      ${S.log.length ? `<ul class="log">${S.log.slice(0, 8).map(l => `<li><span class="muted">${esc(l.t)}</span> ${esc(l.text)}</li>`).join("")}</ul>` : `<p class="muted">還沒有紀錄。</p>`}
    </section>`;
  main.querySelectorAll(".island.locked").forEach(a => a.onclick = (e) => {
    e.preventDefault(); toast(`🔒 還要再完成 ${a.dataset.need - doneCount()} 個任務才能登島！`);
  });
}

function pickTodayQuest() {
  const open = allQuests().filter(q => islandUnlocked(ISLANDS.find(i => i.id === q.island)) && !S.quests[q.id] && !q.boss);
  if (!open.length) return null;
  const d = new Date(); const seed = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
  return open[seed % open.length];
}

// ---------- 島嶼頁 ----------
function pageIsland() {
  const id = Number(new URLSearchParams(location.search).get("id")) || 1;
  const isl = ISLANDS.find(i => i.id === id) || ISLANDS[0];
  const main = $("#main");
  if (!islandUnlocked(isl)) {
    main.innerHTML = `<section class="card center"><div class="big-emoji">🔒</div><h1>${esc(isl.name)}</h1>
      <p>還要再完成 ${isl.unlockNeed - doneCount()} 個任務才能登島！</p><a class="btn" href="index.html">回航海圖</a></section>`;
    return;
  }
  function render() {
    const d = isl.quests.filter(q => S.quests[q.id] === "done").length;
    main.innerHTML = `
      <section class="card island-head" style="--c:${isl.color}">
        <div class="big-emoji">${isl.emoji}</div>
        <div><h1>${esc(isl.name)}</h1><p class="muted">${esc(isl.stage)}</p><p>${esc(isl.intro)}</p>
        <div class="bar"><div style="width:${Math.round(d / isl.quests.length * 100)}%"></div></div>
        <p class="muted">${d} / ${isl.quests.length} 完成</p></div>
      </section>
      <div class="island-nav">${ISLANDS.map(i => `<a href="island.html?id=${i.id}" class="${i.id === isl.id ? "active" : ""}">${islandUnlocked(i) ? i.emoji : "🔒"} ${esc(i.name)}</a>`).join("")}</div>
      <div class="quests">${isl.quests.map(q => questCard(q)).join("")}</div>`;
    main.querySelectorAll("[data-done]").forEach(b => b.onclick = () => {
      const q = findQuest(b.dataset.done);
      S.quests[q.id] = "pending"; addLog(`完成任務「${q.title}」，等待家長蓋章`); save();
      toast(`📮 已送出！請爸爸或媽媽到「家長區」幫你蓋章`);
      refreshNav(); render();
    });
    main.querySelectorAll("[data-undo]").forEach(b => b.onclick = () => {
      delete S.quests[b.dataset.undo]; save(); refreshNav(); render();
    });
    main.querySelectorAll(".quest .q-head").forEach(h => h.onclick = () => h.parentElement.classList.toggle("open"));
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el) { el.classList.add("open"); el.scrollIntoView({ block: "center" }); }
    }
  }
  render();
}

function questCard(q) {
  const st = S.quests[q.id];
  const rw = q.reward ? CREATURES.find(c => c.id === q.reward) : null;
  return `<article class="quest ${q.boss ? "boss" : ""} ${st || ""}" id="${q.id}">
    <div class="q-head">
      <span class="q-emoji">${st === "done" ? "✅" : q.emoji}</span>
      <span class="grow"><b>${esc(q.title)}</b><br><span class="muted">${q.safety} 安全等級・+${q.xp}✨ +${Math.round(q.xp / 2)}🪙${rw ? `・獎勵食靈 ${S.creatures.includes(rw.id) ? rw.emoji : "❓"}` : ""}</span></span>
      <span class="q-state">${st === "done" ? "已完成" : st === "pending" ? "⏳ 等蓋章" : "▶"}</span>
    </div>
    <div class="q-body">
      <p>${esc(q.desc)}</p>
      <ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      ${!st ? `<button class="btn" data-done="${q.id}">🙋 我完成了！</button>` : ""}
      ${st === "pending" ? `<button class="btn ghost" data-undo="${q.id}">取消送出</button>` : ""}
      ${st === "done" ? `<a class="btn ghost" href="recipes.html#${q.id}">📒 寫心得</a>` : ""}
    </div></article>`;
}

function refreshNav() {
  const h = document.querySelector("body > header"); if (h) h.remove();
  renderNav(document.body.dataset.page);
}

// ---------- 餐盤挑戰 ----------
function pagePlate() {
  const main = $("#main");
  let plate = [];
  function render() {
    const groups = new Set(plate.map(f => f.group).filter(g => g !== "treat"));
    const n = groups.size;
    const stars = n >= 6 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0;
    const msg = n === 0 ? "點下面的食材，放進你的早餐盤！"
      : n >= 6 ? "🌈 完美！六大類全部到齊！"
      : n >= 4 ? "👍 很均衡的早餐！還差一點就全齊了"
      : "再加一些不同種類的食物看看？";
    const missing = Object.keys(FOOD_GROUPS).filter(g => !groups.has(g));
    main.innerHTML = `
      <section class="card"><h1>🍽️ 餐盤挑戰</h1>
        <p>設計一份早餐，看看湊齊了幾類？目標是「蛋白質＋全穀＋蔬果＋奶類」四大類以上！</p></section>
      <section class="card plate-area">
        <div class="plate">${plate.length ? plate.map((f, i) => `<button class="food on" data-rm="${i}" title="拿掉">${f.emoji}<small>${esc(f.name)}</small></button>`).join("") : `<span class="muted">空盤子</span>`}</div>
        <div class="stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
        <p class="center"><b>${msg}</b></p>
        <div class="groups">${Object.entries(FOOD_GROUPS).map(([k, g]) => `<span class="grp ${groups.has(k) ? "ok" : ""}">${g.emoji} ${g.name}</span>`).join("")}</div>
        ${n > 0 && missing.length ? `<p class="muted center">小提示：${missing.slice(0, 2).map(m => FOOD_GROUPS[m].tip).join("、")}</p>` : ""}
        ${plate.some(f => f.group === "treat") ? `<p class="muted center">🧁 點心偶爾吃也沒關係，開心最重要！記得也要有其他類別喔。</p>` : ""}
        <div class="center"><button class="btn ghost" id="clear">清空盤子</button></div>
      </section>
      <section class="card"><h2>食材櫃</h2>
        <div class="foods">${FOODS.map((f, i) => `<button class="food" data-add="${i}">${f.emoji}<small>${esc(f.name)}</small></button>`).join("")}</div>
      </section>`;
    main.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
      if (plate.length >= 8) { toast("盤子裝不下了！"); return; }
      plate.push(FOODS[b.dataset.add]); render();
    });
    main.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { plate.splice(Number(b.dataset.rm), 1); render(); });
    $("#clear").onclick = () => { plate = []; render(); };
    if (n >= 6 && !S.badges.plate) {
      S.badges.plate = true; S.coins += 20; addLog("餐盤挑戰三顆星！"); const c = giveCreature("c19"); save(); refreshNav();
      if (c) showCreatureModal(c);
    }
  }
  render();
}

// ---------- 食靈圖鑑 ----------
function pageCollection() {
  const main = $("#main");
  main.innerHTML = `<section class="card"><h1>📖 食靈圖鑑</h1>
    <p>完成任務、通過測驗，就能遇見新的食靈夥伴。已收集 <b>${S.creatures.length} / ${CREATURES.length}</b> 隻！</p></section>
    <div class="dex">${CREATURES.map((c, i) => {
      const has = S.creatures.includes(c.id);
      const src = allQuests().find(q => q.reward === c.id);
      const hint = src ? `完成「${src.title}」` : c.id === "c18" ? "通過安全守則測驗" : "餐盤挑戰湊齊六大類";
      return `<div class="mon ${has ? "" : "unknown"} r${c.rarity}">
        <div class="no">No.${String(i + 1).padStart(3, "0")}</div>
        <div class="mon-emoji">${has ? c.emoji : "❓"}</div>
        <div class="mon-name">${has ? esc(c.name) : "？？？"}</div>
        <div class="muted">${has ? `${esc(c.type)} ${"⭐".repeat(c.rarity)}` : "未發現"}</div>
        <p class="small">${has ? esc(c.text) : `提示：${esc(hint)}`}</p></div>`;
    }).join("")}</div>`;
}

// ---------- 食譜本 ----------
function pageRecipes() {
  const main = $("#main");
  const done = allQuests().filter(q => S.quests[q.id] === "done");
  main.innerHTML = `<section class="card"><h1>📒 我的食譜本</h1>
    <p>每完成一道料理，就會收進食譜本。寫下「下次想改什麼」，讓料理越來越厲害！</p></section>
    ${done.length ? done.map(q => `<article class="card recipe" id="${q.id}">
      <h2>${q.emoji} ${esc(q.title)}</h2>
      <p class="muted">完成日期：${esc(S.doneAt[q.id] || "")}</p>
      <ol>${q.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      <label>✏️ 我的心得 / 下次想改什麼：<textarea data-note="${q.id}" rows="3" placeholder="例如：蛋再煎 30 秒會更好吃">${esc(S.notes[q.id] || "")}</textarea></label>
      <span class="saved muted" data-saved="${q.id}"></span>
    </article>`).join("") : `<section class="card center"><div class="big-emoji">📭</div><p>食譜本還是空的。去完成第一個任務吧！</p><a class="btn" href="island.html?id=1">前往晨光煎蛋島</a></section>`}`;
  main.querySelectorAll("[data-note]").forEach(t => t.oninput = () => {
    S.notes[t.dataset.note] = t.value; save();
    const s = main.querySelector(`[data-saved="${t.dataset.note}"]`); s.textContent = "已儲存 ✓";
  });
  if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
}

// ---------- 安全守則 ----------
function pageSafety() {
  const main = $("#main");
  let qi = 0, score = 0, answered = false;
  main.innerHTML = `<section class="card"><h1>🛡️ 廚房安全守則</h1>
    <p>每個任務都有安全等級。看清楚自己現在可以做什麼！</p>
    <table class="safety">${SAFETY_RULES.map(r => `<tr><td class="lv">${r.level}</td><td><b>${r.name}</b><br><span class="muted">${r.items}</span></td></tr>`).join("")}</table>
    <h2>🔥 一定要記住</h2>
    <ul><li>鍋柄朝內</li><li>離開爐子先關火</li><li>熱鍋不碰水</li><li>生食熟食分開砧板</li><li>燙到馬上沖冷水，並告訴大人</li></ul>
    </section>
    <section class="card" id="quiz"></section>`;
  const box = $("#quiz");
  function renderQ() {
    if (qi >= SAFETY_QUIZ.length) {
      const pass = score >= SAFETY_QUIZ.length - 1;
      box.innerHTML = `<h2>測驗結果：${score} / ${SAFETY_QUIZ.length}</h2>
        <p>${pass ? "🎉 通過！你是安全的小廚師！" : "差一點點！再挑戰一次（最多錯 1 題就通過）"}</p>
        <button class="btn" id="again">再測一次</button>`;
      if (pass && !S.badges.safety) {
        S.badges.safety = true; S.xp += 50; S.coins += 20; addLog("通過廚房安全測驗！");
        const c = giveCreature("c18"); save(); refreshNav(); if (c) showCreatureModal(c);
      }
      $("#again").onclick = () => { qi = 0; score = 0; renderQ(); };
      return;
    }
    const q = SAFETY_QUIZ[qi]; answered = false;
    box.innerHTML = `<h2>🧠 安全小測驗 ${S.badges.safety ? "<span class='badge ok'>已通過</span>" : ""}</h2>
      <p class="muted">第 ${qi + 1} / ${SAFETY_QUIZ.length} 題</p>
      <p><b>${esc(q.q)}</b></p>
      <div class="opts">${q.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("")}</div>
      <p id="why"></p>`;
    box.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      if (answered) return; answered = true;
      const ok = Number(b.dataset.i) === q.answer; if (ok) score++;
      b.classList.add(ok ? "right" : "wrong");
      box.querySelectorAll(".opt")[q.answer].classList.add("right");
      $("#why").innerHTML = `${ok ? "⭕ 答對了！" : "❌ 不對喔！"} ${esc(q.why)}<br><button class="btn" id="next">下一題 ➜</button>`;
      $("#next").onclick = () => { qi++; renderQ(); };
    });
  }
  renderQ();
}

// ---------- 家長區 ----------
function pageParent() {
  const main = $("#main");
  const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
  if (!sessionStorage.getItem("kq-parent")) {
    main.innerHTML = `<section class="card center"><h1>👨‍👩‍👦 家長區</h1>
      <p>請家長回答：<b>${a} × ${b} + 17 = ?</b></p>
      <input id="ans" inputmode="numeric" class="center"><br><button class="btn" id="go">進入</button></section>`;
    $("#go").onclick = () => {
      if (Number($("#ans").value) === a * b + 17) { sessionStorage.setItem("kq-parent", "1"); pageParent(); }
      else toast("答案不對喔！");
    };
    return;
  }
  const pend = allQuests().filter(q => S.quests[q.id] === "pending");
  main.innerHTML = `<section class="card"><h1>👨‍👩‍👦 家長區</h1>
      <h2>📮 等待蓋章的任務（${pend.length}）</h2>
      ${pend.length ? pend.map(q => `<div class="pend"><span>${q.emoji} <b>${esc(q.title)}</b><br><span class="muted">${esc(q.desc)}</span></span>
        <span class="row"><button class="btn" data-ok="${q.id}">✅ 蓋章</button><button class="btn ghost" data-no="${q.id}">再練習</button></span></div>`).join("") : `<p class="muted">目前沒有待確認的任務。</p>`}
    </section>
    <section class="card"><h2>📘 使用方式</h2>
      <ol>
        <li>孩子完成料理後，在任務頁按「我完成了」。</li>
        <li>家長在這裡確認後「蓋章」，孩子就會得到經驗、金幣與食靈。</li>
        <li>覺得還不夠熟練就按「再練習」，任務會退回去重做（不扣分）。</li>
        <li>每個技能都照這四步放手：<b>我做你看 → 我們一起做 → 你做我看 → 你自己做</b>，走到第四步再蓋章。</li>
        <li>完成一定數量的任務，下一座島就會解鎖。</li>
      </ol>
      <h2>🪙 金幣兌換建議（可以自己調整）</h2>
      <ul><li>50 🪙：決定一次週末早餐菜單</li><li>100 🪙：挑一樣新食材來實驗</li><li>200 🪙：一次家庭「小主廚餐廳」，由孩子點菜、全家當客人</li></ul>
      <p>目前金幣：<b>${S.coins}</b> <button class="btn ghost" id="spend">使用 50 金幣</button></p>
    </section>
    <section class="card"><h2>⚙️ 進度管理</h2>
      <label><input type="checkbox" id="ua" ${S.unlockAll ? "checked" : ""}> 解鎖所有島嶼（適合孩子已經會的技能）</label>
      <div class="row wrap">
        <button class="btn ghost" id="export">匯出存檔</button>
        <label class="btn ghost">匯入存檔<input type="file" id="import" accept=".json" hidden></label>
        <button class="btn danger" id="reset">重設全部進度</button>
      </div>
      <p class="muted small">進度存在這台裝置的瀏覽器裡。換裝置前請先匯出存檔。</p>
    </section>`;

  main.querySelectorAll("[data-ok]").forEach(btn => btn.onclick = () => {
    const q = findQuest(btn.dataset.ok);
    S.quests[q.id] = "done"; S.doneAt[q.id] = new Date().toLocaleDateString("zh-TW");
    const before = levelInfo().lv;
    S.xp += q.xp; S.coins += Math.round(q.xp / 2);
    addLog(`「${q.title}」獲得家長蓋章！+${q.xp}✨`);
    const c = giveCreature(q.reward);
    save(); refreshNav(); pageParent();
    const after = levelInfo();
    if (c) showCreatureModal(c);
    if (after.lv > before) toast(`🎉 升級！Lv.${after.lv}「${after.title}」`, 3500);
    else toast(`✅ 已蓋章：${q.title}`);
  });
  main.querySelectorAll("[data-no]").forEach(btn => btn.onclick = () => {
    delete S.quests[btn.dataset.no]; addLog(`「${findQuest(btn.dataset.no).title}」再練習一次`); save(); refreshNav(); pageParent();
  });
  $("#spend").onclick = () => {
    if (S.coins < 50) { toast("金幣不夠喔！"); return; }
    S.coins -= 50; addLog("使用 50 金幣兌換獎勵"); save(); refreshNav(); pageParent(); toast("🪙 已扣除 50 金幣");
  };
  $("#ua").onchange = (e) => { S.unlockAll = e.target.checked; save(); toast(S.unlockAll ? "已解鎖所有島嶼" : "已恢復依進度解鎖"); };
  $("#export").onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = "kitchen-quest-save.json"; link.click();
  };
  $("#import").onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => { try { S = Object.assign(defaultState(), JSON.parse(t)); save(); location.reload(); } catch (err) { toast("檔案格式不對"); } });
  };
  $("#reset").onclick = () => {
    if (confirm("確定要清除所有進度嗎？這個動作無法復原。")) { localStorage.removeItem(KEY); location.href = "index.html"; }
  };
}

// ---------- 啟動 ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  renderNav(page);
  ({
    "index.html": pageHome, "island.html": pageIsland, "plate.html": pagePlate,
    "collection.html": pageCollection, "recipes.html": pageRecipes,
    "safety.html": pageSafety, "parent.html": pageParent
  }[page] || pageHome)();
});
