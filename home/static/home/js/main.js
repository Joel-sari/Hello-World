// ===============================
// Hello World — Three.js Scene (+ Pins)
// Modes:
//  - "login": top-half hero, globe gently spins
//  - "map":   reveal animation then user orbits (globe stationary)
// Visuals:
//  - Transparent WebGL over CSS gradient
//  - 4 billboard clouds drifting around globe
//  - Pins fetched from /api/my-pins/ (JSON), hover/click popups
// ===============================

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js";

// --- MODE ---
const MODE = document.body.classList.contains("mode-map") ? "map" : "login";

// --- SCENE / CAMERA / RENDERER ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#bg"),
  antialias: true,
  alpha: true, // let CSS gradient show through
});
renderer.setClearColor(new THREE.Color(0x000000), 0);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// --- EARTH ---
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load("/static/home/textures/CartoonEarth.png");

const EARTH_RADIUS = 3;
const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMat = new THREE.MeshStandardMaterial({ map: earthTexture });
const earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

// --- LIGHTING ---
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(5, 5, 5);
scene.add(key);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

// --- CLOUDS (billboard sprites orbiting around globe) ---
function makeCloudTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, r = size * 0.45;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grad.addColorStop(0, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0.0)");
  const puff = (x, y, s=1)=>{ ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(cx+x*r, cy+y*r, r*s, 0, Math.PI*2); ctx.fill(); };
  puff(0,0,1.0); puff(-0.4,-0.1,0.7); puff(0.45,0.15,0.6); puff(0.1,-0.45,0.55);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const cloudsGroup = new THREE.Group(); scene.add(cloudsGroup);
(function addSkyClouds(){
  const tex = makeCloudTexture(256);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const NUM = 4, SKY_R = EARTH_RADIUS * 1.35;
  for (let i=0;i<NUM;i++){
    const s = new THREE.Sprite(mat.clone());
    const theta = Math.random()*Math.PI, phi = Math.random()*Math.PI*2;
    s.position.set(
      SKY_R * Math.sin(theta) * Math.cos(phi),
      SKY_R * Math.cos(theta),
      SKY_R * Math.sin(theta) * Math.sin(phi)
    );
    const size = 1.2 + Math.random()*0.6;
    s.scale.set(size, size, 1);
    cloudsGroup.add(s);
  }
})();

// --- CAMERA COMPOSITION ---
if (MODE === "login") {
  camera.position.set(0, 1.5, 6);
  camera.lookAt(earth.position);
} else {
  camera.position.set(0, 1.5, 6);
  camera.lookAt(earth.position);
  requestAnimationFrame(() => revealMap({ toY: 0, toZ: 5.0, ms: 1000 }));
}

// --- ANIMATION STATE ---
let earthSpin = MODE === "login" ? 0.002 : 0.0;
let cloudsYaw = 0.0015;
let tCloud = 0;

// ===============================
// PINS (User Story #1)
// ===============================
const PIN_SURFACE_R = EARTH_RADIUS * 1.01; // float just above the surface
const pinGroup = new THREE.Group();
scene.add(pinGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-2, -2);
let hoveredPin = null;

// Create lightweight popup if template doesn't include it
let popup = document.getElementById("pin-popup");
if (!popup) {
  popup = document.createElement("div");
  popup.id = "pin-popup";
  popup.style.cssText = `
    position:absolute;z-index:20;display:none;max-width:260px;
    background:rgba(17,24,39,.92);color:#fff;padding:10px 12px;border-radius:10px;
    box-shadow:0 6px 18px rgba(0,0,0,.4);backdrop-filter:saturate(120%) blur(2px);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;
    line-height:1.15;font-size:13px
  `;
  // attach near canvas
  renderer.domElement.parentElement?.appendChild(popup);
}

function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius) * Math.sin(phi) * Math.cos(theta),
     (radius) * Math.cos(phi),
     (radius) * Math.sin(phi) * Math.sin(theta)
  );
}

