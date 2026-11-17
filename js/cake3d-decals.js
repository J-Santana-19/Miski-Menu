import * as THREE from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";

export const STICKER_PRESETS = [
  { id: "photocake-bday", label: "🎂 Feliz Cumple", aspect: 1.4 },
  { id: "miski-seal", label: "🤎 Sello Miski", aspect: 1.0 },
  { id: "quince", label: "👑 Mis 15 Años", aspect: 1.25 },
  { id: "boda", label: "💍 Nuestra Boda", aspect: 1.25 },
  { id: "baby", label: "🍼 Baby Shower", aspect: 1.3 },
  { id: "hearts", label: "💖 Corazones", aspect: 1.0 },
];

function createStickerTexture(presetId) {
  const canvas = document.createElement("canvas");
  const isWide = presetId === "photocake-bday" || presetId === "baby";
  const isMed = presetId === "quince" || presetId === "boda";
  canvas.width = isWide ? 700 : isMed ? 620 : 512;
  canvas.height = 500;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, w, h);

  if (presetId === "photocake-bday") {
    // Festive edible rice-paper Photocake sheet
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#fffaf2");
    bg.addColorStop(1, "#f7e5cc");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(16, 16, w - 32, h - 32, 28);
    ctx.fill();

    ctx.strokeStyle = "#c87d46";
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.strokeStyle = "#503629";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(34, 34, w - 68, h - 68, 20);
    ctx.stroke();

    // Confetti dots
    const confetti = ["#c87d46", "#e46b82", "#4aa374", "#e5b84b", "#503629"];
    for (let i = 0; i < 36; i += 1) {
      ctx.fillStyle = confetti[i % confetti.length];
      const cx = 60 + ((i * 113) % (w - 120));
      const cy = 58 + ((i * 79) % (h - 116));
      if (cy < 135 || cy > h - 135) {
        ctx.beginPath();
        ctx.arc(cx, cy, 6 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = "#c87d46";
    ctx.font = "700 28px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MISKI · CELEBRACIÓN ESPECIAL", w / 2, 118);

    ctx.fillStyle = "#503629";
    ctx.font = "700 76px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("¡Feliz Cumpleaños!", w / 2, 245);

    ctx.fillStyle = "#6e503e";
    ctx.font = "600 30px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Hecho con amor tradicional", w / 2, 325);

    ctx.font = "44px sans-serif";
    ctx.fillText("🎉  🎂  ✨", w / 2, 408);
  } else if (presetId === "miski-seal") {
    ctx.fillStyle = "#503629";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 224, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 204, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#faf4ec";
    ctx.font = "700 84px 'Cormorant Garamond', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("Miski", w / 2, 232);

    ctx.fillStyle = "#f3e5d0";
    ctx.font = "700 22px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("PANADERÍA · DULCERÍA", w / 2, 290);
    ctx.fillStyle = "#c87d46";
    ctx.font = "600 24px Georgia, serif";
    ctx.fillText("★ Tradición Artesanal ★", w / 2, 345);
  } else if (presetId === "quince") {
    const bg = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 280);
    bg.addColorStop(0, "#fff8fa");
    bg.addColorStop(1, "#f7d4df");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(22, 22, w - 44, h - 44, 38);
    ctx.fill();
    ctx.strokeStyle = "#d49b89";
    ctx.lineWidth = 9;
    ctx.stroke();

    ctx.fillStyle = "#c58778";
    ctx.font = "54px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑", w / 2, 138);

    ctx.fillStyle = "#503629";
    ctx.font = "700 72px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("Mis 15 Años", w / 2, 255);

    ctx.fillStyle = "#9c5c6b";
    ctx.font = "600 26px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Un día inolvidable", w / 2, 338);
  } else if (presetId === "boda") {
    ctx.fillStyle = "#fffdf8";
    ctx.beginPath();
    ctx.roundRect(22, 22, w - 44, h - 44, 38);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.strokeStyle = "#92a988";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 175, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#503629";
    ctx.font = "700 66px 'Cormorant Garamond', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("Nuestra Boda", w / 2, 238);
    ctx.fillStyle = "#c87d46";
    ctx.font = "44px sans-serif";
    ctx.fillText("💍  🤍  ✨", w / 2, 328);
  } else if (presetId === "baby") {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#eef8ff");
    bg.addColorStop(1, "#fff1f6");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(20, 20, w - 40, h - 40, 34);
    ctx.fill();
    ctx.strokeStyle = "#9bc5e8";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = "#4b7192";
    ctx.font = "700 68px 'Cormorant Garamond', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("Baby Shower", w / 2, 240);
    ctx.font = "46px sans-serif";
    ctx.fillText("⭐  🍼  ☁️", w / 2, 338);
  } else {
    // hearts
    ctx.fillStyle = "rgba(255,255,255,0.0)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.font = "170px sans-serif";
    ctx.fillText("💖", w / 2, 265);
    ctx.fillStyle = "#503629";
    ctx.font = "700 56px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("Con Amor", w / 2, 390);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { texture: tex, aspect: w / h };
}

