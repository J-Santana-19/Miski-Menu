# Miski · Menú Digital y Portal del Encargado

Aplicación web **Mobile First** para el menú digital con código QR de **Miski (Panadería · Dulcería · Cafetería)**, acompañada de un portal privado de administración para gestionar productos, precios, fotografías y datos del establecimiento en tiempo real.

---

## 1. Requisitos e Inicio Rápido

No requiere base de datos externa ni instalación de paquetes de terceros (`node_modules`). Solo necesita **Node.js 18+** (probado con Node.js `v22.22.1`).

```bash
# 1. Entrar a la carpeta del proyecto
cd /home/santana19/.gemini/antigravity/scratch/miski-menu

# 2. Iniciar el servidor
npm start
# o directamente:
node server.js
```

Por defecto se ejecuta en el puerto **`3000`** (configurable con la variable de entorno `PORT`).

---

## 2. Rutas de la Aplicación

| Ruta | Vista | Quién la utiliza | Descripción |
| :--- | :--- | :--- | :--- |
| `/` | `index.html` | **Clientes (Código QR)** | Menú digital público con buscador instantáneo, categorías, tablero bistró para productos sin foto, selector de medidas de tortas y modal de 6 sucursales. **Sin ningún enlace ni rastro del panel administrativo.** |
| `/encargado` *(o `/admin`)* | `admin.html` | **Encargado** | Portal privado protegido por usuario y contraseña para agregar, editar, ocultar/mostrar o eliminar productos, subir/recortar fotos a formato `4:3` WebP y actualizar datos de contacto. |
| `/qr` | `qr.html` | **Sucursales / Imprenta** | Plantillas imprimibles de habladores QR (mostrador y dulcería) con generación de código QR vectorial en SVG sin dependencias externas. |

### Credenciales Iniciales del Portal (`/encargado`)
- **Usuario:** `admin` *(o `encargado@miski.com`)*
- **Contraseña:** `Miski2026!`

> **Recomendación de seguridad:** Al publicar en producción, define las variables de entorno `MISKI_ADMIN_USER` y `MISKI_ADMIN_PASS` (ver `.env.example`).

---

## 3. Estructura del Proyecto

```text
miski-menu/
├── index.html                  # Menú digital público (Mobile First, sin acceso admin)
├── admin.html                  # Portal privado del encargado (/encargado y /admin)
├── qr.html                     # Generador e imprimible de habladores QR (/qr)
├── server.js                   # Servidor HTTP y API REST en Node.js puro
├── package.json                # Metadatos y scripts de ejecución
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Exclusiones para control de versiones
├── README.md                   # Guía principal del proyecto
├── docs/
│   └── ARQUITECTURA.md         # Documentación técnica, esquema JSON y paleta de marca
├── css/
│   ├── styles.css              # Estilos del menú público y tablero bistró
│   └── admin.css               # Estilos del portal del encargado
├── js/
│   ├── menu.js                 # Lógica de catálogo, búsqueda, filtros y selector de tortas
│   ├── admin.js                # Lógica de login, CRUD, compresión de fotos y ajustes
│   └── qrcode.js               # Generador SVG de códigos QR (ISO/IEC 18004)
├── data/
│   ├── menu.json               # Catálogo activo (actualizado en vivo desde /encargado)
│   └── menu.default.json       # Respaldo base de fábrica
├── scripts/
│   └── build_assets.py         # Script de generación inicial de logos, SVGs WebP y respaldo
└── assets/
    ├── brand/                  # Logotipos transparentes WebP (marrón y blanco)
    └── products/
        ├── *.webp              # Imágenes base de productos (640x480 WebP)
        └── uploads/            # Fotografías personalizadas subidas desde el portal
```

---

## 4. API REST del Servidor (`server.js`)

| Método y Ruta | Autenticación | Función |
| :--- | :---: | :--- |
| `GET /api/menu` | Pública | Devuelve el catálogo completo (`brand`, `categories`, `products`). |
| `POST /api/login` | Pública | Valida usuario y contraseña; devuelve token `Bearer` de sesión (24 h). |
| `POST /api/logout` | Token | Cierra la sesión activa. |
| `GET /api/auth/verify` | Token | Verifica si la sesión actual sigue vigente. |
| `POST /api/products` | Token | Crea un producto nuevo y lo guarda en `data/menu.json`. |
| `PUT /api/products/:id` | Token | Actualiza precios, textos, imagen o visibilidad de un producto. |
| `PATCH /api/products/:id/toggle` | Token | Alterna rápidamente entre **Visible** y **Oculto** (agotado). |
| `DELETE /api/products/:id` | Token | Elimina un producto de `data/menu.json`. |
| `POST /api/upload` | Token | Recibe imagen Base64 (`4:3` WebP/JPEG) y la guarda en `assets/products/uploads/`. |
| `PUT /api/settings` | Token | Actualiza WhatsApp, horarios, Instagram, aviso de dulcería y sucursales. |

---

## 5. Cómo abrirlo en Google Antigravity

1. Abre **Google Antigravity**.
2. Selecciona **Open Folder / Abrir Carpeta** y elige:
   `/home/santana19/.gemini/antigravity/scratch/miski-menu`
3. Desde la terminal integrada puedes iniciarlo en cualquier momento con `npm start`.
