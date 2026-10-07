// DATA SORTER — WebXR booth game for Pico 4 (PICO Browser) — TNB Genco · Explore the World of PI
// Blue data tokens -> hit with the LEFT saber; red anomaly tokens -> hit with the RIGHT saber.
// Tokens are locked to the beat of the music: silent 3-2-1 countdown, music starts on "GO",
// and every token reaches the sabers exactly on a beat (beat map: assets/beats.json, tools/beats.py).
import * as THREE from 'three';
import { VRButton } from './lib/VRButton.js';

// ---------------------------------------------------------------- config
const params = new URLSearchParams(location.search);
const ROUND = Number(params.get('round')) || 60;   // seconds of music per round (?round=45 to change)
const COUNTDOWN = 3;              // silent countdown before the music starts
const SPAWN_Z = -18, HIT_Z = -0.5, PASS_Z = 0.6;
const HIT_R = 0.2;                // token hit radius (m)
const SABER_LEN = 0.75;
const COL = { navy: 0x050d1c, teal: 0x3fd0c9, blue: 0x1e90d6, amber: 0xf2a541, red: 0xe5484d, green: 0x8fc74e, white: 0xffffff };
const RANKS = [[0, 'PI ROOKIE'], [300, 'DATA ANALYST'], [800, 'ANOMALY HUNTER'], [1500, 'CHIEF DATA OFFICER']];

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL.navy);
scene.fog = new THREE.Fog(COL.navy, 14, 34);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 200);
camera.position.set(0, 1.6, 0.4);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0x9fd6ff, 0x0a1a30, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 4, 3); scene.add(sun);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- environment
const rings = [];
function buildEnvironment() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'); g.fillStyle = '#071629'; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(63,208,201,0.35)'; g.lineWidth = 2;
  const r = 40, w = Math.sqrt(3) * r;
  for (let row = -1; row < 1024 / (1.5 * r) + 1; row++)
    for (let col = -1; col < 1024 / w + 1; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * 1.5 * r;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      g.closePath(); g.stroke();
    }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshBasicMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // the data tunnel: hexagon rings along the token path (they pulse on every beat)
  for (let i = 0; i < 12; i++) {
    const z = -2.5 - i * 2.2, rr = 1.9;
    const pts = [];
    for (let k = 0; k <= 6; k++) { const a = Math.PI / 180 * (60 * k - 90); pts.push(new THREE.Vector3(rr * Math.cos(a), 1.35 + rr * Math.sin(a), z)); }
    const base = 0.55 - i * 0.03;
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: i % 3 === 0 ? COL.green : COL.teal, transparent: true, opacity: base }));
    ring.userData.base = base;
    scene.add(ring); rings.push(ring);
  }

  const n = 1400, pos = new Float32Array(n * 3), colors = new Float32Array(n * 3);
  const palette = [new THREE.Color(0x58aaeb), new THREE.Color(0x4fd1c5), new THREE.Color(0x8fc74e), new THREE.Color(0xc8ecff)];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 18;
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = Math.sin(a) * d - 6;
    const p = palette[Math.floor(Math.random() * palette.length)]; colors.set([p.r, p.g, p.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.85 })));
}
buildEnvironment();

// ---------------------------------------------------------------- canvas panels (text in VR)
function makePanel(wPx, hPx, wM) {
  const c = document.createElement('canvas'); c.width = wPx; c.height = hPx;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, wM * hPx / wPx),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.renderOrder = 10;
  return { c, g: c.getContext('2d'), tex, mesh };
}
function frame(g, w, h, accent = '#3fd0c9') {
  g.clearRect(0, 0, w, h);
  const ch = 34;
  g.beginPath(); g.moveTo(ch, 0); g.lineTo(w, 0); g.lineTo(w, h - ch); g.lineTo(w - ch, h); g.lineTo(0, h); g.lineTo(0, ch); g.closePath();
  g.fillStyle = 'rgba(6,20,40,0.88)'; g.fill(); g.strokeStyle = accent; g.lineWidth = 4; g.stroke();
}
function hexIcon(g, x, y, r, fill) {
  g.beginPath();
  for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
  g.closePath(); g.fillStyle = fill; g.fill();
}
const logos = {};
for (const [k, src] of [['ted', 'assets/ted_white.png'], ['genco', 'assets/genco_white.png']]) {
  const im = new Image(); im.onload = () => { logos[k] = im; drawMenu(); }; im.src = src;
}

