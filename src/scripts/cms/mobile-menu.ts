import { botonesDeBarra } from './overlay/actions';

type AttributeTarget = {
  setAttribute(name: string, value: string): void;
};

type Launcher = AttributeTarget & {
  focus(): void;
};

type Sheet = AttributeTarget & {
  classList: {
    add(value: string): void;
    remove(value: string): void;
  };
};

export function createMobileMenuController({
  launcher,
  sheet,
  onOpen,
}: {
  launcher: Launcher;
  sheet: Sheet;
  onOpen?: () => void;
}) {
  let isOpen = false;

  function setOpen(nextOpen: boolean, restoreFocus = false) {
    isOpen = nextOpen;
    sheet.classList[nextOpen ? 'add' : 'remove']('open');
    launcher.setAttribute('aria-expanded', String(nextOpen));
    sheet.setAttribute('aria-hidden', String(!nextOpen));
    // Al abrir, el foco entra en el panel; al cerrar con Escape, vuelve al
    // lanzador. `onOpen` es opcional para que las pruebas del controlador
    // puedan construirlo con dos objetos mínimos, sin DOM.
    if (nextOpen) onOpen?.();
    if (!nextOpen && restoreFocus) launcher.focus();
  }

  return {
    open() {
      setOpen(true);
    },
    close(restoreFocus = false) {
      setOpen(false, restoreFocus);
    },
    toggle() {
      setOpen(!isOpen);
    },
    handleKeydown(event: { key: string }) {
      if (event.key !== 'Escape' || !isOpen) return false;
      setOpen(false, true);
      return true;
    },
  };
}

/*
 * B-3: los colores salen de las variables que declara la hoja del overlay
 * (`--hm-cms-*`), que a su vez leen los tokens del sitio. Este archivo se
 * inyecta siempre después, así que las variables ya existen en :root.
 *
 * Las sombras siguen en `rgba(15,36,51,…)`: es el mismo azul oscuro, pero una
 * variable de color no se puede interpolar dentro de rgba() sin cambiar el
 * formato de los tokens del sitio, que es un cambio de otro alcance.
 */
export const mobileMenuStyles = `
  .hm-cms-mobile-launcher,
  .hm-cms-mobile-sheet {
    display: none;
  }
  @media (max-width: 640px) {
    .hm-cms-bar {
      display: none;
    }
    .hm-cms-mobile-launcher {
      pointer-events: auto;
      position: fixed;
      left: 12px;
      bottom: calc(12px + env(safe-area-inset-bottom));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 48px;
      min-height: 48px;
      padding: 8px 16px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      background: var(--hm-cms-dark);
      color: #fff;
      box-shadow: 0 12px 32px rgba(15, 36, 51, 0.28);
      font: 700 14px/1 var(--hm-cms-font, Inter, system-ui, sans-serif);
      cursor: pointer;
    }
    /* Sin sesión el launcher queda oculto: el atributo hidden debe ganarle a
       la regla display:inline-flex de arriba. */
    .hm-cms-mobile-launcher[hidden] {
      display: none;
    }
    .hm-cms-panel.open ~ .hm-cms-mobile-launcher {
      display: none;
    }
    .hm-cms-mobile-launcher:focus-visible,
    .hm-cms-mobile-sheet button:focus-visible {
      outline: 3px solid var(--hm-cms-accent);
      outline-offset: 3px;
    }
    .hm-cms-mobile-sheet {
      pointer-events: auto;
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: calc(8px + env(safe-area-inset-bottom));
      z-index: 2;
      max-height: calc(100dvh - 24px - env(safe-area-inset-bottom));
      overflow-y: auto;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--hm-cms-radius-lg, 12px);
      background: var(--hm-cms-dark);
      color: #fff;
      box-shadow: 0 20px 48px rgba(15, 36, 51, 0.36);
    }
    .hm-cms-mobile-sheet.open {
      display: grid;
      gap: 12px;
    }
    .hm-cms-mobile-sheet-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .hm-cms-mobile-sheet-actions {
      display: grid;
      gap: 8px;
    }
    .hm-cms-mobile-sheet button {
      justify-content: flex-start;
      min-width: 44px;
      min-height: 48px;
      border: 1px solid var(--hm-cms-primary);
      border-radius: var(--hm-cms-radius-sm, 6px);
      padding: 10px 14px;
      background: var(--hm-cms-primary);
      color: #fff;
      font: 600 15px/1.2 var(--hm-cms-font, Inter, system-ui, sans-serif);
      text-align: left;
      cursor: pointer;
    }
    .hm-cms-mobile-sheet button.secondary {
      border-color: rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.08);
    }
    .hm-cms-mobile-sheet button[aria-pressed="true"] {
      border-color: var(--hm-cms-accent);
      box-shadow: 0 0 0 2px rgba(0, 166, 214, 0.2);
    }
    .hm-cms-mobile-sheet [data-mobile-close] {
      width: auto;
      justify-content: center;
      text-align: center;
    }
    .hm-cms-mobile-state:empty {
      display: none;
    }
    .hm-cms-mobile-help {
      margin: 0;
      color: rgba(255, 255, 255, 0.88);
      font: 500 12px/1.45 Inter, system-ui, sans-serif;
    }
  }
`;

