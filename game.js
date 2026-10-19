'use strict';
/* Pen Game. Physics: Matter.js (fixed 240 Hz sub-steps). Turn rules: rules.js. Rendering only reads state. */
if (typeof Matter === 'undefined') { document.body.textContent = 'Matter.js did not load. Check your connection and reload.'; throw new Error('Matter.js missing'); }
const { Engine, Bodies, Body, Composite, Events } = Matter, $ = s => document.querySelector(s);
const PENS = [
  { n: 'Blue', c: '#2f6fdb', u: '#5b92f0', k: 'ball' }, { n: 'Black', c: '#1d1d22', u: '#9aa0b4', k: 'ball' },
  { n: 'Red', c: '#d6303f', u: '#ff5b6b', k: 'ball' }, { n: 'Clear', c: '#bfe3f0', u: '#8fd3ee', k: 'clear' },
  { n: 'Green', c: '#2fa561', u: '#4fd48a', k: 'stud' }, { n: 'Gold', c: '#e0a526', u: '#f2c14e', k: 'stud' }];
const PL = 120, PW = 15, M = 56, VMIN = 3, MAXD = 170, MIND = 14, FA = .035, DECAY = 27, POW = { soft: 15, normal: 21, strong: 27 };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, KEY = 'pengame.v1';

/* ---------- settings + stats (localStorage, tolerant of missing/corrupt data) ---------- */
function load() {
  let s = {}; try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { }
  if (typeof s !== 'object') s = {};
  const o = {
    n: Math.min(6, Math.max(2, Math.round(+s.n) || 4)),
    ai: Array.from({ length: 6 }, (_, i) => Array.isArray(s.ai) ? +!!s.ai[i] : +(i > 0)),
    names: Array.isArray(s.names) ? s.names.slice(0, 6).map(String) : [],
    pens: Array.isArray(s.pens) && s.pens.map(Number).sort().join() === '0,1,2,3,4,5' ? s.pens.map(Number) : [0, 1, 2, 3, 4, 5],
    diff: ['easy', 'medium', 'hard'].includes(s.diff) ? s.diff : 'medium', power: Object.keys(POW).includes(s.power) ? s.power : 'normal',
    assist: s.assist !== false, sound: s.sound !== false, vol: s.vol != null && Number.isFinite(+s.vol) ? Math.min(1, Math.max(0, +s.vol)) : .6,
    stats: Object.assign({ p: 0, w: 0, e: 0, rs: 0, streak: 0, best: 0, use: {} }, s.stats && typeof s.stats === 'object' ? s.stats : {})
  };
  for (const k of ['p', 'w', 'e', 'rs', 'streak', 'best']) o.stats[k] = Math.max(0, +o.stats[k] || 0);
  if (!o.stats.use || typeof o.stats.use !== 'object') o.stats.use = {};
  return o;
}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };

let S = load(), G = null, paused = false, to = 0, tt = 0, bg = null, W = 1, H = 1, BW = 0, BH = 0, cw = 0, ch = 0, dpr = 1, sc = 1, ox = 0, oy = 0, ac, lastHit = 0, last = 0, acc = 0;
const cv = $('#cv'), ctx = cv.getContext('2d');

/* ---------- audio ---------- */
function sfx(k, v = 1) {
  if (!S.sound || S.vol <= 0) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = { flick: [260, 90, .1], hit: [190 + v * 6, 70, .13], fall: [380, 50, .45] }[k];
    o.type = k === 'hit' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + f[2]);
    g.gain.setValueAtTime(S.vol * Math.min(.35, .08 + v * .012), t); g.gain.exponentialRampToValueAtTime(.001, t + f[2]);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + f[2] + .02);
  } catch { }
}

