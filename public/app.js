import { COMPONENTS, LEVELS, CASES, getCase } from './cases.js';
import { evaluate, initialBoard, offlineExplanation } from './evaluator.js';

const NODE_W = 132;
const NODE_H = 62;
const BOARD_W = 960;
const BOARD_H = 560;
const MAX_PLACED = 24;
const STORE_KEY = 'sdc-progress-v1';

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) node.append(kid);
  return node;
}

// ───────────── state ─────────────
const boards = new Map(); // caseId -> { nodes, edges }
const hintCount = new Map(); // caseId -> number
const results = new Map(); // caseId -> evaluation (cleared when board changes)
const chats = new Map(); // caseId -> [{ me, text, src }]
let uid = 0;
let levelId = 'beginner';
let caseId = CASES[0].id;

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}
function saveProgress(p) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress just won't persist */
  }
}
let progress = loadProgress(); // { [caseId]: bestScore } for passed cases

const cur = () => getCase(caseId);
function board() {
  if (!boards.has(caseId)) boards.set(caseId, freshBoard(cur()));
  return boards.get(caseId);
}
function freshBoard(c) {
  return {
    nodes: c.fixed.map((n) => ({ id: n.id, type: n.type, label: n.label, x: n.x, y: n.y, fixed: true })),
    edges: c.fixedEdges.map(([a, b]) => ({ id: `fe-${a}-${b}`, a, b, fixed: true })),
  };
}
const passedCount = (lvl) => CASES.filter((c) => c.level === lvl && progress[c.id] != null).length;
function isUnlocked(level) {
  if (level.comingSoon) return false;
  if (!level.unlockAfter) return true;
  return passedCount(level.unlockAfter.level) >= level.unlockAfter.passes;
}
function changed() {
  results.delete(caseId);
  renderResult();
}

// ───────────── header: levels + case list ─────────────
function renderLevels() {
  const nav = $('levels');
  nav.replaceChildren(
    ...LEVELS.map((l) => {
      const ok = isUnlocked(l);
      const title = l.comingSoon ? 'Coming soon' : ok ? l.blurb : `Pass ${l.unlockAfter.passes} ${l.unlockAfter.level} cases to unlock`;
      return el('button', {
        class: 'level-tab',
        role: 'tab',
        'aria-selected': String(l.id === levelId),
        title,
        disabled: !ok,
        text: `${l.label}${ok ? '' : ' 🔒'}`,
        onclick: () => {
          levelId = l.id;
          caseId = CASES.find((c) => c.level === l.id).id;
          renderAll();
        },
      });
    }),
  );
}

function renderCaseList() {
  const list = $('caseList');
  const cases = CASES.filter((c) => c.level === levelId);
  list.replaceChildren(
    ...cases.map((c, i) =>
      el(
        'button',
        {
          class: 'case-btn',
          'aria-current': String(c.id === caseId),
          onclick: () => {
            caseId = c.id;
            renderAll();
          },
        },
        el('span', { text: `${i + 1}. ${c.title}` }),
        progress[c.id] != null ? el('span', { class: 'badge', title: `Best score ${progress[c.id]}`, text: '✓' }) : null,
      ),
    ),
  );
}

function renderBrief() {
  const c = cur();
  $('brief').replaceChildren(
    el('h3', { text: c.title }),
    el('p', { text: c.scenario }),
    el('h2', { text: 'Your goals' }),
    el('ul', {}, c.goals.map((g) => el('li', { text: g }))),
    el('p', { class: 'locked', text: '🔒 Grey blocks are already built. You can’t move them, but you can connect to them.' }),
  );
}

// ───────────── palette ─────────────
function renderPalette() {
  const c = cur();
  $('palette').replaceChildren(
    ...c.palette.map((type) => {
      const meta = COMPONENTS[type];
      const chip = el(
        'div',
        { class: 'chip', draggable: 'true', tabindex: '0', role: 'button', 'aria-label': `Add ${meta.label}`, 'data-type': type, title: 'Drag onto the board, or click / press Enter to add' },
        el('span', { class: 'icon', text: meta.icon }),
        el('span', {}, el('strong', { text: meta.label }), el('small', { text: meta.desc })),
      );
      chip.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', type);
        e.dataTransfer.effectAllowed = 'copy';
      });
      chip.addEventListener('click', () => addAtFreeSpot(type));
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          addAtFreeSpot(type);
        }
      });
      return chip;
    }),
  );
}

