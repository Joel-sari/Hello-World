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
const earthTexture = textureLoader.load(
  "/static/home/textures/FINALGLOBE.jpeg?v=" + Date.now()
);
// --- PIN SPRITE TEXTURE ---
const pinSpriteTex = textureLoader.load("/static/home/textures/pin_sprite.png");
const pinSpriteMat = new THREE.SpriteMaterial({
  map: pinSpriteTex,
  transparent: true,
  depthWrite: false,
});

const EARTH_RADIUS = 3.025;
const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMat = new THREE.MeshStandardMaterial({ map: earthTexture });
const earth = new THREE.Mesh(earthGeo, earthMat);
scene.add(earth);

// --- SUN LIGHT (animated directional light) ---
const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
sunLight.position.set(10, 5, 0); // initial position
sunLight.castShadow = false;     // optional
scene.add(sunLight);

// store angle for rotation
let sunAngle = 0;

scene.add(new THREE.AmbientLight(0xffffff, 0.18));

// --- CLOUDS (billboard sprites orbiting around globe) ---
// --- IMPROVED CLOUD TEXTURE (Perlin-like soft clouds, no rainbow noise) ---
function makeCloudTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Clear fully
  ctx.clearRect(0, 0, size, size);

  // Generate soft noise-based cloud texture
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  function noise(x, y) {
    return (
      Math.sin(x * 0.05) * Math.sin(y * 0.05) +
      Math.sin(x * 0.12) * Math.sin(y * 0.08) * 0.6
    );
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x, y);
      const brightness = Math.max(0, Math.min(255, (n + 1) * 128)); // 0–255

      const dist = Math.hypot(x - size / 2, y - size / 2);
      const fade = Math.max(0, 1 - dist / (size * 0.5));

      const alpha = brightness * fade * 0.5; // softer edges

      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = alpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);

  // FIX: Remove colorSpace issue that caused rainbow noise
  // tex.colorSpace = THREE.SRGBColorSpace;  <-- DO NOT USE

  // Make the texture smooth
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  return tex;
}

