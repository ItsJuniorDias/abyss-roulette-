// 3D world: inked toon wheel, bowl, ball, candles, skulls, rune sigil and embers.
// Look: Mignola-inspired — hard two/three-step shading, black ink outlines,
// flat crimson / ochre / teal / bone palette, big pools of shadow.
import * as THREE from 'three';
import { ORDER, N, SEG, colorOf } from './rules.js';

export const BALL_R = 0.085;
export const TRACK_R = 3.1;
export const POCKET_R = 1.8;

const PAL = {
  blood: '#b3191c', ochre: '#d9a23a', teal: '#2b6b60', bone: '#efe3c4', coal: '#161111', ink: '#0b0807',
};

// Bowl profile (radius, height). First points form the ball track slope.
const BOWL = [[2.42, -0.05], [2.55, 0.05], [2.8, 0.19], [3.05, 0.34], [3.2, 0.44], [3.28, 0.62], [3.32, 0.82], [3.62, 0.84], [3.76, 0.6], [3.72, -0.1], [3.45, -0.42]];

export function bowlY(r) {
  if (r <= 2.42) return 0;
  for (let i = 0; i < 4; i++) {
    const [r0, y0] = BOWL[i], [r1, y1] = BOWL[i + 1];
    if (r <= r1) return y0 + ((y1 - y0) * (r - r0)) / (r1 - r0);
  }
  return 0.44;
}

// ---------- materials ----------
const gradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([14, 14, 14, 255, 105, 105, 105, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });

const outlineCache = new Map();
function outlineMat(t) {
  if (!outlineCache.has(t)) {
    outlineCache.set(t, new THREE.ShaderMaterial({
      uniforms: { t: { value: t } },
      vertexShader: 'uniform float t; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * t, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.02, 0.008, 0.008, 1.0); }',
      side: THREE.BackSide,
    }));
  }
  return outlineCache.get(t);
}
// Inverted-hull ink outline.
function ink(mesh, t = 0.025) {
  mesh.add(new THREE.Mesh(mesh.geometry, outlineMat(t)));
  mesh.castShadow = true;
  return mesh;
}
const inkLine = (r, y, tube = 0.02, color = PAL.ink) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 160), new THREE.MeshBasicMaterial({ color }));
  m.rotation.x = Math.PI / 2; m.position.y = y;
  return m;
};

// Hand-drawn-ish hatching inside the current clip region.
function hatch(ctx, size, angle, gap, alpha, width = 2) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = '#000'; ctx.lineWidth = width;
  ctx.translate(size / 2, size / 2); ctx.rotate(angle);
  for (let x = -size; x < size; x += gap * (0.7 + Math.random() * 0.6)) {
    ctx.beginPath(); ctx.moveTo(x, -size); ctx.lineTo(x + (Math.random() - 0.5) * 8, size); ctx.stroke();
  }
  ctx.restore();
}