export class CakeDecalManager {
  constructor(engine, { onDecalsChange } = {}) {
    this.engine = engine;
    this.onDecalsChange = onDecalsChange;

    this.decals = [];
    this.activeDecalId = null;
    this.moveMode = false;
    this._isDragging = false;
    this._nextId = 1;

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._dummy = new THREE.Object3D();

    this._bindCanvasEvents();
  }

  _bindCanvasEvents() {
    const canvas = this.engine.canvas;

    const getPointerCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const projectFromEvent = (e) => {
      const decal = this.getActiveDecal();
      if (!decal) return;
      getPointerCoords(e);
      this._raycaster.setFromCamera(this._pointer, this.engine.camera);
      const hits = this._raycaster.intersectObjects(this.engine.tierMeshes, false);
      if (!hits.length) return;

      const hit = hits[0];
      const tierMesh = hit.object;
      const worldNormal = hit.face.normal.clone().transformDirection(tierMesh.matrixWorld).normalize();
      this._updateDecalFromHit(decal, tierMesh, hit.point, worldNormal);
      this.rebuildAllMeshes();
    };

    canvas.addEventListener("pointerdown", (e) => {
      if (!this.moveMode || !this.decals.length) return;
      getPointerCoords(e);
      this._raycaster.setFromCamera(this._pointer, this.engine.camera);
      const hits = this._raycaster.intersectObjects(this.engine.tierMeshes, false);
      if (!hits.length) return;

      this._isDragging = true;
      this.engine.setOrbitEnabled(false);
      canvas.setPointerCapture?.(e.pointerId);
      projectFromEvent(e);
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.moveMode || !this._isDragging) return;
      projectFromEvent(e);
    });