const cloudsGroup = new THREE.Group();
scene.add(cloudsGroup);
(function addSkyClouds() {
  const tex = makeCloudTexture(256);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 10// softer, realistic clouds
  });
  const NUM = 6,
    SKY_R = EARTH_RADIUS * 1.35;
  for (let i = 0; i < NUM; i++) {
    const s = new THREE.Sprite(mat.clone());
    const theta = Math.random() * Math.PI,
      phi = Math.random() * Math.PI * 2;
    s.position.set(
      SKY_R * Math.sin(theta) * Math.cos(phi),
      SKY_R * Math.cos(theta),
      SKY_R * Math.sin(theta) * Math.sin(phi)
    );
    const size = 1.2 + Math.random() * 0.6;
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
    position:absolute;
    z-index:20;
    display:none;
    max-width:210px;
    background:rgba(15,23,42,0.96);
    color:#e5e7eb;
    padding:8px 10px;
    border-radius:12px;
    border:1px solid rgba(148,163,184,0.35);
    box-shadow:0 12px 30px rgba(15,23,42,0.75);
    backdrop-filter:saturate(130%) blur(6px);
    font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;
    line-height:1.25;
    font-size:12px;
    transform-origin:50% 100%;
    transition:
      opacity 120ms ease-out,
      transform 120ms ease-out;
    opacity:0;
  `;
  // attach near canvas
  renderer.domElement.parentElement?.appendChild(popup);
}

// Track when the mouse is over the popup so we don't hide it
let overPopup = false;

popup.addEventListener("mouseenter", () => {
  overPopup = true;
});

popup.addEventListener("mouseleave", () => {
  overPopup = false;
});
// ==========================================
// HIGH-PRECISION lat/lon → 3D placement
// with texture alignment correction
// ==========================================
const LON_OFFSET = -0.25;   // adjust +/- 0–3 degrees after testing
const LAT_OFFSET = 1.59;   // adjust if texture seems vertically off
const PIN_LIFT = 1.005;   // closer to surface for better accuracy

function latLonToVector3(lat, lon, radius) {
  // Apply small manual alignment offsets to fix slight texture misalignment
  const adjLat = lat + LAT_OFFSET;
  const adjLon = lon + LON_OFFSET;

  // Convert to radians
  const phi = (90 - adjLat) * (Math.PI / 180);
  const theta = (adjLon + 180) * (Math.PI / 180);

  // Convert spherical → Cartesian
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y =  radius * Math.cos(phi);
  const z =  radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
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
// --- SPRITE PIN MESH (replaces sphere pins) ---
function createPinMesh(data) {
  // Clone material so hover effects don't affect all pins
  const s = new THREE.Sprite(pinSpriteMat.clone());

  // Base world size for sprite
  const baseSize = EARTH_RADIUS * 0.03; // small world scale

  // Slightly transparent by default; we'll brighten on hover
  s.material.opacity = 0.9;

  // Store data plus rendering metadata on userData
  s.userData = {
    ...data,
    baseSize: baseSize,
  };

  // Put pin above earth surface
  s.position.copy(latLonToVector3(data.lat, data.lon, PIN_SURFACE_R));

  // Initial scale; animate() will keep it in sync with zoom / hover
  s.scale.set(baseSize, baseSize, 1);

  return s;
}

const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  emissive: new THREE.Color(0x66cfff),
  emissiveIntensity: 0.7
});

function showPopup(screenX, screenY, d) {
  // If a bigger modal is open, don't show small popup
  if (
    document.getElementById("pinDetailsModal")?.classList.contains("show") ||
    document.getElementById("editPinModal")?.classList.contains("show")
  ) {
    return;
  }

  const username = d.user || "You";

  const hintText = d.isOwner
    ? "Click to view & edit details"
    : "Click to view details";

  popup.innerHTML = `
    <div style="display:flex; gap:10px; align-items:flex-start; max-width:260px;">
      ${
        d.imageUrl
          ? `<img src="${d.imageUrl}"
                 style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0;">`
          : ""
      }
      <div style="flex:1;">
        <div style="font-weight:600;margin-bottom:4px;overflow-wrap:anywhere;">
          ${d.caption || "No caption"}
        </div>
        <div style="font-size:12px;color:#cbd5e1;margin-bottom:4px;">
          @${username}
        </div>
        <div style="font-size:11px;color:#94a3b8;">
          ${hintText}
        </div>
      </div>
    </div>
  `;

  // Temporarily make visible to measure true size
  popup.style.display = "block";
  popup.style.visibility = "hidden";
  popup.style.opacity = "0";
  popup.style.transform = "scale(0.96) translateY(4px)";

  const rect = popup.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  // Position centered ABOVE the pin
  popup.style.left = `${screenX - w / 2}px`;
  popup.style.top = `${screenY - h - 14}px`;

  // Fade + scale in
  popup.style.visibility = "visible";
  popup.style.opacity = "1";
  popup.style.transform = "scale(1) translateY(0)";
}


function hidePopup() {
  // Animate out; after the transition completes, actually hide
  popup.style.opacity = "0";
  popup.style.transform = "scale(0.96) translateY(4px)";

  setTimeout(() => {
    if (popup.style.opacity === "0") {
      popup.style.display = "none";
    }
  }, 140);
}


renderer.domElement.addEventListener("mousemove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});


renderer.domElement.addEventListener("click", (e) => {
  if (!hoveredPin) return;
  const data = hoveredPin.userData;
  // Always open details modal first
  openPinDetails(data);
});

function openPinDetails(data) {
  const modal = document.getElementById("pinDetailsModal");

  // -------------------------------
  // 1) Build full image list
  //    (cover image + extra photos)
  // -------------------------------
  const allImages = [];
  if (data.imageUrl) {
    allImages.push(data.imageUrl);
  }
  if (Array.isArray(data.photos)) {
    data.photos.forEach((item) => {
      // Support both:
      //   ["https://...", "https://..."]
      //   [{ id: 1, url: "https://..." }, ...]
      let url = null;

      if (typeof item === "string") {
        url = item;
      } else if (item && typeof item === "object" && "url" in item) {
        url = item.url;
      }

      if (url) {
        allImages.push(url);
      }
    });
  }

  const mainImg = document.getElementById("detailImage");
  const thumbsRow = document.getElementById("detailThumbnails");

  // -------------------------------
  // 2) Caption text
  // -------------------------------
  document.getElementById("detailCaption").textContent =
    data.caption || "No caption";

  // -------------------------------
  // 3) Username (@handle)
  // -------------------------------
  document.getElementById("detailUser").textContent = data.user
    ? `@${data.user}`
    : "@unknown";

  // -------------------------------
  // 4) Pretty location (City, State, Country)
  // -------------------------------
  const city = data.city || "";
  const state = data.state || "";
  const country = data.country || "";

  let prettyLocation = "";
  if (city && state && country) {
    prettyLocation = `${city}, ${state}, ${country}`;
  } else if (city && country) {
    prettyLocation = `${city}, ${country}`;
  } else if (country) {
    prettyLocation = country;
  } else {
    prettyLocation = "Unknown location";
  }

  document.getElementById("detailLocation").textContent = prettyLocation;

  // -------------------------------
  // 5) Main image (big one on top)
  // -------------------------------
  if (allImages.length > 0) {
    mainImg.src = allImages[0];
    mainImg.style.display = "block";
  } else {
    mainImg.src = "";
    mainImg.style.display = "none";
  }

  // -------------------------------
  // 6) Thumbnails (small strip below)
  // -------------------------------
  if (thumbsRow) {
    // Clear any previous thumbnails
    thumbsRow.innerHTML = "";

    // Only bother if there is at least 1 image
    allImages.forEach((url, idx) => {
      const thumb = document.createElement("img");
      thumb.src = url;

      // Basic thumbnail styling
      thumb.style.width = "54px";
      thumb.style.height = "54px";
      thumb.style.objectFit = "cover";
      thumb.style.borderRadius = "10px";
      thumb.style.cursor = "pointer";
      thumb.style.flexShrink = "0";
      thumb.style.boxShadow =
        idx === 0
          ? "0 0 0 2px rgba(45,212,191,0.9)"
          : "0 0 0 1px rgba(148,163,184,0.5)";
      thumb.style.opacity = idx === 0 ? "1" : "0.6";

      // When user clicks a thumbnail → swap main image
      thumb.onclick = () => {
        mainImg.src = url;

        // Update highlight on all thumbs
        thumbsRow.querySelectorAll("img").forEach((imgEl) => {
          if (imgEl === thumb) {
            imgEl.style.opacity = "1";
            imgEl.style.boxShadow = "0 0 0 2px rgba(45,212,191,0.9)";
          } else {
            imgEl.style.opacity = "0.6";
            imgEl.style.boxShadow = "0 0 0 1px rgba(148,163,184,0.5)";
          }
        });
      };

      thumbsRow.appendChild(thumb);
    });
  }

  // -------------------------------
  // 7) Save pin ID for reactions / edit
  // -------------------------------
  modal.dataset.pinId = data.id;

  const ownerActions = document.getElementById("ownerActions");
  const editBtn = document.getElementById("editPinButton");

  if (ownerActions && editBtn) {
    if (data.isOwner) {
      ownerActions.style.display = "flex";
      editBtn.dataset.editPinId = data.id;
    } else {
      ownerActions.style.display = "none";
      editBtn.dataset.editPinId = "";
    }
  }

  // -------------------------------
  // 8) Reactions (same as before)
  // -------------------------------
  loadReactions(data.id);

  // -------------------------------
  // 9) Show modal
  // -------------------------------
  modal.classList.remove("hidden"); // ensure it's visible
  modal.classList.add("show");
}

async function loadReactions(pinId) {
  const res = await fetch(`/api/pin/${pinId}/`, { credentials: "same-origin" });
  if (!res.ok) return;

  const data = await res.json();

  // Reaction counts
  const countsDiv = document.getElementById("reactionCounts");
  countsDiv.innerHTML = "";

  const icons = { like: "👍", love: "❤️", laugh: "😂", wow: "😮" };

  for (const [emoji, count] of Object.entries(data.reaction_counts)) {
    countsDiv.innerHTML += `<span>${icons[emoji]} ${count}</span>`;
  }

  // Highlight user's reaction
  document.querySelectorAll(".react-btn").forEach((btn) => {
    btn.style.opacity = btn.dataset.emoji === data.user_reaction ? "1" : "0.4";
  });
}

async function loadMyPins() {
  try {
    const res = await fetch("/api/my-pins/", { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { pins } = await res.json();
    pinGroup.clear();
    pins.forEach((p) => {
      p.isOwner = true;
      pinGroup.add(createPinMesh(p));
    });
  } catch (err) {
    console.error("Failed to load pins:", err);
  }
}

window.addPinToGlobe = function (pin) {
  pin.isOwner = true; // treat as your pin for hover/edit logic

  // 1) Try to find an existing marker for this pin id
  const existing = pinGroup.children.find(
    (obj) => obj.userData && obj.userData.id === pin.id
  );

  if (existing) {
    // ✅ EDIT MODE: update the existing marker in-place
    // merge so we keep things like baseSize
    existing.userData = {
      ...existing.userData,
      ...pin,
    };
    existing.position.copy(latLonToVector3(pin.lat, pin.lon, PIN_SURFACE_R));
  } else {
    // ✅ ADD MODE: create a new marker
    const mesh = createPinMesh(pin);
    pinGroup.add(mesh);
  }

  // Optional: focus camera on this pin after save
  focusCameraOn(pin.lat, pin.lon);
};
// --- HOVER CHECK inside render loop ---
function updatePinHover() {
  const detailsOpen = document
    .getElementById("pinDetailsModal")
    ?.classList.contains("show");
  const editOpen = document
    .getElementById("editPinModal")
    ?.classList.contains("show");

  // If a big modal is open, hide small popup and clear hover state
  if (detailsOpen || editOpen) {
    hidePopup();
    if (hoveredPin) {
      hoveredPin.material.opacity = 0.9;
      hoveredPin = null;
    }
    renderer.domElement.style.cursor = "default";
    return;
  }

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pinGroup.children, false);

  if (hits.length > 0) {
    const obj = hits[0].object;

    if (hoveredPin !== obj) {
      // reset last hovered pin if any
      if (hoveredPin) {
        hoveredPin.material.opacity = 0.9; // base opacity
      }

      hoveredPin = obj;
      hoveredPin.material.opacity = 1.0; // brighter on hover
      renderer.domElement.style.cursor = "pointer";
    }

    // While hovered, keep popup pinned above the pin
    const v = hoveredPin.position.clone().project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    const sx = (v.x * 0.5 + 0.5) * rect.width;
    const sy = (-v.y * 0.5 + 0.5) * rect.height;
    showPopup(sx, sy, hoveredPin.userData);
  } else {
    if (!overPopup) {
      if (hoveredPin) {
        hoveredPin.material.opacity = 0.9;
        hoveredPin = null;
      }
      hidePopup();
      renderer.domElement.style.cursor = "default";
    }
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

  // Adjust pin size based on camera distance so they don't cover the whole screen when zoomed in
  const camDist = camera.position.length();
  const baseScale = THREE.MathUtils.clamp(
    camDist / (EARTH_RADIUS * 4),
    0.4,
    1.4
  );

  pinGroup.children.forEach((mesh) => {
    const spriteBase = mesh.userData.baseSize || EARTH_RADIUS * 0.03;

    // determine if hovered
    const isHovered = mesh === hoveredPin;

    // base factor keeps size proportional to camera distance
    const camFactor = baseScale;

    // tiny "breathing" pulse when hovered
    let hoverFactor = 1.0;
    if (isHovered) {
      const t = performance.now() * 0.005;
      const pulse = 1 + 0.08 * Math.sin(t);
      hoverFactor = 1.2 * pulse;
    }

    const finalScale = spriteBase * camFactor * hoverFactor;

    mesh.scale.set(finalScale, finalScale, 1);
  });

  // --- Animate sun orbit around Earth ---
  sunAngle += 0.0009; // speed of orbit (adjust slower/faster)
  const sunRadius = 12; // distance from Earth

  sunLight.position.set(
    Math.cos(sunAngle) * sunRadius,
    Math.sin(sunAngle * 0.6) * 4,  // slight vertical tilt
    Math.sin(sunAngle) * sunRadius
  );

  // Ensure light points toward Earth
  sunLight.lookAt(earth.position);

  renderer.render(scene, camera);
}
animate();

// ===============================
// CAMERA REVEAL + ORBIT
// ===============================
function revealMap({ toY = 0, toZ = 4.5, ms = 1000 } = {}) {
  const fromY = camera.position.y,
    fromZ = camera.position.z,
    start = performance.now();
  const card = document.getElementById("login-container");
  if (card) card.classList.add("fade-out");
  const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms),
      k = ease(t);
    camera.position.y = fromY + (toY - fromY) * k;
    camera.position.z = fromZ + (toZ - fromZ) * k;
    camera.lookAt(earth.position);
    if (t < 1) requestAnimationFrame(step);
    else enableOrbit();
  };
  requestAnimationFrame(step);
}

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
    const dx = x - orbitState.lastX,
      dy = y - orbitState.lastY;
    orbitState.lastX = x;
    orbitState.lastY = y;

    spherical.setFromVector3(camera.position.clone());
    spherical.theta -= dx * 0.005;
    spherical.phi -= dy * 0.005;
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

  // ------------------------------------
  // ZOOM SUPPORT (scroll wheel & pinch)
  // ------------------------------------
  const minDist = EARTH_RADIUS * 1.08; // extremely close
  const maxDist = EARTH_RADIUS * 3.0; // allow more zoom-out too

  function applyZoom(delta) {
    spherical.setFromVector3(camera.position.clone());
    spherical.radius += delta * 0.01; // adjust zoom sensitivity
    spherical.radius = Math.max(minDist, Math.min(maxDist, spherical.radius));
    camera.position.setFromSpherical(spherical);
    camera.lookAt(earth.position);
  }

  // Mouse wheel zoom
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      applyZoom(e.deltaY);
    },
    { passive: false }
  );

  // Pinch zoom (trackpad)
  let lastDistance = null;
  renderer.domElement.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (lastDistance != null) {
          applyZoom((lastDistance - dist) * 0.5);
        }
        lastDistance = dist;
      }
    },
    { passive: true }
  );

  renderer.domElement.addEventListener("touchend", () => {
    lastDistance = null;
  });

  // ------------------------------------
  // MacBook Safari/Chrome Trackpad Pinch (gesture events)
  // ------------------------------------
  let lastScale = 1;

  renderer.domElement.addEventListener("gesturestart", (e) => {
    e.preventDefault();
    lastScale = e.scale;
  });

  renderer.domElement.addEventListener("gesturechange", (e) => {
    e.preventDefault();

    const scaleChange = e.scale - lastScale;
    lastScale = e.scale;

    // Convert scale change into zoom delta
    applyZoom(-scaleChange * 150); // Larger multiplier = stronger zoom
  });

  renderer.domElement.addEventListener("gestureend", (e) => {
    e.preventDefault();
    lastScale = 1;
  });

  // Once orbit is live, load pins (so they appear on the fully revealed map)
  loadMyPins();
}

// --- RESIZE ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===============================
// GLOBAL SEARCH FEATURE (Cities, Countries, Anything)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("search-btn");
  const input = document.getElementById("country-input");

  if (!searchBtn || !input) return;

  searchBtn.addEventListener("click", async () => {
    const query = input.value.trim();
    if (!query) return alert("Please enter a location name.");

    try {
      const res = await fetch(`/api/search/?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Search failed — location not found.");
        return;
      }

      const data = await res.json();
      console.log("Search results:", data);

      // Move camera to the geocoded location
      const [lat, lon] = data.center;
      moveCameraTo(lat, lon);

      // Render the pins returned from that region
      showPins(data.pins);
    } catch (err) {
      console.error("Search error:", err);
    }
  });
});