// ---------- canvas textures ----------
function rotorTexture() {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), C = S / 2, K = C / 2.42;
  ctx.fillStyle = PAL.coal; ctx.fillRect(0, 0, S, S);
  const fill = { red: PAL.blood, black: PAL.coal, green: PAL.teal };

  const sector = (r0, r1, a) => {
    ctx.beginPath();
    ctx.arc(C, C, r1 * K, a - SEG / 2, a + SEG / 2);
    ctx.arc(C, C, r0 * K, a + SEG / 2, a - SEG / 2, true);
    ctx.closePath();
  };

  ORDER.forEach((n, i) => {
    const a = i * SEG, col = fill[colorOf(n)];
    // pocket floor
    ctx.save(); sector(1.55, 2.05, a); ctx.fillStyle = col; ctx.fill(); ctx.clip();
    hatch(ctx, S, a + 0.6, 9, 0.35); ctx.restore();
    // number ring
    ctx.save(); sector(2.05, 2.42, a); ctx.fillStyle = col; ctx.fill(); ctx.clip();
    hatch(ctx, S, a - 0.9, 14, 0.18); ctx.restore();
    // number
    ctx.save();
    ctx.translate(C + Math.cos(a) * 2.24 * K, C + Math.sin(a) * 2.24 * K); ctx.rotate(a + Math.PI / 2);
    ctx.font = '700 88px Oswald, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.strokeText(String(n), 0, 4);
    ctx.fillStyle = PAL.bone; ctx.fillText(String(n), 0, 4);
    ctx.restore();
  });

  // ink separators
  ctx.strokeStyle = '#000'; ctx.lineWidth = 7;
  for (let i = 0; i < N; i++) {
    const a = i * SEG + SEG / 2;
    ctx.beginPath(); ctx.moveTo(C + Math.cos(a) * 1.55 * K, C + Math.sin(a) * 1.55 * K); ctx.lineTo(C + Math.cos(a) * 2.42 * K, C + Math.sin(a) * 2.42 * K); ctx.stroke();
  }
  [2.05, 2.41].forEach((r) => { ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(C, C, r * K, 0, Math.PI * 2); ctx.stroke(); });

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// Procedural rune sigil (replaced by public/assets/emblem.png if present).
function haloTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), C = S / 2;
  ctx.fillStyle = '#8f1517'; ctx.beginPath(); ctx.arc(C, C, C - 4, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.clip(); hatch(ctx, S, 0.8, 7, 0.22, 2); ctx.restore();
  ctx.strokeStyle = '#000';
  [[C - 8, 14], [C - 60, 6], [C - 150, 10], [C - 160, 3]].forEach(([r, w]) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke(); });
  // invented glyphs
  const G = 28;
  for (let i = 0; i < G; i++) {
    const a = (i / G) * Math.PI * 2;
    ctx.save(); ctx.translate(C + Math.cos(a) * (C - 105), C + Math.sin(a) * (C - 105)); ctx.rotate(a + Math.PI / 2);
    ctx.lineWidth = 7; ctx.lineCap = 'square'; ctx.beginPath();
    ctx.moveTo(0, -26); ctx.lineTo(0, 26);
    for (let k = 0; k < 3; k++) {
      const y = -20 + Math.random() * 40, s = Math.random() < 0.5 ? -1 : 1;
      ctx.moveTo(0, y); ctx.lineTo(s * (10 + Math.random() * 12), y + (Math.random() - 0.5) * 22);
    }
    ctx.stroke(); ctx.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dotTexture(inner, outer) {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 92, 2, 32, 80, 60);
  g.addColorStop(0, '#fff6d0'); g.addColorStop(0.25, '#ffb53a'); g.addColorStop(0.55, 'rgba(220,60,20,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath();
  ctx.moveTo(32, 4); ctx.bezierCurveTo(58, 60, 56, 120, 32, 122); ctx.bezierCurveTo(8, 120, 6, 60, 32, 4); ctx.fill();
  return new THREE.CanvasTexture(c);
}

// ---------- props ----------
function skull() {
  const g = new THREE.Group(), bone = toon(PAL.bone), black = new THREE.MeshBasicMaterial({ color: '#000' });
  const cr = ink(new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), bone), 0.03); cr.scale.set(1, 0.92, 1.08);
  const jaw = ink(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), bone), 0.03); jaw.scale.set(0.95, 0.55, 0.85); jaw.position.set(0, -0.32, 0.12);
  g.add(cr, jaw);
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), black); e.scale.set(1, 0.8, 0.5); e.position.set(0.15 * s, -0.02, 0.38); g.add(e);
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 3), black); nose.position.set(0, -0.15, 0.43); nose.rotation.x = Math.PI; g.add(nose);
  for (let i = -2; i <= 2; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.02), black); tooth.position.set(i * 0.06, -0.3, 0.385); g.add(tooth);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function candle(h) {
  const g = new THREE.Group();
  const body = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, h, 16), toon('#e6d6b0')), 0.022);
  body.position.y = h / 2; g.add(body);
  const drip = ink(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), toon('#e6d6b0')), 0.02); drip.scale.set(1, 0.4, 1); drip.position.y = h; g.add(drip);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.scale.set(0.22, 0.42, 1); flame.position.y = h + 0.22; g.add(flame);
  g.userData.flame = flame;
  return g;
}

