// Shared WebXR helpers for the booth games (Coal Stack, Ship Dock Rush).
import * as THREE from 'three';
import { VRButton } from './lib/VRButton.js';

export { THREE };
export const COL = { navy: 0x050d1c, teal: 0x3fd0c9, blue: 0x1e90d6, amber: 0xf2a541, red: 0xe5484d, green: 0x8fc74e, white: 0xffffff };
export const FONT = 'Bahnschrift, Segoe UI, Arial';
export const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- app
export function createApp({ background = COL.navy, fog = [14, 40], far = 300 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  if (fog) scene.fog = new THREE.Fog(background, fog[0], fog[1]);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, far);
  camera.position.set(0, 1.6, 0.4);
  scene.add(camera);
  scene.add(new THREE.HemisphereLight(0x9fd6ff, 0x0a1a30, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(3, 6, 4); scene.add(sun);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });
  return { renderer, scene, camera };
}

export function hexTexture(bg = '#071629', line = 'rgba(63,208,201,0.35)', r = 40) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = line; g.lineWidth = 2;
  const w = Math.sqrt(3) * r;
  for (let row = -1; row < 1024 / (1.5 * r) + 1; row++)
    for (let col = -1; col < 1024 / w + 1; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * 1.5 * r;
      g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      g.closePath(); g.stroke();
    }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function hexFloor(scene, { radius = 30, repeat = 6, y = 0 } = {}) {
  const tex = hexTexture(); tex.repeat.set(repeat, repeat);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshBasicMaterial({ map: tex }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = y; scene.add(floor);
  return floor;
}

export function dataDots(scene, { n = 1200, minR = 4, maxR = 22, cz = -6, maxY = 9, minY = 0 } = {}) {
  const pos = new Float32Array(n * 3), colors = new Float32Array(n * 3);
  const palette = [new THREE.Color(0x58aaeb), new THREE.Color(0x4fd1c5), new THREE.Color(0x8fc74e), new THREE.Color(0xc8ecff)];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = minR + Math.random() * (maxR - minR);
    pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = minY + Math.random() * (maxY - minY); pos[i * 3 + 2] = Math.sin(a) * d + cz;
    const p = palette[Math.floor(Math.random() * palette.length)]; colors.set([p.r, p.g, p.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.85 }));
  scene.add(pts);
  return pts;
}