// ===============================
// EDIT PIN BUTTON HANDLER
// ===============================

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".edit-pin-btn");
  if (!btn) return;

  const pinId = Number(btn.getAttribute("data-edit-pin-id"));
  if (pinId && window.openEditModal) {
    window.openEditModal(pinId);
  }
});

function moveCameraTo(lat, lon) {
  console.log(`Move camera to lat=${lat}, lon=${lon}`);

  const target = latLonToVector3(lat, lon, EARTH_RADIUS * 2.5);
  const startPos = camera.position.clone();
  const start = performance.now();
  const duration = 1200;

  function animateMove(now) {
    const t = Math.min(1, (now - start) / duration);
    const k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(startPos, target, k);
    camera.lookAt(earth.position);
    if (t < 1) requestAnimationFrame(animateMove);
  }
  requestAnimationFrame(animateMove);
}

function showPins(pins) {
  pinGroup.clear();
  pins.forEach((p) => {
    p.isOwner = p.user === window.CURRENT_USER; // 👈 owner if username matches
    pinGroup.add(createPinMesh(p));
  });
}

// ===============================
// FACEBOOK-STYLE REACTION POPUP
// ===============================
const reactionTrigger = document.getElementById("reactionTrigger");
const reactionPopup = document.getElementById("reactionPopup");
const userReaction = document.getElementById("userReaction");
const reactionSummary = document.getElementById("reactionSummary");

