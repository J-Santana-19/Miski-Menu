import { Cake3DEngine, parseCakeSpec } from "./cake3d-engine.js";
import { CakeDecalManager, STICKER_PRESETS } from "./cake3d-decals.js";

const FROSTING_PALETTE = [
  { name: "Blanco", hex: "#FFFDF9" },
  { name: "Vainilla", hex: "#FAF0DC" },
  { name: "Rosa", hex: "#F7C6D0" },
  { name: "Celeste", hex: "#BEE3F8" },
  { name: "Lavanda", hex: "#E2D4F0" },
  { name: "Menta", hex: "#C6F0D8" },
  { name: "Durazno", hex: "#FCD5B5" },
  { name: "Dorado", hex: "#EAD084" },
  { name: "Caramelo", hex: "#C87D46" },
  { name: "Cacao", hex: "#503629" },
];

const BORDER_PALETTE = [
  { name: "Blanco", hex: "#FFFDF9" },
  { name: "Caramelo", hex: "#C87D46" },
  { name: "Cacao", hex: "#503629" },
  { name: "Dorado", hex: "#D4AF37" },
  { name: "Rosa", hex: "#E892A8" },
];

const state = {
  menuData: null,
  dulceriaProducts: [],
  postresProducts: [],
  activeFilter: "all",
  activeTab: "catalog",
  selectedProduct: null,
  selectedRowIdx: 0,
  sponge: "vanilla", // "vanilla" | "chocolate"
  frosting: "merengue", // "merengue" | "chantilly"
  activeTierIndex: -1, // -1 means all tiers, 0..3 means individual tier
  tierColors: ["#FFFDF9", "#FFFDF9", "#FFFDF9", "#FFFDF9"],
  borderColor: "#C87D46",
  widthScale: 1,
  heightScale: 1,
  enableFruits: false,
  enableTopper: false,
  topperText: "Feliz Cumpleaños",
  topperFinish: "gold",
  showCutaway: false,
  autoRotate: false,
  moveImageMode: false,
  customerNote: "",
};

const els = {
  canvas: document.getElementById("cake3dCanvas"),
  hudCakeName: document.getElementById("hudCakeName"),
  hudCakeMeta: document.getElementById("hudCakeMeta"),
  hudCakePrice: document.getElementById("hudCakePrice"),
  viewerTierBar: document.getElementById("viewerTierBar"),
  viewerTierPills: document.getElementById("viewerTierPills"),
  moveModeBanner: document.getElementById("moveModeBanner"),
  btnDoneMoveMode: document.getElementById("btnDoneMoveMode"),
  btnAutoRotate: document.getElementById("btnAutoRotate"),
  btnToggleCutaway: document.getElementById("btnToggleCutaway"),
  btnToggleMoveHud: document.getElementById("btnToggleMoveHud"),
  panelNavTabs: document.getElementById("panelNavTabs"),
  catalogFilterBar: document.getElementById("catalogFilterBar"),
  catalogCountBadge: document.getElementById("catalogCountBadge"),
  catalogGrid: document.getElementById("catalogGrid"),
  shapeBadge: document.getElementById("shapeBadge"),
  sizeSelectorBlock: document.getElementById("sizeSelectorBlock"),
  sizePillsContainer: document.getElementById("sizePillsContainer"),
  sizeMetaBox: document.getElementById("sizeMetaBox"),
  spongeSelector: document.getElementById("spongeSelector"),
  priceVanillaLabel: document.getElementById("priceVanillaLabel"),
  priceChocolateLabel: document.getElementById("priceChocolateLabel"),
  frostingSelector: document.getElementById("frostingSelector"),
  priceMerengueSub: document.getElementById("priceMerengueSub"),
  priceChantillySub: document.getElementById("priceChantillySub"),
  widthScaleInput: document.getElementById("widthScaleInput"),
  widthScaleVal: document.getElementById("widthScaleVal"),
  heightScaleInput: document.getElementById("heightScaleInput"),
  heightScaleVal: document.getElementById("heightScaleVal"),
  btnResetProportions: document.getElementById("btnResetProportions"),
  tierTargetBlock: document.getElementById("tierTargetBlock"),
  tierColorTargets: document.getElementById("tierColorTargets"),
  colorPaletteGrid: document.getElementById("colorPaletteGrid"),
  surfaceColorPicker: document.getElementById("surfaceColorPicker"),
  surfaceColorHex: document.getElementById("surfaceColorHex"),
  borderSwatchesGrid: document.getElementById("borderSwatchesGrid"),
  borderColorPicker: document.getElementById("borderColorPicker"),
  decalFileInput: document.getElementById("decalFileInput"),
  stickersGrid: document.getElementById("stickersGrid"),
  decalControlsBox: document.getElementById("decalControlsBox"),
  placedDecalsList: document.getElementById("placedDecalsList"),
  btnRemoveActiveDecal: document.getElementById("btnRemoveActiveDecal"),
  btnToggleMovePanel: document.getElementById("btnToggleMovePanel"),
  btnCenterDecalTop: document.getElementById("btnCenterDecalTop"),
  decalScaleInput: document.getElementById("decalScaleInput"),
  decalScaleVal: document.getElementById("decalScaleVal"),
  decalRotateInput: document.getElementById("decalRotateInput"),
  decalRotateVal: document.getElementById("decalRotateVal"),
  toggleFruitsInput: document.getElementById("toggleFruitsInput"),
  toggleTopperInput: document.getElementById("toggleTopperInput"),
  topperConfigBox: document.getElementById("topperConfigBox"),
  topperTextInput: document.getElementById("topperTextInput"),
  topperFinishSelect: document.getElementById("topperFinishSelect"),
  cakeNoticeBanner: document.getElementById("cakeNoticeBanner"),
  summaryBreakdown: document.getElementById("summaryBreakdown"),
  customerNoteInput: document.getElementById("customerNoteInput"),
  waMessagePreview: document.getElementById("waMessagePreview"),
  btnDownloadPng: document.getElementById("btnDownloadPng"),
  btnCopyWaMessage: document.getElementById("btnCopyWaMessage"),
  btnOpenWhatsapp: document.getElementById("btnOpenWhatsapp"),
  actionFeedback: document.getElementById("actionFeedback"),
};

