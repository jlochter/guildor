import { Session } from "./record.js";
import { CURRENT } from "./rulesets/index.js";
import { ALLOC_KEYS } from "./rulesets/sandbox.js";
import { encodeShare, recordFromShare } from "./share.js";
import { verify } from "./verify.js";

const $ = (id) => document.getElementById(id);
const short = (h) => (h ? `${h.slice(7, 15)}…${h.slice(-6)}` : "");

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

// ---------- seeds ----------

const dailySeed = () => `daily-${new Date().toISOString().slice(0, 10)}`;
function randomSeed() {
  const b = crypto.getRandomValues(new Uint8Array(5));
  return "r-" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- local progress (per-viewer convenience; game works without it) ----------

const STORE = "guildor.progress.v1";
function saveProgress(seed, actions) {
  try { localStorage.setItem(STORE, JSON.stringify({ seed, actions })); } catch {}
}
function loadProgress(seed) {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || "null");
    return p && p.seed === seed && Array.isArray(p.actions) ? p.actions : [];
  } catch { return []; }
}
function clearProgress() {
  try { localStorage.removeItem(STORE); } catch {}
}

// ---------- play ----------

const TEXT = {
  gather: { name: "Gather", desc: "Collect materials. They arrive next turn." },
  hire: { name: "Hire", desc: "Recruit warriors with materials you have now." },
  craft: { name: "Craft", desc: "Forge gear with materials left after hiring." },
};

let game = null; // { session, alloc, actions }

function startGame(seed) {
  const session = new Session(new CURRENT(), seed);
  const actions = [];
  for (const a of loadProgress(seed)) {
    try { session.step(a); actions.push(a); } catch { break; }
  }
  game = { session, actions, alloc: emptyAlloc() };
  if (session.done) return showResult();
  show("play");
  renderStatic();
  renderTurn();
}

const emptyAlloc = () => Object.fromEntries(ALLOC_KEYS.map((k) => [k, 0]));

function renderStatic() {
  const s = game.session.rules.spec();
  $("seed-label").textContent = game.session.seed;
  $("rules").replaceChildren(
    h("li", {}, `${s.turns} turns, ${s.energy} energy per turn. Spend all of it.`),
    h("li", {}, `Gather: each point yields ${s.yield_min}–${s.yield_max} materials (shown each turn), delivered next turn.`),
    h("li", {}, `Hire: ${s.hire_cost} materials per warrior. Resolved before crafting.`),
    h("li", {}, `Craft: ${s.craft_cost} materials per gear. Points you can't afford are wasted.`),
    h("li", {}, `Battle: ${s.warrior_dmg} damage per warrior, +${s.gear_dmg} per warrior with gear.`),
    h("li", {}, "No undo."),
  );
}

