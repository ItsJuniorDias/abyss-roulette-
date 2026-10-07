import { PAL, BOWL, BALL_R } from '../config/wheel.ts';
import { bowlY } from '../animations/ball-motion.ts';
// Luxury roulette: polished walnut, brass, emerald felt and warm studio reflections.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ORDER, N, SEG, colorOf } from '../config/roulette.ts';

const material = (
  color: THREE.ColorRepresentation,
  extra: THREE.MeshStandardMaterialParameters = {},
) => new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05, ...extra });
const brass = () => material(PAL.gold, { metalness: 0.86, roughness: 0.23 });
function ring(r: number, y: number, tube = 0.025, mat = brass()) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 160), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
}
function canvasTexture(
  size: number,
  draw: (context: CanvasRenderingContext2D, size: number) => void,
) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function walnutTexture() {
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#412b20';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * s;
      ctx.strokeStyle = i % 2 ? '#9c6a3c18' : '#0a060918';
      ctx.lineWidth = 0.5 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y + Math.sin(i) * 20, s * 0.6, y - Math.cos(i) * 20, s, y);
      ctx.stroke();
    }
  });
}
function rotorTexture() {
  return canvasTexture(2048, (ctx, S) => {
    const C = S / 2,
      K = C / 2.42;
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, S, S);
    const sector = (r0: number, r1: number, a: number) => {
      ctx.beginPath();
      ctx.arc(C, C, r1 * K, a - SEG / 2, a + SEG / 2);
      ctx.arc(C, C, r0 * K, a + SEG / 2, a - SEG / 2, true);
      ctx.closePath();
    };
    ORDER.forEach((n, i) => {
      const a = i * SEG,
        col = PAL[colorOf(n)];
      sector(1.55, 2.42, a);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.save();
      ctx.translate(C + Math.cos(a) * 2.24 * K, C + Math.sin(a) * 2.24 * K);
      ctx.rotate(a + Math.PI / 2);
      ctx.font = '700 80px Manrope, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = PAL.cream;
      ctx.fillText(String(n), 0, 3);
      ctx.restore();
    });
    ctx.strokeStyle = '#c9a968';
    ctx.lineWidth = 3;
    for (let i = 0; i < N; i++) {
      const a = i * SEG + SEG / 2;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * 1.55 * K, C + Math.sin(a) * 1.55 * K);
      ctx.lineTo(C + Math.cos(a) * 2.42 * K, C + Math.sin(a) * 2.42 * K);
      ctx.stroke();
    }
    [2.05, 2.415].forEach((r) => {
      ctx.beginPath();
      ctx.arc(C, C, r * K, 0, Math.PI * 2);
      ctx.stroke();
    });
  });
}
function sparkTexture() {
  return canvasTexture(64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#fff7dc');
    g.addColorStop(0.2, '#efd089');
    g.addColorStop(1, '#d8b66c00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}
function chipStack(x: number, z: number, count: number, color: THREE.ColorRepresentation) {
  const g = new THREE.Group();
  const mat = material(color, { roughness: 0.55 });
  const edgeMat = material('#ede4ce', { roughness: 0.5 });
  for (let i = 0; i < count; i++) {
    const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.055, 32), mat);
    chip.position.y = i * 0.065;
    chip.castShadow = true;
    g.add(chip);
    g.add(ring(0.22, i * 0.065 + 0.03, 0.008, edgeMat));
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.058, 0.025), edgeMat);
      stripe.position.set(Math.cos(a) * 0.252, i * 0.065, Math.sin(a) * 0.252);
      stripe.rotation.y = -a;
      g.add(stripe);
    }
  }
  g.position.set(x, -0.37, z);
  return g;
}
export function createWorld(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#09130f', 20, 44);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const room = new RoomEnvironment(),
    pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff3dc', '#11251d', 1.0));
  const key = new THREE.SpotLight('#ffe7b3', 180, 0, Math.PI / 4, 0.8, 2);
  key.position.set(-4, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#ffdf9d', 1.5);
  rim.position.set(5, 5, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#e7f5ef', 1);
  fill.position.set(-6, 4, 3);
  scene.add(fill);
  const fade = canvasTexture(256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.7, '#fff');
    g.addColorStop(1, '#000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  const felt = new THREE.Mesh(
    new THREE.CircleGeometry(5.7, 96),
    material('#103d2b', { roughness: 1, alphaMap: fade, transparent: true, depthWrite: false }),
  );
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = -0.44;
  felt.receiveShadow = true;
  scene.add(felt);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3.85, 3.65, 0.2, 160),
    material('#101511', { metalness: 0.45, roughness: 0.25 }),
  );
  base.position.y = -0.37;
  base.receiveShadow = true;
  scene.add(base, ring(3.78, -0.28, 0.033), ring(3.67, -0.45, 0.035));
  const walnut = walnutTexture();
  walnut.wrapS = walnut.wrapT = THREE.RepeatWrapping;
  walnut.repeat.set(5, 1);
  const wood = new THREE.MeshPhysicalMaterial({
    color: '#a68a69',
    map: walnut,
    roughness: 0.28,
    metalness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
  });
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(
      BOWL.map((p) => new THREE.Vector2(p[0], p[1])),
      160,
    ),
    wood,
  );
  bowl.receiveShadow = true;
  bowl.castShadow = true;
  scene.add(bowl);
  const track = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [2.95, 0.292],
        [3.05, 0.346],
        [3.2, 0.446],
        [3.28, 0.626],
      ].map((p) => new THREE.Vector2(p[0], p[1])),
      160,
    ),
    material('#775734', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }),
  );
  track.receiveShadow = true;
  scene.add(track);
  scene.add(
    ring(3.48, 0.862, 0.066),
    ring(3.32, 0.833, 0.022),
    ring(3.63, 0.8, 0.02),
    ring(3.755, 0.61, 0.031),
    ring(3.2, 0.451, 0.012),
    ring(2.95, 0.296, 0.012),
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.2;
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), brass());
    d.scale.set(1, 0.6, 2.2);
    d.position.set(Math.cos(a) * 2.78, bowlY(2.78) + 0.05, Math.sin(a) * 2.78);
    d.rotation.y = -a;
    scene.add(d);
  }
  const rotor = new THREE.Group();
  scene.add(rotor);
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(2.42, 160),
    material('#fff', { map: rotorTexture(), roughness: 0.58 }),
  );
  disk.rotation.x = -Math.PI / 2;
  disk.receiveShadow = true;
  rotor.add(disk);
  const fretMat = brass();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.13, 96, 1, true), fretMat);
  wall.position.y = 0.065;
  rotor.add(wall, ring(1.55, 0.13, 0.018), ring(2.05, 0.018, 0.018));
  const fretGeo = new THREE.BoxGeometry(0.5, 0.11, 0.022);
  for (let i = 0; i < N; i++) {
    const a = i * SEG + SEG / 2;
    const f = new THREE.Mesh(fretGeo, fretMat);
    f.position.set(Math.cos(a) * 1.8, 0.055, Math.sin(a) * 1.8);
    f.rotation.y = -a;
    f.castShadow = true;
    rotor.add(f);
  }
  const cone = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        [0.001, 0.62],
        [0.25, 0.6],
        [0.7, 0.43],
        [1.2, 0.2],
        [1.56, 0.08],
        [1.56, 0],
      ].map((p) => new THREE.Vector2(p[0], p[1])),
      96,
    ),
    wood,
  );
  cone.castShadow = true;
  cone.receiveShadow = true;
  rotor.add(cone, ring(1.2, 0.205, 0.012), ring(0.7, 0.435, 0.012));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.18, 0.55, 32), brass());
  stem.position.y = 0.85;
  rotor.add(stem);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 20), brass());
  knob.position.y = 1.18;
  rotor.add(knob);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i * Math.PI) / 2;
    arm.position.y = 0.78;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.8, 16), brass());
    bar.rotation.z = Math.PI / 2;
    bar.position.x = 0.45;
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.072, 20, 14), brass());
    end.position.x = 0.86;
    arm.add(bar, end);
    rotor.add(arm);
  }
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 32, 20),
    material('#fff7e6', { roughness: 0.16, metalness: 0.05 }),
  );
  ball.castShadow = true;
  scene.add(ball);
  const ballGlow = new THREE.PointLight('#ffe6ab', 0, 1.1, 2);
  ball.add(ballGlow);
  scene.add(
    chipStack(-4.1, 1.6, 7, PAL.black),
    chipStack(-4.5, 1.35, 4, PAL.red),
    chipStack(4.25, 0.7, 6, PAL.green),
    chipStack(4.55, 1.05, 3, PAL.black),
  );
  const BN = 100,
    pos = new Float32Array(BN * 3),
    vel = new Float32Array(BN * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const burstMat = new THREE.PointsMaterial({
    size: 0.1,
    map: sparkTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const burst = new THREE.Points(geo, burstMat);
  burst.frustumCulled = false;
  scene.add(burst);
  let life = 0;
  function fireBurst(origin: THREE.Vector3, strength = 1) {
    for (let i = 0; i < BN; i++) {
      pos.set([origin.x, origin.y, origin.z], i * 3);
      const a = Math.random() * Math.PI * 2,
        s = (0.5 + Math.random() * 2) * strength;
      vel.set([Math.cos(a) * s, 1 + Math.random() * 3 * strength, Math.sin(a) * s], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
    life = 1;
  }
  function update(dt: number) {
    if (life <= 0) return;
    life = Math.max(0, life - dt * 0.7);
    for (let i = 0; i < BN; i++) {
      vel[i * 3 + 1] -= 3 * dt;
      for (let j = 0; j < 3; j++) pos[i * 3 + j] += vel[i * 3 + j] * dt;
    }
    geo.attributes.position.needsUpdate = true;
    burstMat.opacity = life;
  }
  function dispose() {
    renderer.setAnimationLoop(null);
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(mat);
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) textures.add(value);
        }
      }
      if (object instanceof THREE.SpotLight || object instanceof THREE.DirectionalLight)
        object.shadow.map?.dispose();
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    environment.dispose();
    renderer.dispose();
  }
  return { renderer, scene, camera, rotor, ball, ballGlow, update, fireBurst, dispose };
}