const menu = makePanel(1200, 800, 2.4); menu.mesh.position.set(0, 1.55, -2.6); scene.add(menu.mesh);
const hud = makePanel(1100, 200, 2.2); hud.mesh.position.set(0, 2.55, -3.6); scene.add(hud.mesh);
const results = makePanel(1200, 940, 2.4); results.mesh.position.set(0, 1.6, -2.6); scene.add(results.mesh);

function drawMenu() {
  const { g, c, tex } = menu, W = c.width, H = c.height;
  frame(g, W, H);
  if (logos.genco) g.drawImage(logos.genco, 50, 46, 80 * logos.genco.width / logos.genco.height, 80);
  if (logos.ted) g.drawImage(logos.ted, W - 50 - 150, 40, 150, 150 * logos.ted.height / logos.ted.width);
  g.fillStyle = '#8fc74e'; g.font = 'bold 30px Bahnschrift, Segoe UI, Arial'; g.fillText('EXPLORE THE WORLD OF PI', 60, 190);
  g.fillStyle = '#ffffff'; g.font = 'bold 110px Bahnschrift, Segoe UI, Arial'; g.fillText('DATA SORTER', 56, 300);
  g.font = '34px Segoe UI, Arial'; g.fillStyle = '#c9dbea';
  g.fillText('Sort the plant data to the beat.', 60, 360);
  hexIcon(g, 110, 455, 42, '#1e90d6'); hexIcon(g, 110, 565, 42, '#e5484d');
  g.font = 'bold 44px Bahnschrift, Segoe UI, Arial';
  g.fillStyle = '#5fd3e8'; g.fillText('NORMAL DATA  →  LEFT HAND', 175, 470);
  g.fillStyle = '#ff8a7a'; g.fillText('ANOMALY  →  RIGHT HAND', 175, 580);
  g.fillStyle = '#ffffff'; g.font = 'bold 46px Bahnschrift, Segoe UI, Arial';
  g.fillText('Pull BOTH triggers to start', 60, 690);
  g.fillStyle = '#9fb8cc'; g.font = '30px Segoe UI, Arial'; g.fillText('B / Y  ·  back to the game menu', 60, 750);
  tex.needsUpdate = true;
}
drawMenu();

let hudCache = '';
function drawHud(score, combo, mult, timeLeft) {
  const key = `${score}|${combo}|${mult}|${Math.ceil(timeLeft)}`;
  if (key === hudCache) return; hudCache = key;
  const { g, c, tex } = hud, W = c.width, H = c.height;
  frame(g, W, H, '#8fc74e');
  g.font = 'bold 30px Bahnschrift, Segoe UI, Arial'; g.fillStyle = '#9fb8cc';
  g.fillText('SCORE', 50, 62); g.fillText('COMBO', 470, 62); g.fillText('TIME', 860, 62);
  g.font = 'bold 92px Bahnschrift, Segoe UI, Arial'; g.fillStyle = '#ffffff'; g.fillText(String(score), 46, 160);
  g.fillStyle = mult > 1 ? '#8fc74e' : '#ffffff'; g.fillText(`${combo}`, 466, 160);
  const cw = g.measureText(String(combo)).width;
  g.font = 'bold 44px Bahnschrift, Segoe UI, Arial'; g.fillText(mult > 1 ? `x${mult}` : '', 470 + cw + 20, 150);
  g.font = 'bold 92px Bahnschrift, Segoe UI, Arial'; g.fillStyle = timeLeft < 10 ? '#ff8a7a' : '#ffffff';
  g.fillText(String(Math.max(0, Math.ceil(timeLeft))), 856, 160);
  tex.needsUpdate = true;
}

function rankFor(score) { let r = RANKS[0][1]; for (const [s, n] of RANKS) if (score >= s) r = n; return r; }
function loadTop() { try { return JSON.parse(localStorage.getItem('datasorter_top') || '[]'); } catch { return []; } }
function saveTop(list) { try { localStorage.setItem('datasorter_top', JSON.stringify(list)); } catch { /* storage blocked */ } }