let engine = null;
let decalManager = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBalboa(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return "Consultar";
  return `B/. ${Number(amount).toFixed(2)}`;
}

function resolveAssetUrl(url) {
  const raw = String(url || "");
  return raw.startsWith("/assets/") ? `./${raw.slice(1)}` : raw;
}

async function fetchMenuData() {
  try {
    const res = await fetch(`/api/menu?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to static JSON when running without Node backend
  }
  const staticRes = await fetch(`./data/menu.json?t=${Date.now()}`, { cache: "no-store" });
  if (!staticRes.ok) throw new Error("No se pudo cargar data/menu.json");
  return staticRes.json();
}

function getSelectedRow() {
  const p = state.selectedProduct;
  if (!p || !Array.isArray(p.matrix) || !p.matrix.length) return null;
  return p.matrix[state.selectedRowIdx] || p.matrix[0];
}

function getSelectedSizeLabel() {
  const row = getSelectedRow();
  if (row) return row.size;
  return state.selectedProduct?.category === "postres" ? "Presentación estándar" : '8x12"';
}

function getCurrentPricing() {
  const p = state.selectedProduct;
  if (!p) {
    return {
      price: 0,
      portions: "—",
      available: false,
      vanillaPrice: null,
      chocolatePrice: null,
      merengueSub: "Satinado artesanal",
      chantillySub: "Suave aterciopelado",
    };
  }

  if (p.priceType !== "cake_matrix") {
    return {
      price: p.price,
      portions: p.description || "Presentación individual / catálogo",
      available: Number.isFinite(Number(p.price)),
      vanillaPrice: p.price,
      chocolatePrice: null,
      merengueSub: "Acabado clásico",
      chantillySub: "Acabado suave",
    };
  }

  const row = getSelectedRow();
  if (!row) {
    return {
      price: p.price,
      portions: "Según dimensiones",
      available: true,
      vanillaPrice: p.price,
      chocolatePrice: null,
      merengueSub: "Satinado artesanal",
      chantillySub: "Suave aterciopelado",
    };
  }

  if (p.matrixType === "tiered") {
    const spongeCap = state.sponge === "vanilla" ? "Vanilla" : "Chocolate";
    const key = `${state.frosting}${spongeCap}`;
    const vKey = `${state.frosting}Vanilla`;
    const cKey = `${state.frosting}Chocolate`;
    const mKey = `merengue${spongeCap}`;
    const chKey = `chantilly${spongeCap}`;
    return {
      price: row[key],
      portions: row.portions || "Según pisos",
      available: row[key] != null,
      vanillaPrice: row[vKey],
      chocolatePrice: row[cKey],
      merengueSub: row[mKey] != null ? formatBalboa(row[mKey]) : "Consultar",
      chantillySub: row[chKey] != null ? formatBalboa(row[chKey]) : "Consultar",
    };
  }

  // standard cake_matrix
  return {
    price: row[state.sponge],
    portions: row.portions || "Porciones estándar",
    available: row[state.sponge] != null,
    vanillaPrice: row.vanilla,
    chocolatePrice: row.chocolate,
    merengueSub: "Incluido (satinado)",
    chantillySub: "Suave aterciopelado",
  };
}

function getFilteredProducts() {
  const allDulceria = state.dulceriaProducts;
  if (state.activeFilter === "postres") {
    return state.postresProducts;
  }
  if (state.activeFilter === "clasicas") {
    return allDulceria.filter((p) => /clásicas|frias|frías/i.test(p.subcategory || ""));
  }
  if (state.activeFilter === "tematicas") {
    return allDulceria.filter((p) => /personalizadas|temáticas/i.test(p.subcategory || ""));
  }
  if (state.activeFilter === "eventos") {
    return allDulceria.filter((p) => /eventos|pisos/i.test(p.subcategory || "") || p.matrixType === "tiered");
  }
  return allDulceria;
}

function renderCatalog() {
  const items = getFilteredProducts();
  els.catalogCountBadge.textContent = `${items.length} ${items.length === 1 ? "opción" : "opciones"}`;

  els.catalogGrid.innerHTML = items
    .map((p) => {
      const isSelected = state.selectedProduct?.id === p.id;
      const thumb = p.image
        ? `<img src="${escapeHtml(resolveAssetUrl(p.image))}" alt="${escapeHtml(p.name)}" loading="lazy" />`
        : `<span aria-hidden="true">${p.category === "postres" ? "🍮" : "🎂"}</span>`;
      const fromPrefix = p.priceType === "cake_matrix" ? "Desde " : "";
      return `
        <button type="button" class="catalog-item-btn ${isSelected ? "is-selected" : ""}" data-product-id="${escapeHtml(p.id)}">
          <div class="catalog-thumb">${thumb}</div>
          <span class="catalog-item-name">${escapeHtml(p.name)}</span>
          <span class="catalog-item-price">${fromPrefix}${formatBalboa(p.price)}</span>
        </button>
      `;
    })
    .join("");
}

function renderSizeAndFlavors() {
  const p = state.selectedProduct;
  if (!p) return;

  const spec = parseCakeSpec(p, getSelectedSizeLabel());
  const shapeNames = {
    rect: "Rectangular",
    square: "Cuadrado",
    round: spec.tiers.length > 1 ? `${spec.tiers.length} Pisos` : "Redondo",
  };
  els.shapeBadge.textContent = shapeNames[spec.shape] || "Personalizado";

  const rows = Array.isArray(p.matrix) ? p.matrix : [];
  if (rows.length) {
    els.sizeSelectorBlock.classList.remove("hidden");
    els.sizePillsContainer.innerHTML = rows
      .map(
        (r, idx) => `
        <button type="button" class="size-pill-btn ${idx === state.selectedRowIdx ? "is-active" : ""}" data-size-idx="${idx}">
          ${escapeHtml(r.size)}
        </button>
      `
      )
      .join("");
  } else {
    els.sizeSelectorBlock.classList.add("hidden");
  }

  const pricing = getCurrentPricing();
  const dimText = spec.tiers
    .map((t, i) =>
      t.shape === "round"
        ? `${spec.tiers.length > 1 ? `Piso ${i + 1}: ` : ""}Ø ${(t.diameter * state.widthScale).toFixed(1)}" × ${(t.height * state.heightScale).toFixed(1)}"`
        : `${(t.depth * state.widthScale).toFixed(1)}" × ${(t.width * state.widthScale).toFixed(1)}" × ${(t.height * state.heightScale).toFixed(1)}"`
    )
    .join(" · ");

  els.sizeMetaBox.innerHTML = `
    <span>👥 <strong>Rinde:</strong> ${escapeHtml(pricing.portions)}</span>
    <span>📐 <strong>3D:</strong> ${escapeHtml(dimText)}</span>
  `;

  // Sponge & Frosting blocks (only relevant for cake_matrix cakes)
  const isCakeMatrix = p.priceType === "cake_matrix";
  els.spongeSelector.closest(".field-block")?.classList.toggle("hidden", !isCakeMatrix);
  els.frostingSelector.closest(".field-block")?.classList.toggle("hidden", !isCakeMatrix);

  // Sponge buttons
  els.priceVanillaLabel.textContent = pricing.vanillaPrice != null ? formatBalboa(pricing.vanillaPrice) : "Consultar";
  els.priceChocolateLabel.textContent = pricing.chocolatePrice != null ? formatBalboa(pricing.chocolatePrice) : "Consultar";

  els.spongeSelector.querySelectorAll("[data-sponge]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.sponge === state.sponge);
  });

  // Frosting buttons
  els.priceMerengueSub.textContent = pricing.merengueSub;
  els.priceChantillySub.textContent = pricing.chantillySub;
  els.frostingSelector.querySelectorAll("[data-frosting]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.frosting === state.frosting);
  });
}

