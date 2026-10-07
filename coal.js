// COAL STACK — grab coal off the conveyor and stack it in the matching yard slot (Coal Supply Chain Optimizer).
// Grab = grip or trigger near a lump · release over the slot with the same colour. 5 in a slot = SLOT FULL bonus.
import {
  THREE, COL, FONT, params, createApp, hexFloor, dataDots, sprite, makePanel, frame, hexIcon, onLogos, drawMenuPanel,
  hudDrawer, rankFor, saveScore, drawResultsPanel, audio, watchSession, bgm, sfx, makeHands, btn, pressed, pulse, goMenu, makeFx,
} from './common.js';

const ROUND = Number(params.get('round')) || 60;
const COUNTDOWN = 3;
const RANKS = [[0, 'YARD TRAINEE'], [250, 'STACKER OPERATOR'], [600, 'YARD SUPERVISOR'], [1000, 'COAL YARD COMMANDER']];
const TYPES = [
  { key: 'A', name: 'COAL A', sub: 'HIGH CV', color: 0x1e90d6, css: '#1e90d6', body: 0x1c1f26 },
  { key: 'B', name: 'COAL B', sub: 'MEDIUM CV', color: 0x8fc74e, css: '#8fc74e', body: 0x2b2b2b },
  { key: 'C', name: 'COAL C', sub: 'HIGH MOISTURE', color: 0xf2a541, css: '#f2a541', body: 0x3b2b1d },
];
const BELT_Y = 1.0, BELT_Z = -0.78, BELT_X0 = 1.9, BELT_X1 = -1.95;
const BIN_Z = -0.36, BIN_TOP = 0.85, BIN_FLOOR = 0.55, BIN_W = 0.4, BIN_D = 0.32;
const GRAB_R = 0.17, SLOT_SIZE = 5;

const { renderer, scene, camera } = createApp({ fog: [12, 40] });
camera.position.set(0, 1.6, 0.6); camera.lookAt(0, 0.95, -0.6);
watchSession(renderer);
hexFloor(scene); dataDots(scene, { n: 900, minR: 5 });
const fx = makeFx(scene, camera);
const hands = makeHands(renderer, scene);

// ---------------------------------------------------------------- yard scenery (sprites from the explainer art)
for (const [src, h, x, z] of [['assets/a_stacker_reclaimer.png', 3.2, -3.5, -9], ['assets/a_coal_pile.png', 2.0, 3.5, -8],
  ['assets/a_coal_pile.png', 1.6, -7, -11], ['assets/a_coal_pile.png', 1.8, 7.5, -12]]) {
  const s = sprite(src, h); s.position.set(x, h / 2, z); scene.add(s);
}

// ---------------------------------------------------------------- conveyor
const beltTexCanvas = document.createElement('canvas'); beltTexCanvas.width = 512; beltTexCanvas.height = 64;
{
  const g = beltTexCanvas.getContext('2d'); g.fillStyle = '#20262e'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#2f3a46'; for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 14, 64);
  g.fillStyle = 'rgba(63,208,201,0.5)';
  for (let x = 0; x < 512; x += 128) { g.beginPath(); g.moveTo(x + 60, 18); g.lineTo(x + 40, 32); g.lineTo(x + 60, 46); g.fill(); }
}
const beltTex = new THREE.CanvasTexture(beltTexCanvas); beltTex.wrapS = THREE.RepeatWrapping; beltTex.repeat.set(4, 1);
const belt = new THREE.Mesh(new THREE.BoxGeometry(BELT_X0 - BELT_X1 + 0.2, 0.06, 0.36),
  [new THREE.MeshStandardMaterial({ color: 0x3a4652 }), new THREE.MeshStandardMaterial({ color: 0x3a4652 }),
    new THREE.MeshStandardMaterial({ map: beltTex }), new THREE.MeshStandardMaterial({ color: 0x3a4652 }),
    new THREE.MeshStandardMaterial({ color: 0x3a4652 }), new THREE.MeshStandardMaterial({ color: 0x3a4652 })]);