// ---------- world ----------
export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#120606', 14, 34);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

  // lights: one hard warm key (big black shadows), crimson rim, dim fill
  scene.add(new THREE.HemisphereLight('#5a3024', '#050203', 0.9));
  const key = new THREE.SpotLight('#ffe0a8', 9, 0, Math.PI / 5.5, 0.25, 0);
  key.position.set(-4.5, 12, 5.5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#ff2a1a', 2.2); rim.position.set(7, 3, -7); scene.add(rim);
  const back = new THREE.DirectionalLight('#2b6b60', 0.9); back.position.set(-8, 2, -4); scene.add(back);

  // table: fades out at the edge so the backdrop art shows through
  const fade = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d'), g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, '#fff'); g.addColorStop(0.62, '#fff'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const table = new THREE.Mesh(new THREE.CircleGeometry(9, 72), toon('#3b100c', { alphaMap: fade, transparent: true }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.42; table.receiveShadow = true; scene.add(table);

  // rune sigil on the table, under the wheel
  const sigil = new THREE.Mesh(new THREE.CircleGeometry(5.4, 96), toon('#ffffff', { map: haloTexture(), transparent: true, polygonOffset: true, polygonOffsetFactor: -1 }));
  sigil.rotation.x = -Math.PI / 2; sigil.position.y = -0.418; sigil.receiveShadow = true; scene.add(sigil);

  // bowl
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(BOWL.map(([r, y]) => new THREE.Vector2(r, y)), 160), toon('#4a1710', { side: THREE.DoubleSide }));
  bowl.receiveShadow = true; bowl.castShadow = true; scene.add(bowl);
  const track = new THREE.Mesh(
    new THREE.LatheGeometry([[2.95, 0.288], [3.05, 0.342], [3.2, 0.442], [3.28, 0.622]].map(([r, y]) => new THREE.Vector2(r, y + 0.004)), 160),
    toon('#7a3418', { side: THREE.DoubleSide })
  );
  track.receiveShadow = true; scene.add(track);
  scene.add(inkLine(3.47, 0.86, 0.075, PAL.ochre), inkLine(3.31, 0.83, 0.025), inkLine(3.2, 0.445, 0.014), inkLine(2.95, 0.29, 0.012), inkLine(3.76, 0.6, 0.03));
  const brass = new THREE.Mesh(new THREE.TorusGeometry(3.47, 0.075, 12, 160), toon(PAL.ochre)); brass.rotation.x = Math.PI / 2; brass.position.y = 0.86; scene.add(brass);

  // diamond deflectors
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, r = 2.78;
    const d = ink(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), toon(PAL.ochre)), 0.02);
    d.scale.set(1, 0.6, 2.2); d.position.set(Math.cos(a) * r, bowlY(r) + 0.05, Math.sin(a) * r); d.rotation.y = -a;
    scene.add(d);
  }

  // rotor (spins)
  const rotor = new THREE.Group(); scene.add(rotor);
  const disk = new THREE.Mesh(new THREE.CircleGeometry(2.42, 160), toon('#ffffff', { map: rotorTexture() }));
  disk.rotation.x = -Math.PI / 2; disk.receiveShadow = true; rotor.add(disk);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.13, 96, 1, true), toon(PAL.ochre)); wall.position.y = 0.065; rotor.add(wall);
  rotor.add(inkLine(1.55, 0.13, 0.02), inkLine(2.05, 0.02, 0.022, PAL.ochre));
  const fretGeo = new THREE.BoxGeometry(0.5, 0.11, 0.028), fretMat = toon(PAL.ochre);
  for (let i = 0; i < N; i++) {
    const a = i * SEG + SEG / 2;
    const f = new THREE.Mesh(fretGeo, fretMat);
    f.position.set(Math.cos(a) * 1.8, 0.055, Math.sin(a) * 1.8); f.rotation.y = -a; f.castShadow = true;
    rotor.add(f);
  }
  const cone = new THREE.Mesh(
    new THREE.LatheGeometry([[0.001, 0.62], [0.25, 0.6], [0.7, 0.43], [1.2, 0.2], [1.56, 0.08], [1.56, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 96),
    toon('#5e1a12', { side: THREE.DoubleSide })
  );
  cone.castShadow = true; cone.receiveShadow = true; rotor.add(cone);
  rotor.add(inkLine(1.2, 0.205, 0.012), inkLine(0.7, 0.435, 0.012));
  // ochre ribs on the cone
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.05), toon(PAL.ochre));
    rib.position.set(Math.cos(a) * 0.95, 0.34, Math.sin(a) * 0.95); rib.rotation.y = -a; rib.rotation.z = 0.43; rib.castShadow = true;
    rotor.add(rib);
  }
  // turret + cross arms
  const gold = toon(PAL.ochre);
  const stem = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 0.55, 20), gold)); stem.position.y = 0.85; rotor.add(stem);
  const knob = ink(new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), gold)); knob.position.y = 1.18; rotor.add(knob);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.y = (i * Math.PI) / 2; arm.position.y = 0.78;
    const bar = ink(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10), gold), 0.018);
    bar.rotation.z = Math.PI / 2; bar.position.x = 0.45; arm.add(bar);
    const end = ink(new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), gold), 0.02); end.position.x = 0.86; arm.add(end);
    rotor.add(arm);
  }

  // ball
  const ball = ink(new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 24, 16), toon('#f6eed8', { emissive: '#3a2a10' })), 0.016);
  scene.add(ball);
  const ballGlow = new THREE.PointLight('#ffb050', 0, 2.5, 2); ball.add(ballGlow);

  // candles + skulls on the table
  const candles = [];
  const flickerLights = [];
  [[-5.2, -1.8, 1.4], [-4.6, -3.2, 0.9], [-5.8, -0.4, 0.7], [5.3, -2.2, 1.6], [4.7, -3.4, 1.0], [5.9, -0.9, 0.6], [-4.4, 2.2, 0.8], [4.6, 2.0, 1.1]].forEach(([x, z, h], i) => {
    const c = candle(h); c.position.set(x, -0.42, z); scene.add(c); candles.push(c);
    if (i === 0 || i === 3) {
      const l = new THREE.PointLight('#ff8a30', 5, 9, 1.6); l.position.set(x, -0.42 + h + 0.3, z); scene.add(l); flickerLights.push(l);
    }
  });
  const s1 = skull(); s1.position.set(-5.0, -0.05, -2.6); s1.rotation.y = 0.6; scene.add(s1);
  const s2 = skull(); s2.position.set(5.1, -0.05, -1.2); s2.rotation.y = -0.7; s2.scale.setScalar(0.85); scene.add(s2);
  const s3 = skull(); s3.position.set(-6.2, -0.1, 1.4); s3.rotation.set(0, 1.1, 0.4); s3.scale.setScalar(0.7); scene.add(s3);

  // embers
  const EN = 420, ePos = new Float32Array(EN * 3), eVel = new Float32Array(EN);
  for (let i = 0; i < EN; i++) {
    ePos[i * 3] = (Math.random() - 0.5) * 22; ePos[i * 3 + 1] = Math.random() * 10 - 0.4; ePos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 3;
    eVel[i] = 0.2 + Math.random() * 0.6;
  }
  const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const embers = new THREE.Points(eGeo, new THREE.PointsMaterial({
    size: 0.09, map: dotTexture('#fff0c0', 'rgba(255,110,30,.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffffff',
  }));
  scene.add(embers);

  // win burst
  const BN = 220, bPos = new Float32Array(BN * 3), bVel = new Float32Array(BN * 3);
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const burstMat = new THREE.PointsMaterial({ size: 0.14, map: dotTexture('#fff8e0', 'rgba(255,160,40,.95)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const burst = new THREE.Points(bGeo, burstMat); burst.frustumCulled = false; scene.add(burst);
  let burstLife = 0;

  function fireBurst(origin, strength = 1) {
    for (let i = 0; i < BN; i++) {
      bPos[i * 3] = origin.x; bPos[i * 3 + 1] = origin.y; bPos[i * 3 + 2] = origin.z;
      const a = Math.random() * Math.PI * 2, up = 2 + Math.random() * 5 * strength, sp = (1 + Math.random() * 3.5) * strength;
      bVel[i * 3] = Math.cos(a) * sp; bVel[i * 3 + 1] = up; bVel[i * 3 + 2] = Math.sin(a) * sp;
    }
    bGeo.attributes.position.needsUpdate = true;
    burstLife = 1;
  }

  // optional generated art (npm run gen:assets)
  const loader = new THREE.TextureLoader();
  const tryLoad = (name, fn) => loader.load(`${import.meta.env.BASE_URL}assets/${name}.png`, (t) => { t.colorSpace = THREE.SRGBColorSpace; fn(t); }, undefined, () => {});
  tryLoad('emblem', (t) => { t.repeat.set(0.72, 0.72); t.offset.set(0.14, 0.14); sigil.material.map = t; sigil.material.transparent = false; sigil.material.needsUpdate = true; });
  tryLoad('felt', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); table.material.map = t; table.material.color.set('#8a5a50'); table.material.needsUpdate = true; });
  tryLoad('wood', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 1); bowl.material.map = t; bowl.material.color.set('#b07a6a'); bowl.material.needsUpdate = true; });

  function update(dt, time) {
    // embers drift up
    for (let i = 0; i < EN; i++) {
      ePos[i * 3 + 1] += eVel[i] * dt;
      ePos[i * 3] += Math.sin(time * 0.7 + i) * 0.15 * dt;
      if (ePos[i * 3 + 1] > 10) ePos[i * 3 + 1] = -0.4;
    }
    eGeo.attributes.position.needsUpdate = true;

    if (burstLife > 0) {
      burstLife = Math.max(0, burstLife - dt * 0.55);
      for (let i = 0; i < BN; i++) {
        bVel[i * 3 + 1] -= 6 * dt;
        bPos[i * 3] += bVel[i * 3] * dt; bPos[i * 3 + 1] += bVel[i * 3 + 1] * dt; bPos[i * 3 + 2] += bVel[i * 3 + 2] * dt;
      }
      bGeo.attributes.position.needsUpdate = true;
    }
    burstMat.opacity = burstLife;

    candles.forEach((c, i) => {
      const f = 1 + Math.sin(time * 13 + i * 7) * 0.08 + Math.sin(time * 23 + i) * 0.05;
      c.userData.flame.scale.set(0.22 * f, 0.42 * (2 - f), 1);
    });
    flickerLights.forEach((l, i) => { l.intensity = 4.5 + Math.sin(time * 11 + i * 3) * 0.8 + Math.random() * 0.6; });
    sigil.rotation.z = time * 0.015;
  }

  return { renderer, scene, camera, rotor, ball, ballGlow, update, fireBurst };
}