// ───────────── board ─────────────
const boardEl = $('board');
const svg = $('edges');
const nodeEls = new Map();

function center(n) {
  return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 };
}
// point where the line from `from` toward `to` leaves the rectangle of `from`
function anchor(from, to) {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return a;
  const t = Math.min(dx ? NODE_W / 2 / Math.abs(dx) : Infinity, dy ? NODE_H / 2 / Math.abs(dy) : Infinity);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

function badSets() {
  const r = results.get(caseId);
  const badNodes = new Set();
  const badEdges = new Set();
  if (!r) return { badNodes, badEdges };
  const b = board();
  const match = (ref, n) => n.id === ref || n.type === ref;
  for (const p of r.problems) {
    if (p.kind === 'component') b.nodes.filter((n) => !n.fixed && n.type === p.nodeType).forEach((n) => badNodes.add(n.id));
    else {
      for (const e of b.edges) {
        const x = b.nodes.find((n) => n.id === e.a);
        const y = b.nodes.find((n) => n.id === e.b);
        if ((match(p.a, x) && match(p.b, y)) || (match(p.a, y) && match(p.b, x))) badEdges.add(e.id);
      }
    }
  }
  return { badNodes, badEdges };
}

function drawEdges(temp) {
  const b = board();
  const { badEdges } = badSets();
  const byId = new Map(b.nodes.map((n) => [n.id, n]));
  const parts = [];
  for (const e of b.edges) {
    const A = byId.get(e.a);
    const B = byId.get(e.b);
    if (!A || !B) continue;
    const p1 = anchor(A, B);
    const p2 = anchor(B, A);
    const d = `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    const cls = `edge-line${e.fixed ? ' fixed' : ''}${badEdges.has(e.id) ? ' bad' : ''}`;
    parts.push(
      `<path class="${cls}" d="${d}"></path>` +
        `<path class="edge-hit${e.fixed ? ' fixed' : ''}" data-edge="${e.id}" d="${d}"><title>${e.fixed ? 'Existing connection (locked)' : 'Click to remove'}</title></path>`,
    );
  }
  if (temp) parts.push(`<path class="edge-temp" d="M${temp.x1},${temp.y1} L${temp.x2},${temp.y2}"></path>`);
  svg.innerHTML = parts.join('');
}

svg.addEventListener('click', (e) => {
  const id = e.target.dataset?.edge;
  if (!id) return;
  const b = board();
  const edge = b.edges.find((x) => x.id === id);
  if (!edge || edge.fixed) return;
  b.edges = b.edges.filter((x) => x.id !== id);
  drawEdges();
  changed();
});

function renderBoard() {
  for (const n of nodeEls.values()) n.remove();
  nodeEls.clear();
  const b = board();
  const { badNodes } = badSets();
  for (const n of b.nodes) {
    const meta = COMPONENTS[n.type];
    const label = n.label || meta.label;
    const node = el(
      'div',
      { class: `node${n.fixed ? ' fixed' : ''}${badNodes.has(n.id) ? ' bad' : ''}`, 'data-id': n.id, title: meta.desc },
      el('span', { class: 'icon', text: meta.icon }),
      el('span', { class: 'name', text: label }),
      n.fixed ? el('span', { class: 'lock', text: '🔒 fixed' }) : el('button', { class: 'del', 'aria-label': `Remove ${label}`, text: '×', onclick: () => removeNode(n.id) }),
      el('span', { class: 'port', title: 'Drag to another block to connect' }),
    );
    node.style.left = `${n.x}px`;
    node.style.top = `${n.y}px`;
    wireNode(node, n);
    boardEl.append(node);
    nodeEls.set(n.id, node);
  }
  drawEdges();
}

function wireNode(node, n) {
  const port = node.querySelector('.port');

  if (!n.fixed) {
    node.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.port, .del')) return;
      e.preventDefault();
      node.setPointerCapture(e.pointerId);
      node.classList.add('dragging');
      const rect = boardEl.getBoundingClientRect();
      const dx = e.clientX - rect.left - n.x;
      const dy = e.clientY - rect.top - n.y;
      const move = (ev) => {
        const r = boardEl.getBoundingClientRect();
        n.x = clamp(ev.clientX - r.left - dx, 0, BOARD_W - NODE_W);
        n.y = clamp(ev.clientY - r.top - dy, 0, BOARD_H - NODE_H);
        node.style.left = `${n.x}px`;
        node.style.top = `${n.y}px`;
        drawEdges();
      };
      const up = () => {
        node.classList.remove('dragging');
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', up);
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
    });
  }

  port.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    port.setPointerCapture(e.pointerId);
    const from = center(n);
    let hover = null;
    const move = (ev) => {
      const r = boardEl.getBoundingClientRect();
      drawEdges({ x1: from.x, y1: from.y, x2: ev.clientX - r.left, y2: ev.clientY - r.top });
      const t = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.node');
      const next = t && t.dataset.id !== n.id ? t : null;
      if (next !== hover) {
        hover?.classList.remove('target');
        next?.classList.add('target');
        hover = next;
      }
    };
    const end = (ev) => {
      port.removeEventListener('pointermove', move);
      port.removeEventListener('pointerup', end);
      port.removeEventListener('pointercancel', end);
      hover?.classList.remove('target');
      const t = ev.type === 'pointerup' ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.node') : null;
      if (t && t.dataset.id !== n.id) connect(n.id, t.dataset.id);
      drawEdges();
    };
    port.addEventListener('pointermove', move);
    port.addEventListener('pointerup', end);
    port.addEventListener('pointercancel', end);
  });
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function connect(a, b) {
  const bd = board();
  if (bd.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
  bd.edges.push({ id: `e${++uid}`, a, b });
  drawEdges();
  changed();
}

function removeNode(id) {
  const bd = board();
  bd.nodes = bd.nodes.filter((n) => n.id !== id);
  bd.edges = bd.edges.filter((e) => e.a !== id && e.b !== id);
  renderBoard();
  changed();
}

function addNode(type, x, y) {
  const bd = board();
  if (bd.nodes.filter((n) => !n.fixed).length >= MAX_PLACED) return;
  bd.nodes.push({ id: `n${++uid}`, type, x: clamp(x, 0, BOARD_W - NODE_W), y: clamp(y, 0, BOARD_H - NODE_H), fixed: false });
  renderBoard();
  changed();
}

function addAtFreeSpot(type) {
  const nodes = board().nodes;
  for (let y = 20; y <= BOARD_H - NODE_H; y += 90) {
    for (let x = 160; x <= BOARD_W - NODE_W; x += 150) {
      if (!nodes.some((n) => Math.abs(n.x - x) < NODE_W + 8 && Math.abs(n.y - y) < NODE_H + 8)) return addNode(type, x, y);
    }
  }
  addNode(type, 20, 20);
}

boardEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  boardEl.classList.add('dragover');
});
boardEl.addEventListener('dragleave', () => boardEl.classList.remove('dragover'));
boardEl.addEventListener('drop', (e) => {
  e.preventDefault();
  boardEl.classList.remove('dragover');
  const type = e.dataTransfer.getData('text/plain');
  if (!cur().palette.includes(type)) return;
  const r = boardEl.getBoundingClientRect();
  addNode(type, e.clientX - r.left - NODE_W / 2, e.clientY - r.top - NODE_H / 2);
});

// ───────────── check / hints / result ─────────────
function toEvalBoard() {
  const b = board();
  return {
    nodes: b.nodes.map((n) => ({ id: n.id, type: n.type, fixed: n.fixed })),
    edges: b.edges.map((e) => ({ a: e.a, b: e.b })),
  };
}

function check() {
  const c = cur();
  const r = evaluate(c, toEvalBoard());
  results.set(caseId, r);
  if (r.passed && (progress[caseId] == null || progress[caseId] < r.score)) {
    progress[caseId] = r.score;
    saveProgress(progress);
    renderLevels();
    renderCaseList();
  }
  renderBoard();
  renderResult();
}

function renderResult() {
  const box = $('result');
  const r = results.get(caseId);
  const c = cur();
  const kids = [];
  if (r) {
    kids.push(
      el('div', { class: `score${r.passed ? ' pass' : ''}`, text: r.passed ? `✅ Correct! Score ${r.score}/100` : `Score ${r.score}/100 · ${r.satisfied}/${r.total} requirements met` }),
      el(
        'ul',
        { class: 'checks' },
        r.checks.map((k) => el('li', { class: k.ok ? 'ok' : 'no' }, k.label, k.ok ? el('span', { class: 'why', text: k.why }) : null)),
        r.problems.map((p) => el('li', { class: 'problem', text: p.message })),
      ),
    );
    if (r.passed) {
      const next = CASES.filter((x) => x.level === c.level)[CASES.filter((x) => x.level === c.level).indexOf(c) + 1];
      if (next) kids.push(el('button', { class: 'primary', text: `Next: ${next.title} →`, onclick: () => { caseId = next.id; renderAll(); } }));
    }
  }
  const n = hintCount.get(caseId) || 0;
  for (let i = 0; i < n; i++) kids.push(el('div', { class: 'hint', text: `💡 Hint ${i + 1}: ${c.hints[i]}` }));
  box.replaceChildren(...kids);
  $('hintBtn').disabled = n >= c.hints.length;
}

$('checkBtn').addEventListener('click', check);
$('hintBtn').addEventListener('click', () => {
  hintCount.set(caseId, Math.min((hintCount.get(caseId) || 0) + 1, cur().hints.length));
  renderResult();
});
$('resetBtn').addEventListener('click', () => {
  boards.delete(caseId);
  results.delete(caseId);
  renderBoard();
  renderResult();
});

// ───────────── tutor chat ─────────────
function renderChat() {
  const log = chats.get(caseId) || [];
  const box = $('chat');
  box.replaceChildren(
    ...(log.length ? log : [{ me: false, text: 'Stuck or curious why a component helps? Ask me. I explain the ideas; the grading is based on the answer key.' }]).map((m) =>
      el('div', { class: `msg${m.me ? ' me' : ''}` }, m.text, m.src ? el('span', { class: 'src', text: m.src }) : null),
    ),
  );
  box.scrollTop = box.scrollHeight;
}

$('askForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('question');
  const question = input.value.trim();
  const id = caseId;
  const log = chats.get(id) || [];
  chats.set(id, log);
  log.push({ me: true, text: question || 'Explain this case and give me a nudge.' });
  input.value = '';
  const pending = { me: false, text: 'Thinking…' };
  log.push(pending);
  renderChat();

  const b = boards.get(id) || freshBoard(getCase(id));
  const payload = {
    caseId: id,
    question,
    board: { nodes: b.nodes.map((n) => ({ id: n.id, type: n.type })), edges: b.edges.map((x) => ({ a: x.a, b: x.b })) },
  };
  try {
    const res = await fetch('/api/explain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    pending.text = data.answer;
    pending.src = data.source === 'llm' ? 'AI tutor' : 'Built-in explanation';
  } catch {
    // static hosting / server down: fall back to the explanation stored with the case
    const c = getCase(id);
    pending.text = offlineExplanation(c, evaluate(c, { nodes: b.nodes.map((n) => ({ id: n.id, type: n.type, fixed: n.fixed })), edges: b.edges }));
    pending.src = 'Built-in explanation (tutor offline)';
  }
  if (caseId === id) renderChat();
});

// ───────────── boot ─────────────
function renderAll() {
  renderLevels();
  renderCaseList();
  renderBrief();
  renderPalette();
  renderBoard();
  renderResult();
  renderChat();
}
renderAll();
