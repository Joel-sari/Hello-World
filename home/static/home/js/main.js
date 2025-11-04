// ===============================
// Hello World — Three.js Scene
// Modes:
//  - "login": show only the TOP HALF of the globe (hero composition). Globe is stationary.
//  - "map":   on load, animate camera down/in to center the whole globe. Globe remains stationary.
// Visuals:
//  - Transparent WebGL canvas over a CSS sky gradient (set in your CSS).
//  - 4 billboard cloud sprites placed AROUND the globe (not on its surface), slowly drifting.
// ===============================

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js";

// Robust mode detection: use body class set by Django templates.
//  - index.html adds body class "mode-login"
//  - map.html   adds body class "mode-map"
const MODE = document.body.classList.contains("mode-map") ? "map" : "login";

// --- SCENE SETUP ---
const scene = new THREE.Scene();

// Camera: perspective camera for 3D view.
const camera = new THREE.PerspectiveCamera(
  75, // field of view
  window.innerWidth / window.innerHeight, // aspect
  0.1, // near
  1000 // far
);

// Renderer: transparent so the CSS gradient behind the canvas is visible.
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#bg"),
  antialias: true,
  alpha: true, // <- key for blending with CSS background
});
// Fully transparent clear so the gradient shows through.
renderer.setClearColor(new THREE.Color(0x000000), 0);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// --- EARTH ---
const textureLoader = new THREE.TextureLoader();
// Your single, stylized, accurate equirectangular texture.
const earthTexture = textureLoader.load(
  "/static/home/textures/CartoonEarth.png"
);

// Bigger globe (radius = 3), smooth segments for a clean look.
const EARTH_RADIUS = 3;
const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMat = new THREE.MeshStandardMaterial({ map: earthTexture });
const earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

// --- LIGHTING ---
// Soft daylight key + a little ambient fill. Keep it simple/fast.
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(5, 5, 5);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

// --- CLOUDS AROUND THE GLOBE (NOT ON IT) ---
// We generate a soft, feathered cloud texture procedurally (no external file).
// Then we place 4 Sprite billboards around the globe at a radius slightly larger than Earth.
// A parent group rotates slowly to simulate drifting clouds.