/* ---------- match setup ---------- */
function start(cfg) {
  clearTimeout(to); paused = false; G = null; show(null); $('#game').hidden = false; fit();
  const por = ch > cw; BW = por ? 520 : 900; BH = por ? 900 : 520; W = BW + 2 * M; H = BH + 2 * M; fit();
  const eng = Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, positionIterations: 8, velocityIterations: 6 }), pts = [], pl = [];
  for (let i = 0; i < cfg.n; i++) {
    let x, y, k = 0;
    do { x = M + 110 + Math.random() * (BW - 220); y = M + 110 + Math.random() * (BH - 220); k++; } while (k < 300 && pts.some(q => Math.hypot(q.x - x, q.y - y) < 150));
    pts.push({ x, y });
    const body = Bodies.rectangle(x, y, PL, PW, { angle: Math.random() * 6.283, frictionAir: FA, friction: .25, frictionStatic: .5, restitution: .45, density: .0016, chamfer: { radius: 6 } });
    pl.push({ i, name: (cfg.names[i] || '').trim() || (cfg.ai[i] ? 'AI ' : 'Player ') + (i + 1), ai: !!cfg.ai[i], pen: S.pens[i], body, alive: true, fall: 0, rank: 0, elims: 0 });
  }
  Composite.add(eng.world, pl.map(p => p.body)); Engine.update(eng, 1000 / 240);
  Events.on(eng, 'collisionStart', e => {
    for (const p of e.pairs) { const a = p.bodyA, b = p.bodyB, v = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y); if (v > 1.2) hit(v, (p.collision.supports && p.collision.supports[0]) || a.position); }
  });
  G = { cfg, eng, pl, cur: 0, st: 'ready', calm: 0, mt: 0, shake: 0, fx: [], drag: null, diff: S.diff, vmax: POW[S.power], assist: S.assist };
  bake(); hud(); sched();
}

