#!/usr/bin/env python3
"""
Extracts and optimizes Miski brand logos, PDF product photos into WebP,
and generates the initial data/menu.json and data/menu.default.json catalogs.
"""

import base64
import json
import os
import re
import subprocess
from collections import deque
from io import BytesIO
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

PROJECT_ROOT = Path("/home/santana19/.gemini/antigravity/scratch/miski-menu")
PDF_PATH = Path("/home/santana19/Descargas/miski/MISKI - CATÁLOGO_compressed (1)_compressed.pdf")
SVG_DIR = Path("/home/santana19/Descargas/miski/Diseño sin título")
PAGES_DIR = Path("/home/santana19/.gemini/antigravity/brain/894eb3e1-dcca-48d1-8511-b858e5bc8acc/scratch/pages")
LOGO_SRC = Path("/home/santana19/.gemini/antigravity/brain/894eb3e1-dcca-48d1-8511-b858e5bc8acc/.user_uploaded/media_1794841277541_4f16a0f9.jpg")

BRAND_DIR = PROJECT_ROOT / "assets" / "brand"
PRODUCTS_DIR = PROJECT_ROOT / "assets" / "products"
UPLOADS_DIR = PRODUCTS_DIR / "uploads"
DATA_DIR = PROJECT_ROOT / "data"


def ensure_dirs():
    for d in [BRAND_DIR, PRODUCTS_DIR, UPLOADS_DIR, DATA_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def clean_old_assets():
    """Remove legacy PDF-cropped product images and unused hero banners."""
    for old_brand in ["hero-croissants.webp", "banner-pan-artesanal.webp"]:
        p = BRAND_DIR / old_brand
        if p.exists():
            p.unlink()
    for p in PRODUCTS_DIR.glob("*.webp"):
        p.unlink()


def build_logos():
    img = Image.open(LOGO_SRC).convert("RGBA")
    arr = np.array(img, dtype=np.float32)

    # Calculate luminance to derive smooth alpha mask from white background
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    lum = (0.299 * r + 0.587 * g + 0.114 * b)

    # Logo brown is ~rgb(80,54,41) -> lum ~60; background is 255.
    # Map lum in [80, 240] smoothly to alpha [255, 0]
    alpha = np.clip((242.0 - lum) / (242.0 - 95.0) * 255.0, 0, 255)

    # Find tight bounding box of non-transparent pixels
    ys, xs = np.where(alpha > 12)
    pad = 16
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(arr.shape[0], int(ys.max()) + pad)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(arr.shape[1], int(xs.max()) + pad)

    # Brown transparent version (deep cacao #503629)
    brown_rgba = np.zeros_like(arr, dtype=np.uint8)
    brown_rgba[:, :, 0] = 80
    brown_rgba[:, :, 1] = 54
    brown_rgba[:, :, 2] = 41
    brown_rgba[:, :, 3] = alpha.astype(np.uint8)
    logo_brown = Image.fromarray(brown_rgba[y0:y1, x0:x1], mode="RGBA")
    logo_brown.thumbnail((640, 640), Image.Resampling.LANCZOS)
    logo_brown.save(BRAND_DIR / "logo-marron.webp", "WEBP", quality=92, method=6)

    # Crisp white transparent version (#FFFFFF)
    white_rgba = np.zeros_like(arr, dtype=np.uint8)
    white_rgba[:, :, 0] = 255
    white_rgba[:, :, 1] = 250
    white_rgba[:, :, 2] = 244
    white_rgba[:, :, 3] = alpha.astype(np.uint8)
    logo_white = Image.fromarray(white_rgba[y0:y1, x0:x1], mode="RGBA")
    logo_white.thumbnail((640, 640), Image.Resampling.LANCZOS)
    logo_white.save(BRAND_DIR / "logo-blanco.webp", "WEBP", quality=92, method=6)
    print("Saved transparent WebP brand logos.")


def make_studio_bg(w=640, h=480) -> Image.Image:
    """Warm cream radial studio backdrop matching Miski's #FAF4EC / #F3E5D0 palette."""
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2.0, h / 2.0
    dist = np.sqrt(((xx - cx) / (w * 0.6)) ** 2 + ((yy - cy) / (h * 0.6)) ** 2)
    t = np.clip(dist, 0.0, 1.0)
    # Center: #FFFDF9 (255, 253, 249), Edge: #F5E9D8 (245, 233, 216)
    r = (255 * (1 - t) + 245 * t).astype(np.uint8)
    g = (253 * (1 - t) + 233 * t).astype(np.uint8)
    b = (249 * (1 - t) + 216 * t).astype(np.uint8)
    a = np.full((h, w), 255, dtype=np.uint8)
    return Image.fromarray(np.stack([r, g, b, a], axis=-1), mode="RGBA")


def decode_svg_rgba_layers(svg_path: Path):
    content = svg_path.read_text(encoding="utf-8", errors="ignore")
    matches = re.findall(r"data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)", content)
    if len(matches) == 2:
        mask_im = Image.open(BytesIO(base64.b64decode(matches[0][1]))).convert("L")
        rgb_im = Image.open(BytesIO(base64.b64decode(matches[1][1]))).convert("RGB")
        if mask_im.size != rgb_im.size:
            mask_im = mask_im.resize(rgb_im.size, Image.Resampling.LANCZOS)
        rgba = rgb_im.convert("RGBA")
        rgba.putalpha(mask_im)
        bbox = rgba.getbbox()
        return [rgba.crop(bbox)] if bbox else [rgba]

    if len(matches) == 4:
        layers = []
        for idx in range(2):
            m_im = Image.open(BytesIO(base64.b64decode(matches[idx][1]))).convert("L")
            r_im = Image.open(BytesIO(base64.b64decode(matches[idx + 2][1]))).convert("RGB")
            if m_im.size != r_im.size:
                m_im = m_im.resize(r_im.size, Image.Resampling.LANCZOS)
            rgba = r_im.convert("RGBA")
            rgba.putalpha(m_im)
            bbox = rgba.getbbox()
            layers.append(rgba.crop(bbox) if bbox else rgba)
        return layers

    if len(matches) == 1:
        # White-backdrop JPEG (e.g. 26.svg corn flakes): flood-fill near-white background from edges
        rgb = Image.open(BytesIO(base64.b64decode(matches[0][1]))).convert("RGB")
        rgb.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        arr = np.array(rgb)
        h, w, _ = arr.shape
        is_white = (arr[:, :, 0] > 236) & (arr[:, :, 1] > 236) & (arr[:, :, 2] > 236) & (
            (arr.max(axis=2) - arr.min(axis=2)) < 18
        )
        visited = np.zeros((h, w), dtype=bool)
        q = deque()
        for x in range(w):
            if is_white[0, x]:
                visited[0, x] = True
                q.append((0, x))
            if is_white[h - 1, x]:
                visited[h - 1, x] = True
                q.append((h - 1, x))
        for y in range(h):
            if is_white[y, 0] and not visited[y, 0]:
                visited[y, 0] = True
                q.append((y, 0))
            if is_white[y, w - 1] and not visited[y, w - 1]:
                visited[y, w - 1] = True
                q.append((y, w - 1))
        while q:
            cy, cx = q.popleft()
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_white[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))
        alpha = np.where(visited, 0, 255).astype(np.uint8)
        alpha_img = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(0.8))
        rgba = rgb.convert("RGBA")
        rgba.putalpha(alpha_img)
        bbox = rgba.getbbox()
        return [rgba.crop(bbox)] if bbox else [rgba]

    return []