belt.position.set((BELT_X0 + BELT_X1) / 2, BELT_Y - 0.03, BELT_Z); scene.add(belt);
const legMat = new THREE.MeshStandardMaterial({ color: 0x5b6878, metalness: 0.5, roughness: 0.5 });
for (const x of [-1.8, -0.6, 0.6, 1.8]) for (const dz of [-0.15, 0.15]) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, BELT_Y - 0.06, 0.04), legMat);
  leg.position.set(x, (BELT_Y - 0.06) / 2, BELT_Z + dz); scene.add(leg);
}

// ---------------------------------------------------------------- yard slots (bins)
const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3644, metalness: 0.4, roughness: 0.6 });
const pileGeo = new THREE.ConeGeometry(0.16, 0.24, 7);
const bins = TYPES.map((type, i) => {
  const x = (i - 1) * 0.5, g = new THREE.Group(); g.position.set(x, 0, BIN_Z); scene.add(g);
  const h = BIN_TOP - BIN_FLOOR, t = 0.02;
  const parts = [[BIN_W, t, BIN_D, 0, BIN_FLOOR, 0], [t, h, BIN_D, -BIN_W / 2, BIN_FLOOR + h / 2, 0], [t, h, BIN_D, BIN_W / 2, BIN_FLOOR + h / 2, 0],
    [BIN_W, h, t, 0, BIN_FLOOR + h / 2, -BIN_D / 2], [BIN_W, h, t, 0, BIN_FLOOR + h / 2, BIN_D / 2]];
  for (const [w, hh, d, px, py, pz] of parts) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), wallMat); m.position.set(px, py, pz); g.add(m); }
  const leg = new THREE.Mesh(new THREE.BoxGeometry(BIN_W * 0.8, BIN_FLOOR, BIN_D * 0.8), legMat); leg.position.y = BIN_FLOOR / 2; g.add(leg);
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BIN_W + 0.01, 0.02, BIN_D + 0.01)),
    new THREE.LineBasicMaterial({ color: type.color })); rim.position.y = BIN_TOP; g.add(rim);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(BIN_W, BIN_D), new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.18, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = BIN_TOP - 0.005; g.add(glow);
  const pile = new THREE.Mesh(pileGeo, new THREE.MeshStandardMaterial({ color: type.body, emissive: type.color, emissiveIntensity: 0.15, flatShading: true }));
  pile.position.y = BIN_FLOOR + 0.01; pile.scale.y = 0.001; g.add(pile);
  const label = makePanel(420, 170, 0.4); label.mesh.position.set(0, 0.68, BIN_D / 2 + 0.012); g.add(label.mesh);
  const bin = { type, x, g, pile, glow, label, count: 0, flash: 0 };
  drawBinLabel(bin);
  return bin;
});
function drawBinLabel(bin) {
  const { g, c, tex } = bin.label, W = c.width, H = c.height;
  frame(g, W, H, bin.type.css);
  hexIcon(g, 56, 70, 34, bin.type.css);
  g.fillStyle = '#ffffff'; g.font = `bold 52px ${FONT}`; g.fillText(bin.type.name, 104, 82);
  g.fillStyle = '#c9dbea'; g.font = `28px Segoe UI, Arial`; g.fillText(bin.type.sub, 106, 126);
  g.fillStyle = bin.type.css; g.font = `bold 34px ${FONT}`; g.fillText(`${bin.count}/${SLOT_SIZE}`, W - 100, 126);
  tex.needsUpdate = true;
}

