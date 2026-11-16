(() => {
  "use strict";

  const TOKEN_KEY = "miski_admin_token";
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("miski_menu_updates") : null;

  const state = {
    token: sessionStorage.getItem(TOKEN_KEY) || "",
    data: null,
    search: "",
    categoryFilter: "all",
    statusFilter: "all",
    editingId: null,
    priceType: "single",
    currentImage: null,
    pendingImageDataUrl: null,
    deleteId: null,
  };

  const els = {
    loginScreen: document.getElementById("loginScreen"),
    adminApp: document.getElementById("adminApp"),
    loginForm: document.getElementById("loginForm"),
    loginUser: document.getElementById("loginUser"),
    loginPass: document.getElementById("loginPass"),
    loginError: document.getElementById("loginError"),
    logoutBtn: document.getElementById("logoutBtn"),
    statTotal: document.getElementById("statTotal"),
    statActive: document.getElementById("statActive"),
    statHidden: document.getElementById("statHidden"),
    adminSearchInput: document.getElementById("adminSearchInput"),
    adminCatFilter: document.getElementById("adminCatFilter"),
    adminStatusFilter: document.getElementById("adminStatusFilter"),
    adminProductsList: document.getElementById("adminProductsList"),
    openAddModalBtn: document.getElementById("openAddModalBtn"),
    productModal: document.getElementById("productModal"),
    productModalTitle: document.getElementById("productModalTitle"),
    closeProductModalBtn: document.getElementById("closeProductModalBtn"),
    cancelProductBtn: document.getElementById("cancelProductBtn"),
    productForm: document.getElementById("productForm"),
    prodId: document.getElementById("prodId"),
    prodCategory: document.getElementById("prodCategory"),
    prodSubcategory: document.getElementById("prodSubcategory"),
    subcategorySuggestions: document.getElementById("subcategorySuggestions"),
    prodName: document.getElementById("prodName"),
    prodDesc: document.getElementById("prodDesc"),
    prodNote: document.getElementById("prodNote"),
    prodVariants: document.getElementById("prodVariants"),
    priceTypeTabs: document.getElementById("priceTypeTabs"),
    priceSingleWrap: document.getElementById("priceSingleWrap"),
    priceSizesWrap: document.getElementById("priceSizesWrap"),
    priceMatrixWrap: document.getElementById("priceMatrixWrap"),
    prodPrice: document.getElementById("prodPrice"),
    prodUnitWrap: document.getElementById("prodUnitWrap"),
    prodUnit: document.getElementById("prodUnit"),
    sizesRows: document.getElementById("sizesRows"),
    addSizeRowBtn: document.getElementById("addSizeRowBtn"),
    matrixTypeSelect: document.getElementById("matrixTypeSelect"),
    matrixRows: document.getElementById("matrixRows"),
    addMatrixRowBtn: document.getElementById("addMatrixRowBtn"),
    photoPreviewFrame: document.getElementById("photoPreviewFrame"),
    prodPhotoFile: document.getElementById("prodPhotoFile"),
    removePhotoBtn: document.getElementById("removePhotoBtn"),
    prodActive: document.getElementById("prodActive"),
    prodFeatured: document.getElementById("prodFeatured"),
    prodPromo: document.getElementById("prodPromo"),
    productFormError: document.getElementById("productFormError"),
    saveProductBtn: document.getElementById("saveProductBtn"),
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    settingsModal: document.getElementById("settingsModal"),
    closeSettingsModalBtn: document.getElementById("closeSettingsModalBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    settingsForm: document.getElementById("settingsForm"),
    setWhatsapp: document.getElementById("setWhatsapp"),
    setHours: document.getElementById("setHours"),
    setInstagram: document.getElementById("setInstagram"),
    setCakeNotice: document.getElementById("setCakeNotice"),
    setBranches: document.getElementById("setBranches"),
    deleteModal: document.getElementById("deleteModal"),
    deleteModalText: document.getElementById("deleteModalText"),
    cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
    toast: document.getElementById("toast"),
  };

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function notifyPublicMenus() {
    if (channel) channel.postMessage({ type: "updated", ts: Date.now() });
  }

  async function apiFetch(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== "/api/login") {
      handleLogout();
      throw new Error("Tu sesión ha expirado. Inicia sesión nuevamente.");
    }
    if (!res.ok) {
      throw new Error(data.error || "Error al comunicarse con el servidor");
    }
    return data;
  }

  function showApp() {
    els.loginScreen.classList.add("hidden");
    els.adminApp.classList.remove("hidden");
  }

  function showLogin() {
    els.adminApp.classList.add("hidden");
    els.loginScreen.classList.remove("hidden");
  }

  function handleLogout() {
    state.token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    showLogin();
  }

  async function loadMenu() {
    const res = await fetch(`/api/menu?t=${Date.now()}`, { cache: "no-store" });
    state.data = await res.json();
    populateCategorySelects();
    renderAdminList();
  }

  function populateCategorySelects() {
    const cats = state.data?.categories || [];
    const currentFilter = els.adminCatFilter.value || "all";
    els.adminCatFilter.innerHTML = [
      `<option value="all">Todas las categorías</option>`,
      ...cats.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`),
    ].join("");
    els.adminCatFilter.value = currentFilter;

    els.prodCategory.innerHTML = cats
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`)
      .join("");
  }

  function updateSubcategorySuggestions() {
    const catId = els.prodCategory.value;
    const subs = new Set();
    for (const p of state.data?.products || []) {
      if (p.category === catId && p.subcategory) subs.add(p.subcategory);
    }
    els.subcategorySuggestions.innerHTML = [...subs].map((s) => `<option value="${escapeHtml(s)}"></option>`).join("");
  }

  function renderAdminList() {
    const products = state.data?.products || [];
    const total = products.length;
    const activeCount = products.filter((p) => p.active !== false).length;
    els.statTotal.textContent = total;
    els.statActive.textContent = activeCount;
    els.statHidden.textContent = total - activeCount;

    const catMap = Object.fromEntries((state.data?.categories || []).map((c) => [c.id, c]));
    const q = normalizeText(state.search.trim());

    const filtered = products.filter((p) => {
      if (state.categoryFilter !== "all") {
        if (state.categoryFilter === "promociones") {
          if (p.category !== "promociones" && !p.promo) return false;
        } else if (p.category !== state.categoryFilter) {
          return false;
        }
      }
      if (state.statusFilter === "active" && p.active === false) return false;
      if (state.statusFilter === "hidden" && p.active !== false) return false;
      if (q) {
        const hay = normalizeText(`${p.name} ${p.subcategory} ${p.description} ${p.note}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      els.adminProductsList.innerHTML = `<div style="text-align:center;padding:2.5rem 1rem;color:var(--miski-mocha)">No hay productos que coincidan con el filtro actual.</div>`;
      return;
    }

    els.adminProductsList.innerHTML = filtered
      .map((p) => {
        const cat = catMap[p.category] || { name: p.category, icon: "🥐" };
        const isActive = p.active !== false;
        const thumbHtml = p.image
          ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="admin-thumb" />`
          : `<div class="admin-thumb">${escapeHtml(cat.icon)}</div>`;

        let priceControlHtml = "";
        if (p.priceType === "single" || p.priceType === "weight") {
          const suffix = p.priceType === "weight" ? "Kg" : p.unit || "";
          priceControlHtml = `
            <div class="quick-price-group">
              <span class="quick-price-label">B/.</span>
              <input type="number" class="quick-price-input" step="0.01" min="0" value="${Number(p.price).toFixed(2)}" data-quick-input="${escapeHtml(p.id)}" aria-label="Precio de ${escapeHtml(p.name)}" />
              ${suffix ? `<span class="quick-price-label">${escapeHtml(suffix)}</span>` : ""}
              <button type="button" class="btn-quick-save" data-quick-save="${escapeHtml(p.id)}">💾</button>
            </div>
          `;
        } else if (p.priceType === "sizes") {
          const summary = (p.sizes || []).map((s) => `${s.label}: B/. ${Number(s.price).toFixed(2)}`).join(" · ");
          priceControlHtml = `<span class="admin-item-sub"><strong>${escapeHtml(summary)}</strong></span>`;
        } else {
          priceControlHtml = `<span class="admin-item-sub"><strong>Desde $${Number(p.price).toFixed(2)}</strong> (${(p.matrix || []).length} medidas)</span>`;
        }

        return `
          <article class="admin-item-card ${isActive ? "" : "is-hidden-item"}">
            <div class="admin-item-top">
              ${thumbHtml}
              <div class="admin-item-meta">
                <div class="admin-item-cat">${escapeHtml(cat.name)} · ${escapeHtml(p.subcategory || "General")}</div>
                <h3 class="admin-item-title">${escapeHtml(p.name)} ${p.featured ? "⭐" : ""} ${p.promo ? "🏷️" : ""}</h3>
                ${p.description ? `<div class="admin-item-sub">${escapeHtml(p.description)}</div>` : ""}
              </div>
            </div>
            <div class="admin-item-controls">
              ${priceControlHtml}
              <div class="action-btns">
                <button type="button" class="btn-toggle-vis ${isActive ? "" : "is-off"}" data-toggle-id="${escapeHtml(p.id)}">
                  ${isActive ? "🟢 Visible" : "⚪ Oculto"}
                </button>
                <button type="button" class="btn-edit-sm" data-edit-id="${escapeHtml(p.id)}">✏️ Editar</button>
                <button type="button" class="btn-del-sm" data-delete-id="${escapeHtml(p.id)}">🗑️</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function setPriceTypeUI(ptype) {
    state.priceType = ptype;
    els.priceTypeTabs.querySelectorAll(".ptype-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.ptype === ptype);
    });
    els.priceSingleWrap.classList.toggle("hidden", ptype !== "single" && ptype !== "weight");
    els.prodUnitWrap.classList.toggle("hidden", ptype !== "single");
    els.priceSizesWrap.classList.toggle("hidden", ptype !== "sizes");
    els.priceMatrixWrap.classList.toggle("hidden", ptype !== "cake_matrix");
  }

  function addSizeRow(label = "", price = "") {
    const div = document.createElement("div");
    div.className = "dyn-row";
    div.innerHTML = `
      <input type="text" class="sz-label" placeholder="Ej. 8oz" value="${escapeHtml(label)}" />
      <input type="number" class="sz-price" step="0.01" min="0" placeholder="Precio" value="${price !== "" ? escapeHtml(price) : ""}" />
      <button type="button" class="btn-row-del" aria-label="Quitar">✕</button>
    `;
    div.querySelector(".btn-row-del").addEventListener("click", () => div.remove());
    els.sizesRows.appendChild(div);
  }

  function addMatrixRow(row = {}) {
    const mtype = els.matrixTypeSelect.value;
    const div = document.createElement("div");
    if (mtype === "tiered") {
      div.className = "dyn-row is-matrix-tiered";
      div.innerHTML = `
        <input type="text" class="mx-size" placeholder='Ej. 6" + 8"' value="${escapeHtml(row.size || "")}" />
        <input type="text" class="mx-portions" placeholder="Porciones" value="${escapeHtml(row.portions || "")}" />
        <input type="number" class="mx-mv" step="0.01" placeholder="Mer. V" value="${row.merengueVanilla ?? ""}" />
        <input type="number" class="mx-mc" step="0.01" placeholder="Mer. C" value="${row.merengueChocolate ?? ""}" />
        <input type="number" class="mx-cv" step="0.01" placeholder="Cha. V" value="${row.chantillyVanilla ?? ""}" />
        <input type="number" class="mx-cc" step="0.01" placeholder="Cha. C" value="${row.chantillyChocolate ?? ""}" />
        <button type="button" class="btn-row-del" aria-label="Quitar">✕</button>
      `;
    } else {
      div.className = "dyn-row is-matrix-std";
      div.innerHTML = `
        <input type="text" class="mx-size" placeholder='Ej. 8x12"' value="${escapeHtml(row.size || "")}" />
        <input type="text" class="mx-portions" placeholder="15 a 20 porciones" value="${escapeHtml(row.portions || "")}" />
        <input type="number" class="mx-van" step="0.01" placeholder="Vainilla $" value="${row.vanilla ?? ""}" />
        <input type="number" class="mx-choc" step="0.01" placeholder="Choc. $" value="${row.chocolate ?? ""}" />
        <button type="button" class="btn-row-del" aria-label="Quitar">✕</button>
      `;
    }
    div.querySelector(".btn-row-del").addEventListener("click", () => div.remove());
    els.matrixRows.appendChild(div);
  }

  function updatePhotoPreview(src) {
    if (src) {
      els.photoPreviewFrame.innerHTML = `<img src="${escapeHtml(src)}" alt="Vista previa" />`;
      els.removePhotoBtn.classList.remove("hidden");
    } else {
      els.photoPreviewFrame.innerHTML = `<span class="no-photo-placeholder">Sin foto</span>`;
      els.removePhotoBtn.classList.add("hidden");
    }
  }

  function compressImageTo4x3(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const targetW = 640;
          const targetH = 480;
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");

          // Center-crop cover into exact 4:3 frame
          const srcRatio = img.width / img.height;
          const dstRatio = targetW / targetH;
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          if (srcRatio > dstRatio) {
            sw = img.height * dstRatio;
            sx = (img.width - sw) / 2;
          } else {
            sh = img.width / dstRatio;
            sy = (img.height - sh) / 2;
          }
          ctx.fillStyle = "#FAF4EC";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

          let dataUrl = canvas.toDataURL("image/webp", 0.86);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.86);
          }
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Error leyendo el archivo"));
      reader.readAsDataURL(file);
    });
  }

  function openProductModal(product = null) {
    els.productFormError.classList.add("hidden");
    els.prodPhotoFile.value = "";
    state.pendingImageDataUrl = null;

    if (product) {
      state.editingId = product.id;
      els.productModalTitle.textContent = "Editar Producto";
      els.prodId.value = product.id;
      els.prodCategory.value = product.category;
      updateSubcategorySuggestions();
      els.prodSubcategory.value = product.subcategory || "";
      els.prodName.value = product.name || "";
      els.prodDesc.value = product.description || "";
      els.prodNote.value = product.note || "";
      els.prodVariants.value = (product.variants || []).join(", ");
      els.prodPrice.value = product.price ?? "";
      els.prodUnit.value = product.unit || "";
      els.prodActive.checked = product.active !== false;
      els.prodFeatured.checked = Boolean(product.featured);
      els.prodPromo.checked = Boolean(product.promo);

      state.currentImage = product.image || null;
      updatePhotoPreview(state.currentImage);

      setPriceTypeUI(product.priceType || "single");

      els.sizesRows.innerHTML = "";
      if (product.priceType === "sizes" && Array.isArray(product.sizes)) {
        product.sizes.forEach((s) => addSizeRow(s.label, s.price));
      } else {
        addSizeRow("8oz", "");
        addSizeRow("12oz", "");
      }

      els.matrixRows.innerHTML = "";
      els.matrixTypeSelect.value = product.matrixType || "standard";
      if (product.priceType === "cake_matrix" && Array.isArray(product.matrix)) {
        product.matrix.forEach((r) => addMatrixRow(r));
      } else {
        addMatrixRow();
      }
    } else {
      state.editingId = null;
      els.productModalTitle.textContent = "Agregar Nuevo Producto";
      els.productForm.reset();
      els.prodId.value = "";
      els.prodCategory.value = state.categoryFilter !== "all" ? state.categoryFilter : "panaderia";
      updateSubcategorySuggestions();
      els.prodActive.checked = true;
      state.currentImage = null;
      updatePhotoPreview(null);
      setPriceTypeUI("single");
      els.sizesRows.innerHTML = "";
      addSizeRow("8oz", "");
      addSizeRow("12oz", "");
      els.matrixRows.innerHTML = "";
      els.matrixTypeSelect.value = "standard";
      addMatrixRow();
    }

    els.productModal.classList.remove("hidden");
  }

  function closeProductModal() {
    els.productModal.classList.add("hidden");
  }

  function openSettingsModal() {
    const b = state.data?.brand || {};
    els.setWhatsapp.value = b.whatsapp || "";
    els.setHours.value = b.hours || "";
    els.setInstagram.value = b.instagram || "";
    els.setCakeNotice.value = b.cakeNotice || "";
    els.setBranches.value = (b.branches || []).join(", ");
    els.settingsModal.classList.remove("hidden");
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      els.loginError.classList.add("hidden");
      try {
        const res = await apiFetch("/api/login", {
          method: "POST",
          body: JSON.stringify({
            username: els.loginUser.value.trim(),
            password: els.loginPass.value,
          }),
        });
        state.token = res.token;
        sessionStorage.setItem(TOKEN_KEY, res.token);
        showApp();
        await loadMenu();
      } catch (err) {
        els.loginError.textContent = err.message;
        els.loginError.classList.remove("hidden");
      }
    });

    els.logoutBtn.addEventListener("click", async () => {
      try {
        await apiFetch("/api/logout", { method: "POST" });
      } catch {
        // ignore
      }
      handleLogout();
    });

    els.adminSearchInput.addEventListener("input", () => {
      state.search = els.adminSearchInput.value;
      renderAdminList();
    });

    els.adminCatFilter.addEventListener("change", () => {
      state.categoryFilter = els.adminCatFilter.value;
      renderAdminList();
    });

    els.adminStatusFilter.addEventListener("change", () => {
      state.statusFilter = els.adminStatusFilter.value;
      renderAdminList();
    });

    els.openAddModalBtn.addEventListener("click", () => openProductModal(null));
    els.closeProductModalBtn.addEventListener("click", closeProductModal);
    els.cancelProductBtn.addEventListener("click", closeProductModal);
    els.prodCategory.addEventListener("change", updateSubcategorySuggestions);

    els.priceTypeTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".ptype-btn");
      if (btn) setPriceTypeUI(btn.dataset.ptype);
    });

    els.addSizeRowBtn.addEventListener("click", () => addSizeRow("", ""));
    els.addMatrixRowBtn.addEventListener("click", () => addMatrixRow());
    els.matrixTypeSelect.addEventListener("change", () => {
      els.matrixRows.innerHTML = "";
      addMatrixRow();
    });

    els.prodPhotoFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressedDataUrl = await compressImageTo4x3(file);
        state.pendingImageDataUrl = compressedDataUrl;
        updatePhotoPreview(compressedDataUrl);
      } catch (err) {
        showToast(err.message);
      }
    });

    els.removePhotoBtn.addEventListener("click", () => {
      state.currentImage = null;
      state.pendingImageDataUrl = null;
      els.prodPhotoFile.value = "";
      updatePhotoPreview(null);
    });

    els.productForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      els.productFormError.classList.add("hidden");
      els.saveProductBtn.disabled = true;

      try {
        let imageUrl = state.currentImage;
        if (state.pendingImageDataUrl) {
          const uploadRes = await apiFetch("/api/upload", {
            method: "POST",
            body: JSON.stringify({
              dataUrl: state.pendingImageDataUrl,
              filename: els.prodName.value.trim() || "producto",
            }),
          });
          imageUrl = uploadRes.url;
        }

        const payload = {
          category: els.prodCategory.value,
          subcategory: els.prodSubcategory.value.trim() || "General",
          name: els.prodName.value.trim(),
          description: els.prodDesc.value.trim(),
          note: els.prodNote.value.trim(),
          variants: els.prodVariants.value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          priceType: state.priceType,
          price: Number(els.prodPrice.value) || 0,
          currency: state.priceType === "cake_matrix" ? "$" : "B/.",
          unit: state.priceType === "single" ? els.prodUnit.value.trim() : state.priceType === "weight" ? "Kg" : "",
          image: imageUrl,
          active: els.prodActive.checked,
          featured: els.prodFeatured.checked,
          promo: els.prodPromo.checked,
        };

        if (state.priceType === "single" || state.priceType === "weight") {
          const val = Number(els.prodPrice.value);
          if (!Number.isFinite(val) || val < 0 || els.prodPrice.value === "") {
            throw new Error("Ingresa un precio válido para el producto.");
          }
        }

        if (state.priceType === "sizes") {
          const sizes = [...els.sizesRows.querySelectorAll(".dyn-row")]
            .map((r) => ({
              label: r.querySelector(".sz-label").value.trim(),
              price: Number(r.querySelector(".sz-price").value),
            }))
            .filter((s) => s.label && Number.isFinite(s.price));
          if (!sizes.length) throw new Error("Agrega al menos un tamaño con precio válido.");
          payload.sizes = sizes;
        }

        if (state.priceType === "cake_matrix") {
          const mtype = els.matrixTypeSelect.value;
          payload.matrixType = mtype;
          const rows = [...els.matrixRows.querySelectorAll(".dyn-row")].map((r) => {
            const size = r.querySelector(".mx-size").value.trim();
            const portions = r.querySelector(".mx-portions").value.trim();
            if (mtype === "tiered") {
              return {
                size,
                portions,
                merengueVanilla: Number(r.querySelector(".mx-mv").value) || null,
                merengueChocolate: Number(r.querySelector(".mx-mc").value) || null,
                chantillyVanilla: Number(r.querySelector(".mx-cv").value) || null,
                chantillyChocolate: Number(r.querySelector(".mx-cc").value) || null,
              };
            }
            return {
              size,
              portions,
              vanilla: Number(r.querySelector(".mx-van").value) || null,
              chocolate: Number(r.querySelector(".mx-choc").value) || null,
            };
          }).filter((row) => row.size);
          if (!rows.length) throw new Error("Agrega al menos una medida para la tabla de dulcería.");
          payload.matrix = rows;
        }

        if (state.editingId) {
          await apiFetch(`/api/products/${encodeURIComponent(state.editingId)}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          showToast("✅ Producto actualizado en el menú");
        } else {
          await apiFetch("/api/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          showToast("✅ Nuevo producto publicado en el menú");
        }

        closeProductModal();
        await loadMenu();
        notifyPublicMenus();
      } catch (err) {
        els.productFormError.textContent = err.message;
        els.productFormError.classList.remove("hidden");
      } finally {
        els.saveProductBtn.disabled = false;
      }
    });

    els.adminProductsList.addEventListener("click", async (e) => {
      const quickBtn = e.target.closest("[data-quick-save]");
      if (quickBtn) {
        const id = quickBtn.dataset.quickSave;
        const input = els.adminProductsList.querySelector(`[data-quick-input="${CSS.escape(id)}"]`);
        const newPrice = Number(input?.value);
        if (!Number.isFinite(newPrice) || newPrice < 0) {
          showToast("Precio inválido");
          return;
        }
        try {
          await apiFetch(`/api/products/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ price: newPrice }),
          });
          await loadMenu();
          notifyPublicMenus();
          showToast("✅ Precio actualizado");
        } catch (err) {
          showToast(err.message);
        }
        return;
      }

      const toggleBtn = e.target.closest("[data-toggle-id]");
      if (toggleBtn) {
        const id = toggleBtn.dataset.toggleId;
        try {
          const res = await apiFetch(`/api/products/${encodeURIComponent(id)}/toggle`, { method: "PATCH" });
          await loadMenu();
          notifyPublicMenus();
          showToast(res.product.active ? "🟢 Producto visible en menú" : "⚪ Producto ocultado");
        } catch (err) {
          showToast(err.message);
        }
        return;
      }

      const editBtn = e.target.closest("[data-edit-id]");
      if (editBtn) {
        const prod = state.data?.products.find((p) => p.id === editBtn.dataset.editId);
        if (prod) openProductModal(prod);
        return;
      }

      const delBtn = e.target.closest("[data-delete-id]");
      if (delBtn) {
        const prod = state.data?.products.find((p) => p.id === delBtn.dataset.deleteId);
        if (!prod) return;
        state.deleteId = prod.id;
        els.deleteModalText.textContent = `Se eliminará "${prod.name}" del menú digital y el resto de los productos se reacomodarán automáticamente.`;
        els.deleteModal.classList.remove("hidden");
      }
    });

    els.cancelDeleteBtn.addEventListener("click", () => {
      state.deleteId = null;
      els.deleteModal.classList.add("hidden");
    });

    els.confirmDeleteBtn.addEventListener("click", async () => {
      if (!state.deleteId) return;
      try {
        await apiFetch(`/api/products/${encodeURIComponent(state.deleteId)}`, { method: "DELETE" });
        state.deleteId = null;
        els.deleteModal.classList.add("hidden");
        await loadMenu();
        notifyPublicMenus();
        showToast("🗑️ Producto eliminado y grilla reacomodada");
      } catch (err) {
        showToast(err.message);
      }
    });

    els.openSettingsBtn.addEventListener("click", openSettingsModal);
    els.closeSettingsModalBtn.addEventListener("click", () => els.settingsModal.classList.add("hidden"));
    els.cancelSettingsBtn.addEventListener("click", () => els.settingsModal.classList.add("hidden"));

    els.settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await apiFetch("/api/settings", {
          method: "PUT",
          body: JSON.stringify({
            whatsapp: els.setWhatsapp.value.trim(),
            hours: els.setHours.value.trim(),
            instagram: els.setInstagram.value.trim(),
            cakeNotice: els.setCakeNotice.value.trim(),
            branches: els.setBranches.value
              .split(",")
              .map((b) => b.trim())
              .filter(Boolean),
          }),
        });
        els.settingsModal.classList.add("hidden");
        await loadMenu();
        notifyPublicMenus();
        showToast("⚙️ Datos del establecimiento guardados");
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  async function init() {
    bindEvents();
    if (!state.token) {
      showLogin();
      return;
    }
    try {
      await apiFetch("/api/auth/verify");
      showApp();
      await loadMenu();
    } catch {
      handleLogout();
    }
  }

  init();
})();