export function sprite(src, heightM, { billboard = false } = {}) {
  const tex = new THREE.TextureLoader().load(src, (t) => {
    const k = t.image.width / t.image.height;
    obj.scale.set(heightM * k, heightM, 1);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  let obj;
  if (billboard) obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  else obj = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
  obj.scale.set(heightM * 2, heightM, 1);
  return obj;
}

// ---------------------------------------------------------------- canvas panels
export function makePanel(wPx, hPx, wM) {
  const c = document.createElement('canvas'); c.width = wPx; c.height = hPx;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, wM * hPx / wPx),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  mesh.renderOrder = 10;
  return { c, g: c.getContext('2d'), tex, mesh };
}
export function frame(g, w, h, accent = '#3fd0c9', fill = 'rgba(6,20,40,0.88)') {
  g.clearRect(0, 0, w, h);
  const ch = Math.min(34, h / 4);
  g.beginPath(); g.moveTo(ch, 0); g.lineTo(w, 0); g.lineTo(w, h - ch); g.lineTo(w - ch, h); g.lineTo(0, h); g.lineTo(0, ch); g.closePath();
  g.fillStyle = fill; g.fill(); g.strokeStyle = accent; g.lineWidth = 4; g.stroke();
}
export function hexIcon(g, x, y, r, fill) {
  g.beginPath();
  for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
  g.closePath(); g.fillStyle = fill; g.fill();
}

export const logos = {};
const logoWaiters = [];
for (const [k, src] of [['ted', 'assets/ted_white.png'], ['genco', 'assets/genco_white.png']]) {
  const im = new Image(); im.onload = () => { logos[k] = im; logoWaiters.forEach((f) => f()); }; im.src = src;
}
export function onLogos(f) { logoWaiters.push(f); }

/** Title / instructions panel. rows: [{ icon:'#hex', text, color }] */
export function drawMenuPanel(p, { kicker = 'EXPLORE THE WORLD OF PI', title, sub, rows = [], start = 'Pull BOTH triggers to start' }) {
  const { g, c, tex } = p, W = c.width, H = c.height;
  frame(g, W, H);
  if (logos.genco) g.drawImage(logos.genco, 50, 46, 80 * logos.genco.width / logos.genco.height, 80);
  if (logos.ted) g.drawImage(logos.ted, W - 50 - 150, 40, 150, 150 * logos.ted.height / logos.ted.width);
  g.fillStyle = '#8fc74e'; g.font = `bold 30px ${FONT}`; g.fillText(kicker, 60, 190);
  g.fillStyle = '#ffffff'; g.font = `bold 100px ${FONT}`; g.fillText(title, 56, 292);
  g.font = '34px Segoe UI, Arial'; g.fillStyle = '#c9dbea'; g.fillText(sub, 60, 350);
  rows.forEach((r, i) => {
    const y = 440 + i * 86;
    if (r.icon) hexIcon(g, 100, y - 14, 30, r.icon);
    g.font = `bold 38px ${FONT}`; g.fillStyle = r.color || '#ffffff'; g.fillText(r.text, r.icon ? 150 : 60, y);
  });
  g.fillStyle = '#ffffff'; g.font = `bold 44px ${FONT}`; g.fillText(start, 60, H - 100);
  g.fillStyle = '#9fb8cc'; g.font = '30px Segoe UI, Arial'; g.fillText('B / Y  ·  back to the game menu', 60, H - 46);
  tex.needsUpdate = true;
}

/** 3-column HUD: cols = [[label, value, color?], ...] */
export function hudDrawer(p, accent = '#8fc74e') {
  let cache = '';
  return (cols) => {
    const key = JSON.stringify(cols);
    if (key === cache) return; cache = key;
    const { g, c, tex } = p, W = c.width, H = c.height;
    frame(g, W, H, accent);
    const cw = W / cols.length;
    cols.forEach(([label, value, color], i) => {
      const x = 50 + i * cw;
      g.font = `bold 30px ${FONT}`; g.fillStyle = '#9fb8cc'; g.fillText(label, x, 62);
      g.font = `bold 86px ${FONT}`; g.fillStyle = color || '#ffffff'; g.fillText(String(value), x - 4, 158);
    });
    tex.needsUpdate = true;
  };
}

export function rankFor(ranks, score) { let r = ranks[0][1]; for (const [s, n] of ranks) if (score >= s) r = n; return r; }
export function loadTop(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
export function saveScore(key, entry) {
  const top = loadTop(key); top.push(entry); top.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(key, JSON.stringify(top.slice(0, 20))); } catch { /* storage blocked */ }
  return top;
}
export function drawResultsPanel(p, { score, rank, line, top, meId }) {
  const { g, c, tex } = p, W = c.width, H = c.height;
  frame(g, W, H, '#8fc74e');
  g.fillStyle = '#8fc74e'; g.font = `bold 34px ${FONT}`; g.fillText('ROUND COMPLETE', 60, 90);
  g.fillStyle = '#ffffff'; g.font = `bold 150px ${FONT}`; g.fillText(String(score), 56, 240);
  g.font = `bold 54px ${FONT}`; g.fillStyle = '#5fd3e8'; g.fillText(rank, 60, 320);
  g.font = '34px Segoe UI, Arial'; g.fillStyle = '#c9dbea'; g.fillText(line, 60, 390);
  g.fillStyle = '#8fc74e'; g.font = `bold 34px ${FONT}`; g.fillText("TODAY'S TOP 5", 60, 480);
  g.font = `bold 40px ${FONT}`;
  top.slice(0, 5).forEach((e, i) => {
    const mine = e.id === meId;
    g.fillStyle = mine ? '#f2a541' : '#ffffff';
    g.fillText(`${i + 1}.  ${String(e.score).padStart(5, ' ')}   ${e.rank}${mine ? '   ← YOU' : ''}`, 60, 545 + i * 58);
  });
  g.fillStyle = '#ffffff'; g.font = `bold 40px ${FONT}`; g.fillText('Pull BOTH triggers to play again', 60, 860);
  g.fillStyle = '#9fb8cc'; g.font = '30px Segoe UI, Arial'; g.fillText('B / Y  ·  back to the game menu', 60, 905);
  tex.needsUpdate = true;
}

// ---------------------------------------------------------------- audio
const music = new Audio('assets/bgm.mp3');
music.preload = 'auto'; music.loop = true;
let actx = null, unlocked = false, fade = 0, fadeFrom = 0;
export function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
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
export function watchSession(renderer) {
  renderer.xr.addEventListener('sessionstart', () => {
    const s = renderer.xr.getSession();
    s.addEventListener('selectstart', unlockAudio);
    s.addEventListener('squeezestart', unlockAudio);
  });
}
export const bgm = {
  start(vol = 0.6) { fade = 0; music.volume = vol; music.currentTime = 0; music.play().catch(() => {}); },
  stop(sec = 1.6) { fade = sec; fadeFrom = music.volume; },
  update(dt) {
    if (fade > 0) {
      fade -= dt; music.volume = Math.max(0, fadeFrom * Math.max(0, fade) / 1.6);
      if (fade <= 0) music.pause();
    }
  },
};
export function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, slide = 0) {
  const a = audio(), o = a.createOscillator(), gn = a.createGain(), t = a.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  good: (m = 1) => { tone(660 + 90 * m, 0.09, 'triangle', 0.13); tone(990 + 90 * m, 0.12, 'sine', 0.06); },
  bonus: () => [784, 988, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'triangle', 0.14), i * 70)),
  wrong: () => tone(160, 0.25, 'sawtooth', 0.12, -60),
  alarm: () => { tone(880, 0.16, 'square', 0.07); setTimeout(() => tone(660, 0.2, 'square', 0.07), 170); },
  click: () => tone(1200, 0.05, 'triangle', 0.1),
  count: () => tone(440, 0.12, 'triangle', 0.16),
  go: () => tone(880, 0.25, 'triangle', 0.18),
  horn: () => tone(110, 0.6, 'sawtooth', 0.08, 10),
};