function makeCloudTexture(size = 256) {
  // Create a radial-gradient "puff" with soft edges on a transparent canvas.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Base fully transparent
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.45;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  // Center bright white fading to transparent
  grad.addColorStop(0, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0.0)");

  // Draw several overlapping blobs for a more organic cloud shape
  function puff(x, y, scale = 1) {
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(cx + x * r, cy + y * r, r * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  puff(0, 0, 1.0);
  puff(-0.4, -0.1, 0.7);
  puff(0.45, 0.15, 0.6);
  puff(0.1, -0.45, 0.55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const cloudsGroup = new THREE.Group();
scene.add(cloudsGroup);

(function addSkyClouds() {
  const tex = makeCloudTexture(256);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false, // prevents cloud writing over depth buffer
  });

  // Place 4 clouds at varying spherical angles around the globe.
  const NUM_CLOUDS = 4;
  const SKY_RADIUS = EARTH_RADIUS * 1.35; // clouds orbit outside the globe
  for (let i = 0; i < NUM_CLOUDS; i++) {
    const sprite = new THREE.Sprite(mat.clone());
    // Random-ish spherical coordinates
    const theta = Math.random() * Math.PI; // polar angle [0, π]
    const phi = Math.random() * Math.PI * 2; // azimuthal angle [0, 2π]

    // Convert spherical to Cartesian at SKY_RADIUS
    const x = SKY_RADIUS * Math.sin(theta) * Math.cos(phi);
    const y = SKY_RADIUS * Math.cos(theta);
    const z = SKY_RADIUS * Math.sin(theta) * Math.sin(phi);

    sprite.position.set(x, y, z);
    // Size proportional to radius for a pleasing silhouette
    const s = 1.2 + Math.random() * 0.6; // sprite size
    sprite.scale.set(s, s, 1);

    cloudsGroup.add(sprite);
  }
})();

// --- CAMERA COMPOSITION ---
// Login: camera higher on Y so only top half of globe shows.
// Map:   start same, then animate reveal (down + slight zoom OUT) to center full globe.
if (MODE === "login") {
  camera.position.set(0, 1.5, 6);
  camera.lookAt(earth.position);
} else {
  camera.position.set(0, 1.5, 6);
  camera.lookAt(earth.position);
  // Delay one frame to ensure first render has correct layout, then animate.
  // We zoom OUT (increase Z) and lower Y to 0 to show the full globe.
  requestAnimationFrame(() => revealMap({ toY: 0, toZ: 5.0, ms: 1000 }));
}

// --- ANIMATION STATE ---
// Animation state
// Login: earth spins gently; Map: earth is stationary (users explore with mouse)
let earthSpin = MODE === "login" ? 0.002 : 0.0;
let cloudsYaw = 0.0015; // slow global drift of all clouds
let cloudsBobAmp = 0.08; // gentle up/down bobbing
let tCloud = 0;

// --- MAIN LOOP ---
function animate() {
  requestAnimationFrame(animate);

  // Rotate the entire cloud group slowly for drifting effect.
  cloudsGroup.rotation.y += cloudsYaw;

  // Gentle bobbing: offset each cloud a little up/down on its local normal.
  tCloud += 0.005;
  cloudsGroup.children.forEach((sprite, i) => {
    const phase = tCloud + i * 0.9;
    // Compute outward normal direction to nudge along
    const dir = sprite.position.clone().normalize();
    // Apply small sinusoidal offset along the normal
    sprite.position.addScaledVector(dir, Math.sin(phase) * 0.0025);
  });

  // Optional tiny globe spin (kept 0 for stationary look)
  earth.rotation.y += earthSpin;

  renderer.render(scene, camera);
}
animate();

// --- CAMERA REVEAL (login -> map) ---
// Smoothly moves camera Y down to 0 and Z in to 4.5 (tweakable).
function revealMap({ toY = 0, toZ = 4.5, ms = 1000 } = {}) {
  const fromY = camera.position.y;
  const fromZ = camera.position.z;
  const start = performance.now();

  // Optional: if the login card still exists on this page, fade it.
  const card = document.getElementById("login-container");
  if (card) card.classList.add("fade-out");

  // Ease in-out quad for a pleasant feel
  const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  function step(now) {
    const t = Math.min(1, (now - start) / ms);
    const k = ease(t);

    camera.position.y = fromY + (toY - fromY) * k;
    camera.position.z = fromZ + (toZ - fromZ) * k;
    camera.lookAt(earth.position);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // After reveal completes, allow user orbiting.
      enableOrbit();
    }
  }

  requestAnimationFrame(step);
}

// --- SIMPLE ORBIT CONTROLS (map mode only) ---
// Lightweight pointer-based orbit so we avoid importing OrbitControls.
// Enabled after the reveal animation.
let orbitEnabled = false;
const spherical = new THREE.Spherical();
const orbitState = { dragging: false, lastX: 0, lastY: 0 };

function enableOrbit() {
  if (orbitEnabled || MODE !== "map") return;
  orbitEnabled = true;

  const onDown = (e) => {
    orbitState.dragging = true;
    orbitState.lastX = e.touches ? e.touches[0].clientX : e.clientX;
    orbitState.lastY = e.touches ? e.touches[0].clientY : e.clientY;
  };
  const onMove = (e) => {
    if (!orbitState.dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = x - orbitState.lastX;
    const dy = y - orbitState.lastY;
    orbitState.lastX = x;
    orbitState.lastY = y;

    // Convert camera position to spherical, adjust angles, and convert back.
    spherical.setFromVector3(camera.position.clone());
    // Horizontal drag rotates around Y (theta). Negative so drag-right spins globe left.
    spherical.theta -= dx * 0.005;
    // Vertical drag changes polar angle (phi). Clamp so we don't flip over poles.
    spherical.phi -= dy * 0.005;
    const EPS = 0.1;
    spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, spherical.phi));

    camera.position.setFromSpherical(spherical);
    camera.lookAt(earth.position);
  };
  const onUp = () => (orbitState.dragging = false);

  // Mouse + touch support
  renderer.domElement.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  renderer.domElement.addEventListener("touchstart", onDown, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onUp);
}

// --- RESIZE HANDLER ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
