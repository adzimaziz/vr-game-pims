// SHIP DOCK RUSH — berth the coal ships before their laytime runs out (Coal Supply Chain Optimizer · demurrage).
// Point the laser at a waiting ship + trigger, then at a free berth + trigger. Laytime out = ON DEMURRAGE (points drain).
import {
  THREE, COL, FONT, params, createApp, sprite, makePanel, frame, hexIcon, onLogos, drawMenuPanel, hexTexture,
  hudDrawer, rankFor, saveScore, drawResultsPanel, audio, watchSession, bgm, sfx, makeHands, btn, pressed, pulse, goMenu, makeFx,
} from './common.js';

const ROUND = Number(params.get('round')) || 75;
const COUNTDOWN = 3;
const RANKS = [[0, 'HARBOUR TRAINEE'], [200, 'BERTH PLANNER'], [450, 'PORT CAPTAIN'], [800, 'DEMURRAGE DESTROYER']];
const SEA = -4;
const BERTHS_X = [-4.5, 0, 4.5], BERTH_Z = -8.8;
const SPOTS = [[-9, -17], [-3, -15], [3, -15], [9, -17], [-6, -24], [6, -24], [0, -28]];
const SAIL_T = 3.0, UNLOAD_T = 6.0, LEAVE_T = 4.0;

const { renderer, scene, camera } = createApp({ background: 0x0a2240, fog: [30, 90], far: 400 });
camera.position.set(0, 1.6, 0.4); camera.lookAt(0, -3, -18);
watchSession(renderer);
const fx = makeFx(scene, camera);
const hands = makeHands(renderer, scene, { ray: true, rayLen: 60 });

// ---------------------------------------------------------------- harbour
const waveC = document.createElement('canvas'); waveC.width = waveC.height = 256;
{
  const g = waveC.getContext('2d'); g.fillStyle = '#0d3d63'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120,200,255,0.25)'; g.lineWidth = 2;
  for (let y = 8; y < 256; y += 18) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + 4 * Math.sin(x / 20 + y)); g.stroke(); }
}
const waveTex = new THREE.CanvasTexture(waveC); waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.repeat.set(40, 40);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ map: waveTex }));
sea.rotation.x = -Math.PI / 2; sea.position.y = SEA; scene.add(sea);

// control-tower deck the player stands on
const deckTex = hexTexture(); deckTex.repeat.set(2, 2);
const deck = new THREE.Mesh(new THREE.CircleGeometry(1.3, 6), new THREE.MeshBasicMaterial({ map: deckTex }));
deck.rotation.x = -Math.PI / 2; deck.rotation.z = Math.PI / 6; scene.add(deck);
const steel = new THREE.MeshStandardMaterial({ color: 0x5b6878, metalness: 0.5, roughness: 0.5 });
const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.3, Math.abs(SEA), 6), steel); tower.position.y = SEA / 2 - 0.01; scene.add(tower);
const rail = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.03, 6, 6), new THREE.MeshStandardMaterial({ color: COL.teal, emissive: 0x0d4f50 }));
rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI / 6; rail.position.y = 1.0; scene.add(rail);

// jetty + trestle
const concrete = new THREE.MeshStandardMaterial({ color: 0x8a96a3, roughness: 0.9 });
const jetty = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 1.8), concrete); jetty.position.set(0, SEA + 0.25, -7); scene.add(jetty);
const trestle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 5), concrete); trestle.position.set(0, SEA + 0.2, -4); scene.add(trestle);
for (const [src, h, x, z] of [['assets/a_stacker_reclaimer.png', 3.4, -11, -3], ['assets/a_coal_pile.png', 2.2, 11, -3]]) {
  const s = sprite(src, h); s.position.set(x, SEA + h / 2, z); s.rotation.y = x < 0 ? 0.6 : -0.6; scene.add(s);
}

