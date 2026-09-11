/**
 * Punto de entrada para Passenger, el servidor de aplicaciones de cPanel.
 *
 * Passenger carga este archivo con `require()` desde su `node-loader.js`, y
 * Node se niega a hacer `require()` de un grafo ESM asíncrono. La versión
 * anterior era `await import('./cms/server.ts')`, y ese `await` de nivel
 * superior bastaba para que el arranque muriera con ERR_REQUIRE_ASYNC_MODULE
 * antes de ejecutar una sola línea del CMS.
 *
 * Sin `await`, la importación dinámica devuelve una promesa y este módulo
 * sigue siendo síncrono, que es lo que `require()` admite. El `catch` es
 * obligatorio: sin él, un fallo al arrancar el servidor quedaría como rechazo
 * no gestionado y Passenger solo mostraría su página de error genérica.
 */
import 'tsx/esm';

import('./cms/server.ts').catch((error) => {
  console.error('[CMS] No se pudo arrancar el servidor:');
  console.error(error);
  process.exit(1);
});