function drawResults(st) {
  const { g, c, tex } = results, W = c.width, H = c.height;
  frame(g, W, H, '#8fc74e');
  g.fillStyle = '#8fc74e'; g.font = 'bold 34px Bahnschrift, Segoe UI, Arial'; g.fillText('ROUND COMPLETE', 60, 90);
  g.fillStyle = '#ffffff'; g.font = 'bold 150px Bahnschrift, Segoe UI, Arial'; g.fillText(String(st.score), 56, 240);
  g.font = 'bold 54px Bahnschrift, Segoe UI, Arial'; g.fillStyle = '#5fd3e8'; g.fillText(rankFor(st.score), 60, 320);
  g.font = '36px Segoe UI, Arial'; g.fillStyle = '#c9dbea';
  const tries = st.hits + st.wrong + st.missedA;
  const acc = tries ? Math.round(100 * st.hits / tries) : 0;
  g.fillText(`Accuracy ${acc}%   ·   Anomalies caught ${st.anomCaught} / ${st.anomTotal}   ·   Best combo ${st.bestCombo}`, 60, 390);
  g.fillStyle = '#8fc74e'; g.font = 'bold 34px Bahnschrift, Segoe UI, Arial'; g.fillText("TODAY'S TOP 5", 60, 480);
  const top = loadTop();
  g.font = 'bold 40px Bahnschrift, Segoe UI, Arial';
  top.slice(0, 5).forEach((e, i) => {
    const mine = e.id === st.id;
    g.fillStyle = mine ? '#f2a541' : '#ffffff';
    g.fillText(`${i + 1}.  ${String(e.score).padStart(5, ' ')}   ${e.rank}${mine ? '   ← YOU' : ''}`, 60, 545 + i * 58);
  });
  g.fillStyle = '#ffffff'; g.font = 'bold 40px Bahnschrift, Segoe UI, Arial'; g.fillText('Pull BOTH triggers to play again', 60, 860);
  g.fillStyle = '#9fb8cc'; g.font = '30px Segoe UI, Arial'; g.fillText('B / Y  ·  back to the game menu', 60, 905);
  tex.needsUpdate = true;
}

// ---------------------------------------------------------------- sabers / controllers
const sabers = [];
function makeSaber(index) {
  const grip = renderer.xr.getControllerGrip(index);
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.6, roughness: 0.4 }));
  handle.rotation.x = Math.PI / 2;
  const bladeMat = new THREE.MeshBasicMaterial({ color: COL.white });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, SABER_LEN, 10), bladeMat);
  blade.rotation.x = Math.PI / 2; blade.position.z = -SABER_LEN / 2 - 0.05;
  const glowMat = new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: 0.25 });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SABER_LEN, 10), glowMat);
  glow.rotation.x = Math.PI / 2; glow.position.z = blade.position.z;
  group.add(handle, blade, glow);
  grip.add(group); scene.add(grip);
  const s = { grip, bladeMat, glowMat, hand: null, source: null, base: new THREE.Vector3(), tip: new THREE.Vector3() };
  grip.addEventListener('connected', (e) => {
    s.source = e.data; s.hand = e.data.handedness;
    const col = s.hand === 'left' ? COL.teal : COL.amber;
    bladeMat.color.setHex(col); glowMat.color.setHex(col);
  });
  grip.addEventListener('disconnected', () => { s.source = null; s.hand = null; });
  sabers.push(s);
}
makeSaber(0); makeSaber(1);

function button(hand, idx) {
  for (const s of sabers) if ((hand === 'any' || s.hand === hand) && s.source && s.source.gamepad) {
    const b = s.source.gamepad.buttons[idx]; if (b && (b.pressed || b.value > 0.6)) return true;
  }
  return false;
}
function pulse(hand, strength, ms) {
  for (const s of sabers) if (s.hand === hand && s.source && s.source.gamepad) {
    const h = s.source.gamepad.hapticActuators && s.source.gamepad.hapticActuators[0];
    if (h && h.pulse) h.pulse(strength, ms);
  }
}
function goMenu() {
  const session = renderer.xr.getSession();
  if (session) session.end().finally(() => { location.href = 'index.html'; });
  else location.href = 'index.html';
}