let popupVisible = false;

// Position popup above trigger
function showReactionPopup() {
  const rect = reactionTrigger.getBoundingClientRect();
  reactionPopup.style.left = `${rect.left + rect.width / 2 - 80}px`;
  reactionPopup.style.top = `${rect.top - 60}px`;

  reactionPopup.style.opacity = "1";
  reactionPopup.style.pointerEvents = "auto";
  popupVisible = true;
}

function hideReactionPopup() {
  reactionPopup.style.opacity = "0";
  reactionPopup.style.pointerEvents = "none";
  popupVisible = false;
}
// ===============================
// PIN DETAILS MODAL CLOSE BUTTON
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const detailsModal = document.getElementById("pinDetailsModal");
  const closeDetailsBtn = document.getElementById("closePinDetails");

  if (!detailsModal || !closeDetailsBtn) return;

  closeDetailsBtn.addEventListener("click", () => {
    // hide the details modal completely
    detailsModal.classList.remove("show");
    detailsModal.classList.add("hidden");

    // also hide the reaction popup if it's open
    if (typeof hideReactionPopup === "function") {
      hideReactionPopup();
    }
  });
});

// Show on hover — desktop optimized
reactionTrigger.addEventListener("mouseenter", showReactionPopup);
reactionTrigger.addEventListener("mouseleave", () => {
  setTimeout(() => {
    if (!reactionPopup.matches(":hover")) hideReactionPopup();
  }, 150);
});

reactionPopup.addEventListener("mouseleave", hideReactionPopup);

// Hover animation
document.querySelectorAll(".popup-react").forEach((emoji) => {
  emoji.addEventListener("mouseenter", () => {
    emoji.style.transform = "scale(1.3)";
    emoji.style.transition = "0.15s ease";
  });
  emoji.addEventListener("mouseleave", () => {
    emoji.style.transform = "scale(1.0)";
  });

  emoji.addEventListener("click", async () => {
    const emojiType = emoji.dataset.emoji;
    const pinId = document.getElementById("pinDetailsModal").dataset.pinId;

    // Update UI instantly
    userReaction.textContent = emoji.textContent;
    reactionSummary.textContent = "Reacted";

    hideReactionPopup();

    // Send reaction to backend
    const res = await fetch(`/api/react/${pinId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": document.querySelector("[name=csrfmiddlewaretoken]")?.value,
      },
      body: JSON.stringify({ emoji: emojiType }),
    });

    if (res.ok) loadReactions(pinId);
  });
});