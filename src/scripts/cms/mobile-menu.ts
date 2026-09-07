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
}: {
  launcher: Launcher;
  sheet: Sheet;
}) {
  let isOpen = false;

  function setOpen(nextOpen: boolean, restoreFocus = false) {
    isOpen = nextOpen;
    sheet.classList[nextOpen ? 'add' : 'remove']('open');
    launcher.setAttribute('aria-expanded', String(nextOpen));
    sheet.setAttribute('aria-hidden', String(!nextOpen));
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
      padding: 8px 12px;
      border: 1px solid #d9e2ec;
      border-radius: 0;
      background: #0f2433;
      color: #fff;
      box-shadow: 0 12px 32px rgba(15, 36, 51, 0.28);
      font: 800 14px/1 Inter, system-ui, sans-serif;
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
      outline: 3px solid #00a6d6;
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
      border: 1px solid #d9e2ec;
      border-radius: 0;
      background: #0f2433;
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
      min-width: 44px;
      min-height: 48px;
      border: 1px solid rgba(255, 255, 255, 0.24);
      border-radius: 0;
      padding: 10px 12px;
      background: #0065a9;
      color: #fff;
      font: 700 14px/1.2 Inter, system-ui, sans-serif;
      text-align: left;
      cursor: pointer;
    }
    .hm-cms-mobile-sheet button.secondary {
      background: rgba(255, 255, 255, 0.1);
    }
    .hm-cms-mobile-sheet [data-mobile-close] {
      width: auto;
      text-align: center;
    }
    .hm-cms-mobile-state:empty {
      display: none;
    }
  }
`;

export function getMobileMenuRuntime() {
  return `(() => {
    const shell = document.querySelector('.hm-cms-shell');
    const bar = shell?.querySelector('.hm-cms-bar');
    if (!shell || !bar || shell.dataset.mobileMenuReady === 'true') return;
    shell.dataset.mobileMenuReady = 'true';

    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(mobileMenuStyles)};
    document.head.appendChild(style);

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'hm-cms-mobile-launcher';
    launcher.textContent = 'CMS';
    launcher.setAttribute('aria-label', 'Abrir menú CMS');
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
    sheet.innerHTML = \`
      <div class="hm-cms-mobile-sheet-header">
        <strong>Hidromont CMS</strong>
        <button type="button" class="secondary" data-mobile-close aria-label="Cerrar menú CMS">Cerrar</button>
      </div>
      <span class="hm-cms-badge hm-cms-mobile-state" data-mobile-state></span>
      <div class="hm-cms-mobile-sheet-actions">
        <button type="button" class="secondary" data-action="collections" data-auth hidden>Colecciones</button>
        <button type="button" class="secondary" data-action="gallery" data-auth hidden>Galería</button>
        <button type="button" class="secondary" data-action="jobs" data-auth hidden>Historial</button>
        <button type="button" data-action="publish" data-auth hidden>Exportar y validar</button>
        <button type="button" class="secondary" data-action="logout" data-auth hidden>Salir</button>
      </div>
    \`;
    shell.append(launcher, sheet);

    let open = false;
    const setOpen = (next, restoreFocus = false) => {
      open = next;
      sheet.classList.toggle('open', next);
      launcher.setAttribute('aria-expanded', String(next));
      sheet.setAttribute('aria-hidden', String(!next));
      if (next) sheet.querySelector('[data-mobile-close]')?.focus();
      if (!next && restoreFocus) launcher.focus();
    };

    launcher.addEventListener('click', () => setOpen(!open));
    sheet.querySelector('[data-mobile-close]')?.addEventListener('click', () => setOpen(false, true));
    sheet.addEventListener('click', (event) => {
      if (event.target.closest('[data-action]')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && open) setOpen(false, true);
    });

    const sourceState = bar.querySelector('[data-state-badge]');
    const mobileState = sheet.querySelector('[data-mobile-state]');
    const syncState = () => {
      mobileState.textContent = sourceState?.textContent || '';
      mobileState.className = sourceState?.className || 'hm-cms-badge hm-cms-mobile-state';
      mobileState.classList.add('hm-cms-mobile-state');
    };
    syncState();
    if (sourceState) new MutationObserver(syncState).observe(sourceState, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  })();`;
}