// ---------------------------------------------------------------- music + beat map
const music = new Audio('assets/bgm.mp3');
music.preload = 'auto'; music.volume = 0.75;
let beatMap = { bpm: 118, beat: 60 / 118, offset: 0.16, strength: [] };
fetch('assets/beats.json').then((r) => r.json()).then((b) => { beatMap = b; }).catch(() => { /* fallback grid */ });
let musicOn = false, fadeOut = 0, unlocked = false;
// browsers only allow audio after a user gesture: unlock on the ENTER VR click / first controller select,
// so the music can start by itself exactly on "GO" three seconds later
function unlockAudio() {
  audio();
  if (unlocked) return;
  unlocked = true;
  music.muted = true;
  music.play().then(() => { music.pause(); music.currentTime = 0; music.muted = false; })
    .catch(() => { music.muted = false; unlocked = false; });
}
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
renderer.xr.addEventListener('sessionstart', () => {
  const s = renderer.xr.getSession();
  s.addEventListener('selectstart', unlockAudio);
  s.addEventListener('squeezestart', unlockAudio);
});

// sound effects (synthesised)
let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, slide = 0) {
  const a = audio(), o = a.createOscillator(), gn = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  good: (m) => { tone(660 + 90 * m, 0.09, 'triangle', 0.12); tone(990 + 90 * m, 0.12, 'sine', 0.06); },
  wrong: () => tone(160, 0.25, 'sawtooth', 0.12, -60),
  alarm: () => { tone(880, 0.16, 'square', 0.08); setTimeout(() => tone(660, 0.2, 'square', 0.08), 170); },
  count: () => tone(440, 0.12, 'triangle', 0.16),
  go: () => tone(880, 0.25, 'triangle', 0.18),
};

// ---------------------------------------------------------------- chart (which beats get a token)
function buildChart() {
  const b = beatMap, out = [];
  for (let k = 0; ; k++) {
    const t = b.offset + k * b.beat;
    if (t > ROUND - 0.4) break;
    if (t < 1.0) continue;                                    // first token about a second after "GO"
    const s = b.strength[k] ?? 0.8, p = t / ROUND;
    let take;
    if (p < 0.25) take = k % 2 === 0;                         // warm-up: every other beat
    else if (p < 0.6) take = k % 2 === 0 || s > 0.55;         // build: most beats
    else take = true;                                         // finale: every beat
    if (take) out.push(t);
    if (p >= 0.6 && s > 0.9 && Math.random() < 0.25) out.push(t + b.beat / 2);   // occasional off-beat
  }
  out.sort((a, c) => a - c);
  return out.map((t) => ({ t, speed: 5.5 + 2.5 * (t / ROUND), anomaly: Math.random() < 0.3 + 0.12 * (t / ROUND) }));
}

// song clock: negative during the countdown, then follows the music element (drift-corrected)
let startWall = 0;
function songTime() {
  let t = (performance.now() - startWall) / 1000 - COUNTDOWN;
  if (musicOn && !music.paused && music.currentTime > 0.05) {
    const drift = music.currentTime - t;
    if (Math.abs(drift) > 0.06) { startWall -= drift * 1000; t = music.currentTime; }
  }
  return t;
}

// ---------------------------------------------------------------- tokens, bursts, floating text
const hexGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.07, 6); hexGeo.rotateX(Math.PI / 2);
const ringGeo = new THREE.TorusGeometry(0.24, 0.012, 6, 6);
const tokens = [];
function spawnToken(spec) {
  const mat = new THREE.MeshStandardMaterial({
    color: spec.anomaly ? COL.red : COL.blue, emissive: spec.anomaly ? 0x8a1010 : 0x0b4f80, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.35,
  });
  const mesh = new THREE.Mesh(hexGeo, mat);
  mesh.position.set((Math.random() - 0.5) * 1.1, 1.05 + Math.random() * 0.65, SPAWN_Z);
  if (spec.anomaly) {
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COL.amber }));
    ring.rotation.z = Math.PI / 6; mesh.add(ring);
  }
  scene.add(mesh);
  tokens.push({ mesh, anomaly: spec.anomaly, beatT: spec.t, speed: spec.speed, spin: (Math.random() - 0.5) * 2 });
}
function removeToken(i) { const t = tokens[i]; scene.remove(t.mesh); t.mesh.material.dispose(); tokens.splice(i, 1); }