// ---------------------------------------------------------------- panels
const menu = makePanel(1200, 860, 2.2); menu.mesh.position.set(0, 1.95, -2.4); scene.add(menu.mesh);
const hudP = makePanel(1100, 200, 1.8); hudP.mesh.position.set(0, 2.25, -2.6); scene.add(hudP.mesh);
const results = makePanel(1200, 940, 2.2); results.mesh.position.set(0, 1.9, -2.4); scene.add(results.mesh);
const drawHud = hudDrawer(hudP);
function drawMenu() {
  drawMenuPanel(menu, {
    title: 'COAL STACK', sub: 'Keep the coal yard in order — stack each coal in its own slot.',
    rows: [
      { text: 'GRAB coal from the conveyor (grip or trigger)', color: '#ffffff' },
      { text: 'DROP it into the slot with the SAME colour', color: '#ffffff' },
      { icon: '#1e90d6', text: 'COAL A', color: '#5fd3e8' }, { icon: '#8fc74e', text: 'COAL B', color: '#a8dd6a' },
    ],
  });
  const { g } = menu; hexIcon(g, 470, 612, 30, '#f2a541'); g.font = `bold 38px ${FONT}`; g.fillStyle = '#f7c27a'; g.fillText('COAL C', 520, 626);
  g.fillStyle = '#c9dbea'; g.font = '30px Segoe UI, Arial'; g.fillText(`${SLOT_SIZE} in a slot = SLOT FULL bonus`, 760, 626);
  menu.tex.needsUpdate = true;
}
drawMenu(); onLogos(drawMenu);

// ---------------------------------------------------------------- lumps
const lumpGeo = new THREE.DodecahedronGeometry(0.07, 0);
const ringGeo = new THREE.TorusGeometry(0.088, 0.012, 6, 20);
const lumpMats = TYPES.map((t) => new THREE.MeshStandardMaterial({ color: t.body, emissive: t.color, emissiveIntensity: 0.35, flatShading: true, roughness: 0.8 }));
const ringMats = TYPES.map((t) => new THREE.MeshBasicMaterial({ color: t.color }));
const lumps = [];
function spawnLump(speed) {
  const ti = Math.floor(Math.random() * TYPES.length);
  const m = new THREE.Mesh(lumpGeo, lumpMats[ti]);
  const ring = new THREE.Mesh(ringGeo, ringMats[ti]); ring.rotation.x = Math.PI / 2; m.add(ring);
  m.position.set(BELT_X0, BELT_Y + 0.07, BELT_Z + (Math.random() - 0.5) * 0.14);
  m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  scene.add(m);
  lumps.push({ m, ti, state: 'belt', speed, v: new THREE.Vector3(), lost: false, hand: null });
}
function removeLump(l) { scene.remove(l.m); const i = lumps.indexOf(l); if (i >= 0) lumps.splice(i, 1); }

// ---------------------------------------------------------------- state
let state = 'menu', tState = 0, st = null, spawnT = 0, lastCount = 99;
function newStats() { return { id: Date.now(), score: 0, combo: 0, bestCombo: 0, placed: 0, wrong: 0, lost: 0, slotsFull: 0 }; }
const mult = () => Math.min(4, 1 + Math.floor(st.combo / 6));
function setState(s) {
  state = s; tState = 0;
  menu.mesh.visible = s === 'menu';
  hudP.mesh.visible = s === 'countdown' || s === 'play';
  results.mesh.visible = s === 'end';
  if (s === 'countdown') {
    st = newStats(); spawnT = 0; lastCount = 99;
    bins.forEach((b) => { b.count = 0; b.pile.scale.y = 0.001; drawBinLabel(b); });
  }
  if (s === 'play') { bgm.start(0.55); sfx.go(); fx.text('GO!', new THREE.Vector3(0, 1.7, -1.6), '#8fc74e', 1.4); }
  if (s === 'end') {
    [...lumps].forEach(removeLump); hands.forEach((h) => { h.held = null; });
    const rank = rankFor(RANKS, st.score);
    const top = saveScore('coalstack_top', { id: st.id, score: st.score, rank });
    const tries = st.placed + st.wrong + st.lost;
    drawResultsPanel(results, { score: st.score, rank, top, meId: st.id,
      line: `Stacked ${st.placed}  ·  accuracy ${tries ? Math.round(100 * st.placed / tries) : 0}%  ·  slots filled ${st.slotsFull}  ·  best combo ${st.bestCombo}` });
    bgm.stop();
  }
}
setState('menu');