function renderTierSelectorsAndColors() {
  const spec = parseCakeSpec(state.selectedProduct, getSelectedSizeLabel());
  const tierCount = spec.tiers.length;

  // Top viewer tier bar (visible when cake has >= 2 tiers)
  if (tierCount > 1) {
    els.viewerTierBar.classList.remove("hidden");
    const pills = [
      `<button type="button" class="tier-pill-btn ${state.activeTierIndex === -1 ? "is-active" : ""}" data-tier-idx="-1">Todos</button>`,
      ...spec.tiers.map(
        (t, i) =>
          `<button type="button" class="tier-pill-btn ${state.activeTierIndex === i ? "is-active" : ""}" data-tier-idx="${i}">Piso ${i + 1} (${t.diameter}")</button>`
      ),
    ].join("");
    els.viewerTierPills.innerHTML = pills;
    els.tierColorTargets.innerHTML = pills;
    els.tierTargetBlock.classList.remove("hidden");
  } else {
    els.viewerTierBar.classList.add("hidden");
    els.tierTargetBlock.classList.add("hidden");
    state.activeTierIndex = -1;
  }

  const activeColor =
    state.activeTierIndex >= 0 ? state.tierColors[state.activeTierIndex] || "#FFFDF9" : state.tierColors[0] || "#FFFDF9";

  els.surfaceColorPicker.value = normalizeHex(activeColor);
  els.surfaceColorHex.textContent = normalizeHex(activeColor).toUpperCase();

  els.colorPaletteGrid.innerHTML = FROSTING_PALETTE.map(
    (c) => `
    <button type="button" class="swatch-btn ${normalizeHex(activeColor) === normalizeHex(c.hex) ? "is-active" : ""}" data-surface-hex="${c.hex}">
      <span class="swatch-dot" style="background:${c.hex}"></span>
      <span class="swatch-name">${escapeHtml(c.name)}</span>
    </button>
  `
  ).join("");

  els.borderColorPicker.value = normalizeHex(state.borderColor);
  els.borderSwatchesGrid.innerHTML = BORDER_PALETTE.map(
    (c) => `
    <button type="button" class="mini-swatch ${normalizeHex(state.borderColor) === normalizeHex(c.hex) ? "is-active" : ""}" data-border-hex="${c.hex}" title="${escapeHtml(c.name)}" style="background:${c.hex}"></button>
  `
  ).join("");
}

