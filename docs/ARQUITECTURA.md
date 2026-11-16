# Documentación Técnica y Sistema de Diseño · Miski

## 1. Identidad Visual y Paleta de Marca

Los colores fueron extraídos directamente del logotipo oficial de **Miski** y verificados para ofrecer alto contraste en pantallas móviles:

| Token / Uso | Color | HEX |
| :--- | :--- | :---: |
| **Primario de Marca** | Cacao Miski | `#503629` |
| **Texto Principal** | Café Tostado | `#3B2314` |
| **Fondo Principal** | Crema Vainilla | `#FAF4EC` |
| **Tarjetas / Superficie** | Blanco Marfil | `#FFFFFF` |
| **Superficie Secundaria** | Trigo Suave | `#F3E5D0` |
| **Acento / Destacados** | Caramelo Artesanal | `#C87D46` |
| **Texto Secundario** | Moka Medio | `#6E503E` |
| **Botón WhatsApp / Acción** | Verde Bosque | `#1F7A4C` |

- **Tipografías:** `Cormorant Garamond` para encabezados y `Plus Jakarta Sans` para precios, descripciones e interfaz.

---

## 2. Esquema de Datos (`data/menu.json`)

El archivo `data/menu.json` es la fuente única de verdad tanto para el menú público como para el portal del encargado.

### Tipos de Precio Soportados (`priceType`)
1. **`single`**: Precio único (`B/. 1.00`, `B/. 3.00`), con unidad opcional (`unit`: `"c/u"`, `"bolsa"`, `"100 uds."`).
2. **`weight`**: Venta al peso en kilogramos (`unit: "Kg"`, ej. `B/. 4.50 Kg`).
3. **`sizes`**: Arreglo `sizes` con múltiples presentaciones (ej. `8oz` y `12oz` en Cafetería).
4. **`cake_matrix`**: Matriz interactiva para tortas de Dulcería:
   - `matrixType: "standard"`: filas con `size`, `portions`, `vanilla`, `chocolate`.
   - `matrixType: "tiered"`: filas por pisos con `size`, `portions`, `merengueVanilla`, `merengueChocolate`, `chantillyVanilla`, `chantillyChocolate`.

---

## 3. Reglas de Presentación Automática

- **Productos con fotografía (`image !== null`)**: Se muestran en cuadrícula adaptable (`repeat(auto-fill, minmax(156px, 1fr))` en móvil y `minmax(210px, 1fr)` en tablet/escritorio) con relación de aspecto `4:3`.
- **Productos sin fotografía (`image === null`)**: Se agrupan automáticamente en un **Tablero Editorial tipo Bistró** (`.bistro-board`) con línea punteada guía y alineación en 2 columnas en escritorio. Si una sección combina productos con y sin foto, los productos sin foto pasan debajo bajo *"Otras opciones disponibles"*.
- **Subida de fotos desde `/encargado`**: El navegador recorta y comprime automáticamente la imagen seleccionada a `640×480` WebP en un `<canvas>` antes de enviarla a `POST /api/upload`.

---

## 4. Regeneración de Respaldo Inicial

El script `scripts/build_assets.py` genera los logotipos WebP, procesa las imágenes base y actualiza `data/menu.default.json` **sin sobrescribir `data/menu.json`** (para proteger las ediciones del encargado). Si algún día se desea restablecer el catálogo de fábrica, ejecutar:

```bash
python3 scripts/build_assets.py --reset-menu
```