// berths
const berths = BERTHS_X.map((x, i) => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.5, 6), new THREE.MeshBasicMaterial({ color: COL.teal, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, SEA + 0.03, BERTH_Z); scene.add(ring);
  const hit = new THREE.Mesh(new THREE.CircleGeometry(2.6, 6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.rotation.x = -Math.PI / 2; hit.position.set(x, SEA + 0.05, BERTH_Z); scene.add(hit);
  const crane = sprite('assets/a_unloader.png', 2.0); crane.position.set(x + 1.9, SEA + 0.5 + 1.0, -6.3); scene.add(crane);
  const label = makePanel(360, 110, 1.6); label.mesh.position.set(x, SEA + 0.9, -6.08); scene.add(label.mesh);
  const b = { i, x, ring, hit, label, ship: null };
  hit.userData.berth = b;
  drawBerthLabel(b);
  return b;
});
function drawBerthLabel(b) {
  const { g, c, tex } = b.label;
  frame(g, c.width, c.height, b.ship ? '#f2a541' : '#3fd0c9');
  g.fillStyle = '#ffffff'; g.font = `bold 46px ${FONT}`; g.fillText(`BERTH ${b.i + 1}`, 28, 70);
  g.fillStyle = b.ship ? '#f2a541' : '#8fc74e'; g.font = `bold 34px ${FONT}`; g.fillText(b.ship ? 'BUSY' : 'FREE', 250, 70);
  tex.needsUpdate = true;
}

// ---------------------------------------------------------------- panels
const menu = makePanel(1200, 860, 2.0); menu.mesh.position.set(0, 1.75, -2.2); scene.add(menu.mesh);
const hudP = makePanel(1100, 200, 1.7); hudP.mesh.position.set(0, 2.55, -2.8); hudP.mesh.rotation.x = 0.15; scene.add(hudP.mesh);
const results = makePanel(1200, 940, 2.0); results.mesh.position.set(0, 1.75, -2.2); scene.add(results.mesh);
const drawHud = hudDrawer(hudP);
function drawMenu() {
  drawMenuPanel(menu, {
    title: 'SHIP DOCK RUSH', sub: 'Berth every coal ship before its laytime runs out.',
    rows: [
      { text: '1. Point the laser at a waiting ship → TRIGGER', color: '#ffffff' },
      { text: '2. Point at a FREE berth → TRIGGER', color: '#ffffff' },
      { icon: '#8fc74e', text: 'Laytime bar green → amber → red', color: '#a8dd6a' },
      { icon: '#e5484d', text: 'Bar empty = ON DEMURRAGE: points drain', color: '#ff8a7a' },
    ],
  });
}
drawMenu(); onLogos(drawMenu);

// ---------------------------------------------------------------- ships
const ships = [];
let shipSeq = 0;
const shipNames = 'ABCDEFGHJKLMNPRSTUVWXYZ';
function freeSpot() {
  const used = ships.filter((s) => s.spot >= 0).map((s) => s.spot);
  const free = SPOTS.map((_, i) => i).filter((i) => !used.includes(i));
  return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
}
function spawnShip(laytime) {
  const spot = freeSpot(); if (spot < 0) return;
  const [sx, sz] = SPOTS[spot];
  const g = new THREE.Group(); g.position.set(sx * 1.6, SEA, -80); scene.add(g);
  const body = sprite('assets/a_ship.png', 3.0); body.position.y = 1.25; g.add(body);
  const label = makePanel(560, 180, 4.6);
  label.mesh.position.y = 4.3; g.add(label.mesh);
  const sel = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.5, 6), new THREE.MeshBasicMaterial({ color: COL.white, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  sel.rotation.x = -Math.PI / 2; sel.position.y = 0.05; g.add(sel);
  const s = {
    g, body, label, sel, spot, name: `MV ${shipNames[shipSeq++ % shipNames.length]}`,
    state: 'arriving', from: g.position.clone(), to: new THREE.Vector3(sx, SEA, sz), tw: 0, dur: 5,
    laytime, wait: laytime, demurrage: false, demTick: 0, berth: null, progress: 0, labelKey: '',
  };
  body.userData.ship = s;
  ships.push(s);
}
function drawShipLabel(s, blink) {
  let status, frac = null, col = '#3fd0c9';
  if (s.state === 'arriving') status = 'ARRIVING';
  else if (s.state === 'anchored' && !s.demurrage) {
    frac = s.wait / s.laytime; col = frac > 0.5 ? '#8fc74e' : frac > 0.2 ? '#f2a541' : '#e5484d'; status = 'WAITING · LAYTIME';
  } else if (s.demurrage && (s.state === 'anchored' || s.state === 'arriving')) { status = 'ON DEMURRAGE'; col = '#e5484d'; frac = 0; }
  else if (s.state === 'sailing') status = `TO BERTH ${s.berth.i + 1}`;
  else if (s.state === 'unloading') { status = `UNLOADING ${Math.round(s.progress * 100)}%`; frac = s.progress; col = '#3fd0c9'; }
  else status = 'DISCHARGED';
  const key = `${status}|${frac === null ? '' : Math.round(frac * 40)}|${blink}|${selected === s}`;
  if (key === s.labelKey) return; s.labelKey = key;
  const { g, c, tex } = s.label, W = c.width, H = c.height;
  frame(g, W, H, selected === s ? '#ffffff' : col, s.demurrage && blink ? 'rgba(90,10,14,0.9)' : 'rgba(6,20,40,0.88)');
  g.fillStyle = '#ffffff'; g.font = `bold 54px ${FONT}`; g.fillText(s.name, 30, 70);
  g.fillStyle = col; g.font = `bold 34px ${FONT}`; g.fillText(status, 30, 118);
  if (frac !== null) {
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(30, 136, W - 60, 22);
    g.fillStyle = col; g.fillRect(30, 136, (W - 60) * Math.max(0, frac), 22);
  }
  tex.needsUpdate = true;
}
function removeShip(s) { scene.remove(s.g); const i = ships.indexOf(s); if (i >= 0) ships.splice(i, 1); if (selected === s) selected = null; }

// ---------------------------------------------------------------- game state
let state = 'menu', tState = 0, st = null, spawnT = 0, lastCount = 99, selected = null;
function newStats() { return { id: Date.now(), score: 0, combo: 0, bestCombo: 0, berthed: 0, onTime: 0, late: 0, discharged: 0, demSec: 0 }; }
const mult = () => Math.min(4, 1 + Math.floor(st.combo / 3));
function setState(s) {
  state = s; tState = 0;
  menu.mesh.visible = s === 'menu';
  hudP.mesh.visible = s === 'countdown' || s === 'play';
  results.mesh.visible = s === 'end';
  if (s === 'countdown') { st = newStats(); lastCount = 99; selected = null; }
  if (s === 'play') { bgm.start(0.5); sfx.go(); fx.text('GO!', new THREE.Vector3(0, 1.7, -1.6), '#8fc74e', 1.4); spawnShip(16); spawnShip(19); spawnT = 6; }
  if (s === 'end') {
    [...ships].forEach(removeShip); berths.forEach((b) => { b.ship = null; drawBerthLabel(b); });
    const rank = rankFor(RANKS, st.score);
    const top = saveScore('shipdock_top', { id: st.id, score: st.score, rank });
    drawResultsPanel(results, { score: st.score, rank, top, meId: st.id,
      line: `Ships berthed ${st.berthed}  ·  on time ${st.onTime}  ·  discharged ${st.discharged}  ·  demurrage ${st.demSec}s` });
    bgm.stop();
  }
}
setState('menu');

function select(s, h) {
  selected = s; sfx.click(); if (h) pulse(h, 0.4, 30);
}
function assign(b, h) {
  if (!selected) { fx.text('PICK A SHIP FIRST', new THREE.Vector3(b.x, SEA + 3, BERTH_Z), '#f2a541', 2.5); sfx.wrong(); return; }
  if (b.ship) { fx.text('BERTH BUSY', new THREE.Vector3(b.x, SEA + 3, BERTH_Z), '#ff8a7a', 2.5); sfx.wrong(); if (h) pulse(h, 0.9, 100); return; }
  const s = selected; selected = null;
  b.ship = s; s.berth = b; s.state = 'sailing'; s.spot = -1;
  s.from = s.g.position.clone(); s.to = new THREE.Vector3(b.x, SEA, BERTH_Z); s.tw = 0; s.dur = SAIL_T;
  st.berthed++;
  const pos = new THREE.Vector3(b.x, SEA + 3.2, BERTH_Z);
  if (!s.demurrage) {
    st.onTime++; st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
    const pts = (15 + Math.round(10 * s.wait / s.laytime)) * mult(); st.score += pts;
    fx.text(`+${pts} ON TIME`, pos, '#8fc74e', 3); sfx.good(mult());
  } else {
    st.late++; st.combo = 0; st.score += 5;
    fx.text('+5 LATE', pos, '#f2a541', 3); sfx.click();
  }
  if (h) pulse(h, 0.5, 50);
  drawBerthLabel(b);
}

// ---------------------------------------------------------------- picking (VR laser + desktop mouse)
const ray = new THREE.Raycaster();
function pickTargets() { return [...ships.filter((s) => s.state === 'anchored' || s.state === 'arriving').map((s) => s.body), ...berths.map((b) => b.hit)]; }
function pick() {
  const hits = ray.intersectObjects(pickTargets(), false);
  return hits.length ? hits[0] : null;
}
function act(hit, h) {
  if (!hit || state !== 'play') return;
  const s = hit.object.userData.ship, b = hit.object.userData.berth;
  if (s) { if (s.state === 'anchored') select(s, h); else fx.text('STILL ARRIVING', s.g.position.clone().setY(SEA + 5), '#9fb8cc', 2.5); }
  else if (b) assign(b, h);
}
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (renderer.xr.isPresenting) return;
  audio();
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  act(pick(), null);
});
const keys = { start: false };
addEventListener('keydown', (e) => {
  if (e.code === 'Space') keys.start = true;
  if (e.code === 'KeyM' || e.code === 'Escape') goMenu(renderer);
  audio();
});
window.__act = (kind, i) => act(kind === 'ship' ? { object: ships[i].body } : { object: berths[i].hit }, null);
window.__dock = () => ({ state, t: +tState.toFixed(1), ships: ships.map((s) => `${s.name}:${s.state}${s.demurrage ? '!' : ''}`), stats: st && { ...st } });

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const tmpM = new THREE.Matrix4();
let bothWas = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  tState += dt;
  const inXR = renderer.xr.isPresenting;
  waveTex.offset.y += dt * 0.02; waveTex.offset.x += dt * 0.006;

  const L = hands.find((h) => h.hand === 'left'), R = hands.find((h) => h.hand === 'right');
  const both = !!(L && R && btn(L, 0) && btn(R, 0));
  const startEdge = (both && !bothWas) || keys.start; bothWas = both; keys.start = false;
  if (startEdge) { audio(); if (state === 'menu') setState('countdown'); else if (state === 'end' && tState > 2.5) setState('menu'); }
  for (const h of hands) if (pressed(h, 5) && (state === 'menu' || state === 'end')) goMenu(renderer);

  // lasers: hover + trigger
  for (const h of hands) {
    if (!inXR || !h.source) { if (h.reticle) h.reticle.visible = false; h.prev[0] = btn(h, 0); continue; }
    h.ctrl.updateMatrixWorld(true);
    tmpM.identity().extractRotation(h.ctrl.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(h.ctrl.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
    const hit = state === 'play' ? pick() : null;
    h.reticle.visible = !!hit;
    if (hit) { h.reticle.position.copy(hit.point); h.reticle.lookAt(camera.getWorldPosition(new THREE.Vector3())); }
    h.ray.scale.z = hit ? hit.distance : 60;
    if (pressed(h, 0) && !both) act(hit, h);
  }

  if (state === 'countdown') {
    const n = Math.ceil(COUNTDOWN - tState);
    if (n !== lastCount && n > 0) { lastCount = n; sfx.count(); fx.text(String(n), new THREE.Vector3(0, 1.7, -1.6), '#ffffff', 1.4); }
    if (tState >= COUNTDOWN) setState('play');
  }

  const blink = Math.floor(performance.now() / 300) % 2 === 0;
  if (state === 'play') {
    const p = Math.min(1, tState / ROUND);
    spawnT -= dt;
    if (spawnT <= 0) { spawnShip(15 - 5 * p + Math.random() * 3); spawnT = 7 - 3.5 * p; }

    for (const s of [...ships]) {
      if (s.state === 'arriving' || s.state === 'sailing' || s.state === 'leaving') {
        s.tw = Math.min(1, s.tw + dt / s.dur);
        const e = s.tw * s.tw * (3 - 2 * s.tw);
        s.g.position.lerpVectors(s.from, s.to, e);
        if (s.tw >= 1) {
          if (s.state === 'arriving') s.state = 'anchored';
          else if (s.state === 'sailing') { s.state = 'unloading'; s.progress = 0; sfx.horn(); }
          else { removeShip(s); continue; }
        }
      }
      if (s.state === 'arriving' || s.state === 'anchored') {
        if (!s.demurrage) {
          s.wait -= dt;
          if (s.wait <= 0) {
            s.demurrage = true; sfx.alarm(); fx.flash(0.2);
            fx.text('DEMURRAGE!', s.g.position.clone().setY(SEA + 5.5), '#ff8a7a', 3);
            st.combo = 0; hands.forEach((h) => pulse(h, 0.7, 120));
          }
        } else {
          s.demTick += dt;
          if (s.demTick >= 1) { s.demTick -= 1; st.demSec++; st.score = Math.max(0, st.score - 2); }
        }
      }
      if (s.state === 'unloading') {
        s.progress = Math.min(1, s.progress + dt / UNLOAD_T);
        if (s.progress >= 1) {
          const pts = 5 * mult(); st.score += pts; st.discharged++;
          fx.text(`+${pts} DISCHARGED`, s.g.position.clone().setY(SEA + 5), '#5fd3e8', 3); sfx.bonus();
          const b = s.berth; b.ship = null; drawBerthLabel(b);
          s.state = 'leaving'; s.from = s.g.position.clone(); s.to = new THREE.Vector3(s.g.position.x * 3 + (Math.random() - 0.5) * 10, SEA, -90); s.tw = 0; s.dur = LEAVE_T * 2;
        }
      }
      // ships face the player (yaw only) and show selection
      s.g.lookAt(camera.position.x, s.g.position.y, camera.position.z);
      s.sel.material.opacity = selected === s ? 0.9 : 0;
      const near = s.state === 'sailing' || s.state === 'unloading' || s.state === 'leaving';   // smaller labels at the jetty
      const k = near ? 0.6 : 1; s.label.mesh.scale.setScalar(k); s.label.mesh.position.y = near ? 3.4 : 4.3;
      drawShipLabel(s, blink);
    }

    berths.forEach((b) => { b.ring.material.opacity = b.ship ? 0.25 : (selected ? 0.6 + 0.35 * Math.sin(performance.now() / 150) : 0.6); });
    drawHud([['SCORE', st.score], ['ON TIME', mult() > 1 ? `${st.onTime} x${mult()}` : st.onTime, mult() > 1 ? '#8fc74e' : null],
      ['TIME', Math.max(0, Math.ceil(ROUND - tState)), ROUND - tState < 10 ? '#ff8a7a' : null]]);
    if (tState >= ROUND) setState('end');
  }

  fx.update(dt); bgm.update(dt);
  renderer.render(scene, camera);
});
