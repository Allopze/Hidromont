/**
 * Arranque del overlay del CMS.
 *
 * Importar este módulo tiene efectos: `shell.js` inyecta la hoja de estilos y
 * monta la barra en cuanto se evalúa. Por eso `index.ts` lo carga con
 * `import()` dinámico y solo cuando el overlay está activo.
 */

import { pruneDrafts } from './drafts';
import { ensureSession } from './auth';
import { registerEvents } from './events';
import { mountMobileMenu } from '../mobile-menu';

export function mount() {
  registerEvents();
  mountMobileMenu();

  // E-2: limpieza de las copias caducadas, una vez por carga. Va antes de
  // ensureSession() para que nunca se ofrezca una copia de hace un mes.
  pruneDrafts();
  ensureSession();
}