/**
 * Monta el menú móvil del CMS: lanzador flotante y panel de acciones.
 *
 * Antes esto devolvía su propio runtime como cadena, que se inyectaba en un
 * segundo `<script is:inline>`. Esa forma obligaba a reimplementar dentro del
 * string la misma lógica de apertura que `createMobileMenuController` ya
 * tenía probada, y las dos copias llevaban tiempo divergiendo. Ahora es una
 * función normal que usa el controlador de verdad.
 */
export function mountMobileMenu(): void {
  const shell = document.querySelector<HTMLElement>('.hm-cms-shell');
  const bar = shell?.querySelector('.hm-cms-bar');
  if (!shell || !bar || shell.dataset.mobileMenuReady === 'true') return;
  shell.dataset.mobileMenuReady = 'true';

  const style = document.createElement('style');
  style.textContent = mobileMenuStyles;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'hm-cms-mobile-launcher';
  launcher.textContent = 'Editar sitio';
  launcher.setAttribute('aria-label', 'Abrir menú para editar el sitio');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'hm-cms-mobile-sheet');
  launcher.setAttribute('data-auth', '');
  launcher.hidden = true;

  const sheet = document.createElement('section');
  sheet.id = 'hm-cms-mobile-sheet';
  sheet.className = 'hm-cms-mobile-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Acciones del CMS');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML = `
    <div class="hm-cms-mobile-sheet-header">
      <strong>Hidromont CMS</strong>
      <button type="button" class="secondary" data-mobile-close aria-label="Cerrar menú CMS">Cerrar</button>
    </div>
    <span class="hm-cms-badge hm-cms-mobile-state" data-mobile-state role="status" aria-live="polite" aria-atomic="true"></span>
    <p class="hm-cms-mobile-help">Toca un texto o una imagen del sitio para editarlo. Lo que guardes se verá en el sitio cuando pulses «Publicar cambios». «Guías editables» marca lo que se puede tocar.</p>
    <div class="hm-cms-mobile-sheet-actions">
      ${botonesDeBarra({ conTitulo: false })}
    </div>
  `;
  shell.append(launcher, sheet);

  const controller = createMobileMenuController({
    launcher,
    sheet,
    onOpen: () => sheet.querySelector<HTMLElement>('[data-mobile-close]')?.focus(),
  });

  launcher.addEventListener('click', () => controller.toggle());
  sheet
    .querySelector('[data-mobile-close]')
    ?.addEventListener('click', () => controller.close(true));
  sheet.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('[data-action]')) controller.close();
  });
  document.addEventListener('keydown', (event) => controller.handleKeydown(event));

  const sourceState = bar.querySelector('[data-state-badge]');
  const mobileState = sheet.querySelector('[data-mobile-state]');
  const syncState = () => {
    if (!mobileState) return;
    mobileState.textContent = sourceState?.textContent || '';
    mobileState.className = sourceState?.className || 'hm-cms-badge hm-cms-mobile-state';
    mobileState.classList.add('hm-cms-mobile-state');
  };
  syncState();
  if (sourceState) {
    new MutationObserver(syncState).observe(sourceState, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
}
