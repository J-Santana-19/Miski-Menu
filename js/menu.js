(() => {
  "use strict";

  const state = {
    data: null,
    activeCategory: "all",
    activeSubcategory: {},
    searchTerm: "",
  };

  const els = {
    menuContainer: document.getElementById("menuContainer"),
    categoryNav: document.getElementById("categoryNav"),
    searchInput: document.getElementById("searchInput"),
    clearSearchBtn: document.getElementById("clearSearchBtn"),
    toggleStoryBtn: document.getElementById("toggleStoryBtn"),
    fullStoryText: document.getElementById("fullStoryText"),
    footerSlogan: document.getElementById("footerSlogan"),
    footerCakeNotice: document.getElementById("footerCakeNotice"),
    footerBranches: document.getElementById("footerBranches"),
    footerHours: document.getElementById("footerHours"),
    footerSocialLinks: document.getElementById("footerSocialLinks"),
    fabWhatsapp: document.getElementById("fabWhatsapp"),
    backToTopBtn: document.getElementById("backToTopBtn"),
    branchesModal: document.getElementById("branchesModal"),
    openBranchesBtn: document.getElementById("openBranchesBtn"),
    closeBranchesBtn: document.getElementById("closeBranchesBtn"),
    modalBranchesList: document.getElementById("modalBranchesList"),
    modalInfoBox: document.getElementById("modalInfoBox"),
    currentYear: document.getElementById("currentYear"),
  };

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMoney(amount, currency = "B/.") {
    const num = Number(amount);
    if (!Number.isFinite(num)) return String(amount || "");
    const prefix = currency === "$" ? "$" : "B/. ";
    return `${prefix}${num.toFixed(2)}`;
  }

  function buildWhatsappUrl(message) {
    const rawPhone = String(state.data?.brand?.whatsapp || "").replace(/\D/g, "");
    if (!rawPhone) return null;
    const text = encodeURIComponent(message);
    return `https://wa.me/${rawPhone}?text=${text}`;
  }

  async function fetchMenuData() {
    const res = await fetch(`/api/menu?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar el menú");
    return res.json();
  }

  function getActiveProducts() {
    if (!state.data) return [];
    return state.data.products.filter((p) => p.active !== false);
  }

  function getCategoryProducts(catId, activeProducts) {
    if (catId === "promociones") {
      return activeProducts.filter((p) => p.category === "promociones" || p.promo === true);
    }
    return activeProducts.filter((p) => p.category === catId);
  }

  function renderBrandInfo() {
    const brand = state.data?.brand || {};
    if (els.fullStoryText) {
      els.fullStoryText.textContent = brand.story || "";
    }
    if (els.footerSlogan && brand.slogan) {
      els.footerSlogan.textContent = brand.slogan;
    }
    if (els.footerCakeNotice) {
      els.footerCakeNotice.textContent = brand.cakeNotice || "";
    }
    const branchDetails = Array.isArray(brand.branchDetails) && brand.branchDetails.length
      ? brand.branchDetails
      : (brand.branches || []).map((b) => ({ name: b, hours: [] }));

    if (els.footerHours) {
      els.footerHours.textContent = !branchDetails.some((b) => b.hours?.length) && brand.hours ? `Horario: ${brand.hours}` : "";
    }

    if (els.footerBranches) {
      els.footerBranches.innerHTML = branchDetails
        .map(
          (b) => `
          <li>
            <span class="branch-card-name">📍 ${escapeHtml(b.name)}</span>
            ${
              b.hours?.length
                ? `<span class="branch-card-hours">${b.hours.map((h) => escapeHtml(h)).join("<br>")}</span>`
                : ""
            }
          </li>`
        )
        .join("");
    }
    if (els.modalBranchesList) {
      els.modalBranchesList.innerHTML = branchDetails
        .map(
          (b) => `
          <li>
            <div style="font-weight:700;color:var(--miski-cacao)">📍 ${escapeHtml(b.name)}</div>
            ${
              b.hours?.length
                ? `<div style="font-size:0.78rem;font-weight:500;color:var(--miski-mocha);margin-top:0.2rem;line-height:1.35">${b.hours.map((h) => escapeHtml(h)).join("<br>")}</div>`
                : ""
            }
          </li>`
        )
        .join("");
    }
    if (els.openBranchesBtn && branchDetails.length) {
      els.openBranchesBtn.querySelector("span:last-child").textContent = `${branchDetails.length} Sucursales`;
    }
    if (els.modalInfoBox) {
      const parts = [];
      if (brand.whatsapp) parts.push(`<div><strong>WhatsApp:</strong> ${escapeHtml(brand.whatsapp)}</div>`);
      if (brand.cakeNotice) parts.push(`<div>${escapeHtml(brand.cakeNotice)}</div>`);
      els.modalInfoBox.innerHTML = parts.join("");
    }

    const waUrl = buildWhatsappUrl("Hola Miski, estoy viendo su menú digital y deseo hacer una consulta.");
    if (waUrl && els.fabWhatsapp) {
      els.fabWhatsapp.href = waUrl;
      els.fabWhatsapp.classList.remove("hidden");
    } else if (els.fabWhatsapp) {
      els.fabWhatsapp.classList.add("hidden");
    }

    if (els.footerSocialLinks) {
      const links = [];
      if (waUrl) {
        links.push(`<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="footer-social-btn">💬 Consultar por WhatsApp</a>`);
      }
      if (brand.instagram) {
        const igHandle = brand.instagram.replace(/^@/, "");
        const igUrl = brand.instagram.startsWith("http") ? brand.instagram : `https://instagram.com/${igHandle}`;
        links.push(`<a href="${escapeHtml(igUrl)}" target="_blank" rel="noopener noreferrer" class="footer-social-btn">📸 Instagram @${escapeHtml(igHandle)}</a>`);
      }
      if (!links.length) {
        links.push(`<button type="button" class="footer-social-btn" onclick="document.getElementById('openBranchesBtn').click()">📍 Ver nuestras ${branchDetails.length} sucursales</button>`);
      }
      els.footerSocialLinks.innerHTML = links.join("");
    }
  }

  function renderCategoryNav(activeProducts) {
    const categories = state.data?.categories || [];
    const visibleCategories = categories.filter((c) => getCategoryProducts(c.id, activeProducts).length > 0);

    const pills = [
      `<button type="button" class="cat-pill ${state.activeCategory === "all" ? "is-active" : ""}" data-cat="all">✨ Todo el menú</button>`,
      ...visibleCategories.map(
        (cat) =>
          `<button type="button" class="cat-pill ${state.activeCategory === cat.id ? "is-active" : ""}" data-cat="${escapeHtml(cat.id)}">${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</button>`
      ),
    ];

    els.categoryNav.innerHTML = pills.join("");
  }

  function renderPhotoCard(p) {
    const isPromo = p.promo;
    const ribbon = p.featured
      ? `<span class="badge-ribbon">⭐ Favorito</span>`
      : isPromo
      ? `<span class="badge-ribbon is-promo">Para compartir</span>`
      : "";

    const priceUnit = p.priceType === "weight" ? "Kg" : p.unit || "";
    const variantsHtml = p.variants?.length
      ? `<div class="variant-chips">${p.variants.map((v) => `<span class="variant-chip">${escapeHtml(v)}</span>`).join("")}</div>`
      : "";

    let priceFooterHtml = "";
    if (p.priceType === "sizes" && Array.isArray(p.sizes) && p.sizes.length) {
      priceFooterHtml = `<div class="sizes-list">${p.sizes
        .map((s) => `<span class="size-badge"><strong>${escapeHtml(s.label)}</strong> <span>${formatMoney(s.price, p.currency)}</span></span>`)
        .join("")}</div>`;
    } else {
      priceFooterHtml = `
        <div class="card-footer-price">
          <span class="price-pill">
            <span>${formatMoney(p.price, p.currency)}</span>
            ${priceUnit ? `<span class="price-unit">${escapeHtml(priceUnit)}</span>` : ""}
          </span>
        </div>
      `;
    }

    return `
      <article class="product-card ${p.featured ? "is-featured" : ""}">
        <div class="card-media">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />
          ${ribbon}
        </div>
        <div class="card-body">
          <h4 class="card-title">${escapeHtml(p.name)}</h4>
          ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ""}
          ${p.note ? `<p class="card-note">${escapeHtml(p.note)}</p>` : ""}
          ${variantsHtml}
          ${priceFooterHtml}
        </div>
      </article>
    `;
  }

  function renderBistroRow(p) {
    const priceUnit = p.priceType === "weight" ? "Kg" : p.unit || "";
    const featuredHtml = p.featured
      ? `<span class="featured-tag">⭐ Recomendado · Favorito de la Casa</span>`
      : p.promo
      ? `<span class="featured-tag">🏷️ Promoción</span>`
      : "";

    const variantsHtml = p.variants?.length
      ? `<div class="variant-chips">${p.variants.map((v) => `<span class="variant-chip">${escapeHtml(v)}</span>`).join("")}</div>`
      : "";

    if (p.priceType === "sizes" && Array.isArray(p.sizes) && p.sizes.length) {
      const sizesHtml = `<div class="sizes-list">${p.sizes
        .map((s) => `<span class="size-badge"><strong>${escapeHtml(s.label)}</strong> <span>${formatMoney(s.price, p.currency)}</span></span>`)
        .join("")}</div>`;
      return `
        <article class="bistro-row is-sizes ${p.featured ? "is-featured" : ""}">
          <div class="bistro-row-body">
            ${featuredHtml}
            <div class="bistro-row-head">
              <h4 class="bistro-title">${escapeHtml(p.name)}</h4>
              ${sizesHtml}
            </div>
            ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ""}
            ${p.note ? `<p class="card-note">${escapeHtml(p.note)}</p>` : ""}
            ${variantsHtml}
          </div>
        </article>
      `;
    }

    return `
      <article class="bistro-row ${p.featured ? "is-featured" : ""}">
        <div class="bistro-row-body">
          ${featuredHtml}
          <div class="bistro-row-main">
            <h4 class="bistro-title">${escapeHtml(p.name)}</h4>
            <span class="bistro-dots" aria-hidden="true"></span>
            <span class="bistro-price">
              <span>${formatMoney(p.price, p.currency)}</span>
              ${priceUnit ? `<span class="bistro-unit">${escapeHtml(priceUnit)}</span>` : ""}
            </span>
          </div>
          ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ""}
          ${p.note ? `<p class="card-note">${escapeHtml(p.note)}</p>` : ""}
          ${variantsHtml}
        </div>
      </article>
    `;
  }

  function renderCakePricePanel(p, row) {
    if (!row) return "";
    if (p.matrixType === "tiered") {
      return `
        <div class="cake-portions">👥 Rinde: ${escapeHtml(row.portions || "Según dimensiones")}</div>
        <div class="cake-price-grid">
          <div class="cake-flavor-box"><span>Merengue · Vainilla</span><strong>${row.merengueVanilla != null ? formatMoney(row.merengueVanilla, "$") : "Consultar"}</strong></div>
          <div class="cake-flavor-box"><span>Merengue · Chocolate</span><strong>${row.merengueChocolate != null ? formatMoney(row.merengueChocolate, "$") : "Consultar"}</strong></div>
          <div class="cake-flavor-box"><span>Chantillí · Vainilla</span><strong>${row.chantillyVanilla != null ? formatMoney(row.chantillyVanilla, "$") : "Consultar"}</strong></div>
          <div class="cake-flavor-box"><span>Chantillí · Chocolate</span><strong>${row.chantillyChocolate != null ? formatMoney(row.chantillyChocolate, "$") : "Consultar"}</strong></div>
        </div>
      `;
    }
    return `
      <div class="cake-portions">👥 Rinde: ${escapeHtml(row.portions || "Porciones estándar")}</div>
      <div class="cake-price-grid">
        <div class="cake-flavor-box"><span>Bizcocho Vainilla</span><strong>${row.vanilla != null ? formatMoney(row.vanilla, "$") : "Consultar"}</strong></div>
        <div class="cake-flavor-box"><span>Bizcocho Chocolate</span><strong>${row.chocolate != null ? formatMoney(row.chocolate, "$") : "Consultar"}</strong></div>
      </div>
    `;
  }

  function renderCakeFullTable(p) {
    const rows = p.matrix || [];
    if (!rows.length) return "";
    if (p.matrixType === "tiered") {
      return `
        <table class="cake-full-table">
          <thead>
            <tr>
              <th>Dimensiones</th>
              <th>Porciones</th>
              <th>Merengue (V / C)</th>
              <th>Chantillí (V / C)</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td><strong>${escapeHtml(r.size)}</strong></td>
                <td>${escapeHtml(r.portions)}</td>
                <td>${formatMoney(r.merengueVanilla, "$")} / ${formatMoney(r.merengueChocolate, "$")}</td>
                <td>${formatMoney(r.chantillyVanilla, "$")} / ${formatMoney(r.chantillyChocolate, "$")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      `;
    }
    return `
      <table class="cake-full-table">
        <thead>
          <tr>
            <th>Tamaño</th>
            <th>Vainilla</th>
            <th>Chocolate</th>
            <th>Porciones</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `
            <tr>
              <td><strong>${escapeHtml(r.size)}</strong></td>
              <td>${r.vanilla != null ? formatMoney(r.vanilla, "$") : "—"}</td>
              <td>${r.chocolate != null ? formatMoney(r.chocolate, "$") : "Consultar"}</td>
              <td>${escapeHtml(r.portions || "—")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderCakeCard(p) {
    const rows = p.matrix || [];
    const firstRow = rows[0];
    const waUrl = buildWhatsappUrl(`Hola Miski, me interesa cotizar "${p.name}" (${firstRow ? firstRow.size : ""}).`);
    const waBtn = waUrl
      ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-cake" data-cake-wa="${escapeHtml(p.id)}">💬 Cotizar por WhatsApp</a>`
      : `<button type="button" class="btn-whatsapp-cake" onclick="document.getElementById('openBranchesBtn').click()">📍 Pedir en sucursal</button>`;

    return `
      <article class="cake-card" data-cake-id="${escapeHtml(p.id)}">
        ${
          p.image
            ? `<div class="card-media"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" /></div>`
            : ""
        }
        <div class="cake-body">
          <div class="cake-header-row">
            <h4 class="card-title">${escapeHtml(p.name)}</h4>
            <span class="cake-from-badge">Desde ${formatMoney(p.price, "$")}</span>
          </div>
          ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ""}
          ${p.note ? `<p class="card-note">${escapeHtml(p.note)}</p>` : ""}

          ${
            rows.length
              ? `
            <span class="cake-selector-label">Elige tamaño o dimensiones:</span>
            <div class="cake-size-pills" role="group" aria-label="Tamaños de ${escapeHtml(p.name)}">
              ${rows
                .map(
                  (r, idx) =>
                    `<button type="button" class="cake-size-btn ${idx === 0 ? "is-active" : ""}" data-cake-select="${escapeHtml(p.id)}" data-row-idx="${idx}">${escapeHtml(r.size)}</button>`
                )
                .join("")}
            </div>
            <div class="cake-price-panel" id="cake-panel-${escapeHtml(p.id)}">
              ${renderCakePricePanel(p, firstRow)}
            </div>
          `
              : ""
          }

          <div class="cake-actions">
            ${
              rows.length > 1
                ? `<button type="button" class="btn-table-toggle" data-table-toggle="${escapeHtml(p.id)}" aria-expanded="false">Ver tabla completa</button>`
                : ""
            }
            ${waBtn}
          </div>

          ${
            rows.length > 1
              ? `<div class="cake-full-table-wrap hidden" id="cake-table-${escapeHtml(p.id)}">${renderCakeFullTable(p)}</div>`
              : ""
          }
        </div>
      </article>
    `;
  }

  function renderSubcategoryGroup(subName, items) {
    const cakeItems = items.filter((p) => p.priceType === "cake_matrix");
    const photoItems = items.filter((p) => p.priceType !== "cake_matrix" && Boolean(p.image));
    const bistroItems = items.filter((p) => p.priceType !== "cake_matrix" && !p.image);

    const blocks = [];
    if (cakeItems.length) {
      blocks.push(`<div class="cake-grid">${cakeItems.map(renderCakeCard).join("")}</div>`);
    }
    if (photoItems.length) {
      blocks.push(`<div class="photo-grid">${photoItems.map(renderPhotoCard).join("")}</div>`);
    }
    if (bistroItems.length) {
      if (photoItems.length || cakeItems.length) {
        blocks.push(`<div class="more-options-label">Otras opciones disponibles</div>`);
      }
      blocks.push(`<div class="bistro-board">${bistroItems.map(renderBistroRow).join("")}</div>`);
    }

    return `
      <div class="subcategory-block">
        <h3 class="subcategory-title">${escapeHtml(subName)}</h3>
        ${blocks.join("")}
      </div>
    `;
  }

  function renderMenu() {
    if (!state.data) return;
    const allActive = getActiveProducts();
    renderCategoryNav(allActive);

    const query = normalizeText(state.searchTerm.trim());
    const categories = state.data.categories || [];

    // Search mode across the whole menu
    if (query) {
      const matches = allActive.filter((p) => {
        const haystack = normalizeText(
          `${p.name} ${p.description} ${p.note} ${p.subcategory} ${(p.variants || []).join(" ")} ${p.name.replace(/cheesecake/gi, "cheesecacke")}`
        );
        return haystack.includes(query);
      });

      if (!matches.length) {
        els.menuContainer.innerHTML = `
          <div class="empty-state">
            <p style="font-size:2rem;margin:0 0 0.4rem">🥐</p>
            <h3 style="margin:0 0 0.4rem;color:var(--miski-cacao)">No encontramos "${escapeHtml(state.searchTerm)}"</h3>
            <p style="margin:0 0 1rem">Prueba con otra palabra como <em>empanada, queso, jamón, dulce, flan o frappe</em>.</p>
            <button type="button" class="btn-primary" id="resetSearchFromEmpty">Ver todo el menú</button>
          </div>
        `;
        return;
      }

      const byCat = categories
        .filter((c) => c.id !== "promociones")
        .map((c) => ({
          cat: c,
          items: matches.filter((p) => p.category === c.id),
        }))
        .filter((g) => g.items.length > 0);

      // Include any products explicitly in 'promociones' category
      const promoOnly = matches.filter((p) => p.category === "promociones");
      if (promoOnly.length) {
        const promoCat = categories.find((c) => c.id === "promociones");
        if (promoCat) byCat.unshift({ cat: promoCat, items: promoOnly });
      }

      els.menuContainer.innerHTML = `
        <div class="search-results-banner">
          <span>Mostrando ${matches.length} resultado${matches.length === 1 ? "" : "s"} para "${escapeHtml(state.searchTerm)}"</span>
          <button type="button" class="sub-pill" id="resetSearchBanner">Limpiar filtro ✕</button>
        </div>
        ${byCat
          .map(
            ({ cat, items }) => `
          <section class="category-section">
            <div class="category-header">
              <div class="category-title-row">
                <h2 class="category-title"><span>${escapeHtml(cat.icon)}</span> ${escapeHtml(cat.name)}</h2>
                <span class="category-count">${items.length}</span>
              </div>
            </div>
            ${renderSubcategoryGroup("Resultados", items)}
          </section>`
          )
          .join("")}
      `;
      return;
    }

    // Standard browsing mode
    const catsToRender =
      state.activeCategory === "all"
        ? categories.filter((c) => getCategoryProducts(c.id, allActive).length > 0)
        : categories.filter((c) => c.id === state.activeCategory && getCategoryProducts(c.id, allActive).length > 0);

    const htmlSections = catsToRender.map((cat) => {
      const catItems = getCategoryProducts(cat.id, allActive);
      const subNames = [];
      for (const item of catItems) {
        const sub = item.subcategory || "General";
        if (!subNames.includes(sub)) subNames.push(sub);
      }

      const selectedSub = state.activeSubcategory[cat.id] || "all";
      const validSelectedSub = selectedSub === "all" || subNames.includes(selectedSub) ? selectedSub : "all";
      const filteredItems =
        validSelectedSub === "all" ? catItems : catItems.filter((p) => (p.subcategory || "General") === validSelectedSub);

      const subFilterHtml =
        subNames.length > 1
          ? `
        <div class="subcat-filter-row" role="group" aria-label="Subsecciones de ${escapeHtml(cat.name)}">
          <button type="button" class="sub-pill ${validSelectedSub === "all" ? "is-active" : ""}" data-subcat-cat="${escapeHtml(cat.id)}" data-subcat="all">Todos</button>
          ${subNames
            .map(
              (s) =>
                `<button type="button" class="sub-pill ${validSelectedSub === s ? "is-active" : ""}" data-subcat-cat="${escapeHtml(cat.id)}" data-subcat="${escapeHtml(s)}">${escapeHtml(s)}</button>`
            )
            .join("")}
        </div>`
          : "";

      const groupedHtml = (validSelectedSub === "all" ? subNames : [validSelectedSub])
        .map((sub) => {
          const items = filteredItems.filter((p) => (p.subcategory || "General") === sub);
          return items.length ? renderSubcategoryGroup(sub, items) : "";
        })
        .join("");

      return `
        <section class="category-section" id="sec-${escapeHtml(cat.id)}">
          <div class="category-header">
            <div class="category-title-row">
              <h2 class="category-title"><span>${escapeHtml(cat.icon)}</span> ${escapeHtml(cat.name)}</h2>
              <span class="category-count">${catItems.length} producto${catItems.length === 1 ? "" : "s"}</span>
            </div>
            ${cat.description ? `<p class="category-desc">${escapeHtml(cat.description)}</p>` : ""}
          </div>
          ${subFilterHtml}
          ${groupedHtml}
        </section>
      `;
    });

    els.menuContainer.innerHTML = htmlSections.join("");
  }

  function bindEvents() {
    els.currentYear.textContent = new Date().getFullYear();

    els.toggleStoryBtn?.addEventListener("click", () => {
      const isHidden = els.fullStoryText.classList.toggle("hidden");
      els.toggleStoryBtn.setAttribute("aria-expanded", String(!isHidden));
      els.toggleStoryBtn.textContent = isHidden ? "Nuestra historia" : "Ocultar historia";
    });

    els.categoryNav.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-pill");
      if (!btn) return;
      state.activeCategory = btn.dataset.cat;
      renderMenu();
      const explorer = document.getElementById("menu-explorer");
      if (explorer && window.scrollY > explorer.offsetTop) {
        explorer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    els.searchInput.addEventListener("input", () => {
      state.searchTerm = els.searchInput.value;
      els.clearSearchBtn.classList.toggle("hidden", !state.searchTerm);
      renderMenu();
    });

    els.clearSearchBtn.addEventListener("click", () => {
      state.searchTerm = "";
      els.searchInput.value = "";
      els.clearSearchBtn.classList.add("hidden");
      renderMenu();
    });

    els.menuContainer.addEventListener("click", (e) => {
      const subBtn = e.target.closest("[data-subcat]");
      if (subBtn) {
        state.activeSubcategory[subBtn.dataset.subcatCat] = subBtn.dataset.subcat;
        renderMenu();
        return;
      }

      const resetBtn = e.target.closest("#resetSearchFromEmpty, #resetSearchBanner");
      if (resetBtn) {
        state.searchTerm = "";
        els.searchInput.value = "";
        els.clearSearchBtn.classList.add("hidden");
        renderMenu();
        return;
      }

      const cakeBtn = e.target.closest("[data-cake-select]");
      if (cakeBtn) {
        const cakeId = cakeBtn.dataset.cakeSelect;
        const rowIdx = Number(cakeBtn.dataset.rowIdx);
        const product = state.data?.products.find((p) => p.id === cakeId);
        if (!product || !product.matrix?.[rowIdx]) return;

        const card = cakeBtn.closest(".cake-card");
        card.querySelectorAll("[data-cake-select]").forEach((b) => b.classList.remove("is-active"));
        cakeBtn.classList.add("is-active");

        const panel = document.getElementById(`cake-panel-${cakeId}`);
        if (panel) panel.innerHTML = renderCakePricePanel(product, product.matrix[rowIdx]);

        const waLink = card.querySelector(`[data-cake-wa="${cakeId}"]`);
        if (waLink) {
          const newUrl = buildWhatsappUrl(`Hola Miski, me interesa cotizar "${product.name}" en medida ${product.matrix[rowIdx].size}.`);
          if (newUrl) waLink.href = newUrl;
        }
        return;
      }

      const tableToggle = e.target.closest("[data-table-toggle]");
      if (tableToggle) {
        const cakeId = tableToggle.dataset.tableToggle;
        const tableWrap = document.getElementById(`cake-table-${cakeId}`);
        if (!tableWrap) return;
        const willShow = tableWrap.classList.contains("hidden");
        tableWrap.classList.toggle("hidden", !willShow);
        tableToggle.setAttribute("aria-expanded", String(willShow));
        tableToggle.textContent = willShow ? "Ocultar tabla" : "Ver tabla completa";
      }
    });

    window.addEventListener(
      "scroll",
      () => {
        els.backToTopBtn.classList.toggle("hidden", window.scrollY < 450);
      },
      { passive: true }
    );

    const openModal = () => els.branchesModal.classList.remove("hidden");
    const closeModal = () => els.branchesModal.classList.add("hidden");
    els.openBranchesBtn.addEventListener("click", openModal);
    els.closeBranchesBtn.addEventListener("click", closeModal);
    els.branchesModal.addEventListener("click", (e) => {
      if (e.target === els.branchesModal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    // Live sync when returning to tab or receiving admin updates
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) reloadSilent();
    });
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("miski_menu_updates");
      ch.onmessage = () => reloadSilent();
    }
  }

  async function reloadSilent() {
    try {
      const latest = await fetchMenuData();
      state.data = latest;
      renderBrandInfo();
      renderMenu();
    } catch {
      // keep current rendered view
    }
  }

  async function init() {
    bindEvents();
    try {
      state.data = await fetchMenuData();
      renderBrandInfo();
      renderMenu();
    } catch (err) {
      els.menuContainer.innerHTML = `
        <div class="empty-state">
          <p>No se pudo cargar el menú en este momento. Intenta recargar la página.</p>
          <button type="button" class="btn-primary" onclick="location.reload()">Reintentar</button>
        </div>
      `;
      console.error(err);
    }
  }

  init();
})();
