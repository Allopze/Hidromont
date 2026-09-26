// @ts-check
/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

/*
 * Cómo está organizada esta hoja (sep-2026).
 *
 * La versión anterior pintaba cada <button> del panel como botón azul de
 * llamada a la acción con una regla de elemento, `.hm-cms-panel button`
 * (especificidad 0,1,1). Cualquier componente construido sobre un <button>
 * —pestañas, miniaturas, la barra del editor de texto, las tarjetas— perdía
 * contra ella y había que calificarlo con `.hm-cms-panel` para empatar: los
 * comentarios de la hoja documentaban cinco de esas peleas, y el resultado
 * era un panel donde casi todo parecía igual de importante.
 *
 * Ahora las reglas base de elementos llevan el ámbito dentro de `:where()`:
 * `:where(.hm-cms-shell) button` pesa lo mismo que un selector de elemento
 * (0,0,1). Empata con el reset del sitio (`input { padding: 0; font: inherit }`,
 * `p { margin-bottom }`) y le gana por orden, porque esta hoja se inyecta al
 * final; y pierde contra cualquier clase, que es lo que se buscaba. Los
 * estados (:hover, :disabled…) van también dentro de `:where()` para no subir
 * ese peso. Ojo: con todo el selector dentro de `:where()` el peso sería 0 y
 * el reset del sitio ganaría — pasó con los campos de texto, que perdieron el
 * relleno y heredaban la negrita del rótulo.
 *
 * Un botón sin clase es neutro; lo que destaca lo declara:
 *
 *   button            neutro (borde, fondo claro)
 *   .primary          la acción principal de la vista; los submit lo son solos
 *   .secondary        neutro explícito
 *   .ghost            solo texto, para Volver, Cancelar, herramientas
 *   .destructive      borrar; con .ghost es discreto, con .strong es rotundo
 *   .small / .icon    tamaños
 *
 * Los colores de los botones neutros salen de variables (--hm-btn-*), que las
 * superficies oscuras (barra, cabecera del panel, aviso de deshacer)
 * redefinen. Así el mismo botón sirve sobre claro y sobre oscuro sin clases
 * distintas.
 */