function normalizeHex(hex) {
  const s = String(hex || "#ffffff").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : "#ffffff";
}

function renderStickersAndDecals() {
  els.stickersGrid.innerHTML = STICKER_PRESETS.map(
    (s) => `<button type="button" class="sticker-btn" data-sticker-id="${escapeHtml(s.id)}">${escapeHtml(s.label)}</button>`
  ).join("");

  const decals = decalManager ? decalManager.decals : [];
  const activeDecal = decalManager ? decalManager.getActiveDecal() : null;

  if (!decals.length) {
    els.decalControlsBox.classList.add("hidden");
  } else {
    els.decalControlsBox.classList.remove("hidden");
    els.placedDecalsList.innerHTML = decals
      .map(
        (d) => `
      <button type="button" class="placed-decal-chip ${d.id === activeDecal?.id ? "is-active" : ""}" data-select-decal="${escapeHtml(d.id)}">
        <span>${escapeHtml(d.name)}</span>
      </button>
    `
      )
      .join("");

    if (activeDecal) {
      const pct = Math.round(activeDecal.scale * 100);
      const deg = Math.round((activeDecal.rotation * 180) / Math.PI);
      els.decalScaleInput.value = String(pct);
      els.decalScaleVal.textContent = `${pct}%`;
      els.decalRotateInput.value = String(deg);
      els.decalRotateVal.textContent = `${deg}°`;
    }
  }

  els.toggleFruitsInput.checked = state.enableFruits;
  els.toggleTopperInput.checked = state.enableTopper;
  els.topperConfigBox.classList.toggle("hidden", !state.enableTopper);
}

function updateMoveModeUI() {
  const active = state.moveImageMode;
  els.moveModeBanner.classList.toggle("hidden", !active);
  els.btnToggleMoveHud.classList.toggle("is-active", active);
  els.btnToggleMoveHud.setAttribute("aria-pressed", String(active));
  els.btnToggleMovePanel.classList.toggle("is-active", active);
  els.btnToggleMovePanel.setAttribute("aria-pressed", String(active));
  els.btnToggleMovePanel.textContent = active ? "✅ Terminar de mover" : "✋ Mover imagen en 3D";
}

function buildWhatsappSummary() {
  const p = state.selectedProduct;
  if (!p) return "";
  const pricing = getCurrentPricing();
  const spec = parseCakeSpec(p, getSelectedSizeLabel());
  const sizeLabel = getSelectedSizeLabel();
  const spongeLabel = state.sponge === "vanilla" ? "Vainilla" : "Chocolate";
  const frostingLabel = state.frosting === "merengue" ? "Merengue" : "Chantillí";

  const tierColorsText =
    spec.tiers.length > 1
      ? spec.tiers.map((t, i) => `Piso ${i + 1} (${t.diameter}"): ${state.tierColors[i] || state.tierColors[0]}`).join(" | ")
      : `Cobertura: ${state.tierColors[0]}`;

  const extras = [];
  if (state.enableFruits) extras.push("Frutas frescas 3D");
  if (state.enableTopper) extras.push(`Cake Topper "${state.topperText}" (${state.topperFinish})`);
  if (decalManager?.decals.length) {
    extras.push(`Imagen/Photocake (${decalManager.decals.map((d) => d.name).join(", ")})`);
  }

  const priceText = pricing.available ? formatBalboa(pricing.price) : "A confirmar en sucursal";
  const notice = state.menuData?.brand?.cakeNotice || "Encargos personalizados con diseño o Photocake: al menos 3 días de anticipación.";

  const lines = [
    `Hola *Miski*, diseñé este dulce en el *Estudio 3D* y deseo cotizar/encargar:`,
    `🎂 *Producto:* ${p.name}`,
    `📏 *Medida:* ${sizeLabel} (${pricing.portions})`,
  ];

  if (p.priceType === "cake_matrix") {
    lines.push(`🍰 *Masa:* ${spongeLabel}`);
    lines.push(`✨ *Cobertura:* ${frostingLabel}`);
    lines.push(`🎨 *Colores:* ${tierColorsText} · Bordes: ${state.borderColor}`);
  }
  if (extras.length) {
    lines.push(`🌟 *Extras:* ${extras.join(" · ")}`);
  }
  if (state.customerNote.trim()) {
    lines.push(`📝 *Nota:* ${state.customerNote.trim()}`);
  }
  lines.push(`💵 *Precio catálogo estimado:* ${priceText}`);
  lines.push(`⏳ _${notice}_`);
  return lines.join("\n");
}