function land(l, bin) {
  const p = l.m.position.clone();
  removeLump(l);
  if (bin.type === TYPES[l.ti]) {
    st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo); st.placed++;
    const pts = 10 * mult(); st.score += pts;
    bin.count++; bin.flash = 1;
    fx.burst(p, bin.type.color, 12, 2); fx.text(`+${pts}`, p.clone().add(new THREE.Vector3(0, 0.15, 0)), bin.type.css, 0.6);
    sfx.good(mult());
    if (bin.count >= SLOT_SIZE) {
      st.score += 25; st.slotsFull++; bin.count = 0;
      fx.burst(new THREE.Vector3(bin.x, BIN_TOP, BIN_Z), bin.type.color, 30, 3);
      fx.text('SLOT FULL +25', new THREE.Vector3(bin.x, 1.25, BIN_Z), '#ffffff', 0.8); sfx.bonus();
    }
    drawBinLabel(bin);
    return true;
  }
  st.combo = 0; st.wrong++; st.score = Math.max(0, st.score - 5);
  fx.burst(p, 0x8899aa, 10, 2); fx.text('WRONG SLOT', p.clone().add(new THREE.Vector3(0, 0.15, 0)), '#ff8a7a', 0.6); sfx.wrong();
  return false;
}

function binAt(pos) {
  return bins.find((b) => Math.abs(pos.x - b.x) < BIN_W / 2 && Math.abs(pos.z - BIN_Z) < BIN_D / 2) || null;
}

