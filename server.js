const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "data", "menu.json");
const UPLOADS_DIR = path.join(ROOT_DIR, "assets", "products", "uploads");

const ADMIN_USERS = new Set([
  (process.env.MISKI_ADMIN_USER || "admin").toLowerCase(),
  "encargado@miski.com",
  "encargado",
]);
const ADMIN_PASS = process.env.MISKI_ADMIN_PASS || "Miski2026!";

const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function readMenuData() {
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeMenuData(data) {
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpFile, DATA_FILE);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function sendFile(res, filePath, noCache = false) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Recurso no encontrado");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const headers = { "Content-Type": mime };
    if (noCache || ext === ".html" || ext === ".css" || ext === ".js" || ext === ".json") {
      headers["Cache-Control"] = "no-store";
    } else if (ext === ".webp" || ext === ".png" || ext === ".jpg") {
      headers["Cache-Control"] = "public, max-age=86400";
    }
    res.writeHead(200, headers);
    res.end(content);
  });
}

function parseBody(req, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getAuthToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function isAuthenticated(req) {
  const token = getAuthToken(req);
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function slugify(text) {
  return String(text || "producto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "producto";
}

function sanitizeProduct(input, existing = null) {
  const priceType = ["single", "weight", "sizes", "cake_matrix"].includes(input.priceType)
    ? input.priceType
    : existing?.priceType || "single";

  const currency = priceType === "cake_matrix" ? (input.currency || "$") : (input.currency || "B/.");
  const numPrice = Number(input.price);
  const price = Number.isFinite(numPrice) && numPrice >= 0 ? Number(numPrice.toFixed(2)) : (existing?.price ?? 0);

  const product = {
    id: existing ? existing.id : `${slugify(input.category)}-${slugify(input.name)}-${crypto.randomBytes(2).toString("hex")}`,
    category: String(input.category || existing?.category || "panaderia").trim(),
    subcategory: String(input.subcategory ?? existing?.subcategory ?? "General").trim() || "General",
    name: String(input.name || existing?.name || "").trim(),
    description: String(input.description ?? existing?.description ?? "").trim(),
    note: String(input.note ?? existing?.note ?? "").trim(),
    priceType,
    price,
    currency,
    unit: priceType === "weight" ? "Kg" : String(input.unit ?? existing?.unit ?? "").trim(),
    variants: Array.isArray(input.variants)
      ? input.variants.map((v) => String(v).trim()).filter(Boolean)
      : (existing?.variants || []),
    image: input.image !== undefined ? (input.image || null) : (existing?.image ?? null),
    featured: Boolean(input.featured !== undefined ? input.featured : existing?.featured),
    promo: Boolean(input.promo !== undefined ? input.promo : existing?.promo),
    active: input.active !== undefined ? Boolean(input.active) : (existing ? existing.active : true),
  };

  if (priceType === "sizes") {
    const rawSizes = Array.isArray(input.sizes) ? input.sizes : (existing?.sizes || []);
    product.sizes = rawSizes
      .filter((s) => s && s.label && Number.isFinite(Number(s.price)))
      .map((s) => ({
        label: String(s.label).trim(),
        price: Number(Number(s.price).toFixed(2)),
      }));
    if (product.sizes.length > 0) {
      product.price = product.sizes[0].price;
    }
  }

  if (priceType === "cake_matrix") {
    product.matrixType = input.matrixType || existing?.matrixType || "standard";
    const rawMatrix = Array.isArray(input.matrix) ? input.matrix : (existing?.matrix || []);
    product.matrix = rawMatrix;
    // Derive minimum price if available
    const candidatePrices = [];
    for (const row of product.matrix) {
      for (const k of ["vanilla", "chocolate", "merengueVanilla", "merengueChocolate", "chantillyVanilla", "chantillyChocolate"]) {
        const val = Number(row[k]);
        if (Number.isFinite(val) && val > 0) candidatePrices.push(val);
      }
    }
    if (candidatePrices.length > 0) {
      product.price = Math.min(...candidatePrices);
    }
  }

  return product;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(urlObj.pathname);

  try {
    // --- API ROUTES ---
    if (pathname === "/api/menu" && req.method === "GET") {
      const data = readMenuData();
      return sendJson(res, 200, data);
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const body = await parseBody(req);
      const user = String(body.username || "").trim().toLowerCase();
      const pass = String(body.password || "");
      if (ADMIN_USERS.has(user) && pass === ADMIN_PASS) {
        const token = crypto.randomBytes(32).toString("hex");
        sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
        return sendJson(res, 200, { ok: true, token, user });
      }
      return sendJson(res, 401, { ok: false, error: "Usuario o contraseña incorrectos" });
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      const token = getAuthToken(req);
      if (token) sessions.delete(token);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/auth/verify" && req.method === "GET") {
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { ok: false });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/products" && req.method === "POST") {
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { error: "Sesión expirada o no autorizada" });
      }
      const body = await parseBody(req);
      if (!body.name || !String(body.name).trim()) {
        return sendJson(res, 400, { error: "El nombre del producto es obligatorio" });
      }
      const data = readMenuData();
      const created = sanitizeProduct(body, null);
      data.products.unshift(created);
      writeMenuData(data);
      return sendJson(res, 201, { ok: true, product: created });
    }

    const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch) {
      const id = productMatch[1];
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { error: "Sesión expirada o no autorizada" });
      }
      const data = readMenuData();
      const idx = data.products.findIndex((p) => p.id === id);
      if (idx === -1) {
        return sendJson(res, 404, { error: "Producto no encontrado" });
      }

      if (req.method === "PUT") {
        const body = await parseBody(req);
        const updated = sanitizeProduct(body, data.products[idx]);
        if (!updated.name) {
          return sendJson(res, 400, { error: "El nombre del producto es obligatorio" });
        }
        data.products[idx] = updated;
        writeMenuData(data);
        return sendJson(res, 200, { ok: true, product: updated });
      }

      if (req.method === "DELETE") {
        const [removed] = data.products.splice(idx, 1);
        writeMenuData(data);
        return sendJson(res, 200, { ok: true, removedId: removed.id });
      }
    }

    const toggleMatch = pathname.match(/^\/api\/products\/([^/]+)\/toggle$/);
    if (toggleMatch && req.method === "PATCH") {
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { error: "Sesión expirada o no autorizada" });
      }
      const id = toggleMatch[1];
      const data = readMenuData();
      const product = data.products.find((p) => p.id === id);
      if (!product) {
        return sendJson(res, 404, { error: "Producto no encontrado" });
      }
      product.active = !product.active;
      writeMenuData(data);
      return sendJson(res, 200, { ok: true, product });
    }

    if (pathname === "/api/upload" && req.method === "POST") {
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { error: "Sesión expirada o no autorizada" });
      }
      const body = await parseBody(req);
      const dataUrl = String(body.dataUrl || "");
      const match = dataUrl.match(/^data:image\/(webp|jpeg|jpg|png);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return sendJson(res, 400, { error: "Formato de imagen inválido" });
      }
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const buffer = Buffer.from(match[2], "base64");
      const filename = `${Date.now()}-${slugify(body.filename || "producto")}.${ext}`;
      const target = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(target, buffer);
      return sendJson(res, 201, { ok: true, url: `/assets/products/uploads/${filename}` });
    }

    if (pathname === "/api/settings" && req.method === "PUT") {
      if (!isAuthenticated(req)) {
        return sendJson(res, 401, { error: "Sesión expirada o no autorizada" });
      }
      const body = await parseBody(req);
      const data = readMenuData();
      if (body.whatsapp !== undefined) data.brand.whatsapp = String(body.whatsapp).trim();
      if (body.hours !== undefined) data.brand.hours = String(body.hours).trim();
      if (body.instagram !== undefined) data.brand.instagram = String(body.instagram).trim();
      if (body.cakeNotice !== undefined) data.brand.cakeNotice = String(body.cakeNotice).trim();
      if (body.qrUrl !== undefined) data.brand.qrUrl = String(body.qrUrl).trim();
      if (Array.isArray(body.branches)) {
        data.brand.branches = body.branches.map((b) => String(b).trim()).filter(Boolean);
      }
      writeMenuData(data);
      return sendJson(res, 200, { ok: true, brand: data.brand });
    }

    // --- PAGE ROUTES ---
    if (pathname === "/" || pathname === "/index.html") {
      return sendFile(res, path.join(ROOT_DIR, "index.html"), true);
    }
    if (
      pathname === "/encargado" ||
      pathname === "/encargado/" ||
      pathname === "/admin" ||
      pathname === "/admin/" ||
      pathname === "/admin.html"
    ) {
      return sendFile(res, path.join(ROOT_DIR, "admin.html"), true);
    }
    if (pathname === "/qr" || pathname === "/qr/" || pathname === "/qr.html") {
      return sendFile(res, path.join(ROOT_DIR, "qr.html"), true);
    }
    if (
      pathname === "/dulces-3d" ||
      pathname === "/dulces-3d/" ||
      pathname === "/dulces-3d.html"
    ) {
      return sendFile(res, path.join(ROOT_DIR, "dulces-3d.html"), true);
    }

    // --- STATIC ASSETS ---
    const allowedPrefixes = ["/css/", "/js/", "/assets/", "/data/"];
    if (allowedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      const safePath = path.normalize(path.join(ROOT_DIR, pathname));
      if (!safePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        return res.end("Acceso denegado");
      }
      return sendFile(res, safePath, pathname.startsWith("/data/"));
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Página no encontrada");
  } catch (err) {
    if (err.message === "PAYLOAD_TOO_LARGE") {
      return sendJson(res, 413, { error: "La imagen supera el tamaño permitido (8MB)" });
    }
    if (err.message === "INVALID_JSON") {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
    console.error("Server error:", err);
    return sendJson(res, 500, { error: "Error interno del servidor" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Miski Menú Digital activo en http://localhost:${PORT}`);
  console.log(`Portal privado del encargado: http://localhost:${PORT}/encargado`);
  console.log(`Hablador QR imprimible: http://localhost:${PORT}/qr`);
});
