# Bookbinder — Journals as Books

[English](#english) · [Español](#español)

## English

Foundry VTT module that shows journals as a **book**: closed cover with the journal's name, two-page spreads, 3D page turns you can drag by hand, and Foundry's own side index (search, add page, drag to reorder) kept as is. System agnostic. Requires **Foundry VTT v14** or later.

> Version 0.2 added themes: six ready-made templates, each with its own sub-styles. Version 0.6 brings the last two (Oriental Scroll and Sheet) with their own page effects, and splitting long text into pages. Version 0.3 adds the **design editor**: create and edit your own themes with a live preview (details below). Import/export arrives in 0.5 and the font picker with search in 0.4.

### Install
In Foundry: **Add-on Modules → Install Module → Manifest URL**:

```
https://raw.githubusercontent.com/HShira101/Bookbinder/main/module.json
```

### Use
1. Open a journal you own.
2. Click the **book icon** next to the window's close button (✕) and choose a theme: **World themes** or **Templates** (Book, Lacquer and Silk, Investigator's Notebook, Datapad, Gothic Codex, Oriental Scroll, Arcane Diary, Sheet).
3. The journal now opens as a book for everyone. Choose **None (Foundry sheet)** to go back.
4. Below it, the **Aa** button picks one of the theme's sub-styles (a letter, a report…) for that page.

A template is used **straight from the module**: applying it to a journal does not copy anything into your world, and templates only use fonts bundled with Foundry. To customize one, open **Bookbinder** and use it as the base of a new design.

Turn pages with the side arrows, the page corners, the ← → keys (while the window has focus), or by dragging the page edge. Clicking a page in the side index, or a link to a page of the same journal, turns the pages to it. The side index is Foundry's own: add, search and reorder pages there as usual. Outside the book, at the top corner next to each page, ✎ opens that page in Foundry's editor.

### Scrolls, loose sheets and long text (0.6)
- **Scroll** (Oriental Scroll, or any design of type 📜 Scroll): each journal page is one scroll. Changing page rolls it up and unrolls the next one; a long page flows in columns and the strip scrolls sideways (mouse wheel or the bar).
- **Loose sheet** (Sheet, or any design of type 📄 Loose sheet): a pile of sheets with no cover. Going forward sends the top sheet to the bottom of the pile, going back brings the last one on top, and a jump of several pages moves the whole bundle.
- **Long text**: in the advanced editor, **Effect → Long text → Split into pages** makes a journal page that does not fit continue on the following book pages instead of scrolling inside its own.

