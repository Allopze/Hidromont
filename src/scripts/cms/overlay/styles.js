/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

export const overlayStyles = `
  /*
   * B-3: la barra y el panel pintaban con 40 colores escritos a mano, nueve
   * de ellos copias literales de los tokens del sitio. Cambiar el azul de
   * marca dejaba la interfaz de administración con el anterior.
   *
   * Los nueve pasan a leer el token, con el literal como respaldo: el overlay
   * también se inyecta en páginas que podrían no cargar tokens.css, y sin el
   * respaldo se quedaría sin color. Los demás son grises y colores de aviso
   * que el sitio no declara; se nombran aquí para que haya un solo sitio
   * donde cambiarlos.
   */
  :root {
    --hm-cms-primary: var(--color-primary, #0065A9);
    --hm-cms-primary-dark: var(--color-primary-dark, #004B7D);
    --hm-cms-accent: var(--color-accent, #00A6D6);
    --hm-cms-ink: var(--color-text, #1F2933);
    --hm-cms-muted: var(--color-text-muted, #5B6770);
    --hm-cms-line: var(--color-border, #D9E2EC);
    --hm-cms-dark: var(--color-background-strong, #0F2433);
    --hm-cms-alt: var(--color-background-alt, #F5F8FA);
    --hm-cms-error: var(--color-error, #C62828);
    --hm-cms-success: var(--color-success, #2E7D32);
    --hm-cms-primary-light: var(--color-primary-light, #E6F2FA);

    /* Grises del panel: sin equivalente en los tokens del sitio. */
    --hm-cms-line-soft: #cbd5e1;
    --hm-cms-line-softer: #e2e8f0;
    --hm-cms-ink-soft: #334155;
    --hm-cms-ink-softer: #475569;
    /*
     * #64748b daba 4.46:1 sobre el fondo claro del panel (#f5f8fa): por debajo
     * del 4.5 que pide WCAG 2.2 SC 1.4.3, y lo usan los rótulos de recuento y
     * las pistas de campo. Un escalón más oscuro del mismo gris lo deja en
     * 5.7:1 sin cambiar el aspecto.
     */
    --hm-cms-muted-soft: #55627a;
    --hm-cms-dark-hover: #172331;
    --hm-cms-surface-soft: #f1f5f9;

    /* Avisos: fondo, borde y texto de cada estado. */
    --hm-cms-warn-bg: #fffbeb;
    --hm-cms-warn-line: #fde68a;
    --hm-cms-warn-ink: #f59e0b;
    --hm-cms-danger-bg: #fee2e2;
    --hm-cms-danger-line: #fecaca;
    --hm-cms-danger-ink: #991b1b;
    --hm-cms-info-bg: #eff8ff;
    --hm-cms-info-line: #bae6fd;
    --hm-cms-ok-bg: #e8f5e9;
    --hm-cms-ok-line: #a5d6a7;
    --hm-cms-ok-ink: #1b5e20;
    --hm-cms-error-bg: #ffebee;

    /* Distintivos de estado de la lista de entradas. */
    --hm-cms-badge-draft-bg: #fef3c7;
    --hm-cms-badge-draft-ink: #92400e;
    --hm-cms-badge-published-bg: #dcfce7;
    --hm-cms-badge-published-ink: #166534;
    --hm-cms-badge-dark-bg: #0f172a;
    --hm-cms-badge-dark-ink: #dbeafe;
  }
  [data-cms-entry] {
    cursor: crosshair;
    outline-offset: 4px;
  }
  [data-cms-entry]:hover {
    outline: 2px solid var(--hm-cms-primary);
    box-shadow: 0 0 0 4px rgba(0,101,169,0.2);
  }
  .hm-cms-shell {
    position: fixed;
    z-index: 99999;
    inset: 0;
    pointer-events: none;
    font-family: Inter, system-ui, sans-serif;
  }
  .hm-cms-bar {
    pointer-events: auto;
    position: fixed;
    left: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--hm-cms-dark);
    color: white;
    border: 1px solid var(--hm-cms-line);
    border-radius: 0px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.24);
  }
  .hm-cms-bar button,
  .hm-cms-panel button {
    border: 0;
    border-radius: 0px;
    padding: 9px 12px;
    min-height: 44px;
    min-width: 44px;
    font-weight: 700;
    background: var(--hm-cms-primary);
    color: #fff;
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .hm-cms-bar button:hover,
  .hm-cms-panel button:hover {
    background: var(--hm-cms-primary-dark);
  }
  /* H-03: estilos :focus-visible para navegacion por teclado (WCAG 2.2 SC 2.4.7) */
  .hm-cms-bar button:focus-visible,
  .hm-cms-panel button:focus-visible {
    outline: 2px solid var(--hm-cms-accent);
    outline-offset: 2px;
  }
  .hm-cms-bar button.secondary,
  .hm-cms-panel button.secondary {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }
  .hm-cms-bar button.secondary:hover,
  .hm-cms-panel button.secondary:hover {
    background: rgba(255,255,255,0.2);
  }
  /* H-06: estilo destructivo consistente para botones de eliminacion */
  .hm-cms-bar button.destructive,
  .hm-cms-panel button.destructive {
    background: var(--hm-cms-danger-bg);
    color: var(--hm-cms-danger-ink);
  }
  .hm-cms-bar button.destructive:hover,
  .hm-cms-panel button.destructive:hover {
    background: var(--hm-cms-danger-line);
  }
  /* La barra flotante tapa el final de la página: damos aire al contenido. */
  body.hm-cms-active {
    padding-bottom: 84px;
  }
  .hm-cms-panel {
    pointer-events: auto;
    position: fixed;
    top: 0;
    right: 0;
    width: min(420px, 100vw);
    height: 100dvh;
    background: var(--hm-cms-alt);
    color: var(--hm-cms-ink);
    border-left: 1px solid var(--hm-cms-line);
    box-shadow: -20px 0 60px rgba(15,36,51,0.24);
    transform: translateX(104%);
    transition: transform 180ms ease;
    display: flex;
    flex-direction: column;
  }
  .hm-cms-panel.open {
    transform: translateX(0);
  }
  .hm-cms-panel-head {
    padding: 18px;
    background: var(--hm-cms-dark);
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .hm-cms-panel-head h2 {
    font-size: 16px;
    margin: 0;
    color: #fff;
  }
  .hm-cms-panel-body {
    padding: 18px;
    overflow: auto;
    display: grid;
    gap: 14px;
  }
  .hm-cms-panel label {
    display: grid;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--hm-cms-ink);
    /* Los hijos de un grid no bajan de su min-content sin esto, y el
       min-content de un <select> es el texto de su opción más larga. */
    min-width: 0;
  }
  .hm-cms-panel label > * {
    min-width: 0;
  }
  /*
   * <select> estaba fuera de esta regla desde el principio: solo la aplicaban
   * input y textarea. Las consecuencias eran dos y ninguna evidente.
   *
   * De ancho: un desplegable se dimensionaba a su opción más larga, así que los
   * filtros de la galería —nombres de álbum como "Tuberías Forzadas y
   * Blindajes"— estiraban el panel y empujaban la tercera columna de la
   * cuadrícula, el filtro de categoría y el botón de agregar fuera de la vista.
   *
   * De alto: sin el padding ni el borde de los demás campos, los desplegables
   * medían 18 px donde un input mide 42. Quedaban por debajo del mínimo de
   * WCAG 2.2 SC 2.5.8 y el formulario se veía desalineado.
   */
  .hm-cms-panel input,
  .hm-cms-panel select,
  .hm-cms-panel textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--hm-cms-line);
    border-radius: 0px;
    padding: 10px;
    font: inherit;
    color: var(--hm-cms-ink);
    background: white;
  }
  .hm-cms-panel input:focus-visible,
  .hm-cms-panel textarea:focus-visible,
  .hm-cms-panel select:focus-visible {
    outline: 2px solid var(--hm-cms-primary);
    outline-offset: 0;
    border-color: var(--hm-cms-primary);
    box-shadow: 0 0 0 3px rgba(0,101,169,0.2);
  }
  .hm-cms-panel textarea {
    min-height: 150px;
    resize: vertical;
  }
  .hm-cms-error {
    color: var(--hm-cms-error);
    font-size: 13px;
  }
  .hm-cms-muted {
    color: var(--hm-cms-muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .hm-cms-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* E-2: aviso de que hay una copia local sin guardar. */
  .hm-cms-draft-notice {
    background: var(--hm-cms-warn-bg);
    border: 1px solid var(--hm-cms-warn-line);
    padding: 10px 12px;
    font-size: 13px;
    color: var(--hm-cms-ink);
  }
  /* E-3: la clave de la base, en pequeño, junto al nombre legible. */
  .hm-cms-field-key {
    font-weight: 400;
    font-size: 11px;
    color: var(--hm-cms-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  /* M-6: panel de administración (registro, respaldos, contraseña). */
  .hm-cms-admin {
    display: grid;
    gap: 10px;
  }
  .hm-cms-admin h3 {
    margin: 8px 0 0;
    font-size: 14px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--hm-cms-dark);
    border-bottom: 1px solid var(--hm-cms-line);
    padding-bottom: 6px;
  }
  .hm-cms-admin h3:first-child {
    margin-top: 0;
  }
  .hm-cms-ok {
    color: var(--hm-cms-ok-ink);
    background: var(--hm-cms-ok-bg);
    border: 1px solid var(--hm-cms-ok-line);
    padding: 8px 10px;
    font-size: 13px;
    margin: 0;
  }
  /*
   * tabindex 0 porque la lista tiene su propio scroll: sin él, quien navega
   * con teclado no puede desplazarla y el registro de actividad queda
   * truncado a lo que quepa en pantalla (axe: scrollable-region-focusable).
   */
  .hm-cms-admin-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1px;
    background: var(--hm-cms-line);
    border: 1px solid var(--hm-cms-line);
    max-height: 320px;
    overflow-y: auto;
  }
  .hm-cms-admin-list li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 4px 12px;
    background: white;
    padding: 6px 8px;
    font-size: 13px;
  }
  /* Los eventos de acceso se distinguen: son los que se revisan cuando se
     sospecha de un intento de entrada ajeno. */
  .hm-cms-admin-list li[data-security] {
    border-left: 3px solid var(--hm-cms-accent);
  }
  /* H-05: spinner para operaciones asincronas */
  @keyframes hm-cms-spin {
    to { transform: rotate(360deg); }
  }
  .hm-cms-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: white;
    border-radius: 50%;
    animation: hm-cms-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  button[data-loading] {
    opacity: 0.7;
    cursor: not-allowed;
    pointer-events: none;
  }
  .hm-cms-job-list {
    display: grid;
    gap: 10px;
  }
  .hm-cms-job {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--hm-cms-line);
    border-radius: 0px;
    background: white;
  }
  .hm-cms-job-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    font-weight: 800;
    color: var(--hm-cms-ink);
  }
  .hm-cms-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 0px;
    padding: 3px 8px;
    background: var(--hm-cms-primary-light);
    color: var(--hm-cms-primary-dark);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .hm-cms-badge.succeeded {
    background: var(--hm-cms-ok-bg);
    color: var(--hm-cms-success);
  }
  .hm-cms-badge.failed {
    background: var(--hm-cms-error-bg);
    color: var(--hm-cms-error);
  }
  .hm-cms-log {
    max-height: 150px;
    overflow: auto;
    margin: 0;
    padding: 8px;
    border-radius: 0px;
    background: var(--hm-cms-badge-dark-bg);
    color: var(--hm-cms-badge-dark-ink);
    font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: pre-wrap;
  }
  .hm-cms-image-preview {
    display: grid;
    gap: 8px;
    padding: 10px;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    background: white;
  }
  .hm-cms-image-preview img {
    width: 100%;
    max-height: 180px;
    object-fit: contain;
    background: var(--hm-cms-line-softer);
    border-radius: 0px;
  }
  .hm-cms-media-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    max-height: 260px;
    overflow: auto;
    padding-right: 2px;
  }
  /*
   * OJO con la especificidad al construir componentes a partir de <button>:
   * ".hm-cms-panel button" (0,1,1) pinta el azul de llamada a la acción y gana
   * a cualquier clase suelta (0,1,0). A esta ficha le ganaba desde el
   * principio: salía azul en vez de blanca y el nombre del archivo quedaba en
   * gris sobre azul, 1.23:1 —ilegible— debajo de cada miniatura.
   *
   * Calificar con ".hm-cms-panel" empata en especificidad y gana por orden. Le
   * pasó lo mismo a la barra del editor de texto; si aparece un tercer
   * componente-botón, califíquelo igual.
   */
  .hm-cms-panel .hm-cms-media-item {
    display: grid;
    gap: 6px;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    padding: 6px;
    min-height: 0;
    font-weight: 400;
    background: white;
    color: var(--hm-cms-dark-hover);
    text-align: left;
    cursor: pointer;
  }
  .hm-cms-panel .hm-cms-media-item:hover,
  .hm-cms-panel .hm-cms-media-item.selected {
    background: white;
    border-color: var(--hm-cms-primary);
    box-shadow: 0 0 0 3px rgba(0,101,169,0.16);
  }
  .hm-cms-media-item img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 0px;
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-media-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--hm-cms-ink-softer);
  }
  /*
   * "minmax(0, 1fr)" y no "1fr": un "1fr" nunca baja del min-content de su
   * contenido, y el min-content de un <select> es el texto de su opción más
   * larga. Con los filtros de la galería —nombres de álbum como «Tuberías
   * Forzadas y Blindajes»— esta fila se negaba a encoger, estiraba la columna
   * del panel de 383 a 541 px y empujaba TODO 140 px fuera del panel: la
   * tercera columna de la cuadrícula, el filtro de categoría y el botón de
   * agregar imagen quedaban cortados, alcanzables solo con scroll horizontal.
   *
   * "min-width: 0" en los hijos es la otra mitad: sin él, cada columna vuelve
   * a plantarse en su min-content aunque la pista ya no se estire.
   */
  .hm-cms-two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
  }
  .hm-cms-two > * {
    min-width: 0;
  }
  .hm-cms-revisions {
    display: grid;
    gap: 8px;
  }
  .hm-cms-revision-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    background: white;
  }
  .hm-cms-revision-item.current {
    border-color: var(--hm-cms-primary);
    background: var(--hm-cms-info-bg);
  }
  .hm-cms-revision-info {
    display: grid;
    gap: 2px;
  }
  .hm-cms-revision-version {
    font-size: 12px;
    font-weight: 700;
    color: var(--hm-cms-ink-soft);
  }
  .hm-cms-revision-date {
    font-size: 11px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-collection-list {
    display: grid;
    gap: 6px;
  }
  .hm-cms-collection-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    background: white;
  }
  .hm-cms-collection-item:hover {
    border-color: var(--hm-cms-primary);
  }
  .hm-cms-collection-info {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .hm-cms-collection-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--hm-cms-dark-hover);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hm-cms-collection-meta {
    font-size: 11px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-collection-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .hm-cms-collection-actions button {
    font-size: 12px;
    padding: 5px 9px;
  }
  .hm-cms-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--hm-cms-line-softer);
    border-radius: 0px;
    margin-bottom: 12px;
  }
  .hm-cms-tab {
    flex: 1;
    padding: 7px 8px;
    border: 0;
    border-radius: 0px;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    background: transparent;
    color: var(--hm-cms-ink-softer);
  }
  .hm-cms-tab.active {
    background: white;
    color: var(--hm-cms-dark-hover);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  /* Sin este relevo de especificidad, la regla genérica
     ".hm-cms-panel button" (azul) pisaba a ".hm-cms-tab": las pestañas
     inactivas se veían rellenas de azul y la activa blanca, al revés. */
  .hm-cms-panel .hm-cms-tab {
    background: transparent;
    color: var(--hm-cms-ink-softer);
    border: 0;
  }
  .hm-cms-panel .hm-cms-tab.active {
    background: white;
    color: var(--hm-cms-dark-hover);
  }
  /* Los botones secundarios del cuerpo claro del panel (Editar, Volver,
     Cancelar) necesitan fondo visible: el "secondary" blanco al 10% está
     pensado para el header oscuro y aquí desaparecía. */
  .hm-cms-panel-body button.secondary {
    background: white;
    color: var(--hm-cms-ink);
    border: 1px solid var(--hm-cms-line-soft);
  }
  .hm-cms-panel-body button.secondary:hover {
    background: var(--hm-cms-surface-soft);
  }
  .hm-cms-entry-form {
    display: grid;
    gap: 12px;
  }
  .hm-cms-entry-form label {
    display: grid;
    gap: 5px;
    font-size: 13px;
    font-weight: 700;
    color: var(--hm-cms-ink-soft);
  }
  .hm-cms-entry-form input,
  .hm-cms-entry-form select,
  .hm-cms-entry-form textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    padding: 9px 10px;
    font: inherit;
    color: var(--hm-cms-dark-hover);
    background: white;
  }
  .hm-cms-entry-form textarea {
    min-height: 120px;
    resize: vertical;
  }
  .hm-cms-badge.draft { background: var(--hm-cms-badge-draft-bg); color: var(--hm-cms-badge-draft-ink); }
  .hm-cms-badge.published { background: var(--hm-cms-badge-published-bg); color: var(--hm-cms-badge-published-ink); }
  .hm-cms-gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .hm-cms-gallery-thumb {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 0px;
    border: 2px solid transparent;
    cursor: pointer;
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hm-cms-gallery-thumb:hover { border-color: var(--hm-cms-primary); }
  .hm-cms-gallery-thumb .hm-cms-gallery-featured {
    position: absolute;
    top: 3px;
    right: 3px;
    background: var(--hm-cms-accent);
    color: white;
    font-size: 9px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 0px;
    text-transform: uppercase;
  }
  .hm-cms-gallery-cat-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    background: white;
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-size: 13px;
    color: var(--hm-cms-dark-hover);
  }
  .hm-cms-gallery-cat-btn:hover { border-color: var(--hm-cms-primary); }
  .hm-cms-gallery-cat-name { font-weight: 700; }
  .hm-cms-gallery-cat-slug { font-size: 11px; color: var(--hm-cms-muted-soft); font-family: ui-monospace, monospace; }
  @media (max-width: 640px) {
    .hm-cms-bar {
      left: 8px;
      right: 8px;
      bottom: 8px;
      justify-content: space-between;
    }
    .hm-cms-panel {
      width: 100vw;
    }
  }
  /*
   * Editor de texto con formato (campos de tipo richtext).
   *
   * Los colores salen de los mismos tokens que el resto del panel; no se
   * introduce ninguno nuevo.
   */
  .hm-cms-rt {
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: 0px;
    background: white;
    margin-bottom: 12px;
  }
  .hm-cms-rt-bar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--hm-cms-line-softer);
    background: var(--hm-cms-surface-soft);
    flex-wrap: wrap;
  }
  /*
   * La especificidad importa: ".hm-cms-panel button" (0,1,1) gana a
   * ".hm-cms-rt-btn" (0,1,0), así que los once botones de la barra salían
   * pintados como CTA primarios azules de 44 px y la barra ocupaba dos filas.
   * Se califica con el panel para empatar en especificidad y ganar por orden.
   *
   * 32 px queda por encima del mínimo de 24 px de WCAG 2.2 SC 2.5.8 y deja la
   * barra en una sola fila; con puntero grueso vuelven a 44 px más abajo.
   */
  .hm-cms-panel .hm-cms-rt-btn {
    border: 1px solid transparent;
    background: transparent;
    color: var(--hm-cms-ink-soft);
    border-radius: 0px;
    padding: 0 7px;
    min-width: 32px;
    min-height: 32px;
    height: 32px;
    font-weight: 600;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    line-height: 1;
  }
  .hm-cms-panel .hm-cms-rt-btn:hover {
    background: white;
    border-color: var(--hm-cms-line-soft);
    color: var(--hm-cms-primary-dark);
  }
  .hm-cms-panel .hm-cms-rt-btn:focus-visible {
    outline: 2px solid var(--hm-cms-primary);
    outline-offset: -2px;
  }
  .hm-cms-panel .hm-cms-rt-btn[aria-pressed='true'] {
    background: var(--hm-cms-primary-light);
    border-color: var(--hm-cms-primary);
    color: var(--hm-cms-primary-dark);
  }
  .hm-cms-rt-bold { font-weight: 800; }
  .hm-cms-rt-italic { font-style: italic; }
  .hm-cms-rt-sep {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--hm-cms-line-soft);
  }
  .hm-cms-rt-spacer { flex: 1; }
  @media (pointer: coarse) {
    .hm-cms-panel .hm-cms-rt-btn {
      min-height: 44px;
      height: 44px;
      min-width: 44px;
    }
  }
  .hm-cms-rt textarea {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 0px;
    padding: 10px 12px;
    font: inherit;
    font-family: ui-monospace, monospace;
    font-size: 13px;
    line-height: 1.6;
    resize: vertical;
  }
  .hm-cms-rt textarea:focus-visible { outline: 2px solid var(--hm-cms-primary); outline-offset: -2px; }
  /*
   * La vista previa se acerca al sitio sin copiarlo: es una ayuda para no
   * publicar a ciegas, no una maqueta fiel. Decirlo evita la queja de «en el
   * panel se veía de otra manera».
   */
  .hm-cms-rt-preview {
    padding: 12px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--hm-cms-ink);
    max-height: 420px;
    overflow-y: auto;
  }
  .hm-cms-rt-preview h2 { font-size: 18px; margin: 0 0 8px; color: var(--hm-cms-dark); }
  .hm-cms-rt-preview h3 { font-size: 15px; margin: 12px 0 6px; color: var(--hm-cms-dark); }
  .hm-cms-rt-preview p { margin: 0 0 10px; }
  .hm-cms-rt-preview ul,
  .hm-cms-rt-preview ol { margin: 0 0 10px; padding-left: 20px; }
  .hm-cms-rt-preview li { margin-bottom: 4px; }
  .hm-cms-rt-preview blockquote {
    margin: 0 0 10px;
    padding: 6px 12px;
    border-left: 3px solid var(--hm-cms-primary);
    background: var(--hm-cms-alt);
    color: var(--hm-cms-ink-softer);
  }
  .hm-cms-rt-preview code {
    background: var(--hm-cms-surface-soft);
    padding: 1px 4px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
  }
  .hm-cms-rt-preview a { color: var(--hm-cms-primary); }
  .hm-cms-rt-preview :first-child { margin-top: 0; }
  .hm-cms-rt-preview :last-child { margin-bottom: 0; }
  .hm-cms-rt-help {
    margin: 0;
    padding: 6px 12px 8px;
    border-top: 1px solid var(--hm-cms-line-softer);
    font-size: 11px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-rt-help code {
    background: var(--hm-cms-surface-soft);
    padding: 0 3px;
    font-family: ui-monospace, monospace;
  }

  /* H-08: indicador de cambios sin guardar */
  .hm-cms-autosave-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--hm-cms-warn-ink);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 200ms ease;
  }
  .hm-cms-autosave-indicator.visible {
    opacity: 1;
  }
`;