def extract_svg_overrides():
    if not SVG_DIR.exists():
        print("SVG override directory not found; skipping SVG extraction.")
        return

    mapping = {
        "1.svg": "tartaleta-redonda",
        "2.svg": "mousse-maracuya",
        "3.svg": "tiramisu",
        "4.svg": "cuatro-leches",
        "5.svg": "tres-leches-grande",
        "6.svg": "arroz-con-leche",
        "7.svg": "cheesecake",
        "8.svg": "chocoflan",
        "9.svg": "pie-de-limon",
        "10.svg": "flan-casero",
        "11.svg": "fresas-con-crema",
        "12.svg": "tres-leches",
        "13.svg": "frappe-capuccino",
        "14.svg": "frappe-vainilla",
        "15.svg": "frappe-mocca",
        "16.svg": "frappe-chocolate",
        "17.svg": "frappe-oreo",
        "Diseño sin título.svg": "batido-fresa",
        "18.svg": "batido-melon",
        "19.svg": "batido-melocoton",
        "21.svg": "batido-pina",
        "22.svg": "batido-guineo",
        "23.svg": "batido-papaya",
        "24.svg": "batido-avena",
        "25.svg": "batido-tutti-frutti",
        "26.svg": "batido-corn-flakes",
        "27.svg": "dulce-sencillo",
        "28.svg": "dulce-sencillo-diseno",
        "29.svg": "cake-topper",
        "30.svg": "dulce-frutas-redondo",
        "31.svg": "dulces-frios-rectangulares",
        "32.svg": "dulce-frutas-rectangular",
        "33.svg": "dos-pisos-tematico",
        "34.svg": "dulces-eventos",
    }

    target_w, target_h = 640, 480
    updated = 0
    for svg_name, dest_slug in mapping.items():
        svg_path = SVG_DIR / svg_name
        if not svg_path.exists():
            continue
        layers = decode_svg_rgba_layers(svg_path)
        if not layers:
            continue

        bg = make_studio_bg(target_w, target_h)
        if len(layers) == 2:
            # Arrange both fruit groups cleanly side by side (e.g. 25.svg tutti frutti)
            left_fg = layers[0].copy()
            right_fg = layers[1].copy()
            left_fg.thumbnail((340, 380), Image.Resampling.LANCZOS)
            right_fg.thumbnail((290, 320), Image.Resampling.LANCZOS)
            bg.alpha_composite(right_fg, (target_w - right_fg.width - 28, (target_h - right_fg.height) // 2 + 20))
            bg.alpha_composite(left_fg, (24, (target_h - left_fg.height) // 2 - 12))
        else:
            fg = layers[0].copy()
            fg.thumbnail((target_w - 56, target_h - 44), Image.Resampling.LANCZOS)
            ox = (target_w - fg.width) // 2
            oy = (target_h - fg.height) // 2
            bg.alpha_composite(fg, (ox, oy))

        bg.convert("RGB").save(PRODUCTS_DIR / f"{dest_slug}.webp", "WEBP", quality=88, method=6)
        updated += 1

    print(f"Replaced {updated} product images from high-res Canva SVGs.")


def p_single(pid, cat, sub, name, price, image=None, desc="", note="", variants=None, featured=False, promo=False, unit=""):
    return {
        "id": pid,
        "category": cat,
        "subcategory": sub,
        "name": name,
        "description": desc,
        "note": note,
        "priceType": "single",
        "price": price,
        "currency": "B/.",
        "unit": unit,
        "variants": variants or [],
        "image": f"/assets/products/{image}.webp" if image else None,
        "featured": featured,
        "promo": promo,
        "active": True,
    }


def p_weight(pid, cat, sub, name, price, image=None, desc=""):
    return {
        "id": pid,
        "category": cat,
        "subcategory": sub,
        "name": name,
        "description": desc,
        "note": "Venta al peso",
        "priceType": "weight",
        "price": price,
        "currency": "B/.",
        "unit": "Kg",
        "variants": [],
        "image": f"/assets/products/{image}.webp" if image else None,
        "featured": False,
        "promo": False,
        "active": True,
    }


def p_sizes(pid, cat, sub, name, sizes, image=None, desc=""):
    return {
        "id": pid,
        "category": cat,
        "subcategory": sub,
        "name": name,
        "description": desc,
        "note": "",
        "priceType": "sizes",
        "price": sizes[0]["price"],
        "currency": "B/.",
        "unit": "",
        "sizes": sizes,
        "image": f"/assets/products/{image}.webp" if image else None,
        "featured": False,
        "promo": False,
        "active": True,
    }


def p_cake(pid, sub, name, from_price, desc, note, image, matrix_type, rows):
    return {
        "id": pid,
        "category": "dulceria",
        "subcategory": sub,
        "name": name,
        "description": desc,
        "note": note,
        "priceType": "cake_matrix",
        "price": from_price,
        "currency": "$",
        "unit": "",
        "matrixType": matrix_type,
        "matrix": rows,
        "image": f"/assets/products/{image}.webp" if image else None,
        "featured": False,
        "promo": False,
        "active": True,
    }


def build_menu_json():
    categories = [
        {
            "id": "panaderia",
            "name": "Panadería",
            "icon": "🥖",
            "description": "Horneado artesanal diario, empanadas para compartir y panes tradicionales al peso.",
        },
        {
            "id": "emparedados",
            "name": "Emparedados y Comidas",
            "icon": "🥪",
            "description": "Clásicos preparados al momento con pan recién tostado y nuestros favoritos de la casa.",
        },
        {
            "id": "dulceria",
            "name": "Dulcería y Tortas",
            "icon": "🎂",
            "description": "Dulces sencillos, personalizados, fríos, con frutas y tortas de varios pisos para eventos.",
        },
        {
            "id": "postres",
            "name": "Postres",
            "icon": "🍮",
            "description": "Postres individuales listos para llevar y opciones familiares recién preparados.",
        },
        {
            "id": "cafeteria",
            "name": "Cafetería",
            "icon": "☕",
            "description": "Café recién colado, bebidas calientes en 8oz y 12oz e Iced Lattes refrescantes.",
        },
        {
            "id": "bebidas",
            "name": "Bebidas y Frappés",
            "icon": "🥤",
            "description": "Frappés cremosos y batidos de frutas y cereales naturales.",
        },
        {
            "id": "promociones",
            "name": "Promociones",
            "icon": "🏷️",
            "description": "Combos para compartir y promociones especiales vigentes.",
        },
    ]

    products = [
        # --- PANADERÍA (Págs. 4 a 7, sin fotos) ---
        p_single("pan-100-empanadas", "panaderia", "Empanadas y Choripán", "100 Empanadas (Pollo o Carne)", 35.00, None, "Empanadas para compartir", "Elige relleno de pollo o carne", ["Pollo", "Carne"], promo=True, unit="100 uds."),
        p_single("pan-50-empanadas", "panaderia", "Empanadas y Choripán", "50 Empanadas (Pollo o Carne)", 20.00, None, "Empanadas para compartir", "Elige relleno de pollo o carne", ["Pollo", "Carne"], promo=True, unit="50 uds."),
        p_single("pan-empanada", "panaderia", "Empanadas y Choripán", "Empanada", 1.00, None, "Individual de pollo o carne, dorada y sabrosa", "", ["Pollo", "Carne"], unit="c/u"),
        p_single("pan-choripan", "panaderia", "Empanadas y Choripán", "Choripán", 1.00, None, "Chorizo asado en pan artesanal de la casa", "", [], unit="c/u"),

        # Tradicional al peso (Pág. 5)
        p_weight("pan-bolita-huevo", "panaderia", "Tradicional al Peso (Kg)", "Bolita de Huevo", 4.50),
        p_weight("pan-flauta", "panaderia", "Tradicional al Peso (Kg)", "Pan Flauta", 3.50),
        p_weight("pan-michita-huevo", "panaderia", "Tradicional al Peso (Kg)", "Pan Michita de Huevo", 4.50),
        p_weight("pan-mona-huevo", "panaderia", "Tradicional al Peso (Kg)", "Moña de Huevo", 4.50),
        p_weight("pan-mona-queso-kg", "panaderia", "Tradicional al Peso (Kg)", "Moña con Queso (Al peso)", 5.70),

        # Especialidades de la Casa - Panes de Mesa (Pág. 6)
        p_weight("pan-frances", "panaderia", "Panes de Mesa (Kg)", "Pan Francés", 3.50),
        p_weight("pan-de-leche", "panaderia", "Panes de Mesa (Kg)", "Pan de Leche", 4.85),
        p_weight("pan-mantequilla", "panaderia", "Panes de Mesa (Kg)", "Pan de Mantequilla", 4.50),

        # Especialidades de la Casa - Aromáticos y Dulces (Pág. 6)
        p_weight("pan-de-anis", "panaderia", "Aromáticos y Dulces (Kg)", "Pan de Anís", 5.70),
        p_weight("pan-pasita", "panaderia", "Aromáticos y Dulces (Kg)", "Pan Pasita", 4.85),
        p_weight("pan-viril", "panaderia", "Aromáticos y Dulces (Kg)", "Pan Viril", 3.50),
        p_weight("pan-panito", "panaderia", "Aromáticos y Dulces (Kg)", "Panito", 5.20),

        # Rosquitas, Bolsas y Panes por Unidad (Pág. 7)
        p_weight("pan-rosquita-salada", "panaderia", "Rosquitas y Empacados", "Rosquita Salada", 4.80),
        p_weight("pan-rosquita-huevo", "panaderia", "Rosquitas y Empacados", "Rosquita de Huevo", 5.20),
        p_single("pan-bolsa-panito", "panaderia", "Rosquitas y Empacados", "Bolsa de Panito", 1.00, None, "Presentación empacada lista para llevar", "", [], unit="bolsa"),
        p_single("pan-bolsa-rosquita", "panaderia", "Rosquitas y Empacados", "Bolsa de Rosquita", 0.75, None, "Presentación empacada lista para llevar", "", [], unit="bolsa"),
        p_single("pan-michita", "panaderia", "Rosquitas y Empacados", "Pan Michita", 3.08, None, "Pan tradicional suave", "Presentación según catálogo"),
        p_single("pan-mona-queso-ud", "panaderia", "Rosquitas y Empacados", "Moña con Queso (Unidad)", 1.00, None, "Presentación individual horneada con queso", "", [], unit="c/u"),
        p_single("pan-de-ajo", "panaderia", "Rosquitas y Empacados", "Pan de Ajo", 1.50, None, "Tostado con mantequilla de ajo y hierbas", "", [], unit="c/u"),

        # --- EMPAREDADOS Y COMIDAS (Págs. 8 a 12) ---
        # Los Derretidos y Clásicos (Pág. 8)
        p_single("emp-derretido-amarillo", "emparedados", "Los Derretidos", "Derretido de Queso Amarillo", 1.75),
        p_single("emp-derretido-blanco", "emparedados", "Los Derretidos", "Derretido Queso Blanco", 1.75),
        p_single("emp-chorizo", "emparedados", "Los Clásicos", "Emparedado de Chorizo", 2.25),
        p_single("emp-chorizo-huevo", "emparedados", "Los Clásicos", "Chorizo con Huevo", 3.25),
        p_single("emp-huevo", "emparedados", "Los Clásicos", "Emparedado de Huevo", 2.25),
        p_single("emp-combinacion", "emparedados", "Los Clásicos", "Emparedado de Combinación", 4.25, None, "Una generosa combinación de embutidos, queso y nuestro toque especial", "Recomendado · El Favorito de la Casa", [], featured=True),

        # Emparedados de Jamón (Pág. 9)
        p_single("emp-jamon-sencillo", "emparedados", "Línea de Jamón", "Jamón Sencillo", 2.25, None, "Clásico preparado al momento con el cariño de siempre"),
        p_single("emp-jamon-queso", "emparedados", "Línea de Jamón", "Jamón con Queso", 2.75, None, "", "CONTIENE QUESO AMERICANO*"),
        p_single("emp-jamon-huevo", "emparedados", "Línea de Jamón", "Jamón con Huevo", 2.75),
        p_single("emp-huevo-queso", "emparedados", "Línea de Jamón", "Huevo con Queso", 2.75),
        p_single("emp-jamon-queso-huevo", "emparedados", "Línea de Jamón", "Jamón, Queso y Huevo", 3.25, None, "Una deliciosa y abundante combinación de jamón, queso derretido y huevo en nuestro pan recién tostado", "CONTIENE QUESO AMERICANO* · Favorito de la Casa", [], featured=True),

        # La Línea de Mortadela (Pág. 10)
        p_single("emp-mortadela-trad", "emparedados", "Línea de Mortadela", "Mortadela Tradicional", 2.25, None, "La receta de siempre, tostado al momento"),
        p_single("emp-mortadela-queso", "emparedados", "Línea de Mortadela", "Mortadela con Queso", 2.75, None, "", "CONTIENE QUESO AMERICANO*"),
        p_single("emp-mortadela-huevo", "emparedados", "Línea de Mortadela", "Mortadela con Huevo", 2.75),
        p_single("emp-mortadela-queso-huevo", "emparedados", "Línea de Mortadela", "Mortadela con Queso y Huevo", 3.25, None, "La combinación más completa y pedida en la línea de mortadela", "CONTIENE QUESO AMERICANO* · Favorito de la Casa", [], featured=True),

        # Carnes Selectas & Pollo (Pág. 11)
        p_single("emp-pierna", "emparedados", "Carnes Selectas y Pollo", "Emparedado de Pierna", 3.75),
        p_single("emp-pierna-queso", "emparedados", "Carnes Selectas y Pollo", "Pierna con Queso", 4.25, None, "", "CONTIENE QUESO AMERICANO*"),
        p_single("emp-pollo", "emparedados", "Carnes Selectas y Pollo", "Emparedado de Pollo", 3.25),
        p_single("emp-pollo-queso", "emparedados", "Carnes Selectas y Pollo", "Pollo con Queso", 3.75, None, "", "CONTIENE QUESO AMERICANO*"),

        # Salchicha, Tuna y Antojos Rápidos (Pág. 12)
        p_single("emp-salchicha", "emparedados", "Salchicha, Tuna y Antojos", "Emparedado de Salchicha", 2.25),
        p_single("emp-salchicha-huevo", "emparedados", "Salchicha, Tuna y Antojos", "Emparedado de Salchicha con Huevo", 3.25),
        p_single("emp-tuna", "emparedados", "Salchicha, Tuna y Antojos", "Emparedado de Tuna", 2.75),
        p_single("emp-hamburguesa", "emparedados", "Salchicha, Tuna y Antojos", "Hamburguesa Miski", 3.25, None, "Antojos rápidos"),
        p_single("emp-hot-dog", "emparedados", "Salchicha, Tuna y Antojos", "Hot Dog Tradicional", 2.00, None, "Antojos rápidos"),

        # --- DULCERÍA Y TORTAS (Págs. 14 a 34) ---
        p_cake(
            "dul-sencillo",
            "Tortas Clásicas y Frías",
            "Dulce Sencillo",
            18.90,
            "Bizcocho de vainilla o chocolate, relleno de manjar y detalles en 2 colores adicionales.",
            "Con bizcocho de chocolate desde $27.50",
            "dulce-sencillo",
            "standard",
            [
                {"size": "8x12\"", "portions": "15 a 20 porciones", "vanilla": 18.90, "chocolate": 27.50},
                {"size": "8x17\"", "portions": "20 a 25 porciones", "vanilla": 24.00, "chocolate": 32.00},
                {"size": "12x17\"", "portions": "35 a 40 porciones", "vanilla": 38.00, "chocolate": 46.00},
                {"size": "17x17\"", "portions": "45 a 50 porciones", "vanilla": 50.00, "chocolate": 58.00},
                {"size": "17x26\"", "portions": "60 a 65 porciones", "vanilla": 63.00, "chocolate": 72.00},
            ],
        ),
        p_cake(
            "dul-sencillo-diseno",
            "Tortas Clásicas y Frías",
            "Dulce Sencillo con Diseño Adicional",
            24.90,
            "Bizcocho de vainilla o chocolate y relleno de manjar con diseño adicional personalizado.",
            "Pedidos con al menos 3 días de anticipación · Chocolate desde $33.50",
            "dulce-sencillo-diseno",
            "standard",
            [
                {"size": "8x12\"", "portions": "15 a 20 porciones", "vanilla": 24.90, "chocolate": 33.50},
                {"size": "8x17\"", "portions": "20 a 25 porciones", "vanilla": 32.00, "chocolate": 40.00},
                {"size": "12x17\"", "portions": "35 a 40 porciones", "vanilla": 46.00, "chocolate": 54.00},
                {"size": "17x17\"", "portions": "45 a 50 porciones", "vanilla": 60.00, "chocolate": 68.00},
                {"size": "17x26\"", "portions": "60 a 65 porciones", "vanilla": 73.00, "chocolate": 82.00},
            ],
        ),
        p_cake(
            "dul-frios-rect",
            "Tortas Clásicas y Frías",
            "Dulces Fríos Rectangulares",
            34.00,
            "Dulces fríos rectangulares con bizcocho de vainilla o chocolate.",
            "Con bizcocho de chocolate desde $40.00",
            "dulces-frios-rectangulares",
            "standard",
            [
                {"size": "8x12\"", "portions": "Según tamaño estándar", "vanilla": 34.00, "chocolate": 40.00},
                {"size": "8x17\"", "portions": "Según tamaño estándar", "vanilla": 42.00, "chocolate": 48.00},
                {"size": "12x17\"", "portions": "Según tamaño estándar", "vanilla": 50.00, "chocolate": 56.00},
                {"size": "17x17\"", "portions": "Según tamaño estándar", "vanilla": 58.00, "chocolate": 64.00},
                {"size": "17x26\"", "portions": "Según tamaño estándar", "vanilla": 66.00, "chocolate": 72.00},
            ],
        ),
        p_cake(
            "dul-frutas-rect",
            "Tortas Clásicas y Frías",
            "Dulce con Frutas Rectangular",
            44.00,
            "Plancha de dulce de frutas en tamaños diferentes, bizcocho de vainilla o chocolate.",
            "Con bizcocho de chocolate desde $50.00",
            "dulce-frutas-rectangular",
            "standard",
            [
                {"size": "8x12\"", "portions": "15 a 20 porciones", "vanilla": 44.00, "chocolate": 50.00},
                {"size": "8x17\"", "portions": "20 a 25 porciones", "vanilla": 52.00, "chocolate": 58.00},
                {"size": "12x17\"", "portions": "35 a 40 porciones", "vanilla": 48.00, "chocolate": 66.00},
            ],
        ),
        p_cake(
            "dul-frutas-redondo",
            "Tortas Clásicas y Frías",
            "Dulce con Frutas Redondo",
            35.00,
            "Redondo de 8 pulgadas (12 a 14 porciones), bizcocho de vainilla o chocolate.",
            "Con bizcocho de chocolate desde $40.00",
            "dulce-frutas-redondo",
            "standard",
            [
                {"size": "8\" Redondo", "portions": "12 a 14 porciones", "vanilla": 35.00, "chocolate": 40.00},
            ],
        ),
        p_cake(
            "dul-photocake",
            "Tortas Personalizadas y Temáticas",
            "Photocake",
            28.90,
            "Con la imagen que desees impresa, bizcocho de vainilla o chocolate.",
            "3 días de anticipación · Chocolate desde $37.50",
            None,
            "standard",
            [
                {"size": "8x12\"", "portions": "15 a 20 porciones", "vanilla": 28.90, "chocolate": 37.50},
                {"size": "8x17\"", "portions": "20 a 25 porciones", "vanilla": 34.00, "chocolate": 42.00},
                {"size": "12x17\"", "portions": "35 a 40 porciones", "vanilla": 48.00, "chocolate": 56.00},
                {"size": "17x17\"", "portions": "45 a 50 porciones", "vanilla": 66.00, "chocolate": 74.00},
                {"size": "17x26\"", "portions": "60 a 65 porciones", "vanilla": 79.00, "chocolate": 88.00},
            ],
        ),
        p_cake(
            "dul-cake-topper",
            "Tortas Personalizadas y Temáticas",
            "Cake Topper",
            35.00,
            "Tema o topper de tu elección (también puedes pedirlo sin topper). Bizcocho de vainilla o chocolate.",
            "Con topper desde $43.00 (Choc. $53.00) · Sin topper desde $35.00",
            "cake-topper",
            "standard",
            [
                {"size": "6x5\" (Con Topper)", "portions": "14 a 16 porciones", "vanilla": 43.00, "chocolate": 53.00},
                {"size": "8x7\" (Con Topper)", "portions": "20 a 25 porciones", "vanilla": 51.00, "chocolate": 61.00},
                {"size": "6x5\" (Sin Topper)", "portions": "14 a 16 porciones", "vanilla": 35.00, "chocolate": None},
                {"size": "8x7\" (Sin Topper)", "portions": "20 a 25 porciones", "vanilla": 43.00, "chocolate": None},
            ],
        ),
        p_cake(
            "dul-dos-pisos-tematico",
            "Tortas Personalizadas y Temáticas",
            "Dos Pisos Temático",
            48.00,
            "Tema o topper de tu elección en 2 pisos, bizcocho de vainilla o chocolate.",
            "Con bizcocho de chocolate desde $58.00",
            "dos-pisos-tematico",
            "standard",
            [
                {"size": "8 y 6\"", "portions": "15 a 20 porciones", "vanilla": 48.00, "chocolate": 58.00},
                {"size": "10 y 8\"", "portions": "20 a 25 porciones", "vanilla": 61.00, "chocolate": 71.00},
                {"size": "14 y 10\"", "portions": "40 a 45 porciones", "vanilla": 78.00, "chocolate": 93.00},
            ],
        ),
        p_cake(
            "dul-2-pisos-eventos",
            "Eventos: 2, 3 y 4 Pisos",
            "Dulce 2 Pisos (Eventos)",
            35.00,
            "Para Quinceaños, Bodas, Baby Shower y eventos. Dimensiones y cobertura (Merengue o Chantillí) a elegir.",
            "¡Cotiza con nosotros!",
            "dulces-eventos",
            "tiered",
            [
                {"size": "6\" + 6\"", "portions": "14 porciones", "merengueVanilla": 35.00, "merengueChocolate": 45.00, "chantillyVanilla": 40.00, "chantillyChocolate": 50.00},
                {"size": "6\" + 8\"", "portions": "15/20 porciones", "merengueVanilla": 40.00, "merengueChocolate": 50.00, "chantillyVanilla": 45.00, "chantillyChocolate": 55.00},
                {"size": "8\" + 8\"", "portions": "20/25 porciones", "merengueVanilla": 43.00, "merengueChocolate": 53.00, "chantillyVanilla": 48.00, "chantillyChocolate": 58.00},
                {"size": "8\" + 10\"", "portions": "30/35 porciones", "merengueVanilla": 43.00, "merengueChocolate": 53.00, "chantillyVanilla": 48.00, "chantillyChocolate": 58.00},
                {"size": "10\" + 14\"", "portions": "40/45 porciones", "merengueVanilla": 70.00, "merengueChocolate": 85.00, "chantillyVanilla": 85.00, "chantillyChocolate": 100.00},
            ],
        ),
        p_cake(
            "dul-3-pisos-eventos",
            "Eventos: 2, 3 y 4 Pisos",
            "Dulce 3 Pisos (Eventos)",
            80.00,
            "Para Quinceaños, Bodas y celebraciones grandes. Dimensiones a elegir en Merengue o Chantillí.",
            "¡Cotiza con nosotros!",
            "dulces-eventos",
            "tiered",
            [
                {"size": "6\" + 8\" + 10\"", "portions": "40/45 porciones", "merengueVanilla": 80.00, "merengueChocolate": 100.00, "chantillyVanilla": 90.00, "chantillyChocolate": 110.00},
                {"size": "8\" + 10\" + 14\"", "portions": "44/55 porciones", "merengueVanilla": 100.00, "merengueChocolate": 125.00, "chantillyVanilla": 110.00, "chantillyChocolate": 135.00},
            ],
        ),
        p_cake(
            "dul-4-pisos-eventos",
            "Eventos: 2, 3 y 4 Pisos",
            "Dulce 4 Pisos (Eventos)",
            130.00,
            "Imponente pastel de 4 pisos para Bodas y Quinceaños. Cobertura Merengue o Chantillí.",
            "¡Cotiza con nosotros!",
            "dulces-eventos",
            "tiered",
            [
                {"size": "6\" + 8\" + 10\" + 14\"", "portions": "55/70 porciones", "merengueVanilla": 130.00, "merengueChocolate": 150.00, "chantillyVanilla": 145.00, "chantillyChocolate": 165.00},
            ],
        ),

        # --- POSTRES (Págs. 36 a 40) ---
        p_single("pos-tartaleta-redonda", "postres", "Postres Individuales", "Tartaleta Redonda", 3.00, "tartaleta-redonda"),
        p_single("pos-mousse-maracuya", "postres", "Postres Individuales", "Mousse de Maracuyá", 3.00, "mousse-maracuya"),
        p_single("pos-tiramisu", "postres", "Postres Individuales", "Tiramisú", 3.25, "tiramisu"),
        p_single("pos-cuatro-leches", "postres", "Postres Individuales", "Cuatro Leches", 4.00, "cuatro-leches"),
        p_single("pos-tres-leches-grande", "postres", "Tamaño Familiar", "Tres Leches Grande", 6.90, "tres-leches-grande", "Presentación familiar para compartir"),
        p_single("pos-arroz-con-leche", "postres", "Postres Individuales", "Arroz con Leche", 1.25, "arroz-con-leche"),
        p_single("pos-cheesecake", "postres", "Postres Individuales", "Cheesecake", 4.00, "cheesecake"),
        p_single("pos-chocoflan", "postres", "Postres Individuales", "Chocoflan", 3.25, "chocoflan"),
        p_single("pos-pie-de-limon", "postres", "Postres Individuales", "Pie de Limón", 2.90, "pie-de-limon"),
        p_single("pos-gelatina-con-flan", "postres", "Postres Individuales", "Gelatina con Flan", 1.00, None),
        p_single("pos-flan", "postres", "Postres Individuales", "Flan", 1.00, None),
        p_single("pos-gelatina-con-frutas", "postres", "Postres Individuales", "Gelatina con Frutas", 1.00, None),
        p_single("pos-gelatina", "postres", "Postres Individuales", "Gelatina", 0.85, None),
        p_single("pos-flan-casero", "postres", "Postres Individuales", "Flan Casero", 2.75, "flan-casero"),
        p_single("pos-fresas-con-crema", "postres", "Postres Individuales", "Fresas con Crema", 3.50, "fresas-con-crema"),
        p_single("pos-tres-leches", "postres", "Postres Individuales", "Tres Leches", 2.75, "tres-leches"),
        p_single("pos-gelatina-con-bizcocho", "postres", "Postres Individuales", "Gelatina con Bizcocho", 1.85, None),

        # --- CAFETERÍA (Págs. 42 y 45) ---
        p_sizes("caf-cafe-con-leche", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Café con Leche", [{"label": "8oz", "price": 1.50}, {"label": "12oz", "price": 2.00}]),
        p_sizes("caf-cafe-negro", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Café Negro", [{"label": "8oz", "price": 1.25}, {"label": "12oz", "price": 1.75}]),
        p_sizes("caf-capuccino", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Capuccino", [{"label": "8oz", "price": 2.00}, {"label": "12oz", "price": 2.50}]),
        p_sizes("caf-chocolate", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Chocolate", [{"label": "8oz", "price": 1.50}, {"label": "12oz", "price": 2.00}]),
        p_sizes("caf-mocaccino", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Mocaccino", [{"label": "8oz", "price": 2.25}, {"label": "12oz", "price": 2.75}]),
        p_sizes("caf-te-negro", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Té Negro", [{"label": "8oz", "price": 1.00}, {"label": "12oz", "price": 1.25}]),
        p_sizes("caf-te-con-leche", "cafeteria", "Bebidas Calientes (8oz / 12oz)", "Té con Leche", [{"label": "8oz", "price": 1.25}, {"label": "12oz", "price": 1.50}]),

        p_single("caf-iced-latte", "cafeteria", "Iced Lattes", "Iced Latte", 3.00, None, "Clásica combinación de espresso, leche y hielo"),
        p_single("caf-iced-caramel-latte", "cafeteria", "Iced Lattes", "Iced Caramel Latte", 3.50, None, "Con un dulce toque y espirales de salsa de caramelo"),
        p_single("caf-iced-vainilla-latte", "cafeteria", "Iced Lattes", "Iced Vainilla Latte", 3.50, None, "Aromatizado con jarabe de vainilla natural"),

        # --- BEBIDAS Y FRAPPÉS (Págs. 43, 44, 46 a 48) ---
        p_single("beb-frappe-capuccino", "bebidas", "Frappés", "Frappé de Capuccino", 3.75, "frappe-capuccino"),
        p_single("beb-frappe-vainilla", "bebidas", "Frappés", "Frappé de Vainilla", 3.75, "frappe-vainilla"),
        p_single("beb-frappe-mocca", "bebidas", "Frappés", "Frappé de Mocca", 3.75, "frappe-mocca"),
        p_single("beb-frappe-chocolate", "bebidas", "Frappés", "Frappé de Chocolate", 3.75, "frappe-chocolate"),
        p_single("beb-frappe-oreo", "bebidas", "Frappés", "Frappé de Oreo", 3.75, "frappe-oreo"),

        p_single("beb-batido-fresa", "bebidas", "Batidos", "Batido de Fresa", 2.50, "batido-fresa"),
        p_single("beb-batido-melon", "bebidas", "Batidos", "Batido de Melón", 2.50, "batido-melon"),
        p_single("beb-batido-melocoton", "bebidas", "Batidos", "Batido de Melocotón", 2.50, "batido-melocoton"),
        p_single("beb-batido-pina", "bebidas", "Batidos", "Batido de Piña", 2.25, "batido-pina"),
        p_single("beb-batido-guineo", "bebidas", "Batidos", "Batido de Guineo", 2.25, "batido-guineo"),
        p_single("beb-batido-papaya", "bebidas", "Batidos", "Batido de Papaya", 2.25, "batido-papaya"),
        p_single("beb-batido-avena", "bebidas", "Batidos", "Batido de Avena", 2.25, "batido-avena"),
        p_single("beb-batido-tutti-frutti", "bebidas", "Batidos", "Batido de Tutti Frutti", 2.50, "batido-tutti-frutti"),
        p_single("beb-batido-corn-flakes", "bebidas", "Batidos", "Batido de Corn Flakes", 2.25, "batido-corn-flakes"),
    ]

    data = {
        "brand": {
            "name": "Miski",
            "subtitle": "PANADERÍA · DULCERÍA · CAFETERÍA",
            "slogan": "El sabor de lo tradicional hecho con amor",
            "story": (
                "En Miski nacimos como un proyecto de familia con un propósito sencillo y honesto: "
                "hacer las cosas bien. Cuidamos cada ingrediente y respetamos los tiempos de nuestras "
                "recetas para hornear con la paciencia de lo artesanal. Cada pan, postre y café que "
                "preparamos lleva el cariño de nuestro hogar, pensado para acompañar tus mejores momentos "
                "con sabor y frescura de verdad."
            ),
            "branches": [
                "Mañanitas, Plaza los Pinos",
                "La Siesta, Tocumen, Plaza Más",
                "Santa Isabel - Pacora",
                "Chepo, Plaza 4 altos",
                "San Francisco - Las Garzas",
                "Nuevo Tocumen - La Plaza 25",
            ],
            "branchDetails": [
                {
                    "name": "Mañanitas, Plaza los Pinos",
                    "hours": ["Todos los días 24 horas"],
                },
                {
                    "name": "La Siesta, Tocumen, Plaza Más",
                    "hours": ["Lunes a Domingo de 6:00 a.m. a 9:00 p.m."],
                },
                {
                    "name": "Santa Isabel - Pacora",
                    "hours": ["Lunes a Domingo de 6:00 a.m. a 9:00 p.m."],
                },
                {
                    "name": "Chepo, Plaza 4 altos",
                    "hours": [
                        "Lunes a Viernes de 5:30 a.m. a 9:45 p.m.",
                        "Sábado de 6:00 a.m. a 9:45 p.m.",
                        "Domingo de 6:00 a.m. a 9:15 p.m.",
                    ],
                },
                {
                    "name": "San Francisco - Las Garzas",
                    "hours": [
                        "Lunes a Sábado 24 horas",
                        "Domingo hasta las 9:00 p.m.",
                    ],
                },
                {
                    "name": "Nuevo Tocumen - La Plaza 25",
                    "hours": ["Lunes a Domingo de 6:00 a.m. a 10:00 p.m."],
                },
            ],
            "whatsapp": "",
            "hours": "",
            "instagram": "",
            "cakeNotice": "Encargos personalizados con diseño o Photocake: al menos 3 días de anticipación.",
        },
        "categories": categories,
        "products": products,
    }

    with open(DATA_DIR / "menu.default.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    menu_file = DATA_DIR / "menu.json"
    if not menu_file.exists() or "--reset-menu" in os.sys.argv:
        with open(menu_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Generated menu.json with {len(products)} products across {len(categories)} categories.")
    else:
        print(f"Preserved existing menu.json (updated menu.default.json with {len(products)} products).")


if __name__ == "__main__":
    ensure_dirs()
    clean_old_assets()
    build_logos()
    extract_svg_overrides()
    build_menu_json()