    const endDrag = (e) => {
      if (!this._isDragging) return;
      this._isDragging = false;
      this.engine.setOrbitEnabled(true);
      try {
        canvas.releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignore if not captured
      }
      this.onDecalsChange?.(this.decals, this.activeDecalId);
    };

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
  }

  setMoveMode(enabled) {
    this.moveMode = Boolean(enabled);
    if (!this.moveMode) {
      this._isDragging = false;
      this.engine.setOrbitEnabled(true);
    }
    this.engine.canvas.style.cursor = this.moveMode ? "crosshair" : "grab";
  }

  getActiveDecal() {
    return this.decals.find((d) => d.id === this.activeDecalId) || this.decals[0] || null;
  }

  setActiveDecal(id) {
    this.activeDecalId = id;
    this.onDecalsChange?.(this.decals, this.activeDecalId);
  }

  addStickerPreset(presetId, { replacePhotocake = false } = {}) {
    const preset = STICKER_PRESETS.find((s) => s.id === presetId) || STICKER_PRESETS[0];
    const { texture, aspect } = createStickerTexture(preset.id);
    return this._addDecal({
      name: preset.label,
      texture,
      aspect,
      isPhotocake: replacePhotocake || preset.id === "photocake-bday",
      replaceFirst: replacePhotocake,
    });
  }

  addImageFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("Archivo no seleccionado"));
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1024;
          const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(16, Math.round(img.width * ratio));
          canvas.height = Math.max(16, Math.round(img.height * ratio));
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          const decal = this._addDecal({
            name: file.name || "Imagen subida",
            texture: tex,
            aspect: img.width / Math.max(1, img.height),
            isPhotocake: true,
          });
          resolve(decal);
        };
        img.onerror = () => reject(new Error("No se pudo leer la imagen"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Error al cargar el archivo"));
      reader.readAsDataURL(file);
    });
  }

  _addDecal({ name, texture, aspect, isPhotocake = false, replaceFirst = false }) {
    const meshes = this.engine.tierMeshes;
    if (!meshes.length) return null;

    if (replaceFirst && this.decals.length) {
      this.clearAll({ silent: true });
    }

    const topTierIdx = meshes.length - 1;
    const tierMesh = meshes[topTierIdx];
    const meta = tierMesh.userData;

    const scale = isPhotocake ? 0.78 : 0.45;
    const decal = {
      id: `decal-${this._nextId++}`,
      name,
      texture,
      aspect: aspect || 1,
      tierIndex: topTierIdx,
      relPos: { nx: 0, ny: 1, nz: 0 },
      normal: new THREE.Vector3(0, 1, 0),
      scale,
      rotation: 0,
      mesh: null,
    };

    // Place cleanly on top center of the target tier
    const topCenter = new THREE.Vector3(0, meta.topY, 0);
    this._updateDecalFromHit(decal, tierMesh, topCenter, new THREE.Vector3(0, 1, 0));

    this.decals.push(decal);
    this.activeDecalId = decal.id;
    this.rebuildAllMeshes();
    this.onDecalsChange?.(this.decals, this.activeDecalId);
    return decal;
  }

  centerActiveOnTop() {
    const decal = this.getActiveDecal();
    const meshes = this.engine.tierMeshes;
    if (!decal || !meshes.length) return;
    const tierIndex = Math.min(decal.tierIndex, meshes.length - 1);
    const tierMesh = meshes[tierIndex];
    const meta = tierMesh.userData;
    decal.tierIndex = tierIndex;
    decal.relPos = { nx: 0, ny: 1, nz: 0 };
    decal.normal = new THREE.Vector3(0, 1, 0);
    decal.rotation = 0;
    this._updateDecalFromHit(decal, tierMesh, new THREE.Vector3(0, meta.topY, 0), new THREE.Vector3(0, 1, 0));
    this.rebuildAllMeshes();
    this.onDecalsChange?.(this.decals, this.activeDecalId);
  }

  updateActiveTransform({ scale, rotationDeg }) {
    const decal = this.getActiveDecal();
    if (!decal) return;
    if (typeof scale === "number") decal.scale = scale;
    if (typeof rotationDeg === "number") decal.rotation = (rotationDeg * Math.PI) / 180;
    this.rebuildAllMeshes();
    this.onDecalsChange?.(this.decals, this.activeDecalId);
  }

  removeDecal(id) {
    const idx = this.decals.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const [removed] = this.decals.splice(idx, 1);
    if (removed.mesh) {
      removed.mesh.geometry.dispose();
      removed.mesh.material.dispose();
      this.engine.decalsGroup.remove(removed.mesh);
    }
    removed.texture?.dispose();

    if (this.activeDecalId === id) {
      this.activeDecalId = this.decals[this.decals.length - 1]?.id || null;
    }
    this.onDecalsChange?.(this.decals, this.activeDecalId);
  }

  clearAll({ silent = false } = {}) {
    for (const d of this.decals) {
      if (d.mesh) {
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
        this.engine.decalsGroup.remove(d.mesh);
      }
      d.texture?.dispose();
    }
    this.decals = [];
    this.activeDecalId = null;
    if (!silent) this.onDecalsChange?.(this.decals, this.activeDecalId);
  }

  _updateDecalFromHit(decal, tierMesh, worldPoint, worldNormal) {
    const meta = tierMesh.userData;
    const centerY = (meta.bottomY + meta.topY) / 2;
    decal.tierIndex = meta.tierIndex;
    decal.relPos = {
      nx: THREE.MathUtils.clamp(worldPoint.x / Math.max(0.05, meta.halfW), -1, 1),
      ny: THREE.MathUtils.clamp((worldPoint.y - centerY) / Math.max(0.05, meta.height / 2), -1, 1),
      nz: THREE.MathUtils.clamp(worldPoint.z / Math.max(0.05, meta.halfD), -1, 1),
    };
    decal.normal = worldNormal.clone().normalize();
  }

  /**
   * Re-projects all decals onto the current cake meshes (e.g., after size/shape/color rebuild).
   */
  rebuildAllMeshes() {
    const group = this.engine.decalsGroup;
    while (group.children.length) {
      const child = group.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      group.remove(child);
    }

    const meshes = this.engine.tierMeshes;
    if (!meshes.length) return;

    this.engine.cakeGroup.updateMatrixWorld(true);

    for (const decal of this.decals) {
      const safeTierIdx = Math.min(decal.tierIndex, meshes.length - 1);
      decal.tierIndex = safeTierIdx;
      const tierMesh = meshes[safeTierIdx];
      const meta = tierMesh.userData;
      const centerY = (meta.bottomY + meta.topY) / 2;

      const approxPos = new THREE.Vector3(
        decal.relPos.nx * meta.halfW,
        centerY + decal.relPos.ny * (meta.height / 2),
        decal.relPos.nz * meta.halfD
      );

      const n = decal.normal.clone().normalize();
      // Snap cleanly to the exact surface via raycast from outside along -normal
      const rayOrigin = approxPos.clone().addScaledVector(n, 1.5);
      this._raycaster.set(rayOrigin, n.clone().negate());
      const hits = this._raycaster.intersectObject(tierMesh, false);

      const hitPos = hits.length ? hits[0].point : approxPos;
      const hitNormal = hits.length
        ? hits[0].face.normal.clone().transformDirection(tierMesh.matrixWorld).normalize()
        : n;

      // Orient projector avoiding gimbal lock on top surface
      this._dummy.position.copy(hitPos);
      if (Math.abs(hitNormal.y) > 0.92) {
        this._dummy.up.set(0, 0, -1);
      } else {
        this._dummy.up.set(0, 1, 0);
      }
      this._dummy.lookAt(hitPos.clone().add(hitNormal));
      this._dummy.rotateZ(decal.rotation || 0);

      // Compute proportional decal size based on surface orientation
      const isTopFace = Math.abs(hitNormal.y) > 0.7;
      let width;
      let height;
      if (isTopFace) {
        const maxW = meta.halfW * 1.78;
        const maxH = meta.halfD * 1.78;
        width = Math.min(maxW, maxH * decal.aspect) * decal.scale;
        height = width / Math.max(0.25, decal.aspect);
      } else {
        const refSpan = Math.min(meta.height * 1.45, meta.halfW * 1.9);
        width = refSpan * decal.scale;
        height = width / Math.max(0.25, decal.aspect);
        if (height > refSpan * 1.25) {
          height = refSpan * 1.1;
          width = height * decal.aspect;
        }
      }

      const depth = Math.min(0.65, Math.max(0.32, Math.min(meta.halfW, meta.halfD) * 0.65));
      const sizeVec = new THREE.Vector3(width, height, depth);

      const decalGeo = new DecalGeometry(tierMesh, hitPos, this._dummy.rotation, sizeVec);
      const decalMat = new THREE.MeshStandardMaterial({
        map: decal.texture,
        transparent: true,
        roughness: 0.45,
        metalness: 0.02,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      });

      const decalMesh = new THREE.Mesh(decalGeo, decalMat);
      decalMesh.renderOrder = 2;
      decal.mesh = decalMesh;
      group.add(decalMesh);
    }
  }
}