// ---------------------------------------------------------------- desktop test
const keys = { start: false, drop: -1 };
addEventListener('keydown', (e) => {
  if (e.code === 'Space') keys.start = true;
  if (e.code === 'Digit1' || e.code === 'Numpad1') keys.drop = 0;
  if (e.code === 'Digit2' || e.code === 'Numpad2') keys.drop = 1;
  if (e.code === 'Digit3' || e.code === 'Numpad3') keys.drop = 2;
  if (e.code === 'KeyM' || e.code === 'Escape') goMenu(renderer);
  audio();
});
window.__cs = () => ({ state, t: +tState.toFixed(1), lumps: lumps.length, stats: st && { ...st }, bins: bins.map((b) => b.count),
  lead: (lumps.filter((l) => l.state === 'belt').sort((a, b) => a.m.position.x - b.m.position.x)[0] || {}).ti });

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  tState += dt;
  const inXR = renderer.xr.isPresenting;

  // hand positions + velocities
  for (const h of hands) {
    h.grip.updateMatrixWorld(true);
    tmp.setFromMatrixPosition(h.grip.matrixWorld);
    h.vel = h.vel || new THREE.Vector3();
    if (h.last) h.vel.lerp(tmp.clone().sub(h.last).divideScalar(Math.max(dt, 1e-3)), 0.5);
    h.last = (h.last || new THREE.Vector3()).copy(tmp);
    h.pos.copy(tmp);
  }

  // start / back
  const L = hands.find((h) => h.hand === 'left'), R = hands.find((h) => h.hand === 'right');
  const both = !!(L && R && btn(L, 0) && btn(R, 0));
  const startEdge = (both && !window.__bothWas) || keys.start; window.__bothWas = both; keys.start = false;
  if (startEdge) { audio(); if (state === 'menu') setState('countdown'); else if (state === 'end' && tState > 2.5) setState('menu'); }
  for (const h of hands) if (pressed(h, 5) && (state === 'menu' || state === 'end')) goMenu(renderer);

  if (state === 'countdown') {
    const n = Math.ceil(COUNTDOWN - tState);
    if (n !== lastCount && n > 0) { lastCount = n; sfx.count(); fx.text(String(n), new THREE.Vector3(0, 1.7, -1.6), '#ffffff', 1.4); }
    if (tState >= COUNTDOWN) setState('play');
  }

  if (state === 'play') {
    const p = Math.min(1, tState / ROUND);
    const speed = 0.3 + 0.35 * p;
    beltTex.offset.x += speed * dt / ((BELT_X0 - BELT_X1) / 4);
    spawnT -= dt;
    if (spawnT <= 0) { spawnLump(speed); spawnT = 1.5 - 0.8 * p; }

    // grab / release (VR)
    if (inXR) for (const h of hands) {
      const grabbing = btn(h, 1) || btn(h, 0);
      if (grabbing && !h.held && !(both && tState < 0.4)) {
        let best = null, bd = GRAB_R;
        for (const l of lumps) if (l.state !== 'held') { const d = l.m.position.distanceTo(h.pos); if (d < bd) { bd = d; best = l; } }
        if (best) { best.state = 'held'; best.hand = h; h.held = best; pulse(h, 0.4, 30); sfx.click(); }
      } else if (!grabbing && h.held) {
        const l = h.held; h.held = null; l.state = 'fall'; l.hand = null;
        l.v.copy(h.vel).multiplyScalar(0.6); l.v.y = Math.min(l.v.y, 1);
      }
    }

    // desktop: send the leading lump on the belt into slot 1/2/3
    if (keys.drop >= 0) {
      const lead = lumps.filter((l) => l.state === 'belt').sort((a, b) => a.m.position.x - b.m.position.x)[0];
      if (lead) { lead.m.position.set(bins[keys.drop].x, BIN_TOP + 0.25, BIN_Z); lead.state = 'fall'; lead.v.set(0, 0, 0); }
      keys.drop = -1;
    }

    for (const l of [...lumps]) {
      if (l.state === 'belt') {
        l.m.position.x -= speed * dt;
        if (l.m.position.x < BELT_X1) {
          l.state = 'fall'; l.lost = true; l.v.set(-0.4, 0, 0);
          st.lost++; st.combo = 0; st.score = Math.max(0, st.score - 3);
          fx.text('LOST', new THREE.Vector3(BELT_X1, 1.25, BELT_Z), '#ff8a7a', 0.7); sfx.alarm(); fx.flash(0.25);
        }
      } else if (l.state === 'held') {
        l.m.position.copy(l.hand.pos); l.m.rotation.y += dt * 2;
      } else {
        l.v.y -= 9.8 * dt; l.m.position.addScaledVector(l.v, dt);
        const bin = !l.lost && binAt(l.m.position);
        if (bin && l.m.position.y <= BIN_TOP - 0.03) {
          const ok = land(l, bin);
          hands.forEach((h) => pulse(h, ok ? 0.4 : 0.9, ok ? 40 : 120));
        } else if (l.m.position.y < 0.05) {
          if (!l.lost) { st.lost++; st.combo = 0; st.score = Math.max(0, st.score - 2); fx.text('DROPPED', l.m.position.clone().setY(0.5), '#ff8a7a', 0.6); }
          removeLump(l);
        }
      }
    }

    drawHud([['SCORE', st.score], ['COMBO', mult() > 1 ? `${st.combo} x${mult()}` : st.combo, mult() > 1 ? '#8fc74e' : null],
      ['TIME', Math.max(0, Math.ceil(ROUND - tState)), ROUND - tState < 10 ? '#ff8a7a' : null]]);
    if (tState >= ROUND) setState('end');
  }

  // slot fill + glow
  for (const b of bins) {
    const target = Math.max(0.001, b.count / SLOT_SIZE);
    b.pile.scale.y += (target - b.pile.scale.y) * Math.min(1, dt * 8);
    b.pile.position.y = BIN_FLOOR + 0.01 + 0.12 * b.pile.scale.y;
    b.flash = Math.max(0, b.flash - dt * 3);
    b.glow.material.opacity = 0.18 + 0.5 * b.flash;
  }
  fx.update(dt); bgm.update(dt);
  renderer.render(scene, camera);
});