const bursts = [];
const burstGeo = new THREE.BoxGeometry(0.035, 0.035, 0.035);
function burst(pos, color, n = 16) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos); scene.add(m);
    bursts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3), life: 0.6 });
  }
}
const floaters = [];
function floatText(text, pos, color, size = 1) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); g.font = 'bold 84px Bahnschrift, Segoe UI, Arial'; g.textAlign = 'center';
  g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(text, 256, 96); g.fillStyle = color; g.fillText(text, 256, 96);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.8 * size, 0.2 * size, 1); sp.position.copy(pos); scene.add(sp);
  floaters.push({ sp, life: 0.9 });
}

const flash = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshBasicMaterial({ color: COL.red, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }));
flash.renderOrder = 20; camera.add(flash);

// ---------------------------------------------------------------- game state
let state = 'menu', tState = 0;
let st = null, chart = [], chartIdx = 0, lastCount = 99, lastBeat = -1;
function newStats() { return { id: Date.now(), score: 0, combo: 0, bestCombo: 0, hits: 0, wrong: 0, missedA: 0, anomCaught: 0, anomTotal: 0 }; }
function setState(s) {
  state = s; tState = 0;
  menu.mesh.visible = s === 'menu';
  hud.mesh.visible = s === 'countdown' || s === 'play';
  results.mesh.visible = s === 'end';
  if (s === 'countdown') {
    st = newStats(); hudCache = ''; drawHud(0, 0, 1, ROUND);
    chart = buildChart(); chartIdx = 0; lastCount = 99; lastBeat = -1;
    music.pause(); music.currentTime = 0; music.volume = 0.75; musicOn = false; fadeOut = 0;
    startWall = performance.now();
  }
  if (s === 'end') {
    for (let i = tokens.length - 1; i >= 0; i--) removeToken(i);
    const top = loadTop(); top.push({ id: st.id, score: st.score, rank: rankFor(st.score) });
    top.sort((a, b) => b.score - a.score); saveTop(top.slice(0, 20));
    drawResults(st);
    fadeOut = 1.6;                                            // music fades out over 1.6 s
  }
}
setState('menu');

function multiplier() { return Math.min(4, 1 + Math.floor(st.combo / 8)); }

function scoreHit(tok, hand) {
  const correct = (tok.anomaly && hand === 'right') || (!tok.anomaly && hand === 'left');
  if (tok.anomaly) st.anomTotal++;
  const p = tok.mesh.position.clone();
  if (correct) {
    st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo); st.hits++;
    if (tok.anomaly) st.anomCaught++;
    const pts = 10 * multiplier(); st.score += pts;
    burst(p, tok.anomaly ? COL.amber : COL.teal); floatText(`+${pts}`, p, tok.anomaly ? '#f2a541' : '#5fd3e8');
    pulse(hand, 0.55, 45); sfx.good(multiplier());
  } else {
    st.combo = 0; st.wrong++; st.score = Math.max(0, st.score - 5);
    burst(p, 0x8899aa, 10); floatText('WRONG HAND', p, '#ff8a7a');
    pulse(hand, 1.0, 140); sfx.wrong();
  }
}

const _ab = new THREE.Vector3(), _ap = new THREE.Vector3();
function segDist(p, a, b) {
  _ab.subVectors(b, a); _ap.subVectors(p, a);
  const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
  return _ap.sub(_ab.multiplyScalar(t)).length();
}

// ---------------------------------------------------------------- desktop test controls
const keys = { left: false, right: false, start: false };
addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') keys.left = true;
  if (e.code === 'KeyJ') keys.right = true;
  if (e.code === 'Space') keys.start = true;
  if (e.code === 'KeyM' || e.code === 'Escape') goMenu();
  audio();
});
function desktopSwing(hand) {
  // hit the token closest to the hit plane (within the swing window)
  let best = -1, bz = HIT_Z - 1.6;
  tokens.forEach((t, i) => { const z = t.mesh.position.z; if (z > bz && z < PASS_Z) { best = i; bz = z; } });
  if (best >= 0) { scoreHit(tokens[best], hand); removeToken(best); }
}

