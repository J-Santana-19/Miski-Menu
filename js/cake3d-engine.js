import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const INCH_TO_UNIT = 0.22;

const TOPPER_FINISHES = {
  gold: { label: "Dorado", hex: "#d4af37", accent: "#fff3c4" },
  rosegold: { label: "Rose Gold", hex: "#d89588", accent: "#fbe4df" },
  cacao: { label: "Cacao Miski", hex: "#503629", accent: "#e8cbb1" },
  silver: { label: "Plata", hex: "#cfd6df", accent: "#ffffff" },
};

/**
 * Parses a product + matrix row size label into concrete 3D physical dimensions in inches.
 */
export function parseCakeSpec(product, sizeLabel = "") {
  const id = String(product?.id || "");
  const label = String(sizeLabel || "");
  const clean = label.replace(/[”″"]/g, '"').trim();

  // Optional Postres category support (representative 3D dessert models)
  if (product?.category === "postres") {
    return parseDessertSpec(product);
  }

  // Multi-tier cakes ("6\" + 8\" + 10\"", "8 y 6\"", etc.)
  const isTieredMatrix = product?.matrixType === "tiered" || id === "dul-dos-pisos-tematico";
  if (isTieredMatrix) {
    const nums = (clean.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter((n) => n > 0);
    const diameters = nums.length ? [...nums].sort((a, b) => b - a) : [8, 6];
    const tierHeight = diameters.length >= 3 ? 4.1 : 4.4;
    return {
      kind: "tiered",
      shape: "round",
      label: clean || diameters.map((d) => `${d}"`).join(" + "),
      tiers: diameters.map((diameter, idx) => ({
        tierIndex: idx,
        shape: "round",
        diameter,
        height: tierHeight,
      })),
      hasTopperDefault: id === "dul-dos-pisos-tematico",
      hasFruitsDefault: false,
      isGlossyCold: false,
      isPhotocakeDefault: false,
    };
  }

  // Cake Topper tall round cylinders ("6x5\" (Con Topper)", "8x7\" (Sin Topper)")
  if (id === "dul-cake-topper") {
    const nums = (clean.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    const diameter = nums[0] || 6;
    const height = nums[1] || 5;
    const hasTopper = !/sin topper/i.test(clean);
    return {
      kind: "single",
      shape: "round",
      label: clean,
      tiers: [{ tierIndex: 0, shape: "round", diameter, height }],
      hasTopperDefault: hasTopper,
      hasFruitsDefault: false,
      isGlossyCold: false,
      isPhotocakeDefault: false,
    };
  }

  // Round fruit cake ("8\" Redondo")
  if (/redondo/i.test(clean) || id === "dul-frutas-redondo") {
    const nums = (clean.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    const diameter = nums[0] || 8;
    return {
      kind: "single",
      shape: "round",
      label: clean || '8" Redondo',
      tiers: [{ tierIndex: 0, shape: "round", diameter, height: 4.5 }],
      hasTopperDefault: false,
      hasFruitsDefault: id === "dul-frutas-redondo",
      isGlossyCold: false,
      isPhotocakeDefault: false,
    };
  }

  // Rectangular / Square cakes ("8x12\"", "8x17\"", "12x17\"", "17x17\"", "17x26\"")
  const rectMatch = clean.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  const depthIn = rectMatch ? Number(rectMatch[1]) : 8;
  const widthIn = rectMatch ? Number(rectMatch[2]) : 12;
  const heightIn = widthIn >= 24 ? 4.4 : 4.0;

  return {
    kind: "single",
    shape: widthIn === depthIn ? "square" : "rect",
    label: clean || `${depthIn}x${widthIn}"`,
    tiers: [
      {
        tierIndex: 0,
        shape: "rect",
        width: widthIn,
        depth: depthIn,
        height: heightIn,
      },
    ],
    hasTopperDefault: false,
    hasFruitsDefault: id === "dul-frutas-rect",
    isGlossyCold: id === "dul-frios-rect",
    isPhotocakeDefault: id === "dul-photocake",
  };
}

function parseDessertSpec(product) {
  const id = String(product.id || "");
  if (id === "pos-tres-leches-grande") {
    return {
      kind: "dessert",
      dessertStyle: "tray",
      shape: "rect",
      label: "Familiar",
      tiers: [{ tierIndex: 0, shape: "rect", width: 11, depth: 8, height: 3.0 }],
      hasTopperDefault: false,
      hasFruitsDefault: false,
      isGlossyCold: true,
      isPhotocakeDefault: false,
    };
  }
  if (id.includes("flan") || id.includes("gelatina")) {
    return {
      kind: "dessert",
      dessertStyle: id.includes("chocoflan") ? "chocoflan" : id.includes("gelatina") ? "gelatin" : "flan",
      shape: "round",
      label: "Porción individual",
      tiers: [{ tierIndex: 0, shape: "round", diameter: 5.5, height: 3.4 }],
      hasTopperDefault: false,
      hasFruitsDefault: id.includes("frutas"),
      isGlossyCold: true,
      isPhotocakeDefault: false,
    };
  }
  if (id.includes("cheesecake") || id.includes("pie") || id.includes("tartaleta")) {
    return {
      kind: "dessert",
      dessertStyle: id.includes("tartaleta") ? "tart" : "cheesecake",
      shape: "round",
      label: "Porción redonda",
      tiers: [{ tierIndex: 0, shape: "round", diameter: 6.5, height: 3.2 }],
      hasTopperDefault: false,
      hasFruitsDefault: id.includes("tartaleta") || id.includes("cheesecake"),
      isGlossyCold: false,
      isPhotocakeDefault: false,
    };
  }
  return {
    kind: "dessert",
    dessertStyle: "cup",
    shape: "round",
    label: "Postre en vaso / porción",
    tiers: [{ tierIndex: 0, shape: "round", diameter: 5.0, height: 4.2 }],
    hasTopperDefault: false,
    hasFruitsDefault: id.includes("fresas"),
    isGlossyCold: true,
    isPhotocakeDefault: false,
  };
}

function createFrostingBumpMap(type) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 256, 256);

  if (type === "merengue") {
    // Artisan spatula wave ridges
    for (let y = 0; y < 256; y += 8) {
      const grad = ctx.createLinearGradient(0, y, 0, y + 8);
      grad.addColorStop(0, "#646464");
      grad.addColorStop(0.5, "#adadad");
      grad.addColorStop(1, "#686868");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) {
        const wave = Math.sin((x / 256) * Math.PI * 4 + y * 0.08) * 2.2;
        ctx.lineTo(x, y + wave);
      }
      ctx.lineTo(256, y + 8);
      ctx.lineTo(0, y + 8);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Soft fine whipped Chantilly grain
    for (let i = 0; i < 1800; i += 1) {
      const x = (i * 73) % 256;
      const y = (i * 139) % 256;
      const v = 116 + ((i * 29) % 28);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createWoodBoardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4ebdc";
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "rgba(200, 125, 70, 0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 256; i += 14) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.bezierCurveTo(85, i + 4, 170, i - 4, 256, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createTopperSignTexture(text, finishKey) {
  const finish = TOPPER_FINISHES[finishKey] || TOPPER_FINISHES.gold;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 320);

  // Decorative arch & badge
  const grad = ctx.createLinearGradient(60, 30, 452, 270);
  grad.addColorStop(0, finish.accent);
  grad.addColorStop(0.5, finish.hex);
  grad.addColorStop(1, finish.hex);

  ctx.save();
  ctx.fillStyle = grad;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;

  // Plaque shape with rounded top crown
  ctx.beginPath();
  ctx.roundRect(44, 58, 424, 198, 44);
  ctx.fill();
  ctx.stroke();

  // Top crown medallion
  ctx.beginPath();
  ctx.arc(256, 56, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner hairline border
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(60, 74, 392, 166, 32);
  ctx.stroke();

  // Star glyph inside medallion
  ctx.fillStyle = finishKey === "cacao" ? "#faf4ec" : "#3b2314";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★", 256, 56);

  // Custom topper text wrapped up to 2 lines
  const cleanText = String(text || "Feliz Cumpleaños").trim() || "Feliz Cumpleaños";
  const words = cleanText.split(/\s+/);
  let lines = [cleanText];
  if (cleanText.length > 14 && words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }

  ctx.fillStyle = finishKey === "cacao" ? "#faf4ec" : "#3b2314";
  const fontSize = lines.length > 1 ? 42 : cleanText.length > 12 ? 44 : 52;
  ctx.font = `700 ${fontSize}px "Cormorant Garamond", Georgia, serif`;

  if (lines.length === 1) {
    ctx.fillText(lines[0], 256, 158, 360);
  } else {
    ctx.fillText(lines[0], 256, 134, 360);
    ctx.fillText(lines[1], 256, 184, 360);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map && !m.userData?.keepTexture) m.map.dispose();
        if (m.bumpMap && !m.userData?.keepTexture) m.bumpMap.dispose();
        m.dispose();
      }
    }
  });
  group.clear();
}

export class Cake3DEngine {
  constructor(canvas, { onTierPick } = {}) {
    this.canvas = canvas;
    this.onTierPick = onTierPick;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(4.8, 3.8, 5.4);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.minPolarAngle = 0.12;
    this.controls.minDistance = 2.4;
    this.controls.maxDistance = 15;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.8;

    this.bumpMerengue = createFrostingBumpMap("merengue");
    this.bumpChantilly = createFrostingBumpMap("chantilly");
    this.boardTex = createWoodBoardTexture();

    this.boardGroup = new THREE.Group();
    this.cakeGroup = new THREE.Group();
    this.extrasGroup = new THREE.Group();
    this.selectionGroup = new THREE.Group();
    this.decalsGroup = new THREE.Group();

    this.scene.add(this.boardGroup);
    this.scene.add(this.cakeGroup);
    this.scene.add(this.extrasGroup);
    this.scene.add(this.selectionGroup);
    this.scene.add(this.decalsGroup);

    this.tierMeshes = [];
    this.currentSpec = null;
    this.currentMaxDim = 3;
    this.currentTotalHeight = 1.2;

    this._setupLights();
    this._setupResize();
    this._setupTierClick();
    this._animate();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight("#fff9f0", "#c9aa8b", 1.15);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight("#fff8ee", 1.65);
    keyLight.position.set(5.5, 8.5, 6.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    const d = 5.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#fde8d3", 0.72);
    fillLight.position.set(-6, 4.2, -3.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#ffdfba", 0.52);
    rimLight.position.set(0, 5, -7);
    this.scene.add(rimLight);

    // Soft studio shadow catcher plane
    const floorGeo = new THREE.CircleGeometry(14, 48);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.14 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.14;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  _setupResize() {
    const resize = () => {
      const parent = this.canvas.parentElement;
      if (!parent) return;
      const w = Math.max(parent.clientWidth, 100);
      const h = Math.max(parent.clientHeight, 100);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    this._ro = new ResizeObserver(resize);
    if (this.canvas.parentElement) this._ro.observe(this.canvas.parentElement);
    resize();
  }

  _setupTierClick() {
    let downPos = null;
    const raycaster = new THREE.Raycaster();
    const ptr = new THREE.Vector2();

    this.canvas.addEventListener("pointerdown", (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener("pointerup", (e) => {
      if (!downPos || !this.onTierPick) return;
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (dist > 6) return;

      const rect = this.canvas.getBoundingClientRect();
      ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ptr, this.camera);
      const hits = raycaster.intersectObjects(this.tierMeshes, false);
      if (hits.length > 0) {
        const tierIndex = hits[0].object.userData?.tierIndex;
        if (typeof tierIndex === "number") {
          this.onTierPick(tierIndex);
        }
      }
    });
  }

  _animate() {
    this._raf = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = Boolean(enabled);
  }

  setOrbitEnabled(enabled) {
    this.controls.enabled = Boolean(enabled);
  }

  setCameraPreset(preset) {
    const span = Math.max(this.currentMaxDim, this.currentTotalHeight * 1.15, 2.2);
    const targetY = Math.max(this.currentTotalHeight * 0.48, 0.45);
    this.controls.target.set(0, targetY, 0);

    if (preset === "front") {
      this.camera.position.set(0, targetY + span * 0.25, span * 1.85);
    } else if (preset === "top") {
      this.camera.position.set(0, span * 2.15, 0.35);
    } else if (preset === "iso" || preset === "reset") {
      this.camera.position.set(span * 1.35, targetY + span * 0.95, span * 1.55);
    }
    this.controls.update();
  }

  buildCake(state, { refitCamera = false } = {}) {
    disposeGroup(this.boardGroup);
    disposeGroup(this.cakeGroup);
    disposeGroup(this.extrasGroup);
    disposeGroup(this.selectionGroup);
    this.tierMeshes = [];

    const spec = parseCakeSpec(state.selectedProduct, state.selectedSizeLabel);
    this.currentSpec = spec;

    const wScale = state.widthScale || 1;
    const hScale = state.heightScale || 1;
    const isMerengue = state.frosting === "merengue";
    const bumpTex = isMerengue ? this.bumpMerengue : this.bumpChantilly;

    let currentY = 0;
    let maxExtentX = 1.6;
    let maxExtentZ = 1.6;
    let topTierMeta = null;

    spec.tiers.forEach((tier, idx) => {
      const colorHex = state.tierColors[idx] || state.tierColors[0] || "#FFF9F0";
      const tierH = tier.height * INCH_TO_UNIT * hScale;

      let mesh;
      let halfW;
      let halfD;

      if (tier.shape === "round") {
        const radius = (tier.diameter / 2) * INCH_TO_UNIT * wScale;
        const bottomRadius =
          spec.dessertStyle === "flan" || spec.dessertStyle === "chocoflan" || spec.dessertStyle === "gelatin"
            ? radius * 1.18
            : spec.dessertStyle === "cup"
            ? radius * 0.82
            : radius;
        const topRadius =
          spec.dessertStyle === "flan" || spec.dessertStyle === "chocoflan" || spec.dessertStyle === "gelatin"
            ? radius * 0.92
            : radius;

        const geo = new THREE.CylinderGeometry(topRadius, bottomRadius, tierH, 64, 12);
        const mat = this._createCakeMaterial(colorHex, bumpTex, isMerengue, spec.isGlossyCold, spec.dessertStyle);
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, currentY + tierH / 2, 0);
        halfW = radius;
        halfD = radius;
      } else {
        const w = tier.width * INCH_TO_UNIT * wScale;
        const d = tier.depth * INCH_TO_UNIT * wScale;
        const bevel = Math.min(0.08, tierH * 0.14);
        const geo = new RoundedBoxGeometry(w, tierH, d, 6, bevel);
        const mat = this._createCakeMaterial(colorHex, bumpTex, isMerengue, spec.isGlossyCold, spec.dessertStyle);
        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, currentY + tierH / 2, 0);
        halfW = w / 2;
        halfD = d / 2;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        isCakeTier: true,
        tierIndex: idx,
        shape: tier.shape,
        halfW,
        halfD,
        height: tierH,
        bottomY: currentY,
        topY: currentY + tierH,
      };

      this.cakeGroup.add(mesh);
      this.tierMeshes.push(mesh);

      // Piping / border frosting pearls (top & bottom of each tier)
      if (spec.kind !== "dessert") {
        this._addPipingBorder(tier, halfW, halfD, currentY, tierH, state.borderColor || "#C87D46");
      }

      // Selection ring if editing a specific tier on multi-tier cakes
      if (spec.tiers.length > 1 && state.activeTierIndex === idx) {
        const ringGeo = new THREE.RingGeometry(halfW + 0.07, halfW + 0.12, 64);
        const ringMat = new THREE.MeshBasicMaterial({
          color: "#C87D46",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = currentY + 0.015;
        this.selectionGroup.add(ring);
      }

      maxExtentX = Math.max(maxExtentX, halfW * 2);
      maxExtentZ = Math.max(maxExtentZ, halfD * 2);

      topTierMeta = {
        tierIndex: idx,
        shape: tier.shape,
        halfW,
        halfD,
        topY: currentY + tierH,
      };
      currentY += tierH;
    });

    this.currentMaxDim = Math.max(maxExtentX, maxExtentZ);
    this.currentTotalHeight = currentY + (state.enableTopper ? 1.3 : 0);

    // Cake board / tray underneath
    this._buildCakeBoard(spec.shape, maxExtentX, maxExtentZ, state.showCutaway);

    // Extras: Cold chocolate/glaze drip, Fruits 3D, Topper 3D, Cutaway Slice
    if (spec.isGlossyCold && spec.kind !== "dessert") {
      this._buildColdGlazeRim(topTierMeta, state.borderColor || "#C87D46");
    }

    if (state.enableFruits && topTierMeta) {
      this._buildFruits3D(topTierMeta);
    }

    if (state.enableTopper && topTierMeta) {
      this._buildTopper3D(topTierMeta, state.topperText, state.topperFinish);
    }

    if (state.showCutaway) {
      this._buildSliceCutaway(maxExtentX, maxExtentZ, state.sponge, state.tierColors[0]);
    }

    this.cakeGroup.updateMatrixWorld(true);

    if (refitCamera) {
      this.setCameraPreset("iso");
    }
  }

  _createCakeMaterial(colorHex, bumpTex, isMerengue, isGlossy, dessertStyle) {
    let color = colorHex;
    let roughness = isMerengue ? 0.36 : 0.7;
    let bumpScale = isMerengue ? 0.014 : 0.004;
    let opacity = 1;
    let transparent = false;

    if (dessertStyle === "flan") {
      color = "#f6c96e";
      roughness = 0.22;
      bumpScale = 0.001;
    } else if (dessertStyle === "chocoflan") {
      color = "#633822";
      roughness = 0.35;
    } else if (dessertStyle === "gelatin") {
      color = "#df4a5e";
      roughness = 0.14;
      bumpScale = 0;
    } else if (dessertStyle === "tart" || dessertStyle === "cheesecake") {
      color = "#fff5dc";
      roughness = 0.5;
    } else if (isGlossy) {
      roughness = 0.24;
      bumpScale = 0.005;
    }

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness: 0.02,
      bumpMap: bumpTex,
      bumpScale,
      transparent,
      opacity,
      userData: { keepTexture: true },
    });
  }

  _buildCakeBoard(shape, extentX, extentZ, extraMargin = false) {
    const boardMat = new THREE.MeshStandardMaterial({
      color: "#fffdf9",
      map: this.boardTex,
      roughness: 0.45,
      metalness: 0.05,
      userData: { keepTexture: true },
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: "#c87d46",
      roughness: 0.35,
      metalness: 0.35,
    });

    const pad = extraMargin ? 0.72 : 0.48;

    if (shape === "round") {
      const r = Math.max(extentX, extentZ) / 2 + pad;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, 0.11, 64), boardMat);
      plate.position.y = -0.055;
      plate.receiveShadow = true;
      plate.castShadow = true;
      this.boardGroup.add(plate);

      const trim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.024, 12, 64), rimMat);
      trim.rotation.x = Math.PI / 2;
      trim.position.y = -0.01;
      this.boardGroup.add(trim);
    } else {
      const w = extentX + pad * 2;
      const d = extentZ + pad * 2;
      const plate = new THREE.Mesh(new RoundedBoxGeometry(w, 0.11, d, 4, 0.04), boardMat);
      plate.position.y = -0.055;
      plate.receiveShadow = true;
      plate.castShadow = true;
      this.boardGroup.add(plate);

      const trim = new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, 0.04, d + 0.04, 4, 0.03), rimMat);
      trim.position.y = -0.095;
      this.boardGroup.add(trim);
    }
  }

  _addPipingBorder(tier, halfW, halfD, bottomY, tierH, borderHex) {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(borderHex),
      roughness: 0.42,
      metalness: 0.02,
      bumpMap: this.bumpMerengue,
      bumpScale: 0.008,
      userData: { keepTexture: true },
    });

    const pearlGeo = new THREE.SphereGeometry(0.052, 10, 8);
    const positions = [];

    if (tier.shape === "round") {
      const count = Math.max(20, Math.round(halfW * 28));
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        positions.push([Math.cos(a) * (halfW + 0.02), bottomY + 0.04, Math.sin(a) * (halfW + 0.02)]);
        positions.push([Math.cos(a) * (halfW - 0.03), bottomY + tierH + 0.02, Math.sin(a) * (halfW - 0.03)]);
      }
    } else {
      const step = 0.19;
      const nx = Math.max(4, Math.floor((halfW * 2) / step));
      const nz = Math.max(4, Math.floor((halfD * 2) / step));
      for (let i = 0; i <= nx; i += 1) {
        const x = -halfW + (i / nx) * (halfW * 2);
        positions.push([x, bottomY + 0.04, halfD + 0.015]);
        positions.push([x, bottomY + 0.04, -halfD - 0.015]);
        positions.push([x, bottomY + tierH + 0.015, halfD - 0.05]);
        positions.push([x, bottomY + tierH + 0.015, -halfD + 0.05]);
      }
      for (let j = 1; j < nz; j += 1) {
        const z = -halfD + (j / nz) * (halfD * 2);
        positions.push([halfW + 0.015, bottomY + 0.04, z]);
        positions.push([-halfW - 0.015, bottomY + 0.04, z]);
        positions.push([halfW - 0.05, bottomY + tierH + 0.015, z]);
        positions.push([-halfW + 0.05, bottomY + tierH + 0.015, z]);
      }
    }

    const inst = new THREE.InstancedMesh(pearlGeo, mat, positions.length);
    const dummy = new THREE.Object3D();
    positions.forEach((p, idx) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.set(1, 0.85, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    this.cakeGroup.add(inst);
  }

  _buildColdGlazeRim(topMeta, borderHex) {
    const glazeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(borderHex),
      roughness: 0.15,
      metalness: 0.04,
      transparent: true,
      opacity: 0.88,
    });
    const w = topMeta.halfW * 1.92;
    const d = topMeta.halfD * 1.92;
    const glaze = new THREE.Mesh(new RoundedBoxGeometry(w, 0.035, d, 3, 0.015), glazeMat);
    glaze.position.set(0, topMeta.topY + 0.01, 0);
    this.extrasGroup.add(glaze);
  }

  _buildFruits3D(topMeta) {
    const berryMat = new THREE.MeshStandardMaterial({ color: "#c92034", roughness: 0.28 });
    const leafMat = new THREE.MeshStandardMaterial({ color: "#2d7a3e", roughness: 0.55 });
    const kiwiMat = new THREE.MeshStandardMaterial({ color: "#6db33f", roughness: 0.4 });
    const peachMat = new THREE.MeshStandardMaterial({ color: "#f69d3b", roughness: 0.32 });
    const cherryMat = new THREE.MeshStandardMaterial({ color: "#9e0b22", roughness: 0.16 });

    const points = [];
    if (topMeta.shape === "round") {
      const r = topMeta.halfW * 0.68;
      const count = 10;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        points.push([Math.cos(a) * r, topMeta.topY, Math.sin(a) * r, a]);
      }
      points.push([0, topMeta.topY, 0, 0]);
    } else {
      const rx = topMeta.halfW * 0.72;
      const rz = topMeta.halfD * 0.72;
      const perim = [
        [-rx, -rz],
        [0, -rz],
        [rx, -rz],
        [rx, 0],
        [rx, rz],
        [0, rz],
        [-rx, rz],
        [-rx, 0],
        [-rx * 0.45, -rz * 0.45],
        [rx * 0.45, -rz * 0.45],
        [rx * 0.45, rz * 0.45],
        [-rx * 0.45, rz * 0.45],
      ];
      perim.forEach(([x, z], idx) => points.push([x, topMeta.topY, z, idx * 0.8]));
    }

    points.forEach(([x, y, z, angle], idx) => {
      const kind = idx % 4;
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = angle;

      if (kind === 0) {
        // Strawberry
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 12), berryMat);
        cone.rotation.x = Math.PI;
        cone.position.y = 0.1;
        cone.castShadow = true;
        const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.02, 0.03, 6), leafMat);
        leaf.position.y = 0.2;
        g.add(cone, leaf);
      } else if (kind === 1) {
        // Kiwi slice
        const kiwi = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 16), kiwiMat);
        kiwi.position.y = 0.05;
        kiwi.rotation.x = 0.35;
        kiwi.castShadow = true;
        g.add(kiwi);
      } else if (kind === 2) {
        // Peach wedge
        const peach = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10, 0, Math.PI), peachMat);
        peach.scale.set(1.2, 0.75, 0.65);
        peach.position.y = 0.06;
        peach.castShadow = true;
        g.add(peach);
      } else {
        // Glazed cherry
        const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), cherryMat);
        cherry.position.y = 0.085;
        cherry.castShadow = true;
        g.add(cherry);
      }

      this.extrasGroup.add(g);
    });
  }

  _buildTopper3D(topMeta, topperText, finishKey) {
    const finish = TOPPER_FINISHES[finishKey] || TOPPER_FINISHES.gold;
    const stickMat = new THREE.MeshStandardMaterial({
      color: finish.hex,
      roughness: 0.25,
      metalness: 0.7,
    });

    const group = new THREE.Group();
    const baseY = topMeta.topY;

    // Two support picks
    const stickGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8);
    const leftStick = new THREE.Mesh(stickGeo, stickMat);
    leftStick.position.set(-0.28, baseY + 0.24, 0);
    const rightStick = new THREE.Mesh(stickGeo, stickMat);
    rightStick.position.set(0.28, baseY + 0.24, 0);

    // Topper plaque with high-res dynamic typography
    const tex = createTopperSignTexture(topperText, finishKey);
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.12,
      roughness: 0.28,
      metalness: 0.45,
      side: THREE.DoubleSide,
    });
    const signWidth = Math.min(1.65, Math.max(1.05, topMeta.halfW * 1.45));
    const signHeight = signWidth * 0.625;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(signWidth, signHeight), signMat);
    sign.position.set(0, baseY + 0.42 + signHeight * 0.45, 0);
    sign.castShadow = true;

    group.add(leftStick, rightStick, sign);
    this.extrasGroup.add(group);
  }

  _buildSliceCutaway(extentX, extentZ, spongeFlavor, frostingColor) {
    const isChoc = spongeFlavor === "chocolate";
    const spongeMat = new THREE.MeshStandardMaterial({
      color: isChoc ? "#4a2716" : "#f2cf8d",
      roughness: 0.85,
    });
    const manjarMat = new THREE.MeshStandardMaterial({
      color: "#b56727",
      roughness: 0.35,
    });
    const frostingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(frostingColor || "#fff9f0"),
      roughness: 0.42,
    });

    const wedgeShape = new THREE.Shape();
    const radius = 0.42;
    const angle = Math.PI * 0.34;
    wedgeShape.moveTo(0, 0);
    wedgeShape.lineTo(radius, 0);
    wedgeShape.absarc(0, 0, radius, 0, angle, false);
    wedgeShape.closePath();

    const sliceGroup = new THREE.Group();
    const layers = [
      { h: 0.11, mat: spongeMat },
      { h: 0.045, mat: manjarMat },
      { h: 0.11, mat: spongeMat },
      { h: 0.045, mat: manjarMat },
      { h: 0.11, mat: spongeMat },
      { h: 0.045, mat: frostingMat },
    ];

    let y = 0;
    for (const layer of layers) {
      const geo = new THREE.ExtrudeGeometry(wedgeShape, {
        depth: layer.h,
        bevelEnabled: false,
        curveSegments: 16,
      });
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, layer.mat);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sliceGroup.add(mesh);
      y += layer.h;
    }

    // Back frosting shell covering the curved outer edge of the slice
    const backArcGeo = new THREE.CylinderGeometry(radius + 0.012, radius + 0.012, y, 16, 1, true, Math.PI / 2, angle);
    const backShellMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(frostingColor || "#fff9f0"),
      roughness: 0.42,
      side: THREE.DoubleSide,
    });
    const backShell = new THREE.Mesh(backArcGeo, backShellMat);
    backShell.position.y = y / 2;
    sliceGroup.add(backShell);

    sliceGroup.position.set(extentX * 0.12, 0.005, extentZ / 2 + 0.5);
    sliceGroup.rotation.y = Math.PI * 0.22;
    this.extrasGroup.add(sliceGroup);
  }

  /**
   * Captures a clean PNG snapshot of the 3D viewport (hiding selection rings temporarily).
   */
  captureCleanDataUrl() {
    const prevVis = this.selectionGroup.visible;
    this.selectionGroup.visible = false;
    this.renderer.render(this.scene, this.camera);
    const dataUrl = this.canvas.toDataURL("image/png");
    this.selectionGroup.visible = prevVis;
    this.renderer.render(this.scene, this.camera);
    return dataUrl;
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    disposeGroup(this.boardGroup);
    disposeGroup(this.cakeGroup);
    disposeGroup(this.extrasGroup);
    disposeGroup(this.selectionGroup);
    disposeGroup(this.decalsGroup);
    this.bumpMerengue.dispose();
    this.bumpChantilly.dispose();
    this.boardTex.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
