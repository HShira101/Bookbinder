# Bookbinder — Journals as Books

[English](#english) · [Español](#español)

## English

Foundry VTT module that shows journals as a **book**: closed cover with the journal's name, two-page spreads, 3D page turns you can drag by hand, and Foundry's own side index (search, add page, drag to reorder) kept as is. System agnostic. Requires **Foundry VTT v14** or later.

> Version 0.2 adds themes: six ready-made templates, each with its own sub-styles. Two more (Oriental Scroll and Sheet) are included but stay hidden until their page effects arrive in 0.6. The theme editor arrives in 0.3.

### Install
In Foundry: **Add-on Modules → Install Module → Manifest URL**:

```
https://raw.githubusercontent.com/HShira101/Bookbinder/main/module.json
```

### Use
1. Open a journal you own.
2. Click the **book icon** next to the window's close button (✕) and choose a theme: **World themes** or **Templates** (Book, Lacquer and Silk, Investigator's Notebook, Datapad, Gothic Codex, Arcane Diary).
3. The journal now opens as a book for everyone. Choose **None (Foundry sheet)** to go back.
4. Below it, the **Aa** button picks one of the theme's sub-styles (a letter, a report…) for that page.

Applying a template copies it into `worlds/<world>/Bookbinder_themes/` (if you can upload files), so later module updates never change your journals. Templates use only fonts bundled with Foundry.

Turn pages with the side arrows, the page corners, the ← → keys (while the window has focus), or by dragging the page edge. Clicking a page in the side index, or a link to a page of the same journal, turns the pages to it. The side index is Foundry's own: add, search and reorder pages there as usual. Outside the book, at the top corner next to each page, ✎ opens that page in Foundry's editor.

Per-user settings: animation on/off, page-turn speed, page-turn sound and volume, index collapsed by default. Reduced motion is always respected.

### Tested game systems
| System | Status |
|---|---|
| l5r5e | pending |
| dnd5e | pending |
| sfrpg | pending |

## Español

Módulo de Foundry VTT que muestra los diarios como un **libro**: tapa cerrada con el nombre del diario, pliegos de dos páginas, paso de página en 3D que se puede arrastrar con la mano y el índice lateral propio de Foundry (buscar, añadir página, reordenar arrastrando) tal cual. Agnóstico de sistema. Requiere **Foundry VTT v14** o superior.

> La versión 0.2 añade los temas: seis plantillas listas, cada una con sus sub-estilos. Otras dos (Pergamino oriental y Hoja) vienen incluidas pero quedan ocultas hasta que sus efectos de página lleguen en la 0.6. El editor de temas llega en la 0.3.

### Instalar
En Foundry: **Módulos complementarios → Instalar módulo → URL del manifiesto**:

```
https://raw.githubusercontent.com/HShira101/Bookbinder/main/module.json
```

### Uso
1. Abre un diario del que seas propietario.
2. Pulsa el **icono de libro** junto al botón de cerrar (✕) de la ventana y elige un tema: **Diseños del mundo** o **Plantillas** (Libro, Laca y seda, Cuaderno de investigador, Datapad, Códice gótico, Diario de magia).
3. El diario se abre ahora como libro para todos. Elige **Ninguno (hoja de Foundry)** para volver.
4. Debajo, el botón **Aa** elige uno de los sub-estilos del tema (una carta, un informe…) para esa página.

Aplicar una plantilla la copia a `worlds/<mundo>/Bookbinder_themes/` (si puedes subir archivos), así las actualizaciones del módulo nunca cambian tus diarios. Las plantillas usan solo fuentes incluidas en Foundry.

Pasa las páginas con las flechas laterales, las esquinas de la página, las teclas ← → (con la ventana enfocada) o arrastrando el borde de la hoja. Pulsar una página en el índice lateral, o un enlace a una página del mismo diario, pasa las hojas hasta ella. El índice lateral es el de Foundry: ahí se añaden, buscan y reordenan las páginas como siempre. Fuera del libro, en la esquina superior junto a cada página, ✎ la abre en el editor de Foundry.

Ajustes por usuario: animación sí/no, velocidad del paso de página, sonido y volumen del paso de página, índice contraído por defecto. El movimiento reducido del sistema siempre se respeta.

### Sistemas de juego probados
| Sistema | Estado |
|---|---|
| l5r5e | pendiente |
| dnd5e | pendiente |
| sfrpg | pendiente |