/* ---------- turn flow ---------- */
const isOut = b => b.position.x < M - 2 || b.position.x > M + BW + 2 || b.position.y < M - 2 || b.position.y > M + BH + 2; // centre crossed the edge
function flick(p, ux, uy, v) {
  G.pl.forEach(q => { if (!q.fall) q.body.frictionAir = FA; });
  Body.setVelocity(p.body, { x: ux * v, y: uy * v }); Body.setAngularVelocity(p.body, (Math.random() - .5) * .03);
  G.st = 'move'; G.mt = 0; G.calm = 0; sfx('flick', v / 3);
}
function tick(now) { // one fixed 1/60 s tick, after its 4 physics sub-steps
  for (const p of G.pl) {
    if (!p.alive) continue; const b = p.body;
    if (!p.fall && isOut(b)) { p.fall = now; b.collisionFilter.mask = 0; b.frictionAir = .1; sfx('fall'); }
    else if (!p.fall && b.speed < .07 && Math.abs(b.angularVelocity) < .002) { Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngularVelocity(b, 0); }
  }
  if (G.st !== 'move') return;
  const still = G.pl.every(p => !p.alive || p.fall || (p.body.speed < .12 && Math.abs(p.body.angularVelocity) < .004));
  G.calm = still ? G.calm + 1 : 0;
  if (++G.mt === 420) G.pl.forEach(p => { p.body.frictionAir = .2; }); // nothing runs forever
  if (G.calm >= 36) resolveTurn(); // settle delay before judging the turn
}
function resolveTurn() {
  const gone = G.pl.filter(p => p.alive && p.fall), who = G.pl[G.cur], rk = Rules.rank(G.pl.filter(p => p.alive).length, gone.length);
  const r = Rules.resolve(G.pl, gone.map(p => p.i));
  gone.forEach(p => { p.rank = rk; if (p !== who) who.elims++; });
  if (gone.length) toast(gone.map(p => p.name).join(', ') + ' out!');
  if (r.over) return finish(r);
  G.cur = Rules.nextTurn(G.pl, G.cur); G.st = 'ready'; hud(); sched();
}
function finish(r) {
  G.st = 'over'; if (r.winner >= 0) G.pl[r.winner].rank = 1; hud();
  const me = G.pl[0];
  if (!me.ai) { const s = S.stats; s.p++; if (r.winner === 0) { s.w++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0; s.e += me.elims; s.rs += me.rank || 1; s.use[me.pen] = (s.use[me.pen] || 0) + 1; save(); }
  $('#et').textContent = r.draw ? 'Draw: the last pens fell together' : G.pl[r.winner].name + ' wins!';
  $('#es').replaceChildren(...[...G.pl].sort((a, b) => a.rank - b.rank).map(p => { const li = document.createElement('li'); li.textContent = `${p.name}: ${p.elims} knock-out${p.elims === 1 ? '' : 's'}`; return li; }));
  clearTimeout(to); to = setTimeout(() => show('end'), 900);
}
function sched() { clearTimeout(to); if (G.pl[G.cur].ai) to = setTimeout(aiMove, 700 + Math.random() * 500); }

/* ---------- AI: same flick() and physics as humans ---------- */
const edge = (q, ux, uy) => { // distance a pen at q can travel along (ux,uy) before leaving the bench
  let t = 1e9;
  if (ux > 1e-6) t = Math.min(t, (M + BW - q.x) / ux); else if (ux < -1e-6) t = Math.min(t, (M - q.x) / ux);
  if (uy > 1e-6) t = Math.min(t, (M + BH - q.y) / uy); else if (uy < -1e-6) t = Math.min(t, (M - q.y) / uy);
  return Math.max(0, t);
};
function aiMove() {
  if (!G || G.st !== 'ready') return; if (paused) { to = setTimeout(aiMove, 300); return; }
  const me = G.pl[G.cur], m = me.body.position, lv = ['easy', 'medium', 'hard'].indexOf(G.diff);
  const ts = G.pl.filter(p => p.alive && !p.fall && p !== me).map(t => {
    const q = t.body.position, d = Math.hypot(q.x - m.x, q.y - m.y) || 1, ux = (q.x - m.x) / d, uy = (q.y - m.y) / d, room = edge(q, ux, uy);
    return { d, ux, uy, room, s: -room - .25 * d };
  }).sort((a, b) => b.s - a.s);
  if (!ts.length) return;
  const t = lv === 0 ? ts[Math.random() * ts.length | 0] : lv === 1 && ts.length > 1 && Math.random() < .35 ? ts[1] : ts[0];
  const a = Math.atan2(t.uy, t.ux) + [.3, .1, .025][lv] * (Math.random() * 2 - 1);
  let v = t.d / DECAY * (lv === 2 ? 1.3 : 1.6) + 5;
  if (lv === 2 && t.room < 70) v = t.d / DECAY * 1.1 + 3.5; // hard: don't follow the target off the bench
  if (lv === 0) v *= .55 + Math.random() * .5;
  flick(me, Math.cos(a), Math.sin(a), Math.max(VMIN, Math.min(G.vmax, v)));
}

/* ---------- input (Pointer Events: mouse, touch, pen) ---------- */
const toWorld = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc }; };
function aim() {
  const p = G.pl[G.cur].body.position, w = G.drag.w, dx = p.x - w.x, dy = p.y - w.y, l = Math.hypot(dx, dy) || 1; // launch = opposite of drag
  return { ux: dx / l, uy: dy / l, pw: l < MIND ? 0 : Math.min(1, l / MAXD) };
}
cv.addEventListener('pointerdown', e => {
  if (!G || paused || G.st !== 'ready' || e.button > 0) return; const p = G.pl[G.cur]; if (p.ai) return;
  const w = toWorld(e); if (Math.hypot(w.x - p.body.position.x, w.y - p.body.position.y) > 70) return;
  cv.setPointerCapture(e.pointerId); G.drag = { id: e.pointerId, w }; G.st = 'aim'; e.preventDefault();
});
cv.addEventListener('pointermove', e => { if (G && G.drag && e.pointerId === G.drag.id) G.drag.w = toWorld(e); });
const release = (e, fire) => {
  if (!G || !G.drag || e.pointerId !== G.drag.id) return;
  const d = aim(); G.drag = null;
  if (fire && d.pw > 0) flick(G.pl[G.cur], d.ux, d.uy, VMIN + (G.vmax - VMIN) * Math.pow(d.pw, 1.3)); else G.st = 'ready';
};
cv.addEventListener('pointerup', e => release(e, true)); cv.addEventListener('pointercancel', e => release(e, false));
cv.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- rendering ---------- */
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const sh = (hex, a) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, v + a)); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
const col = pw => `hsl(${50 - 50 * pw},85%,55%)`;
function fit() {
  dpr = Math.min(2, devicePixelRatio || 1); const r = cv.getBoundingClientRect(); cw = r.width; ch = r.height;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  sc = Math.min(cw / W, ch / H) || 1; ox = (cw - W * sc) / 2; oy = (ch - H * sc) / 2; if (BW) bake();
}
function bake() { // floor + wooden bench, drawn once per size
  if (!cv.width) return; bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
  const c = bg.getContext('2d'); c.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
  let g = c.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, Math.max(W, H)); g.addColorStop(0, '#16161b'); g.addColorStop(1, '#050505');
  c.fillStyle = g; c.fillRect(-ox / sc, -oy / sc, cw / sc, ch / sc);
  c.save(); c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = 36 * dpr * sc; c.shadowOffsetY = 14 * dpr * sc;
  g = c.createLinearGradient(M, M, M + BW, M + BH); g.addColorStop(0, '#c0904f'); g.addColorStop(.5, '#a9763a'); g.addColorStop(1, '#b4834a');
  rr(c, M, M, BW, BH, 26); c.fillStyle = g; c.fill(); c.restore();
  c.save(); rr(c, M, M, BW, BH, 26); c.clip(); let s = 7; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647, por = BH > BW;
  for (let i = 0; i < 160; i++) { // grain along the long axis
    const x = M + rnd() * BW, y = M + rnd() * BH, l = 120 + rnd() * 380, dk = rnd() > .5;
    c.strokeStyle = `rgba(${dk ? '70,40,15' : '230,190,130'},${.05 + rnd() * .1})`; c.lineWidth = .6 + rnd() * 1.6; c.beginPath(); c.moveTo(x, y);
    if (por) c.bezierCurveTo(x + 6, y + l / 3, x - 6, y + 2 * l / 3, x + 2, y + l); else c.bezierCurveTo(x + l / 3, y + 6, x + 2 * l / 3, y - 6, x + l, y + 2); c.stroke();
  }
  for (let i = 0; i < 14; i++) { const x = M + rnd() * BW, y = M + rnd() * BH, a = rnd() * 6.283, l = 10 + rnd() * 40; c.strokeStyle = 'rgba(255,235,200,.16)'; c.lineWidth = .8; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  c.restore();
  rr(c, M, M, BW, BH, 26); c.lineWidth = 7; c.strokeStyle = '#6e4624'; c.stroke(); // bevel
  rr(c, M + 4, M + 4, BW - 8, BH - 8, 22); c.lineWidth = 2; c.strokeStyle = 'rgba(255,225,170,.45)'; c.stroke();
}
function drawPen(c, p, now) {
  const b = p.body, k = PENS[p.pen], L = PL / 2; let a = b.angle, x = b.position.x, y = b.position.y, al = 1, s = 1;
  if (p.fall) { const t = reduce ? 1 : Math.min(1, (now - p.fall) / 700); y += t * t * 70; a += t * .9; s = 1 - .35 * t; al = 1 - t; if (al <= .02) return; } // drop below the surface
  c.save(); c.globalAlpha = al * .3; c.translate(x + 3, y + 5); c.rotate(a); c.scale(s, s); c.fillStyle = '#000'; rr(c, -L, -PW / 2, PL, PW, 7); c.fill(); c.restore();
  c.save(); c.globalAlpha = al; c.translate(x, y); c.rotate(a); c.scale(s, s);
  const g = c.createLinearGradient(0, -PW / 2, 0, PW / 2); g.addColorStop(0, sh(k.c, 55)); g.addColorStop(.4, k.c); g.addColorStop(1, sh(k.c, -50));
  rr(c, -L, -PW / 2, PL - 22, PW, 7); c.fillStyle = k.k === 'clear' ? 'rgba(190,225,240,.55)' : g; c.fill();
  if (k.k === 'clear') { c.fillStyle = '#2a58c8'; c.fillRect(-L + 18, -1.6, PL - 56, 3.2); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; rr(c, -L + .5, -PW / 2 + .5, PL - 23, PW - 1, 7); c.stroke(); }
  if (k.k === 'stud') { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(-L + 30, -PW / 2, 6, PW); }
  c.fillStyle = k.k === 'clear' ? '#1c3f9a' : sh(k.c, -35); rr(c, -L, -PW / 2, 24, PW, 7); c.fill(); // cap
  c.fillStyle = '#c9ccd4'; rr(c, -L + 4, -PW / 2 - 1.4, 30, 3.2, 1.6); c.fill(); // clip
  c.fillStyle = '#d8dae0'; c.beginPath(); c.moveTo(L - 22, -PW / 2 + 1.5); c.lineTo(L - 3, -2.4); c.lineTo(L, 0); c.lineTo(L - 3, 2.4); c.lineTo(L - 22, PW / 2 - 1.5); c.closePath(); c.fill(); // tip
  c.fillStyle = k.k === 'clear' ? '#2a58c8' : sh(k.c, -20); c.fillRect(L - 22, -PW / 2 + 1.5, 5, PW - 3);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-L + 8, -PW / 2 + 2.4, PL - 42, 1.6); // highlight
  c.restore();
}
function draw(now) {
  const c = ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#050505'; c.fillRect(0, 0, cv.width, cv.height);
  if (!G || !bg || !bg.width) return;
  let sx = 0, sy = 0; if (G.shake > .3) { sx = (Math.random() - .5) * G.shake; sy = (Math.random() - .5) * G.shake; G.shake *= .88; } else G.shake = 0;
  c.drawImage(bg, sx * dpr, sy * dpr); c.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (ox + sx), dpr * (oy + sy));
  const cur = G.pl[G.cur];
  if (G.st === 'ready' || G.st === 'aim') { const q = cur.body.position; c.globalAlpha = reduce ? .6 : .45 + .25 * Math.sin(now / 220); c.strokeStyle = PENS[cur.pen].u; c.lineWidth = 3; c.beginPath(); c.arc(q.x, q.y, PL / 2 + 12, 0, 6.283); c.stroke(); c.globalAlpha = 1; }
  G.pl.forEach(p => p.fall && drawPen(c, p, now)); G.pl.forEach(p => !p.fall && p.alive && drawPen(c, p, now));
  G.fx = G.fx.filter(f => --f.l > 0); for (const f of G.fx) { f.x += f.vx; f.y += f.vy; c.fillStyle = `rgba(255,236,200,${f.l / 24})`; c.fillRect(f.x, f.y, 3, 3); }
  if (G.drag) {
    const d = aim(), p = cur.body.position, w = G.drag.w; c.lineCap = 'round';
    c.setLineDash([5, 7]); c.strokeStyle = 'rgba(245,245,247,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(w.x, w.y); c.stroke(); // pull-back
    if (d.pw) {
      const l = 40 + d.pw * 170, ex = p.x + d.ux * l, ey = p.y + d.uy * l; c.setLineDash([]); c.strokeStyle = c.fillStyle = col(d.pw); c.lineWidth = 5;
      c.beginPath(); c.moveTo(p.x + d.ux * 30, p.y + d.uy * 30); c.lineTo(ex, ey); c.stroke();
      c.beginPath(); c.moveTo(ex + d.ux * 14, ey + d.uy * 14); c.lineTo(ex - d.uy * 9 - d.ux * 4, ey + d.ux * 9 - d.uy * 4); c.lineTo(ex + d.uy * 9 - d.ux * 4, ey - d.ux * 9 - d.uy * 4); c.fill();
      if (G.assist) { c.setLineDash([2, 10]); c.strokeStyle = 'rgba(245,245,247,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ex + d.ux * 14, ey + d.uy * 14); c.lineTo(ex + d.ux * 234, ey + d.uy * 234); c.stroke(); }
    }
    c.setLineDash([]); c.setTransform(dpr, 0, 0, dpr, 0, 0); // power meter in screen space
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(14, ch - 30, 160, 10); c.fillStyle = col(d.pw); c.fillRect(14, ch - 30, 160 * d.pw, 10);
    c.fillStyle = '#f5f5f7'; c.font = '13px system-ui,sans-serif'; c.fillText((d.pw < .34 ? 'Weak ' : d.pw < .67 ? 'Medium ' : 'Strong ') + Math.round(d.pw * 100) + '%', 14, ch - 38);
  }
}
function hit(v, pt) {
  const n = performance.now(); if (n - lastHit > 45) { lastHit = n; sfx('hit', v); }
  if (reduce) return; if (v > 9) G.shake = Math.max(G.shake, Math.min(7, v * .3));
  for (let i = 0; i < Math.min(6, v | 0); i++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 2.5; if (G.fx.length < 120) G.fx.push({ x: pt.x, y: pt.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 24 }); }
}
function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min(50, t - (last || t)); last = t;
  if (G && !paused) { acc += dt; while (acc >= 1000 / 60) { acc -= 1000 / 60; for (let i = 0; i < 4; i++) Engine.update(G.eng, 1000 / 240); tick(t); if (!G) break; } }
  draw(t);
}