// ---------------------------------------------------------------- controllers
/** Two controllers with an orb at the grip and (optionally) a laser from the target-ray space. */
export function makeHands(renderer, scene, { ray = false, rayLen = 40 } = {}) {
  const hands = [];
  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    scene.add(ctrl, grip);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x335577, roughness: 0.3 });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), orbMat);
    grip.add(orb);
    const h = { i, ctrl, grip, orb, hand: null, source: null, ray: null, reticle: null, prev: {}, pos: new THREE.Vector3() };
    if (ray) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
      h.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      h.ray.scale.z = rayLen; ctrl.add(h.ray);
      h.reticle = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
      h.reticle.renderOrder = 30; h.reticle.visible = false; scene.add(h.reticle);
    }
    ctrl.addEventListener('connected', (e) => {
      h.source = e.data; h.hand = e.data.handedness;
      const col = h.hand === 'left' ? COL.teal : COL.amber;
      orbMat.color.setHex(col); orbMat.emissive.setHex(col).multiplyScalar(0.4);
      if (h.ray) h.ray.material.color.setHex(col);
    });
    ctrl.addEventListener('disconnected', () => { h.source = null; h.hand = null; });
    hands.push(h);
  }
  return hands;
}
export function btn(h, idx) {
  const gp = h.source && h.source.gamepad; const b = gp && gp.buttons[idx];
  return !!(b && (b.pressed || b.value > 0.6));
}
/** true only on the frame the button goes down */
export function pressed(h, idx) {
  const now = btn(h, idx), was = !!h.prev[idx];
  h.prev[idx] = now;
  return now && !was;
}
export function pulse(h, strength, ms) {
  const gp = h && h.source && h.source.gamepad;
  const a = gp && gp.hapticActuators && gp.hapticActuators[0];
  if (a && a.pulse) a.pulse(strength, ms);
}
export function goMenu(renderer) {
  const session = renderer.xr.getSession();
  if (session) session.end().finally(() => { location.href = 'index.html'; });
  else location.href = 'index.html';
}

// ---------------------------------------------------------------- effects
export function makeFx(scene, camera) {
  const bursts = [], floaters = [];
  const burstGeo = new THREE.BoxGeometry(0.035, 0.035, 0.035);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: COL.red, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }));
  flash.renderOrder = 20; camera.add(flash);
  return {
    burst(pos, color, n = 16, speed = 3) {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
        m.position.copy(pos); scene.add(m);
        bursts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed), life: 0.6 });
      }
    },
    text(text, pos, color, size = 1) {
      const c = document.createElement('canvas'); c.width = 640; c.height = 128;
      const g = c.getContext('2d'); g.font = `bold 80px ${FONT}`; g.textAlign = 'center';
      g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(text, 320, 96); g.fillStyle = color; g.fillText(text, 320, 96);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
      sp.renderOrder = 25; sp.scale.set(1.0 * size, 0.2 * size, 1); sp.position.copy(pos); scene.add(sp);
      floaters.push({ sp, life: 1.0 });
    },
    flash(op = 0.45) { flash.material.opacity = op; },
    update(dt) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.life -= dt; b.v.y -= 4 * dt; b.m.position.addScaledVector(b.v, dt);
        b.m.material.opacity = Math.max(0, b.life / 0.6);
        if (b.life <= 0) { scene.remove(b.m); b.m.material.dispose(); bursts.splice(i, 1); }
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i]; f.life -= dt; f.sp.position.y += 0.4 * dt; f.sp.material.opacity = Math.max(0, f.life);
        if (f.life <= 0) { scene.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); floaters.splice(i, 1); }
      }
      flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.2);
    },
  };
}