function renderHudAndSummary() {
  const p = state.selectedProduct;
  if (!p) return;
  const pricing = getCurrentPricing();
  const sizeLabel = getSelectedSizeLabel();
  const priceFormatted = pricing.available ? formatBalboa(pricing.price) : "Consultar";

  els.hudCakeName.textContent = p.name;
  els.hudCakeMeta.textContent = `${sizeLabel} · ${pricing.portions}`;
  els.hudCakePrice.textContent = priceFormatted;

  const notice = state.menuData?.brand?.cakeNotice || "Encargos personalizados con diseño o Photocake: al menos 3 días de anticipación.";
  els.cakeNoticeBanner.textContent = `⏳ ${notice}`;

  const spec = parseCakeSpec(p, sizeLabel);
  const extrasSummary = [];
  if (state.enableFruits) extrasSummary.push("Frutas 3D");
  if (state.enableTopper) extrasSummary.push(`Topper "${state.topperText}"`);
  if (decalManager?.decals.length) extrasSummary.push(`${decalManager.decals.length} imagen(es)`);

  els.summaryBreakdown.innerHTML = `
    <div class="summary-line"><span>Dulce seleccionado</span><strong>${escapeHtml(p.name)}</strong></div>
    <div class="summary-line"><span>Medida oficial</span><strong>${escapeHtml(sizeLabel)}</strong></div>
    <div class="summary-line"><span>Rendimiento</span><strong>${escapeHtml(pricing.portions)}</strong></div>
    <div class="summary-line"><span>Masa y cobertura</span><strong>${state.sponge === "vanilla" ? "Vainilla" : "Chocolate"} · ${state.frosting === "merengue" ? "Merengue" : "Chantillí"}</strong></div>
    <div class="summary-line"><span>Estructura 3D</span><strong>${spec.tiers.length > 1 ? `${spec.tiers.length} Pisos` : spec.shape === "round" ? "Redondo" : spec.shape === "square" ? "Cuadrado" : "Rectangular"}</strong></div>
    ${extrasSummary.length ? `<div class="summary-line"><span>Extras visuales</span><strong>${escapeHtml(extrasSummary.join(" + "))}</strong></div>` : ""}
    <div class="summary-line is-total"><span>Total estimado (menu.json)</span><strong>${escapeHtml(priceFormatted)}</strong></div>
  `;

  const waText = buildWhatsappSummary();
  els.waMessagePreview.value = waText;

  const rawPhone = String(state.menuData?.brand?.whatsapp || "").replace(/\D/g, "");
  const encoded = encodeURIComponent(waText);
  els.btnOpenWhatsapp.href = rawPhone ? `https://wa.me/${rawPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

function rebuild3DCake({ refitCamera = false } = {}) {
  if (!engine || !state.selectedProduct) return;
  state.selectedSizeLabel = getSelectedSizeLabel();
  engine.buildCake(state, { refitCamera });
  if (decalManager) {
    decalManager.rebuildAllMeshes();
  }
}

function selectProduct(product, { keepCamera = false } = {}) {
  if (!product) return;
  state.selectedProduct = product;
  state.selectedRowIdx = 0;
  state.widthScale = 1;
  state.heightScale = 1;
  els.widthScaleInput.value = "100";
  els.widthScaleVal.textContent = "100%";
  els.heightScaleInput.value = "100";
  els.heightScaleVal.textContent = "100%";

  const row = getSelectedRow();
  if (row && product.matrixType === "standard" && row[state.sponge] == null) {
    state.sponge = row.vanilla != null ? "vanilla" : "chocolate";
  }

  const spec = parseCakeSpec(product, getSelectedSizeLabel());
  state.activeTierIndex = -1;
  state.enableFruits = Boolean(spec.hasFruitsDefault);
  state.enableTopper = Boolean(spec.hasTopperDefault);

  // Reset decals only if switching to Photocake with no decals yet, otherwise re-project
  if (product.id === "dul-photocake" && decalManager && decalManager.decals.length === 0) {
    rebuild3DCake({ refitCamera: !keepCamera });
    decalManager.addStickerPreset("photocake-bday", { replacePhotocake: true });
  } else {
    rebuild3DCake({ refitCamera: !keepCamera });
  }

  renderCatalog();
  renderSizeAndFlavors();
  renderTierSelectorsAndColors();
  renderStickersAndDecals();
  renderHudAndSummary();
}

function selectSizeRow(idx) {
  const rows = state.selectedProduct?.matrix || [];
  if (!rows[idx]) return;
  state.selectedRowIdx = idx;

  const row = rows[idx];
  if (state.selectedProduct.id === "dul-cake-topper") {
    state.enableTopper = !/sin topper/i.test(row.size);
  }
  if (state.selectedProduct.matrixType === "standard" && row[state.sponge] == null) {
    if (row.vanilla != null) state.sponge = "vanilla";
    else if (row.chocolate != null) state.sponge = "chocolate";
  }

  rebuild3DCake({ refitCamera: true });
  renderSizeAndFlavors();
  renderTierSelectorsAndColors();
  renderStickersAndDecals();
  renderHudAndSummary();
}

function applySurfaceColor(hex) {
  const spec = parseCakeSpec(state.selectedProduct, getSelectedSizeLabel());
  if (state.activeTierIndex >= 0 && spec.tiers.length > 1) {
    state.tierColors[state.activeTierIndex] = hex;
  } else {
    for (let i = 0; i < 4; i += 1) {
      state.tierColors[i] = hex;
    }
  }
  rebuild3DCake();
  renderTierSelectorsAndColors();
  renderHudAndSummary();
}

function setActiveTab(tabName) {
  state.activeTab = tabName;
  els.panelNavTabs.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel-card").forEach((card) => {
    card.classList.toggle("is-tab-active", card.dataset.panel === tabName);
  });

  if (window.innerWidth >= 960) {
    const target = document.getElementById(`card-${tabName}`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function showFeedback(text) {
  els.actionFeedback.textContent = text;
  els.actionFeedback.classList.remove("hidden");
  clearTimeout(showFeedback._timer);
  showFeedback._timer = setTimeout(() => {
    els.actionFeedback.classList.add("hidden");
  }, 3500);
}

function downloadDesignPng() {
  if (!engine || !state.selectedProduct) return;
  const raw3dUrl = engine.captureCleanDataUrl();
  const img = new Image();
  img.onload = () => {
    const cardW = 1200;
    const cardH = 900;
    const out = document.createElement("canvas");
    out.width = cardW;
    out.height = cardH;
    const ctx = out.getContext("2d");

    // Warm cream background
    ctx.fillStyle = "#faf4ec";
    ctx.fillRect(0, 0, cardW, cardH);

    // Top cacao bar
    ctx.fillStyle = "#503629";
    ctx.fillRect(0, 0, cardW, 88);

    ctx.fillStyle = "#faf4ec";
    ctx.font = "700 36px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("Miski · Estudio 3D de Dulcería", 42, 56);

    const pricing = getCurrentPricing();
    const priceLabel = pricing.available ? formatBalboa(pricing.price) : "Consultar";
    ctx.fillStyle = "#f3e5d0";
    ctx.font = "700 28px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(priceLabel, cardW - 42, 55);
    ctx.textAlign = "left";

    // Draw 3D snapshot centered preserving aspect ratio
    const availW = cardW - 80;
    const availH = cardH - 240;
    const scale = Math.min(availW / img.width, availH / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const drawX = (cardW - drawW) / 2;
    const drawY = 104 + (availH - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Bottom spec card
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, cardH - 126, cardW, 126);
    ctx.fillStyle = "#eadbc8";
    ctx.fillRect(0, cardH - 126, cardW, 2);

    ctx.fillStyle = "#3b2314";
    ctx.font = "700 26px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(`${state.selectedProduct.name} · ${getSelectedSizeLabel()}`, 42, cardH - 80);

    ctx.fillStyle = "#6e503e";
    ctx.font = "600 20px 'Plus Jakarta Sans', sans-serif";
    const spongeTxt = state.sponge === "vanilla" ? "Masa Vainilla" : "Masa Chocolate";
    const frostTxt = state.frosting === "merengue" ? "Cobertura Merengue" : "Cobertura Chantillí";
    ctx.fillText(`${pricing.portions} · ${spongeTxt} · ${frostTxt}`, 42, cardH - 46);

    ctx.fillStyle = "#c87d46";
    ctx.font = "600 17px 'Plus Jakarta Sans', sans-serif";
    const notice = state.menuData?.brand?.cakeNotice || "Encargos personalizados: al menos 3 días de anticipación.";
    ctx.fillText(notice, 42, cardH - 18);

    const link = document.createElement("a");
    link.download = `miski-3d-${state.selectedProduct.id}.png`;
    link.href = out.toDataURL("image/png");
    link.click();
    showFeedback("📸 Imagen PNG del diseño descargada.");
  };
  img.src = raw3dUrl;
}

function bindEvents() {
  // Tabs
  els.panelNavTabs.addEventListener("click", (e) => {
    const tabBtn = e.target.closest("[data-tab]");
    if (tabBtn) setActiveTab(tabBtn.dataset.tab);
  });

  // Catalog filter
  els.catalogFilterBar.addEventListener("click", (e) => {
    const fBtn = e.target.closest("[data-filter]");
    if (!fBtn) return;
    state.activeFilter = fBtn.dataset.filter;
    els.catalogFilterBar.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("is-active", b === fBtn));
    renderCatalog();
  });

  // Select product
  els.catalogGrid.addEventListener("click", (e) => {
    const card = e.target.closest("[data-product-id]");
    if (!card) return;
    const all = [...state.dulceriaProducts, ...state.postresProducts];
    const found = all.find((p) => p.id === card.dataset.productId);
    if (found) selectProduct(found);
  });

  // Size selection
  els.sizePillsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-size-idx]");
    if (!btn) return;
    selectSizeRow(Number(btn.dataset.sizeIdx));
  });

  // Sponge selection
  els.spongeSelector.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sponge]");
    if (!btn) return;
    state.sponge = btn.dataset.sponge;
    rebuild3DCake();
    renderSizeAndFlavors();
    renderHudAndSummary();
  });

  // Frosting selection
  els.frostingSelector.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-frosting]");
    if (!btn) return;
    state.frosting = btn.dataset.frosting;
    rebuild3DCake();
    renderSizeAndFlavors();
    renderHudAndSummary();
  });

  // Fine-tune proportions
  const onPropChange = () => {
    state.widthScale = Number(els.widthScaleInput.value) / 100;
    state.heightScale = Number(els.heightScaleInput.value) / 100;
    els.widthScaleVal.textContent = `${els.widthScaleInput.value}%`;
    els.heightScaleVal.textContent = `${els.heightScaleInput.value}%`;
    rebuild3DCake();
    renderSizeAndFlavors();
  };
  els.widthScaleInput.addEventListener("input", onPropChange);
  els.heightScaleInput.addEventListener("input", onPropChange);
  els.btnResetProportions.addEventListener("click", () => {
    els.widthScaleInput.value = "100";
    els.heightScaleInput.value = "100";
    onPropChange();
  });

  // Tier targets (both in HUD and panel)
  const onTierTargetClick = (e) => {
    const btn = e.target.closest("[data-tier-idx]");
    if (!btn) return;
    state.activeTierIndex = Number(btn.dataset.tierIdx);
    rebuild3DCake();
    renderTierSelectorsAndColors();
  };
  els.viewerTierPills.addEventListener("click", onTierTargetClick);
  els.tierColorTargets.addEventListener("click", onTierTargetClick);

  // Surface colors
  els.colorPaletteGrid.addEventListener("click", (e) => {
    const sw = e.target.closest("[data-surface-hex]");
    if (sw) applySurfaceColor(sw.dataset.surfaceHex);
  });
  els.surfaceColorPicker.addEventListener("input", (e) => applySurfaceColor(e.target.value));

  // Border colors
  els.borderSwatchesGrid.addEventListener("click", (e) => {
    const sw = e.target.closest("[data-border-hex]");
    if (!sw) return;
    state.borderColor = sw.dataset.borderHex;
    rebuild3DCake();
    renderTierSelectorsAndColors();
    renderHudAndSummary();
  });
  els.borderColorPicker.addEventListener("input", (e) => {
    state.borderColor = e.target.value;
    rebuild3DCake();
    renderTierSelectorsAndColors();
    renderHudAndSummary();
  });

  // Camera toolbar
  document.querySelectorAll("[data-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-cam]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      engine?.setCameraPreset(btn.dataset.cam);
    });
  });

  els.btnAutoRotate.addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    engine?.setAutoRotate(state.autoRotate);
    els.btnAutoRotate.classList.toggle("is-active", state.autoRotate);
    els.btnAutoRotate.setAttribute("aria-pressed", String(state.autoRotate));
  });

  els.btnToggleCutaway.addEventListener("click", () => {
    state.showCutaway = !state.showCutaway;
    els.btnToggleCutaway.classList.toggle("is-active", state.showCutaway);
    els.btnToggleCutaway.setAttribute("aria-pressed", String(state.showCutaway));
    rebuild3DCake();
  });

  // Move image mode toggles
  const setMoveMode = (enabled) => {
    if (enabled && decalManager && !decalManager.decals.length) {
      decalManager.addStickerPreset("photocake-bday", { replacePhotocake: true });
    }
    state.moveImageMode = Boolean(enabled);
    decalManager?.setMoveMode(state.moveImageMode);
    updateMoveModeUI();
  };

  els.btnToggleMoveHud.addEventListener("click", () => setMoveMode(!state.moveImageMode));
  els.btnToggleMovePanel.addEventListener("click", () => setMoveMode(!state.moveImageMode));
  els.btnDoneMoveMode.addEventListener("click", () => setMoveMode(false));

  // Decals upload & stickers
  els.decalFileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file || !decalManager) return;
    try {
      await decalManager.addImageFromFile(file);
      showFeedback("🖼️ Imagen proyectada en 3D. Usa 'Mover imagen' para ubicarla.");
    } catch (err) {
      showFeedback(`⚠️ ${err.message}`);
    }
    e.target.value = "";
  });

  els.stickersGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sticker-id]");
    if (!btn || !decalManager) return;
    decalManager.addStickerPreset(btn.dataset.stickerId);
  });

  els.placedDecalsList.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-select-decal]");
    if (chip) decalManager?.setActiveDecal(chip.dataset.selectDecal);
  });

  els.btnCenterDecalTop.addEventListener("click", () => decalManager?.centerActiveOnTop());
  els.btnRemoveActiveDecal.addEventListener("click", () => {
    const active = decalManager?.getActiveDecal();
    if (!active) return;
    decalManager.removeDecal(active.id);
    if (!decalManager.decals.length && state.moveImageMode) {
      setMoveMode(false);
    }
  });

  els.decalScaleInput.addEventListener("input", () => {
    const val = Number(els.decalScaleInput.value);
    els.decalScaleVal.textContent = `${val}%`;
    decalManager?.updateActiveTransform({ scale: val / 100 });
  });

  els.decalRotateInput.addEventListener("input", () => {
    const deg = Number(els.decalRotateInput.value);
    els.decalRotateVal.textContent = `${deg}°`;
    decalManager?.updateActiveTransform({ rotationDeg: deg });
  });

  // Fruits & Topper toggles
  els.toggleFruitsInput.addEventListener("change", () => {
    state.enableFruits = els.toggleFruitsInput.checked;
    rebuild3DCake();
    renderHudAndSummary();
  });

  els.toggleTopperInput.addEventListener("change", () => {
    state.enableTopper = els.toggleTopperInput.checked;
    els.topperConfigBox.classList.toggle("hidden", !state.enableTopper);
    rebuild3DCake({ refitCamera: state.enableTopper });
    renderHudAndSummary();
  });

  els.topperTextInput.addEventListener("input", () => {
    state.topperText = els.topperTextInput.value;
    rebuild3DCake();
    renderHudAndSummary();
  });

  els.topperFinishSelect.addEventListener("change", () => {
    state.topperFinish = els.topperFinishSelect.value;
    rebuild3DCake();
    renderHudAndSummary();
  });

  // Summary & Export
  els.customerNoteInput.addEventListener("input", () => {
    state.customerNote = els.customerNoteInput.value;
    renderHudAndSummary();
  });

  els.btnDownloadPng.addEventListener("click", downloadDesignPng);

  els.btnCopyWaMessage.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.waMessagePreview.value);
      showFeedback("📋 Mensaje de pedido copiado al portapapeles.");
    } catch {
      els.waMessagePreview.select();
      document.execCommand("copy");
      showFeedback("📋 Mensaje de pedido copiado.");
    }
  });
}

async function init() {
  engine = new Cake3DEngine(els.canvas, {
    onTierPick: (tierIndex) => {
      if (state.moveImageMode) return;
      const spec = parseCakeSpec(state.selectedProduct, getSelectedSizeLabel());
      if (spec.tiers.length <= 1) return;
      state.activeTierIndex = tierIndex;
      rebuild3DCake();
      renderTierSelectorsAndColors();
    },
  });

  decalManager = new CakeDecalManager(engine, {
    onDecalsChange: () => {
      renderStickersAndDecals();
      renderHudAndSummary();
    },
  });

  bindEvents();

  try {
    const data = await fetchMenuData();
    state.menuData = data;
    const active = (data.products || []).filter((p) => p.active !== false);

    // Include all dulceria items plus any cake_matrix item (e.g. dul-sencillo-diseno)
    state.dulceriaProducts = active.filter((p) => p.category === "dulceria" || p.priceType === "cake_matrix");
    state.postresProducts = active.filter((p) => p.category === "postres");

    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("cake");
    const allItems = [...state.dulceriaProducts, ...state.postresProducts];
    const initial =
      (requestedId && allItems.find((p) => p.id === requestedId)) ||
      state.dulceriaProducts[0] ||
      state.postresProducts[0];

    if (initial?.category === "postres" && initial.priceType !== "cake_matrix") {
      state.activeFilter = "postres";
      els.catalogFilterBar.querySelectorAll("[data-filter]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.filter === "postres");
      });
    }

    if (initial) {
      selectProduct(initial);
    }

    // Live sync with admin panel updates
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("miski_menu_updates");
      ch.onmessage = async () => {
        try {
          const updated = await fetchMenuData();
          state.menuData = updated;
          const act = (updated.products || []).filter((p) => p.active !== false);
          state.dulceriaProducts = act.filter((p) => p.category === "dulceria" || p.priceType === "cake_matrix");
          state.postresProducts = act.filter((p) => p.category === "postres");
          const currentId = state.selectedProduct?.id;
          const refreshed = [...state.dulceriaProducts, ...state.postresProducts].find((p) => p.id === currentId);
          if (refreshed) state.selectedProduct = refreshed;
          renderCatalog();
          renderSizeAndFlavors();
          renderHudAndSummary();
        } catch {
          // ignore transient reload failure
        }
      };
    }
  } catch (err) {
    els.catalogGrid.innerHTML = `<div class="loading-inline">⚠️ No se pudo cargar el catálogo: ${escapeHtml(err.message)}</div>`;
    console.error(err);
  }
}

init();