/* ---------- UI ---------- */
function show(id) { document.querySelectorAll('.ov').forEach(o => { o.hidden = o.id !== id; }); if (id) { const f = $(`#${id} button,#${id} input`); if (f) f.focus(); } }
function toast(s) { const e = $('#toast'); e.textContent = s; e.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 2200); }
function hud() {
  $('#chips').replaceChildren(...G.pl.map((p, i) => { const e = document.createElement('span'), d = document.createElement('i'); e.className = 'chip' + (i === G.cur && G.st !== 'over' ? ' cur' : '') + (p.alive ? '' : ' out'); d.style.background = PENS[p.pen].u; e.append(d, p.name); return e; }));
  const p = G.pl[G.cur]; $('#turn').textContent = G.st === 'over' ? 'Match over' : p.ai ? p.name + ' is aiming…' : p.name + ': drag back from your pen';
}
function stats() {
  const s = S.stats, fav = Object.entries(s.use).sort((a, b) => b[1] - a[1])[0];
  $('#stats').innerHTML = [['Played', s.p], ['Won', s.w], ['Knock-outs', s.e], ['Avg rank', s.p ? (s.rs / s.p).toFixed(1) : '-'], ['Best streak', s.best], ['Favorite pen', fav && PENS[fav[0]] ? PENS[fav[0]].n : '-']].map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');
}
function rows() {
  const box = $('#rows'); box.replaceChildren();
  for (let i = 0; i < S.n; i++) {
    const r = document.createElement('div'), d = document.createElement('i'), nm = document.createElement('input'), ty = document.createElement('select'), pn = document.createElement('select');
    r.className = 'row'; d.style.background = PENS[S.pens[i]].u;
    nm.value = S.names[i] || ''; nm.placeholder = 'Player ' + (i + 1); nm.maxLength = 14; nm.setAttribute('aria-label', 'Name, player ' + (i + 1)); nm.oninput = () => { S.names[i] = nm.value; save(); };
    ty.innerHTML = '<option value="0">Human</option><option value="1">AI</option>'; ty.value = S.ai[i]; ty.setAttribute('aria-label', 'Player ' + (i + 1) + ' type'); ty.onchange = () => { S.ai[i] = +ty.value; save(); };
    pn.innerHTML = PENS.map((p, k) => `<option value="${k}">${p.n}</option>`).join(''); pn.value = S.pens[i]; pn.setAttribute('aria-label', 'Player ' + (i + 1) + ' pen');
    pn.onchange = () => { const j = S.pens.indexOf(+pn.value); [S.pens[i], S.pens[j]] = [S.pens[j], S.pens[i]]; save(); rows(); };
    r.append(d, nm, ty, pn); box.append(r);
  }
  $('#nv').textContent = S.n;
}
function pause(on) {
  if (!G || G.st === 'over') return; paused = on;
  if (on) { G.drag = null; if (G.st === 'aim') G.st = 'ready'; show('pause'); } else show(null);
}
function menu() { clearTimeout(to); G = null; paused = false; $('#game').hidden = true; stats(); show('menu'); }
const on = (id, f) => $(id).addEventListener('click', f);
on('#quick', () => start({ n: 4, ai: [0, 1, 1, 1], names: [S.names[0] || ''] }));
on('#custom', () => { rows(); $('#df').value = S.diff; $('#pw').value = S.power; $('#as').checked = S.assist; $('#sn').checked = S.sound; $('#vo').value = S.vol; show('setup'); });
on('#rules', () => show('how')); on('#hb', () => show('menu')); on('#back', () => { save(); show('menu'); });
on('#go', () => { save(); start({ n: S.n, ai: S.ai.slice(), names: S.names.slice() }); });
on('#nm', () => { S.n = Math.max(2, S.n - 1); save(); rows(); }); on('#np', () => { S.n = Math.min(6, S.n + 1); save(); rows(); });
on('#bp', () => pause(true)); on('#pr', () => pause(false)); on('#br', () => G && start(G.cfg)); on('#er', () => start(G.cfg)); on('#em', menu); on('#pm', menu);
$('#df').onchange = e => { S.diff = e.target.value; save(); }; $('#pw').onchange = e => { S.power = e.target.value; save(); };
$('#as').onchange = e => { S.assist = e.target.checked; save(); }; $('#sn').onchange = e => { S.sound = e.target.checked; save(); };
$('#vo').oninput = e => { S.vol = +e.target.value; save(); sfx('hit', 3); };
addEventListener('resize', fit);
addEventListener('keydown', e => { if (e.key === 'Escape' && G && !$('#game').hidden) pause(!paused); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
fit(); stats(); show('menu'); requestAnimationFrame(loop);