export const overlayStyles = `
  /*
   * B-3: los colores de marca leen los tokens del sitio, con el literal como
   * respaldo: el overlay también se inyecta en páginas que podrían no cargar
   * tokens.css. Los grises y colores de aviso no existen en el sitio; se
   * nombran aquí para que haya un solo sitio donde cambiarlos.
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

    --hm-cms-line-soft: #cbd5e1;
    --hm-cms-line-softer: #e2e8f0;
    --hm-cms-ink-soft: #334155;
    --hm-cms-ink-softer: #475569;
    /*
     * #64748b daba 4.46:1 sobre el fondo claro del panel (#f5f8fa): por debajo
     * del 4.5 que pide WCAG 2.2 SC 1.4.3. Un escalón más oscuro lo deja en 5.7:1.
     */
    --hm-cms-muted-soft: #55627a;
    --hm-cms-dark-hover: #172331;
    --hm-cms-surface-soft: #f1f5f9;

    --hm-cms-warn-bg: #fffbeb;
    --hm-cms-warn-line: #fde68a;
    --hm-cms-warn-ink: #f59e0b;
    --hm-cms-warn-text: #92400e;
    --hm-cms-danger-bg: #fee2e2;
    --hm-cms-danger-line: #fecaca;
    --hm-cms-danger-ink: #991b1b;
    --hm-cms-danger-solid: #b42318;
    --hm-cms-info-bg: #eff8ff;
    --hm-cms-info-line: #bae6fd;
    --hm-cms-ok-bg: #e8f5e9;
    --hm-cms-ok-line: #a5d6a7;
    --hm-cms-ok-ink: #1b5e20;
    --hm-cms-error-bg: #ffebee;

    --hm-cms-badge-draft-bg: #fef3c7;
    --hm-cms-badge-draft-ink: #92400e;
    --hm-cms-badge-published-bg: #dcfce7;
    --hm-cms-badge-published-ink: #166534;
    --hm-cms-badge-dark-bg: #0f172a;
    --hm-cms-badge-dark-ink: #dbeafe;

    /* Tonos de apoyo: placeholder, bordes al pasar, iconos de aviso. */
    --hm-cms-placeholder: #7a8795;
    --hm-cms-line-hover: #a9b6c6;
    --hm-cms-danger-line-hover: #f5a3a3;
    --hm-cms-danger-solid-hover: #912018;
    --hm-cms-warn-icon: #b45309;
    --hm-cms-tabs-bg: #e6ecf2;
    --hm-cms-checker: #eef2f6;

    /* Texto de estado sobre superficies oscuras (barra, aviso de deshacer). */
    --hm-cms-on-dark: #e2e8f0;
    --hm-cms-on-dark-warn: #fcd34d;
    --hm-cms-on-dark-ok: #86efac;
    --hm-cms-on-dark-error: #fca5a5;

    --hm-cms-font: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --hm-cms-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

    /*
     * UI-01: el sitio público usa radio 0 como decisión industrial; el CMS es
     * una herramienta interna y un radio suave lo hace más amable sin tocar
     * la estética pública.
     */
    --hm-cms-radius: 8px;
    --hm-cms-radius-sm: 6px;
    --hm-cms-radius-lg: 12px;

    /* Alto de los controles. Con puntero grueso sube a 44 px (WCAG 2.5.5). */
    --hm-cms-control: 38px;
    --hm-cms-control-sm: 32px;

    --hm-cms-ring: 0 0 0 3px rgba(0, 101, 169, 0.22);
    --hm-cms-shadow-sm: 0 1px 2px rgba(15, 36, 51, 0.06);
    --hm-cms-shadow-md: 0 4px 16px rgba(15, 36, 51, 0.1);
    --hm-cms-shadow-lg: 0 16px 48px rgba(15, 36, 51, 0.28);

    --hm-cms-ease: cubic-bezier(0.2, 0, 0, 1);
    --hm-cms-duration: 150ms;
    --hm-cms-duration-panel: 240ms;
  }
  @media (pointer: coarse) {
    :root {
      --hm-cms-control: 44px;
      /* P3-11: los botones de mover y quitar de las listas, 44 px al tacto. */
      --hm-cms-control-sm: 44px;
    }
  }
  /* P3-11: con el editor abierto la franja de logos se detiene, para poder
     pulsar el logo que se quiere cambiar. */
  .logo-marquee-track,
  .logo-marquee-track--rev {
    animation-play-state: paused !important;
  }

  /* ─── Zonas editables de la página ─────────────────────────────────────── */
  /*
   * Solo con sesión: [data-cms-editable-ready] lo pone
   * inline-edit-accessibility.js al iniciarla. Antes el contorno y el cursor
   * en cruz salían también en la pantalla de acceso, sobre elementos que aún
   * no se podían editar. El cursor pasa a la mano: pulsar abre el editor.
   */
  [data-cms-editable-ready] {
    cursor: pointer;
    outline-offset: 4px;
  }
  [data-cms-editable-ready]:hover {
    outline: 2px solid var(--hm-cms-primary);
    box-shadow: 0 0 0 4px rgba(0,101,169,0.2);
  }
  /*
   * Tarjetas que son un enlace entero (las de proyecto): el enlace se estira
   * con un ::before que tapa todo el contenido, así que el clic en el título
   * abría la ficha en vez del editor. Con sesión, los campos suben por encima.
   * El resto de la tarjeta sigue llevando a la ficha.
   */
  [data-cms-tarjeta-enlace] [data-cms-editable-ready] {
    position: relative;
    z-index: 1;
  }
  /*
   * La foto de fondo de la portada: queda debajo del contenido y de dos
   * degradados. Con sesión, lo vacío del bloque de contenido deja pasar el
   * clic hasta la foto; los textos y botones siguen recibiéndolo.
   */
  [data-cms-fondo][data-cms-editable-ready] {
    pointer-events: auto;
  }
  body.hm-cms-active [data-cms-sobre-fondo] {
    pointer-events: none;
  }
  body.hm-cms-active [data-cms-sobre-fondo] > * {
    pointer-events: auto;
  }
  /* Selector de iconos de servicio: los ocho de la lista, en su color. */
  .hm-cms-iconos {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .hm-cms-icono {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 64px;
    padding: 10px;
    border: 1px solid var(--hm-cms-line);
    border-radius: var(--hm-cms-radius-sm);
    background: #fff;
    color: var(--hm-cms-primary);
    cursor: pointer;
  }
  .hm-cms-icono[aria-checked="true"] {
    border-color: var(--hm-cms-primary);
    box-shadow: 0 0 0 3px rgba(0,101,169,0.2);
    background: var(--hm-cms-primary-light);
  }
  .hm-cms-icono-dibujo {
    display: block;
    width: 36px;
    height: 36px;
  }
  .hm-cms-icono-dibujo svg {
    width: 100%;
    height: 100%;
  }
  .hm-cms-icono-propio {
    width: 64px;
    height: 64px;
    padding: 10px;
    margin-bottom: 8px;
    border: 1px solid var(--hm-cms-primary);
    border-radius: var(--hm-cms-radius-sm);
    color: var(--hm-cms-primary);
  }
  /* Las fotos de /galeria se editan pulsándolas (abren su ficha de galería). */
  body.hm-cms-sesion .gallery-card:hover {
    outline: 2px solid var(--hm-cms-primary);
    outline-offset: 2px;
  }
  /* El elemento que se está editando: se ve con el panel abierto al lado. */
  [data-cms-entry].hm-cms-editing,
  [data-cms-editable-ready]:has(> .hm-cms-editing) {
    outline: 2px solid var(--hm-cms-accent);
    outline-offset: 4px;
    box-shadow: 0 0 0 6px rgba(0, 166, 214, 0.2);
  }
  [data-cms-editable-ready]:focus-visible {
    outline: 3px solid var(--hm-cms-primary);
    outline-offset: 4px;
    box-shadow: 0 0 0 6px rgba(255,255,255,0.95);
  }
  /* En pantallas táctiles no existe :hover para descubrir qué se puede editar. */
  @media (hover: none) {
    [data-cms-editable-ready]:not(:focus-visible) {
      outline: none;
      box-shadow: none;
    }
    body.hm-cms-guides-visible [data-cms-editable-ready]:not(:focus-visible) {
      outline: 2px dashed var(--hm-cms-primary);
      outline-offset: 3px;
      box-shadow: 0 0 0 4px rgba(0,101,169,0.14);
    }
  }
  @media (hover: hover) {
    [data-touch-only] { display: none !important; }
  }
  /* La barra flotante tapa el final de la página: damos aire al contenido. */
  body.hm-cms-active {
    padding-bottom: 84px;
  }

  /* ─── Shell ──────────────────────────────────────────────────────────── */
  .hm-cms-shell {
    position: fixed;
    z-index: 99999;
    inset: 0;
    pointer-events: none;
    font-family: var(--hm-cms-font);
    color: var(--hm-cms-ink);
    -webkit-font-smoothing: antialiased;
  }
  /*
   * «hidden» tiene que ganar siempre. Los avisos y las notas se muestran con
   * display:flex o grid, y sin esto el atributo no los ocultaba: el aviso de
   * «Borrador» salía aunque la entrada estuviera publicada.
   */
  .hm-cms-shell [hidden] {
    display: none !important;
  }
  .hm-cms-icon {
    flex: none;
    display: block;
  }
  /* Solo para lectores de pantalla. */
  .hm-cms-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* ─── Elementos base, sin especificidad ─────────────────────────────── */
  :where(.hm-cms-shell) button {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--hm-cms-control);
    min-width: var(--hm-cms-control);
    margin: 0;
    padding: 0 14px;
    border: 1px solid var(--hm-btn-line, var(--hm-cms-line-soft));
    border-radius: var(--hm-cms-radius-sm);
    background: var(--hm-btn-bg, #fff);
    color: var(--hm-btn-ink, var(--hm-cms-ink));
    font: 600 14px/1.2 var(--hm-cms-font);
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background-color var(--hm-cms-duration) var(--hm-cms-ease),
      border-color var(--hm-cms-duration) var(--hm-cms-ease),
      box-shadow var(--hm-cms-duration) var(--hm-cms-ease),
      color var(--hm-cms-duration) var(--hm-cms-ease);
  }
  :where(.hm-cms-shell) button:where(:hover:not([disabled])) {
    background: var(--hm-btn-bg-hover, var(--hm-cms-surface-soft));
  }
  :where(.hm-cms-shell) button:where(:active:not([disabled])) {
    transform: translateY(1px);
  }
  :where(.hm-cms-shell) button:where(:focus-visible) {
    outline: 2px solid var(--hm-cms-accent);
    outline-offset: 2px;
  }
  :where(.hm-cms-shell) button:where([disabled]) {
    cursor: not-allowed;
    opacity: 0.55;
  }

  :where(.hm-cms-shell) input:where(:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"])),
  :where(.hm-cms-shell) select,
  :where(.hm-cms-shell) textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: var(--hm-cms-control);
    margin: 0;
    padding: 8px 11px;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: var(--hm-cms-radius-sm);
    background: #fff;
    color: var(--hm-cms-ink);
    font: 400 15px/1.45 var(--hm-cms-font);
    transition: border-color var(--hm-cms-duration) var(--hm-cms-ease),
      box-shadow var(--hm-cms-duration) var(--hm-cms-ease);
  }
  /* 0,0,2 como el reset («input::placeholder»), para ganarle por orden. */
  :where(.hm-cms-shell) input::placeholder,
  :where(.hm-cms-shell) textarea::placeholder {
    opacity: 1;
    color: var(--hm-cms-placeholder);
  }
  :where(.hm-cms-shell) input:where(:hover:not(:focus)),
  :where(.hm-cms-shell) select:where(:hover:not(:focus)),
  :where(.hm-cms-shell) textarea:where(:hover:not(:focus)) {
    border-color: var(--hm-cms-line-hover);
  }
  /* El contorno transparente reaparece en modo de alto contraste. */
  :where(.hm-cms-shell) input:where(:focus-visible),
  :where(.hm-cms-shell) select:where(:focus-visible),
  :where(.hm-cms-shell) textarea:where(:focus-visible) {
    outline: 2px solid transparent;
    border-color: var(--hm-cms-primary);
    box-shadow: var(--hm-cms-ring);
  }
  :where(.hm-cms-shell) input:where([readonly]) {
    background: var(--hm-cms-surface-soft);
    color: var(--hm-cms-ink-softer);
  }
  :where(.hm-cms-shell) textarea {
    min-height: 120px;
    resize: vertical;
  }
  :where(.hm-cms-shell) input:where([type="checkbox"]) {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--hm-cms-primary);
  }

  /*
   * El texto del <label> es el nombre del campo y el control va dentro. Los
   * hijos de un grid no bajan de su min-content sin min-width:0, y el de un
   * <select> es su opción más larga: sin esto, «Tuberías Forzadas y
   * Blindajes» estiraba el panel y empujaba columnas fuera de la vista.
   */
  :where(.hm-cms-shell) label {
    display: grid;
    gap: 6px;
    min-width: 0;
    font: 600 13px/1.35 var(--hm-cms-font);
    color: var(--hm-cms-ink-soft);
  }
  :where(.hm-cms-shell) label > * {
    min-width: 0;
  }
  :where(.hm-cms-shell) form {
    display: grid;
    gap: 16px;
    margin: 0;
  }
  :where(.hm-cms-shell) p,
  :where(.hm-cms-shell) h2,
  :where(.hm-cms-shell) h3,
  :where(.hm-cms-shell) ul,
  :where(.hm-cms-shell) ol,
  :where(.hm-cms-shell) pre {
    margin: 0;
    line-height: inherit;
  }
  :where(.hm-cms-shell) code {
    font: 12.5px/1.4 var(--hm-cms-mono);
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--hm-cms-surface-soft);
    color: var(--hm-cms-ink-soft);
    overflow-wrap: anywhere;
  }

  /* ─── Botones: variantes ─────────────────────────────────────────────── */
  :where(.hm-cms-shell) :is(button.primary, button[type="submit"]) {
    border-color: var(--hm-cms-primary);
    background: var(--hm-cms-primary);
    color: #fff;
    box-shadow: 0 1px 2px rgba(0, 75, 125, 0.25);
  }
  :where(.hm-cms-shell) :is(button.primary, button[type="submit"]):where(:hover:not([disabled])) {
    border-color: var(--hm-cms-primary-dark);
    background: var(--hm-cms-primary-dark);
  }
  :where(.hm-cms-shell) button.secondary {
    border-color: var(--hm-btn-line, var(--hm-cms-line-soft));
    background: var(--hm-btn-bg, #fff);
    color: var(--hm-btn-ink, var(--hm-cms-ink));
  }
  :where(.hm-cms-shell) button.secondary:where(:hover:not([disabled])) {
    background: var(--hm-btn-bg-hover, var(--hm-cms-surface-soft));
  }
  :where(.hm-cms-shell) button.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--hm-ghost-ink, var(--hm-cms-primary-dark));
    box-shadow: none;
  }
  :where(.hm-cms-shell) button.ghost:where(:hover:not([disabled])) {
    background: var(--hm-ghost-hover, var(--hm-cms-primary-light));
  }
  :where(.hm-cms-shell) button.destructive {
    border-color: var(--hm-cms-danger-line);
    background: #fff;
    color: var(--hm-cms-danger-ink);
    box-shadow: none;
  }
  :where(.hm-cms-shell) button.destructive:where(:hover:not([disabled])) {
    border-color: var(--hm-cms-danger-line-hover);
    background: var(--hm-cms-danger-bg);
  }
  :where(.hm-cms-shell) button.ghost.destructive {
    border-color: transparent;
    background: transparent;
  }
  :where(.hm-cms-shell) button.ghost.destructive:where(:hover:not([disabled])) {
    background: var(--hm-cms-danger-bg);
  }
  :where(.hm-cms-shell) button.destructive.strong {
    border-color: var(--hm-cms-danger-solid);
    background: var(--hm-cms-danger-solid);
    color: #fff;
  }
  :where(.hm-cms-shell) button.destructive.strong:where(:hover:not([disabled])) {
    border-color: var(--hm-cms-danger-solid-hover);
    background: var(--hm-cms-danger-solid-hover);
  }
  :where(.hm-cms-shell) button.small {
    min-height: var(--hm-cms-control-sm);
    padding: 0 10px;
    font-size: 13px;
  }
  :where(.hm-cms-shell) button.icon {
    min-width: var(--hm-cms-control);
    padding: 0;
  }
  :where(.hm-cms-shell) button.icon.small {
    min-width: var(--hm-cms-control-sm);
  }
  :where(.hm-cms-shell) button[data-loading] {
    opacity: 0.75;
    cursor: progress;
    pointer-events: none;
  }

  /* Superficies oscuras: los botones neutros pasan a translúcidos. */
  .hm-cms-bar,
  .hm-cms-panel-head,
  .hm-cms-undo {
    --hm-btn-bg: rgba(255, 255, 255, 0.08);
    --hm-btn-bg-hover: rgba(255, 255, 255, 0.16);
    --hm-btn-line: rgba(255, 255, 255, 0.14);
    --hm-btn-ink: #fff;
    --hm-ghost-ink: #fff;
    --hm-ghost-hover: rgba(255, 255, 255, 0.12);
  }

  /* ─── Barra ─────────────────────────────────────────────────────────── */
  .hm-cms-bar {
    pointer-events: auto;
    position: fixed;
    z-index: 20;
    left: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    background: var(--hm-cms-dark);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--hm-cms-radius-lg);
    box-shadow: var(--hm-cms-shadow-lg);
  }
  .hm-cms-brand {
    padding: 0 8px 0 10px;
    font: 700 13px/1 var(--hm-cms-font);
    letter-spacing: 0.01em;
    white-space: nowrap;
  }
  .hm-cms-bar button {
    min-height: 36px;
    padding: 0 12px;
    font-size: 13.5px;
    white-space: nowrap;
  }
  /* Menú «Más»: Historial, Administrar y Salir, que se usan de vez en cuando. */
  .hm-cms-bar-more {
    position: relative;
  }
  .hm-cms-bar-more > button > .hm-cms-icon {
    transition: transform var(--hm-cms-duration) var(--hm-cms-ease);
  }
  .hm-cms-bar-more > button[aria-expanded="true"] > .hm-cms-icon {
    transform: rotate(180deg);
  }
  .hm-cms-bar-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    display: grid;
    gap: 2px;
    min-width: 230px;
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--hm-cms-radius-lg);
    background: var(--hm-cms-dark);
    box-shadow: var(--hm-cms-shadow-lg);
  }
  .hm-cms-bar .hm-cms-bar-menu button {
    justify-content: flex-start;
    width: 100%;
    border-color: transparent;
    background: transparent;
  }
  .hm-cms-bar .hm-cms-bar-menu button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .hm-cms-bar button[aria-pressed="true"] {
    border-color: var(--hm-cms-accent);
    box-shadow: 0 0 0 2px rgba(0, 166, 214, 0.18);
  }
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

  /* ─── Panel ─────────────────────────────────────────────────────────── */
  .hm-cms-backdrop {
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 10;
    background: rgba(15, 36, 51, 0.3);
    opacity: 0;
    transition: opacity var(--hm-cms-duration-panel) var(--hm-cms-ease);
  }
  .hm-cms-backdrop.visible {
    pointer-events: auto;
    opacity: 1;
  }
  .hm-cms-panel {
    pointer-events: auto;
    position: fixed;
    z-index: 30;
    top: 0;
    right: 0;
    width: min(440px, 100vw);
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--hm-cms-alt);
    color: var(--hm-cms-ink);
    border-left: 1px solid var(--hm-cms-line);
    box-shadow: -12px 0 40px rgba(15, 36, 51, 0.18);
    transform: translateX(104%);
    transition: transform var(--hm-cms-duration-panel) var(--hm-cms-ease);
  }
  .hm-cms-panel.open {
    transform: translateX(0);
  }
  .hm-cms-panel.is-wide {
    width: min(680px, 100vw);
  }
  /* P2-21: con el panel abierto en escritorio, la página y la barra le ceden su ancho. */
  html.hm-cms-con-panel body {
    margin-right: var(--hm-cms-reserva);
  }
  html.hm-cms-con-panel header[data-overlay] {
    right: var(--hm-cms-reserva);
  }
  html.hm-cms-con-panel .hm-cms-bar {
    max-width: calc(100vw - var(--hm-cms-reserva) - 32px);
    flex-wrap: wrap;
  }
  .hm-cms-panel:focus {
    outline: none;
  }
  .hm-cms-panel-head {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 56px;
    padding: 8px 10px 8px 20px;
    background: var(--hm-cms-dark);
    color: #fff;
  }
  .hm-cms-panel-head h2 {
    font: 600 15px/1.3 var(--hm-cms-font);
    color: #fff;
  }
  .hm-cms-panel-head button.icon {
    --hm-btn-bg: transparent;
    --hm-btn-line: transparent;
  }
  /* Mientras se publica el panel no se puede cerrar: la X no se ofrece. */
  .hm-cms-panel:has(.hm-cms-progress) .hm-cms-panel-head [data-action="close"] {
    visibility: hidden;
  }
  .hm-cms-panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    overflow: auto;
    overscroll-behavior: contain;
    font-size: 14px;
    line-height: 1.5;
  }

  /*
   * Pie fijo con la acción principal. Sin él, «Guardar» quedaba debajo de la
   * biblioteca de imágenes y había que desplazarse para encontrarlo.
   */
  .hm-cms-panel-body .hm-cms-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0 -20px -20px;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--hm-cms-line);
    background: #fff;
    box-shadow: 0 -6px 18px rgba(15, 36, 51, 0.06);
  }
  /*
   * Un formulario con pie ocupa todo el alto del panel: si es corto, el pie
   * queda abajo, donde se espera, y no flotando a media pantalla.
   */
  .hm-cms-panel-body > :is(form, .hm-cms-view):has(> .hm-cms-footer) {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
  }
  .hm-cms-panel-body > :is(form, .hm-cms-view) > .hm-cms-footer {
    margin-top: auto;
  }
  .hm-cms-footer .hm-cms-save-state:not(:empty) {
    flex-basis: 100%;
  }
  .hm-cms-edit-actions-primary {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .hm-cms-footer .hm-cms-edit-actions-primary .hm-cms-save-state {
    flex: 1 1 0;
    flex-basis: auto;
  }
  .hm-cms-edit-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 8px;
    margin: -6px -8px 0;
  }
  .hm-cms-edit-actions-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }

  /* ─── Texto ─────────────────────────────────────────────────────────── */
  .hm-cms-muted {
    font-size: 13px;
    line-height: 1.5;
    color: var(--hm-cms-muted);
  }
  .hm-cms-hint {
    font: 400 12.5px/1.5 var(--hm-cms-font);
    color: var(--hm-cms-muted-soft);
  }
  /* Una pista pertenece al campo que la precede, no al hueco entre campos. */
  :where(.hm-cms-shell) :where(label, .hm-cms-drop, .hm-cms-fieldset) + .hm-cms-hint {
    margin-top: -10px;
  }
  .hm-cms-block {
    display: block;
    margin-top: 8px;
  }
  .hm-cms-label {
    font: 600 13px/1.35 var(--hm-cms-font);
    color: var(--hm-cms-ink-soft);
  }
  .hm-cms-error {
    font-size: 13px;
    line-height: 1.5;
    color: var(--hm-cms-danger-ink);
  }
  .hm-cms-count {
    margin-top: -6px;
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-empty {
    padding: 24px 16px;
    border: 1px dashed var(--hm-cms-line-soft);
    border-radius: var(--hm-cms-radius);
    background: #fff;
    color: var(--hm-cms-muted);
    font-size: 13.5px;
    text-align: center;
  }
  .hm-cms-context {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-context strong {
    font-weight: 600;
    color: var(--hm-cms-ink);
  }
  .hm-cms-context-sep {
    color: var(--hm-cms-line-soft);
  }
  .hm-cms-section-title {
    margin-bottom: 2px;
    font: 600 15px/1.35 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }

  /* ─── Disposición ───────────────────────────────────────────────────── */
  .hm-cms-stack {
    display: grid;
    align-content: start;
    gap: 12px;
  }
  .hm-cms-toolbar {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .hm-cms-grow {
    flex: 1;
    min-width: 0;
  }
  .hm-cms-back {
    justify-self: start;
    align-self: flex-start;
    margin-left: -8px;
  }
  .hm-cms-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .hm-cms-field-group {
    display: grid;
    gap: 8px;
  }
  /*
   * "minmax(0, 1fr)" y no "1fr": un "1fr" nunca baja del min-content de su
   * contenido, y el de un <select> es el texto de su opción más larga.
   */
  .hm-cms-two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
  }
  .hm-cms-two > * {
    min-width: 0;
  }
  .hm-cms-fieldset {
    display: grid;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .hm-cms-fieldset > legend {
    margin-bottom: 6px;
    padding: 0;
    font: 600 13px/1.35 var(--hm-cms-font);
    color: var(--hm-cms-ink-soft);
  }
  .hm-cms-check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    color: var(--hm-cms-ink);
    cursor: pointer;
  }

  /* Secciones plegables: opciones avanzadas y detalles técnicos. */
  .hm-cms-advanced {
    padding: 0 12px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-advanced[open] {
    padding-bottom: 12px;
  }
  .hm-cms-advanced > :not(summary) + :not(summary) {
    margin-top: 12px;
  }
  .hm-cms-advanced > summary,
  .hm-cms-tech > summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    list-style: none;
    cursor: pointer;
    font: 600 13px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink-soft);
  }
  .hm-cms-advanced > summary::-webkit-details-marker,
  .hm-cms-tech > summary::-webkit-details-marker {
    display: none;
  }
  .hm-cms-advanced > summary::before,
  .hm-cms-tech > summary::before {
    content: "";
    width: 6px;
    height: 6px;
    margin: 0 2px;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(-45deg);
    transition: transform var(--hm-cms-duration) var(--hm-cms-ease);
  }
  .hm-cms-advanced[open] > summary::before,
  .hm-cms-tech[open] > summary::before {
    transform: rotate(45deg);
  }
  .hm-cms-advanced > summary:focus-visible,
  .hm-cms-tech > summary:focus-visible {
    outline: 2px solid var(--hm-cms-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
  .hm-cms-tech {
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-tech > summary {
    min-height: 32px;
    font-weight: 500;
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-tech > :not(summary) + :not(summary) {
    margin-top: 8px;
  }

  /* ─── Avisos ────────────────────────────────────────────────────────── */
  .hm-cms-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--hm-cms-line);
    border-radius: var(--hm-cms-radius-sm);
    background: #fff;
    color: var(--hm-cms-ink);
    font: 400 13.5px/1.5 var(--hm-cms-font);
  }
  .hm-cms-notice > .hm-cms-icon {
    margin-top: 2px;
  }
  .hm-cms-notice > div {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  .hm-cms-notice.is-info { border-color: var(--hm-cms-info-line); background: var(--hm-cms-info-bg); }
  .hm-cms-notice.is-info > .hm-cms-icon { color: var(--hm-cms-primary); }
  .hm-cms-notice.is-warn { border-color: var(--hm-cms-warn-line); background: var(--hm-cms-warn-bg); }
  .hm-cms-notice.is-warn > .hm-cms-icon { color: var(--hm-cms-warn-icon); }
  .hm-cms-notice.is-ok { border-color: var(--hm-cms-ok-line); background: var(--hm-cms-ok-bg); color: var(--hm-cms-ok-ink); }
  .hm-cms-notice.is-danger { border-color: var(--hm-cms-danger-line); background: var(--hm-cms-danger-bg); color: var(--hm-cms-danger-ink); }
  .hm-cms-notice-list {
    display: grid;
    gap: 6px;
    padding-left: 18px;
    list-style: disc;
  }

  /* ─── Estado del guardado ───────────────────────────────────────────── */
  .hm-cms-save-state {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-save-state[data-level]::before {
    content: "";
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.85;
  }
  .hm-cms-save-state[data-level="error"]::before {
    display: none;
  }
  .hm-cms-save-state[data-level="error"] {
    display: grid;
    gap: 8px;
  }
  .hm-cms-save-state[data-level="dirty"] { color: var(--hm-cms-warn-text); }
  .hm-cms-save-state[data-level="saving"] { color: var(--hm-cms-primary); }
  .hm-cms-save-state[data-level="success"] { color: var(--hm-cms-ok-ink); }

  /* ─── Distintivos ───────────────────────────────────────────────────── */
  .hm-cms-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--hm-cms-primary-light);
    color: var(--hm-cms-primary-dark);
    font: 600 12px/1.3 var(--hm-cms-font);
    white-space: nowrap;
  }
  .hm-cms-badge.draft,
  .hm-cms-badge.pending,
  .hm-cms-badge.warning,
  .hm-cms-badge.running,
  .hm-cms-badge.queued {
    background: var(--hm-cms-badge-draft-bg);
    color: var(--hm-cms-badge-draft-ink);
  }
  .hm-cms-badge.published,
  .hm-cms-badge.succeeded {
    background: var(--hm-cms-badge-published-bg);
    color: var(--hm-cms-badge-published-ink);
  }
  .hm-cms-badge.failed {
    background: var(--hm-cms-error-bg);
    color: var(--hm-cms-error);
  }
  .hm-cms-state::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  /* Sobre la barra oscura, los mismos estados en versión translúcida. */
  .hm-cms-bar .hm-cms-badge {
    background: rgba(255, 255, 255, 0.1);
    color: var(--hm-cms-on-dark);
  }
  .hm-cms-bar .hm-cms-badge.pending,
  .hm-cms-bar .hm-cms-badge.warning { background: rgba(245, 158, 11, 0.16); color: var(--hm-cms-on-dark-warn); }
  .hm-cms-bar .hm-cms-badge.succeeded { background: rgba(34, 197, 94, 0.16); color: var(--hm-cms-on-dark-ok); }
  .hm-cms-bar .hm-cms-badge.failed { background: rgba(239, 68, 68, 0.18); color: var(--hm-cms-on-dark-error); }

  /* ─── Listas de entradas, categorías y álbumes ──────────────────────── */
  .hm-cms-tabs {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--hm-cms-radius);
    background: var(--hm-cms-tabs-bg);
  }
  .hm-cms-tab {
    flex: 1;
    min-height: 34px;
    border: 0;
    background: transparent;
    color: var(--hm-cms-ink-softer);
    font-size: 13px;
    box-shadow: none;
  }
  .hm-cms-tab:hover {
    background: rgba(255, 255, 255, 0.6);
    color: var(--hm-cms-ink);
  }
  .hm-cms-tab.active,
  .hm-cms-tab.active:hover {
    background: #fff;
    color: var(--hm-cms-ink);
    box-shadow: 0 1px 2px rgba(15, 36, 51, 0.14);
  }
  .hm-cms-collection-list {
    display: grid;
    gap: 6px;
  }
  .hm-cms-collection-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 56px;
    padding: 8px 8px 8px 14px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
    transition: border-color var(--hm-cms-duration) var(--hm-cms-ease),
      box-shadow var(--hm-cms-duration) var(--hm-cms-ease);
  }
  .hm-cms-collection-item:hover {
    border-color: var(--hm-cms-line-soft);
    box-shadow: var(--hm-cms-shadow-sm);
  }
  .hm-cms-collection-info {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .hm-cms-collection-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 600 14px/1.35 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-collection-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
    white-space: nowrap;
  }
  .hm-cms-collection-meta > span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hm-cms-collection-meta .hm-cms-badge {
    padding: 1px 7px;
    font-size: 11.5px;
  }
  .hm-cms-collection-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }

  /* ─── Secciones de la ficha ─────────────────────────────────────────── */
  .hm-cms-form-section {
    display: grid;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-form-section-title {
    font: 600 14.5px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  /* Dentro de una sección blanca, las filas y grupos se separan con gris. */
  .hm-cms-form-section .hm-cms-group {
    background: var(--hm-cms-alt);
  }

  /* ─── Editor de listas ──────────────────────────────────────────────── */
  .hm-cms-list {
    display: grid;
    gap: 8px;
  }
  .hm-cms-list-items {
    display: grid;
    gap: 6px;
    padding: 0;
    list-style: none;
  }
  .hm-cms-list-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .hm-cms-list-row > input {
    flex: 1;
  }
  .hm-cms-move {
    display: inline-flex;
    flex: none;
  }
  .hm-cms-group-head .hm-cms-move {
    margin-left: auto;
  }
  .hm-cms-group {
    display: grid;
    gap: 10px;
    padding: 8px 8px 12px 12px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-group > label {
    margin-right: 4px;
  }
  .hm-cms-group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .hm-cms-group-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 600 13.5px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-group textarea {
    min-height: 76px;
  }
  /* Las áreas de texto crecen con lo escrito (donde el navegador lo admite). */
  :where(.hm-cms-shell) textarea {
    field-sizing: content;
    max-height: 60vh;
  }
  .hm-cms-add-item {
    width: 100%;
    justify-content: flex-start;
    border: 1px dashed var(--hm-cms-line-soft);
    background: transparent;
    color: var(--hm-cms-primary-dark);
    box-shadow: none;
  }
  .hm-cms-add-item:hover {
    border-color: var(--hm-cms-primary);
    background: var(--hm-cms-primary-light);
  }

  /* ─── Imágenes ──────────────────────────────────────────────────────── */
  .hm-cms-image-preview {
    display: grid;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-image-preview video {
    display: block;
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    border-radius: var(--hm-cms-radius-sm);
    background: var(--hm-cms-dark);
  }
  .hm-cms-image-preview img {
    display: block;
    width: 100%;
    max-height: 220px;
    object-fit: contain;
    border-radius: var(--hm-cms-radius-sm);
    /* Cuadriculado: deja ver los logos con fondo transparente. */
    background: repeating-conic-gradient(var(--hm-cms-checker) 0 25%, #fff 0 50%) 50% / 16px 16px;
  }
  /*
   * Filas a «max-content»: la cuadrícula tiene alto acotado (se desplaza por
   * dentro) y con filas «auto» el navegador las encogía hasta el mínimo de
   * cada ficha para caber en los 300 px. Salían franjas de 10 px.
   */
  /*
   * Marco de encuadre: tiene la proporción del hueco de la página (la fija
   * encuadre-ui.js) y recorta igual que el sitio. La foto se arrastra dentro.
   */
  .hm-cms-encuadre-marco {
    position: relative;
    margin: 0 auto;
    overflow: hidden;
    border-radius: var(--hm-cms-radius-sm);
  }
  /* El video se queda los eventos del puntero y el arrastre no llegaba al
     marco: que los reciba el marco, como con una foto. */
  .hm-cms-encuadre-marco video {
    pointer-events: none;
  }
  .hm-cms-encuadre-marco.is-encuadre video,
  .hm-cms-encuadre-marco.is-encuadre img {
    width: 100%;
    height: 100%;
    max-height: none;
    object-fit: cover;
    user-select: none;
    -webkit-user-drag: none;
  }
  .hm-cms-encuadre-marco.is-movible {
    cursor: grab;
    touch-action: none;
    box-shadow: 0 0 0 1px var(--hm-cms-line-soft);
  }
  .hm-cms-encuadre-marco.is-arrastrando {
    cursor: grabbing;
  }
  .hm-cms-encuadre-marco.is-movible:focus-visible {
    outline: 3px solid var(--hm-cms-accent);
    outline-offset: 2px;
  }
  /* Una pista visual de que se puede mover, solo mientras no se arrastra. */
  .hm-cms-encuadre-marco.is-movible::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 2px dashed rgba(255, 255, 255, 0.7);
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--hm-cms-duration) var(--hm-cms-ease);
  }
  .hm-cms-encuadre-marco.is-movible:hover::after,
  .hm-cms-encuadre-marco.is-arrastrando::after {
    opacity: 1;
  }
  .hm-cms-encuadre-ayuda {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .hm-cms-media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    grid-auto-rows: max-content;
    gap: 6px;
    max-height: 300px;
    margin: 0 -2px;
    padding: 2px;
    overflow: auto;
  }
  .hm-cms-media-item {
    display: grid;
    align-content: start;
    gap: 4px;
    min-width: 0;
    min-height: auto;
    padding: 4px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius-sm);
    background: #fff;
    color: var(--hm-cms-ink);
    font-weight: 400;
    text-align: left;
  }
  .hm-cms-media-item:hover {
    border-color: var(--hm-cms-primary);
    background: #fff;
  }
  .hm-cms-media-item.selected {
    border-color: var(--hm-cms-primary);
    box-shadow: 0 0 0 2px var(--hm-cms-primary);
  }
  .hm-cms-media-item video,
  .hm-cms-media-item img {
    display: block;
    width: 100%;
    height: 84px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-media-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11.5px;
    line-height: 1.3;
    color: var(--hm-cms-ink-softer);
  }
  .hm-cms-media-usage {
    font: 600 10.5px/1.2 var(--hm-cms-font);
    color: var(--hm-cms-primary-dark);
  }
  .hm-cms-media-missing {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    height: 84px;
    border-radius: 4px;
    background: var(--hm-cms-surface-soft);
    color: var(--hm-cms-danger-ink);
    font: 600 11px/1.3 var(--hm-cms-font);
    text-align: center;
  }
  .hm-cms-media-wide {
    grid-column: 1 / -1;
  }
  .hm-cms-gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .hm-cms-gallery-thumb {
    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 0;
    aspect-ratio: 1;
    padding: 0;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: var(--hm-cms-radius-sm);
    background: var(--hm-cms-line-softer);
    transition: none;
  }
  .hm-cms-gallery-thumb:hover {
    border-color: var(--hm-cms-primary);
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-gallery-thumb:focus-visible {
    outline: 3px solid var(--hm-cms-primary);
    outline-offset: 2px;
  }
  .hm-cms-gallery-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hm-cms-gallery-featured {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(15, 36, 51, 0.78);
    color: var(--hm-cms-on-dark-warn);
  }

  /* Zona para subir: el input queda oculto; el rótulo es la superficie. */
  .hm-cms-drop {
    position: relative;
    display: grid;
    gap: 6px;
  }
  .hm-cms-drop-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .hm-cms-drop-label {
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 16px 12px;
    border: 1.5px dashed var(--hm-cms-line-soft);
    border-radius: var(--hm-cms-radius);
    background: #fff;
    color: var(--hm-cms-ink-soft);
    font: 400 13.5px/1.4 var(--hm-cms-font);
    text-align: center;
    cursor: pointer;
    transition: border-color var(--hm-cms-duration) var(--hm-cms-ease),
      background-color var(--hm-cms-duration) var(--hm-cms-ease);
  }
  .hm-cms-drop-label strong {
    font-weight: 600;
    color: var(--hm-cms-primary-dark);
  }
  .hm-cms-drop-label > .hm-cms-icon {
    color: var(--hm-cms-primary);
  }
  .hm-cms-drop-label:hover,
  .hm-cms-drop.is-over .hm-cms-drop-label {
    border-color: var(--hm-cms-primary);
    background: var(--hm-cms-primary-light);
  }
  .hm-cms-drop-input:focus-visible + .hm-cms-drop-label {
    border-color: var(--hm-cms-primary);
    box-shadow: var(--hm-cms-ring);
  }
  .hm-cms-drop-file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--hm-cms-ok-line);
    border-radius: var(--hm-cms-radius-sm);
    background: var(--hm-cms-ok-bg);
    color: var(--hm-cms-ok-ink);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  /* ─── Editor de texto con formato ───────────────────────────────────── */
  .hm-cms-rt {
    overflow: hidden;
    border: 1px solid var(--hm-cms-line-soft);
    border-radius: var(--hm-cms-radius-sm);
    background: #fff;
  }
  .hm-cms-rt:focus-within {
    border-color: var(--hm-cms-primary);
    box-shadow: var(--hm-cms-ring);
  }
  .hm-cms-rt-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--hm-cms-line-softer);
    background: var(--hm-cms-surface-soft);
  }
  /*
   * 32 px queda por encima del mínimo de 24 px de WCAG 2.2 SC 2.5.8 y deja la
   * barra en una sola fila; con puntero grueso vuelven a 44 px más abajo.
   */
  .hm-cms-rt-btn {
    min-width: 32px;
    min-height: 32px;
    height: 32px;
    padding: 0 7px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--hm-cms-ink-soft);
    font-size: 13px;
    line-height: 1;
    box-shadow: none;
  }
  .hm-cms-rt-btn:hover {
    border-color: var(--hm-cms-line-soft);
    background: #fff;
    color: var(--hm-cms-primary-dark);
  }
  .hm-cms-rt-btn:focus-visible {
    outline: 2px solid var(--hm-cms-primary);
    outline-offset: -2px;
  }
  .hm-cms-rt-btn[aria-pressed="true"] {
    border-color: var(--hm-cms-primary);
    background: var(--hm-cms-primary-light);
    color: var(--hm-cms-primary-dark);
  }
  .hm-cms-rt-bold { font-weight: 800; }
  .hm-cms-rt-italic { font-style: italic; font-family: Georgia, serif; }
  .hm-cms-rt-sep {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--hm-cms-line-soft);
  }
  .hm-cms-rt-spacer { flex: 1; }
  @media (pointer: coarse) {
    .hm-cms-rt-btn {
      min-width: 44px;
      min-height: 44px;
      height: 44px;
    }
  }
  .hm-cms-rt textarea {
    display: block;
    width: 100%;
    min-height: 260px;
    padding: 12px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    font: 400 14.5px/1.65 var(--hm-cms-font);
    resize: vertical;
  }
  .hm-cms-rt textarea:focus-visible {
    box-shadow: none;
  }
  /*
   * La vista previa se acerca al sitio sin copiarlo: es una ayuda para no
   * publicar a ciegas, no una maqueta fiel.
   */
  .hm-cms-rt-preview {
    max-height: 420px;
    overflow-y: auto;
    padding: 12px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--hm-cms-ink);
  }
  .hm-cms-rt-preview h2 { margin: 0 0 8px; font-size: 18px; color: var(--hm-cms-dark); }
  .hm-cms-rt-preview h3 { margin: 12px 0 6px; font-size: 15px; color: var(--hm-cms-dark); }
  .hm-cms-rt-preview p { margin: 0 0 10px; }
  .hm-cms-rt-preview ul,
  .hm-cms-rt-preview ol { margin: 0 0 10px; padding-left: 20px; }
  .hm-cms-rt-preview ul { list-style: disc; }
  .hm-cms-rt-preview ol { list-style: decimal; }
  .hm-cms-rt-preview li { margin-bottom: 4px; }
  .hm-cms-rt-preview blockquote {
    margin: 0 0 10px;
    padding: 6px 12px;
    border-left: 3px solid var(--hm-cms-primary);
    background: var(--hm-cms-alt);
    color: var(--hm-cms-ink-softer);
  }
  .hm-cms-rt-preview a { color: var(--hm-cms-primary); }
  .hm-cms-rt-preview :first-child { margin-top: 0; }
  .hm-cms-rt-preview :last-child { margin-bottom: 0; }
  /* P2-23: el editor visual reutiliza el aspecto de la vista previa. */
  .hm-cms-rt-visual {
    min-height: 260px;
    max-height: 520px;
    outline: none;
    cursor: text;
  }
  .hm-cms-rt:focus-within .hm-cms-rt-visual:focus {
    box-shadow: inset 0 0 0 2px var(--hm-cms-primary);
  }
  .hm-cms-rt-enlace {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--hm-cms-line-softer);
    background: var(--hm-cms-alt);
  }
  .hm-cms-rt-help {
    padding: 6px 12px 8px;
    border-top: 1px solid var(--hm-cms-line-softer);
    font-size: 12px;
    color: var(--hm-cms-muted-soft);
  }

  /* ─── Revisiones, historial y administración ────────────────────────── */
  .hm-cms-revisions,
  .hm-cms-job-list {
    display: grid;
    gap: 8px;
  }
  .hm-cms-revision-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 10px 10px 14px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-revision-item.current {
    border-color: var(--hm-cms-info-line);
    background: var(--hm-cms-info-bg);
  }
  .hm-cms-revision-info {
    display: grid;
    gap: 2px;
  }
  .hm-cms-revision-version {
    font: 600 13.5px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-revision-date {
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-job {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-job-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font: 600 14px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-log {
    max-height: 150px;
    overflow: auto;
    padding: 8px;
    border-radius: var(--hm-cms-radius-sm);
    background: var(--hm-cms-badge-dark-bg);
    color: var(--hm-cms-badge-dark-ink);
    font: 11px/1.5 var(--hm-cms-mono);
    white-space: pre-wrap;
  }
  .hm-cms-admin {
    display: grid;
    gap: 12px;
  }
  .hm-cms-admin-section {
    display: grid;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-admin h3 {
    font: 600 14.5px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  /*
   * tabindex 0 porque la lista tiene su propio scroll: sin él, quien navega
   * con teclado no puede desplazarla (axe: scrollable-region-focusable).
   */
  .hm-cms-admin-list {
    display: grid;
    gap: 1px;
    max-height: 320px;
    overflow-y: auto;
    padding: 0;
    list-style: none;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius-sm);
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-admin-list li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 2px 12px;
    padding: 7px 10px;
    background: #fff;
    font-size: 13px;
  }
  /* Los eventos de acceso se distinguen: son los que se revisan cuando se
     sospecha de un intento de entrada ajeno. */
  .hm-cms-admin-list li[data-security] {
    box-shadow: inset 3px 0 0 var(--hm-cms-accent);
  }

  /* ─── Acceso ────────────────────────────────────────────────────────── */
  .hm-cms-login-form {
    width: 100%;
    max-width: 340px;
    margin: 24px auto 0;
  }
  .hm-cms-login-head {
    display: grid;
    gap: 4px;
  }
  .hm-cms-login-head h3 {
    font: 600 18px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-login-form button[type="submit"] {
    width: 100%;
    min-height: 42px;
  }

  /* ─── Confirmaciones ────────────────────────────────────────────────── */
  .hm-cms-dialog-layer {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgba(15, 36, 51, 0.45);
    animation: hm-cms-fade 120ms var(--hm-cms-ease);
  }
  .hm-cms-dialog {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px 14px;
    width: min(440px, 100%);
    padding: 20px;
    border-radius: var(--hm-cms-radius-lg);
    background: #fff;
    color: var(--hm-cms-ink);
    box-shadow: var(--hm-cms-shadow-lg);
    animation: hm-cms-rise 160ms var(--hm-cms-ease);
  }
  .hm-cms-dialog-icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--hm-cms-info-bg);
    color: var(--hm-cms-primary);
  }
  .hm-cms-dialog.is-danger .hm-cms-dialog-icon {
    background: var(--hm-cms-danger-bg);
    color: var(--hm-cms-danger-ink);
  }
  .hm-cms-dialog-body {
    display: grid;
    gap: 6px;
    padding-top: 6px;
  }
  .hm-cms-dialog-body h2 {
    font: 600 16px/1.35 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-dialog-body p {
    font-size: 14px;
    line-height: 1.5;
    color: var(--hm-cms-ink-softer);
  }
  .hm-cms-dialog-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }
  @keyframes hm-cms-fade {
    from { opacity: 0; }
  }
  @keyframes hm-cms-rise {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
  }

  /* ─── Aviso de deshacer ─────────────────────────────────────────────── */
  /*
   * Se ancla encima de la barra, que es fija abajo a la izquierda.
   * "pointer-events: auto" porque el shell entero es "none".
   */
  .hm-cms-undo {
    pointer-events: auto;
    position: fixed;
    z-index: 40;
    left: 16px;
    bottom: 80px;
    max-width: min(440px, calc(100vw - 32px));
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 10px 10px 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--hm-cms-radius);
    background: var(--hm-cms-dark);
    color: #fff;
    font-size: 13.5px;
    line-height: 1.4;
    box-shadow: var(--hm-cms-shadow-lg);
  }
  .hm-cms-undo-texto { flex: 1; }
  .hm-cms-undo-aviso {
    display: block;
    margin-top: 2px;
    color: var(--hm-cms-on-dark-warn);
    font-size: 12px;
  }
  .hm-cms-undo-cuenta {
    font-variant-numeric: tabular-nums;
    color: var(--hm-cms-line-soft);
    font-size: 12px;
  }
  .hm-cms-undo-btn {
    min-height: 34px;
    white-space: nowrap;
  }

  /* ─── Publicación ───────────────────────────────────────────────────── */
  .hm-cms-pending-list {
    display: grid;
    gap: 1px;
    padding: 0;
    overflow: hidden;
    list-style: none;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-pending-list li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: #fff;
  }
  .hm-cms-pending-text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .hm-cms-pending-text strong {
    font-weight: 600;
    color: var(--hm-cms-ink);
  }
  .hm-cms-pending-text span,
  .hm-cms-pending-when {
    font-size: 12.5px;
    color: var(--hm-cms-muted-soft);
  }
  .hm-cms-pending-when {
    flex: none;
    white-space: nowrap;
  }
  .hm-cms-progress {
    display: grid;
    justify-items: center;
    gap: 14px;
    padding: 40px 16px;
    text-align: center;
  }
  .hm-cms-progress > div {
    display: grid;
    gap: 6px;
  }
  .hm-cms-spinner-lg {
    width: 32px;
    height: 32px;
    border-width: 3px;
    color: var(--hm-cms-primary);
  }
  .hm-cms-progress-clock {
    font: 600 20px/1 var(--hm-cms-font);
    font-variant-numeric: tabular-nums;
    color: var(--hm-cms-ink-soft);
  }
  .hm-cms-result {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--hm-cms-line);
    border-radius: var(--hm-cms-radius);
    background: #fff;
  }
  .hm-cms-result > div {
    display: grid;
    gap: 4px;
  }
  .hm-cms-result h3 {
    font: 600 16px/1.3 var(--hm-cms-font);
    color: var(--hm-cms-ink);
  }
  .hm-cms-result.is-ok { border-color: var(--hm-cms-ok-line); background: var(--hm-cms-ok-bg); }
  .hm-cms-result.is-ok > .hm-cms-icon { color: var(--hm-cms-ok-ink); }
  .hm-cms-result.is-warn { border-color: var(--hm-cms-warn-line); background: var(--hm-cms-warn-bg); }
  .hm-cms-result.is-warn > .hm-cms-icon { color: var(--hm-cms-warn-icon); }
  .hm-cms-result.is-danger { border-color: var(--hm-cms-danger-line); background: var(--hm-cms-danger-bg); }
  .hm-cms-result.is-danger > .hm-cms-icon { color: var(--hm-cms-danger-ink); }
  .hm-cms-count-pill {
    display: inline-block;
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--hm-cms-surface-soft);
    color: var(--hm-cms-ink-softer);
    font-size: 11.5px;
    font-weight: 600;
  }

  /* ─── Etiqueta al pasar el puntero ──────────────────────────────────── */
  .hm-cms-chip {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 15;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 999px;
    background: var(--hm-cms-dark);
    color: #fff;
    font: 600 12px/1.2 var(--hm-cms-font);
    white-space: nowrap;
    box-shadow: var(--hm-cms-shadow-md);
    pointer-events: none;
  }

  /* ─── Pequeñas piezas ───────────────────────────────────────────────── */
  /* H-05: spinner para operaciones asíncronas. Toma el color del botón. */
  @keyframes hm-cms-spin {
    to { transform: rotate(360deg); }
  }
  .hm-cms-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    opacity: 0.85;
    animation: hm-cms-spin 0.7s linear infinite;
    vertical-align: middle;
  }
  .hm-cms-skeleton {
    height: 44px;
    border-radius: var(--hm-cms-radius-sm);
    background: linear-gradient(90deg, var(--hm-cms-line-softer) 25%, var(--hm-cms-surface-soft) 50%, var(--hm-cms-line-softer) 75%);
    background-size: 200% 100%;
    animation: hm-cms-shimmer 1.5s ease infinite;
  }
  @keyframes hm-cms-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ─── Registro de actividad: lo técnico, plegado (P2-22) ───────────── */
  .hm-cms-tecnico summary {
    cursor: pointer;
    font-size: 12px;
    color: var(--hm-cms-muted-soft);
  }

  /* ─── Valor de cada versión (P2-26) ─────────────────────────────────── */
  .hm-cms-revision-value {
    display: block;
    margin-top: 4px;
    color: var(--hm-cms-ink);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .hm-cms-revision-thumb {
    display: block;
    margin-top: 6px;
    width: 96px;
    height: 64px;
    object-fit: cover;
    border-radius: 4px;
  }

  /* ─── Archivo que no vale (P2-19) ───────────────────────────────────── */
  .hm-cms-drop.has-error .hm-cms-drop-file {
    color: var(--hm-cms-error);
  }

  /* ─── Guardado sin publicar (P2-17) ─────────────────────────────────── */
  .hm-cms-sin-publicar {
    outline: 2px dashed var(--hm-cms-warn-ink);
    outline-offset: 2px;
  }

  /* ─── Entrar sin sesión (P2-18) ─────────────────────────────────────── */
  .hm-cms-entrar {
    pointer-events: auto;
    position: fixed;
    z-index: 25;
    left: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    min-height: 48px;
    padding: 0 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    background: var(--hm-cms-dark);
    color: #fff;
    font: 600 14px/1 var(--hm-cms-font);
    box-shadow: var(--hm-cms-shadow-lg);
    cursor: pointer;
  }
  .hm-cms-entrar[hidden] {
    display: none;
  }
  /* En escritorio va dentro de la barra; el flotante es para tablet y móvil. */
  @media (min-width: 1101px) {
    .hm-cms-entrar {
      display: none;
    }
  }

  /* ─── Ir a otra página (P1-07) ──────────────────────────────────────── */
  .hm-cms-page-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 4px;
  }
  .hm-cms-page-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--hm-cms-line-softer);
    border-radius: var(--hm-cms-radius);
    color: var(--hm-cms-ink);
    text-decoration: none;
    font: 600 14px/1.3 var(--hm-cms-font);
  }
  .hm-cms-page-link:hover,
  .hm-cms-page-link:focus-visible {
    border-color: var(--hm-cms-accent);
  }
  .hm-cms-page-link[aria-current='page'] {
    background: var(--hm-cms-line-softer);
  }
  .hm-cms-page-link .hm-cms-muted {
    font-weight: 400;
    font-size: 12.5px;
  }
  .hm-cms-go-link {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 10px;
    text-decoration: none;
    color: inherit;
  }

  /* ─── Pantallas pequeñas y táctiles ─────────────────────────────────── */
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
    .hm-cms-panel-body {
      padding: 16px;
    }
    .hm-cms-panel-body .hm-cms-footer {
      margin: 0 -16px -16px;
      padding-left: 16px;
      padding-right: 16px;
    }
    /* Más ancho para los campos: en 390 px cada píxel de relleno cuenta. */
    .hm-cms-form-section {
      padding: 12px;
    }
    .hm-cms-undo {
      left: 8px;
      right: 8px;
      bottom: 72px;
      max-width: none;
    }
    .hm-cms-dialog-actions {
      flex-direction: column-reverse;
    }
    .hm-cms-dialog-actions button {
      width: 100%;
    }
  }
  /* 16 px evita que iOS amplíe la página al enfocar un campo. */
  @media (pointer: coarse) {
    :where(.hm-cms-shell) input,
    :where(.hm-cms-shell) select,
    :where(.hm-cms-shell) textarea {
      font-size: 16px;
    }
  }

  /*
   * UI-01: prefers-reduced-motion — sin transiciones ni animaciones cuando
   * la persona lo pide.
   */
  @media (prefers-reduced-motion: reduce) {
    .hm-cms-shell *,
    .hm-cms-shell *::before,
    .hm-cms-panel,
    .hm-cms-backdrop {
      transition-duration: 0ms !important;
      animation: none !important;
    }
    :where(.hm-cms-shell) button:where(:active:not([disabled])) {
      transform: none;
    }
    .hm-cms-skeleton {
      background: var(--hm-cms-line-softer);
    }
  }
`;