function renderTurn() {
  const { session, alloc } = game;
  const rules = session.rules;
  const spec = rules.spec();
  const st = session.state;
  const turn = st.turn + 1;
  const last = turn === spec.turns;

  $("turn-title").textContent = `Turn ${turn} of ${spec.turns}`;
  $("pips").replaceChildren(
    ...Array.from({ length: spec.turns }, (_, i) => h("span", { class: i < st.turn ? "done" : i === st.turn ? "now" : "" })),
  );

  const stat = (label, value, sub) => h("div", {}, h("dt", {}, label), h("dd", {}, String(value), sub ? h("span", { class: "sub" }, ` ${sub}`) : null));
  $("stats").replaceChildren(
    stat("Materials", st.materials),
    stat("Arriving", st.incoming, "next turn"),
    stat("Warriors", st.warriors),
    stat("Gear", st.gear),
  );

  $("yield-hint").textContent = last
    ? `Final turn: gathered materials would arrive after the battle. Yield is ${st.yield} per point.`
    : `This turn each gather point yields ${st.yield} materials.`;

  const used = ALLOC_KEYS.reduce((t, k) => t + alloc[k], 0);
  const left = spec.energy - used;
  const r = rules.resolve(st, alloc);

  const effect = {
    gather: () => [`+${r.gathered} materials ${last ? "after the battle" : "next turn"}`],
    hire: () => [
      `+${r.hired} warriors · −${r.hired * spec.hire_cost} materials`,
      alloc.hire > r.hired ? h("span", { class: "warn" }, ` · ${alloc.hire - r.hired} wasted`) : null,
    ],
    craft: () => [
      `+${r.crafted} gear · −${r.crafted * spec.craft_cost} materials`,
      alloc.craft > r.crafted ? h("span", { class: "warn" }, ` · ${alloc.craft - r.crafted} wasted`) : null,
    ],
  };

  $("alloc").replaceChildren(
    ...ALLOC_KEYS.map((k) => {
      const set = (d) => { alloc[k] += d; renderTurn(); };
      return h("div", { class: "row" },
        h("div", {},
          h("div", { class: "name" }, TEXT[k].name),
          h("div", { class: "desc" }, TEXT[k].desc),
          h("div", { class: "effect" }, effect[k]()),
        ),
        h("div", { class: "stepper" },
          h("button", { type: "button", "aria-label": `Less ${TEXT[k].name}`, disabled: alloc[k] === 0, onclick: () => set(-1) }, "−"),
          h("output", { "aria-label": TEXT[k].name }, String(alloc[k])),
          h("button", { type: "button", "aria-label": `More ${TEXT[k].name}`, disabled: left === 0, onclick: () => set(1) }, "+"),
        ),
      );
    }),
  );

  const el = $("energy-left");
  el.textContent = left === 0 ? `All ${spec.energy} energy assigned` : `${left} of ${spec.energy} energy left`;
  el.classList.toggle("zero", left === 0);
  $("btn-end").disabled = left !== 0;
  $("btn-end").textContent = last ? "End turn and fight" : "End turn";

  renderLog();
}

function renderLog() {
  const items = game.session.turns.map((t) =>
    h("li", {}, `${ALLOC_KEYS.map((k) => `${TEXT[k].name.toLowerCase()} ${t.action[k]}`).join(", ")}`),
  );
  $("log").replaceChildren(...(items.length ? items : [h("li", { class: "muted" }, "No turns yet.")]));
}

function endTurn() {
  const a = { ...game.alloc };
  game.session.step(a);
  game.actions.push(a);
  saveProgress(game.session.seed, game.actions);
  game.alloc = emptyAlloc();
  if (game.session.done) showResult();
  else renderTurn();
}

// ---------- result ----------

let lastRecord = null;

function showResult() {
  const rec = game.session.record();
  lastRecord = rec;
  const st = rec.final_state;
  show("result");
  $("res-score").textContent = rec.score.damage;
  $("res-detail").textContent = `${st.warriors} warriors, ${st.gear} gear · seed ${rec.seed}`;
  $("res-hash").textContent = rec.final_hash;
  $("lnk-verify").href = `#run=${encodeShare(rec)}`;
  $("toast").textContent = "";
}

const shareUrl = (rec) => `${location.origin}${location.pathname}#run=${encodeShare(rec)}`;

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    $("toast").textContent = msg;
  } catch {
    window.prompt("Copy this:", text);
  }
}