window.__ds = () => ({ state, song: +songTime().toFixed(2), music: +music.currentTime.toFixed(2), tokens: tokens.length, chart: chart.length, stats: st && { ...st } });

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let bothWasDown = false, backWasDown = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  tState += dt;
  const inXR = renderer.xr.isPresenting;

  // start / restart: both triggers (VR) or Space (desktop) · back to menu: B / Y
  const bothDown = button('left', 0) && button('right', 0);
  const startPressed = (bothDown && !bothWasDown) || keys.start;
  bothWasDown = bothDown; keys.start = false;
  if (startPressed) { audio(); if (state === 'menu') setState('countdown'); else if (state === 'end' && tState > 2.5) setState('menu'); }
  const backDown = button('any', 5);
  if (backDown && !backWasDown && (state === 'menu' || state === 'end')) goMenu();
  backWasDown = backDown;

  for (const s of sabers) {
    s.grip.updateMatrixWorld(true);
    s.base.set(0, 0, -0.05).applyMatrix4(s.grip.matrixWorld);
    s.tip.set(0, 0, -0.05 - SABER_LEN).applyMatrix4(s.grip.matrixWorld);
  }

  if (state === 'countdown' || state === 'play') {
    const T = songTime();

    // countdown 3-2-1 in silence, music starts exactly on GO
    if (T < 0) {
      const n = Math.ceil(-T);
      if (n !== lastCount && n <= 3) { lastCount = n; sfx.count(); floatText(String(n), new THREE.Vector3(0, 1.6, -2), '#ffffff', 1.6); }
    } else if (!musicOn) {
      music.currentTime = 0; music.play().catch(() => {}); musicOn = true;
      sfx.go(); floatText('GO!', new THREE.Vector3(0, 1.6, -2), '#8fc74e', 1.6);
      setState('play');
    }

    // spawn: each token appears early enough to reach the hit plane on its beat
    while (chartIdx < chart.length && T >= chart[chartIdx].t - (HIT_Z - SPAWN_Z) / chart[chartIdx].speed) spawnToken(chart[chartIdx++]);

    // tunnel pulses on every beat
    const beatIdx = Math.floor((T - beatMap.offset) / beatMap.beat);
    if (T >= 0 && beatIdx !== lastBeat) { lastBeat = beatIdx; rings.forEach((r) => { r.material.opacity = 1; }); }

    // move tokens on the song clock
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i], m = t.mesh;
      m.position.z = HIT_Z - t.speed * (t.beatT - T);
      m.rotation.z += t.spin * dt;
      if (t.anomaly) {
        m.scale.setScalar(1 + 0.12 * Math.sin(performance.now() / 70));
        m.material.emissiveIntensity = 1 + 0.8 * Math.abs(Math.sin(performance.now() / 110));
      }
      let hit = null;
      if (inXR) for (const s of sabers) if (s.hand && segDist(m.position, s.base, s.tip) < HIT_R) { hit = s.hand; break; }
      if (hit) { scoreHit(t, hit); removeToken(i); continue; }
      if (m.position.z > PASS_Z) {
        if (t.anomaly) {
          st.anomTotal++; st.missedA++; st.combo = 0; st.score = Math.max(0, st.score - 10);
          flash.material.opacity = 0.45; sfx.alarm(); floatText('MISSED ANOMALY', new THREE.Vector3(0, 2.0, -1.6), '#ff8a7a');
          pulse('left', 0.8, 120); pulse('right', 0.8, 120);
        } else st.combo = 0;
        removeToken(i);
      }
    }

    if (!inXR && state === 'play') {
      if (keys.left) desktopSwing('left');
      if (keys.right) desktopSwing('right');
    }
    keys.left = keys.right = false;

    drawHud(st.score, st.combo, multiplier(), Math.min(ROUND, ROUND - T));
    if (state === 'play' && T >= ROUND) setState('end');
  }

  // music fade-out after the round
  if (fadeOut > 0) {
    fadeOut -= dt; music.volume = Math.max(0, 0.75 * fadeOut / 1.6);
    if (fadeOut <= 0) { music.pause(); musicOn = false; }
  }

  // effects
  rings.forEach((r) => { r.material.opacity += (r.userData.base - r.material.opacity) * Math.min(1, dt * 6); });
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.life -= dt; b.v.y -= 4 * dt; b.m.position.addScaledVector(b.v, dt);
    b.m.material.opacity = Math.max(0, b.life / 0.6);
    if (b.life <= 0) { scene.remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); }
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.life -= dt; f.sp.position.y += 0.5 * dt; f.sp.material.opacity = Math.max(0, f.life / 0.9);
    if (f.life <= 0) { scene.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); floaters.splice(i, 1); }
  }
  flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.2);

  renderer.render(scene, camera);
});