function focusCameraOn(lat, lon, ms = 1500) {
  const target = latLonToVector3(lat, lon, EARTH_RADIUS * 1.5);
  const start = camera.position.clone();
  const startTime = performance.now();

  // optional: ease in/out curve
  const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  function step(now) {
    const t = Math.min(1, (now - startTime) / ms);
    const k = ease(t);
    camera.position.lerpVectors(start, target, k);
    camera.lookAt(earth.position);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const pinGeom = new THREE.SphereGeometry(EARTH_RADIUS * 0.01, 16, 16);
function makePinMaterial() { return new THREE.MeshBasicMaterial({ color: 0xff6688 }); }

function createPinMesh(data) {
  const m = new THREE.Mesh(pinGeom, makePinMaterial());
  m.userData = data;
  m.position.copy(latLonToVector3(data.lat, data.lon, PIN_SURFACE_R));
  m.lookAt(new THREE.Vector3(0,0,0));
  return m;
}

function showPopup(screenX, screenY, d) {
  popup.innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-start">
      ${d.imageUrl ? `<img src="${d.imageUrl}" style="width:84px;height:84px;object-fit:cover;border-radius:8px">` : ""}
      <div style="max-width:150px">
        <div style="font-weight:700;margin-bottom:6px">
          (${Number(d.lat).toFixed(2)}, ${Number(d.lon).toFixed(2)})
        </div>
        <div style="opacity:.9">${d.caption ? d.caption : "No caption"}</div>
      </div>
    </div>`;
  popup.style.left = `${screenX + 12}px`;
  popup.style.top  = `${screenY + 12}px`;
  popup.style.display = "block";
}
function hidePopup(){ popup.style.display = "none"; }

renderer.domElement.addEventListener("mousemove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});

renderer.domElement.addEventListener("click", (e) => {
  if (!hoveredPin) return;
  const rect = renderer.domElement.getBoundingClientRect();
  showPopup(e.clientX - rect.left, e.clientY - rect.top, hoveredPin.userData);
});

async function loadMyPins(){
  try{
    const res = await fetch("/api/my-pins/", { credentials: "same-origin" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const { pins } = await res.json();
    pinGroup.clear();
    pins.forEach(p => pinGroup.add(createPinMesh(p)));
  }catch(err){
    console.error("Failed to load pins:", err);
  }
}

window.addPinToGlobe = function (pin) {
  const mesh = createPinMesh(pin);
  pinGroup.add(mesh);

  // Center the camera on the new pin
  focusCameraOn(pin.lat, pin.lon);
};

// --- HOVER CHECK inside render loop ---
function updatePinHover(){
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pinGroup.children, false);
  if (hits.length > 0) {
    const obj = hits[0].object;
    if (hoveredPin !== obj) {
      hoveredPin = obj;
      const v = hoveredPin.position.clone().project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      showPopup(sx, sy, hoveredPin.userData);
    }
  } else {
    hoveredPin = null;
    hidePopup();
  }
}

// ===============================
// ANIMATION LOOP
// ===============================
function animate() {
  requestAnimationFrame(animate);

  // clouds drift
  cloudsGroup.rotation.y += cloudsYaw;
  tCloud += 0.005;
  cloudsGroup.children.forEach((sprite, i) => {
    const phase = tCloud + i * 0.9;
    const dir = sprite.position.clone().normalize();
    sprite.position.addScaledVector(dir, Math.sin(phase) * 0.0025);
  });

  // tiny globe spin on login
  earth.rotation.y += earthSpin;

  // pin hover
  updatePinHover();

  renderer.render(scene, camera);
}
animate();

// ===============================
// CAMERA REVEAL + ORBIT
// ===============================
function revealMap({ toY = 0, toZ = 4.5, ms = 1000 } = {}) {
  const fromY = camera.position.y, fromZ = camera.position.z, start = performance.now();
  const card = document.getElementById("login-container");
  if (card) card.classList.add("fade-out");
  const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms), k = ease(t);
    camera.position.y = fromY + (toY - fromY) * k;
    camera.position.z = fromZ + (toZ - fromZ) * k;
    camera.lookAt(earth.position);
    if (t < 1) requestAnimationFrame(step); else enableOrbit();
  };
  requestAnimationFrame(step);
}

let orbitEnabled = false;
const spherical = new THREE.Spherical();
const orbitState = { dragging:false, lastX:0, lastY:0 };

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
    const dx = x - orbitState.lastX, dy = y - orbitState.lastY;
    orbitState.lastX = x; orbitState.lastY = y;

    spherical.setFromVector3(camera.position.clone());
    spherical.theta -= dx * 0.005;
    spherical.phi   -= dy * 0.005;
    const EPS = 0.1;
    spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, spherical.phi));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(earth.position);
  };
  const onUp = () => (orbitState.dragging = false);

  renderer.domElement.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  renderer.domElement.addEventListener("touchstart", onDown, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onUp);

  // Once orbit is live, load pins (so they appear on the fully revealed map)
  loadMyPins();
}

// --- RESIZE ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