### Designs (0.3)
Open **Configure Settings → Bookbinder → Open Bookbinder**. There you can:
- see the **created designs** (name, shared or private, pending resources), open each one's **preview card** and **edit** the ones you may edit;
- **Add design** with the 4-step wizard (Base, Cover, Sheets, Typography) and a live preview, or fine-tune any element, ornament and effect in the **advanced editor**, including **sub-sheets** (they inherit what they don't change: "= Main", ↺ to inherit again);
- save with one dialog that warns when the design is **in use** by some journals (only the number; the GM can see which) or when **another user saved it first**, and lets you overwrite, save as a new version or discard;
- (GM) choose **who can create themes** and move designs to the **trash** (journals using a deleted design keep working; restore it any time).

Players you allow can create and edit their own designs; uploading images needs Foundry's own "Upload files" permission. Without a GM connected, a player's design is kept on hold and written as soon as a GM joins.

Per-user settings: animation on/off, page-turn speed, page-turn sound and volume, index collapsed by default. Reduced motion is always respected.

### Tested game systems
| System | Status |
|---|---|
| l5r5e | pending |
| dnd5e | pending |
| sfrpg | pending |

## Español

Módulo de Foundry VTT que muestra los diarios como un **libro**: tapa cerrada con el nombre del diario, pliegos de dos páginas, paso de página en 3D que se puede arrastrar con la mano y el índice lateral propio de Foundry (buscar, añadir página, reordenar arrastrando) tal cual. Agnóstico de sistema. Requiere **Foundry VTT v14** o superior.

> La versión 0.2 añadió los temas: seis plantillas listas, cada una con sus sub-estilos. La versión 0.6 trae las dos últimas (Pergamino oriental y Hoja) con sus propios efectos de página, y el reparto del texto largo en páginas. La versión 0.3 añade el **editor de diseños**: crea y edita tus propios temas con vista previa en vivo (detalle abajo). Importar y exportar llegan en la 0.5 y el selector de fuentes con búsqueda en la 0.4.

### Instalar
En Foundry: **Módulos complementarios → Instalar módulo → URL del manifiesto**:

```
https://raw.githubusercontent.com/HShira101/Bookbinder/main/module.json
```

### Uso
1. Abre un diario del que seas propietario.
2. Pulsa el **icono de libro** junto al botón de cerrar (✕) de la ventana y elige un tema: **Diseños del mundo** o **Plantillas** (Libro, Laca y seda, Cuaderno de investigador, Datapad, Códice gótico, Pergamino oriental, Diario de magia, Hoja).
3. El diario se abre ahora como libro para todos. Elige **Ninguno (hoja de Foundry)** para volver.
4. Debajo, el botón **Aa** elige uno de los sub-estilos del tema (una carta, un informe…) para esa página.

Una plantilla se usa **directamente desde el módulo**: aplicarla a un diario no copia nada a tu mundo, y las plantillas usan solo fuentes incluidas en Foundry. Para personalizar una, abre **Bookbinder** y úsala como base de un diseño nuevo.

Pasa las páginas con las flechas laterales, las esquinas de la página, las teclas ← → (con la ventana enfocada) o arrastrando el borde de la hoja. Pulsar una página en el índice lateral, o un enlace a una página del mismo diario, pasa las hojas hasta ella. El índice lateral es el de Foundry: ahí se añaden, buscan y reordenan las páginas como siempre. Fuera del libro, en la esquina superior junto a cada página, ✎ la abre en el editor de Foundry.

### Pergaminos, hojas sueltas y texto largo (0.6)
- **Pergamino** (Pergamino oriental, o cualquier diseño de tipo 📜 Pergamino): cada página del diario es un pergamino. Al cambiar de página se enrolla y se desenrolla el siguiente; una página larga se reparte en columnas y la tira se desplaza de lado (rueda del ratón o la barra).
- **Hoja suelta** (Hoja, o cualquier diseño de tipo 📄 Hoja suelta): una pila de hojas sin tapa. Al avanzar, la hoja de arriba pasa al fondo de la pila; al retroceder, la última vuelve encima; y un salto de varias páginas mueve el fajo entero.
- **Texto largo**: en el editor avanzado, **Efecto → Texto largo → Repartir en páginas** hace que una página del diario que no cabe siga en las páginas siguientes del libro en lugar de desplazarse dentro de la suya.

### Diseños (0.3)
Abre **Configurar ajustes → Bookbinder → Abrir Bookbinder**. Ahí puedes:
- ver los **diseños creados** (nombre, compartido o privado, recursos pendientes), abrir la **ficha de vista previa** de cada uno y **editar** los que puedas editar;
- **Agregar diseño** con el asistente de 4 pasos (Base, Tapa, Hojas, Tipografía) y vista previa en vivo, o ajustar cada elemento, adorno y efecto en el **editor avanzado**, incluidas las **sub-hojas** (heredan lo que no cambian: «= Principal», ↺ para volver a heredar);
- guardar con un único diálogo que avisa si el diseño **está en uso** por algún Journal (solo la cantidad; el GM ve cuáles) o si **otro usuario guardó antes**, y deja sobrescribir, crear una versión nueva o descartar;
- (GM) elegir **quién puede crear temas** y mover diseños a la **papelera** (los Journals que usan un diseño borrado siguen funcionando; se puede restaurar cuando quieras).

Los jugadores que autorices pueden crear y editar sus propios diseños; subir imágenes requiere el permiso nativo «Subir archivos» de Foundry. Sin un GM conectado, el diseño de un jugador queda en espera y se escribe en cuanto entra un GM.

Ajustes por usuario: animación sí/no, velocidad del paso de página, sonido y volumen del paso de página, índice contraído por defecto. El movimiento reducido del sistema siempre se respeta.

### Sistemas de juego probados
| Sistema | Estado |
|---|---|
| l5r5e | pendiente |
| dnd5e | pendiente |
| sfrpg | pendiente |