function download(rec) {
  const blob = new Blob([JSON.stringify(rec, null, 2) + "\n"], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `guildor-${rec.seed}-${rec.final_hash.slice(7, 15)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

// ---------- verify ----------

function parseInput(text) {
  const t = text.trim();
  if (!t) throw new Error("Paste a link, a share code or a run file.");
  if (t.startsWith("{")) {
    let rec;
    try { rec = JSON.parse(t); } catch { throw new Error("That looks like JSON but doesn't parse."); }
    return { record: rec, source: "file", hashMatches: true };
  }
  const code = t.includes("#run=") ? t.split("#run=")[1] : t;
  const { record, hashMatches, claimedHash } = recordFromShare(code);
  return { record, source: "link", hashMatches, claimedHash };
}

function runVerify(text) {
  const out = $("verify-out");
  let parsed;
  try {
    parsed = parseInput(text);
  } catch (e) {
    out.replaceChildren(statusBox(false, "Could not verify", [e.message]));
    return;
  }
  const { record, source, hashMatches } = parsed;
  const res = verify(record);
  const errors = [...res.errors];
  if (!hashMatches) errors.unshift("The link's claimed hash doesn't match the replayed game: the link was altered.");
  const ok = res.ok && hashMatches;

  const rows = (res.replay.length ? res.replay : []).map((r) =>
    h("tr", {},
      h("td", {}, String(r.turn)),
      h("td", {}, ALLOC_KEYS.map((k) => r.action[k]).join(" / ")),
      h("td", {}, String(r.state.materials)),
      h("td", {}, String(r.state.warriors)),
      h("td", {}, String(r.state.gear)),
      h("td", { class: "hash-cell" }, short(r.hash), " ", h("span", { class: r.match ? "tick" : "cross" }, r.match ? "✓" : "✗")),
    ),
  );

  out.replaceChildren(
    h("div", { class: "card verdict" },
      statusBox(ok, ok ? `Verified: ${res.score.damage} damage` : "Not valid", ok ? [] : errors),
      h("dl", { class: "kv" },
        h("dt", {}, "Seed"), h("dd", {}, h("code", {}, String(record.seed))),
        h("dt", {}, "Rules"), h("dd", {}, `${record.ruleset?.id}@${record.ruleset?.version}`),
        h("dt", {}, "Final hash"), h("dd", {}, h("code", {}, String(record.final_hash))),
        h("dt", {}, "Checked from"), h("dd", {}, source === "link" ? "share link (rebuilt by replay)" : "run file"),
      ),
      rows.length
        ? h("div", { class: "table-wrap" },
            h("table", {},
              h("thead", {}, h("tr", {}, ...["Turn", "Gather / Hire / Craft", "Materials", "Warriors", "Gear", "State hash"].map((x) => h("th", {}, x)))),
              h("tbody", {}, rows),
            ))
        : null,
      h("div", { class: "actions" },
        h("a", { class: "button", href: `#play/${encodeURIComponent(record.seed)}` }, "Play this seed"),
      ),
    ),
  );
}

function statusBox(ok, title, errors) {
  return h("div", { class: `status ${ok ? "ok" : "bad"}` },
    h("span", { class: "big", "aria-hidden": "true" }, ok ? "✓" : "✗"),
    h("div", {}, title, errors.length ? h("ul", {}, errors.map((e) => h("li", {}, e))) : null),
  );
}

// ---------- routing ----------

function show(view) {
  for (const v of ["play", "result", "verify"]) $(`view-${v}`).hidden = v !== view;
  for (const a of document.querySelectorAll("[data-nav]")) {
    const active = a.dataset.nav === view || (view === "result" && a.dataset.nav === "play");
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

function route() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("run=")) {
    show("verify");
    $("verify-input").value = location.href;
    runVerify(location.href);
  } else if (hash === "verify") {
    show("verify");
    $("verify-out").replaceChildren();
  } else if (hash.startsWith("play/")) {
    startGame(decodeURIComponent(hash.slice(5)) || dailySeed());
  } else {
    startGame(dailySeed());
  }
  window.scrollTo(0, 0);
}

function newGame(seed) {
  clearProgress();
  const target = seed === dailySeed() ? "#" : `#play/${encodeURIComponent(seed)}`;
  if (location.hash === target || (target === "#" && location.hash === "")) startGame(seed);
  else location.hash = target;
}

$("btn-end").addEventListener("click", endTurn);
$("btn-daily").addEventListener("click", () => newGame(dailySeed()));
$("btn-random").addEventListener("click", () => newGame(randomSeed()));
$("btn-again").addEventListener("click", () => newGame(game.session.seed));
$("btn-copy-link").addEventListener("click", () => copy(shareUrl(lastRecord), "Link copied. Anyone who opens it replays and checks your run."));
$("btn-download").addEventListener("click", () => download(lastRecord));
$("btn-verify").addEventListener("click", () => runVerify($("verify-input").value));
$("verify-file").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const text = await f.text();
  $("verify-input").value = text;
  runVerify(text);
  e.target.value = "";
});
window.addEventListener("hashchange", route);
route();
