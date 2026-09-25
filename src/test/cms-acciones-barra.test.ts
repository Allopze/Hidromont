/**
 * Guarda anti-deriva de las acciones del CMS.
 *
 * Las acciones estaban escritas dos veces —`shell.js` para la barra de
 * escritorio y `mobile-menu.ts` para el panel flotante— sin nada que atara las
 * copias. Ya habían divergido: la barra llevaba `title` explicando qué hace
 * «Exportar y validar» y qué incluye «Administrar», y el panel móvil los había
 * perdido.
 *
 * Estas pruebas van sobre el texto de los archivos, que es el patrón que ya
 * usan los demás guardas contra deriva de este proyecto
 * (`design-tokens.test.ts`, `content-vocabulary.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACCIONES_BARRA,
  botonesDeBarra,
  DENTRO_DEL_MENU,
  FUERA_DEL_MENU,
} from '../scripts/cms/overlay/actions';

const shell = readFileSync('src/scripts/cms/overlay/shell.js', 'utf8');
const movil = readFileSync('src/scripts/cms/mobile-menu.ts', 'utf8');

describe('acciones de la barra', () => {
  it('ninguna superficie escribe sus botones a mano', () => {
    // Si alguien vuelve a pegar un <button data-action> en cualquiera de las
    // dos, la deriva empieza otra vez.
    expect(shell).not.toMatch(
      /<button[^>]*data-action="(collections|gallery|jobs|toggle-edit-guides|admin|publish|logout)"/
    );
    expect(movil).not.toMatch(
      /<button[^>]*data-action="(collections|gallery|jobs|toggle-edit-guides|admin|publish|logout)"/
    );
  });

  it('las dos superficies se pintan desde la misma lista', () => {
    // La barra de escritorio reparte la lista entre sus botones y el menú
    // «Más»; el panel móvil la pinta entera.
    expect(shell).toContain('botonesDeBarra({ filtro: FUERA_DEL_MENU })');
    expect(shell).toContain('botonesDeBarra({ filtro: DENTRO_DEL_MENU })');
    expect(movil).toContain('botonesDeBarra({ conTitulo: false })');
  });

  it('el reparto de la barra no pierde ni duplica ninguna acción', () => {
    const fuera = ACCIONES_BARRA.filter(FUERA_DEL_MENU).map((a) => a.accion);
    const dentro = ACCIONES_BARRA.filter(DENTRO_DEL_MENU).map((a) => a.accion);
    expect([...fuera, ...dentro].sort()).toEqual(ACCIONES_BARRA.map((a) => a.accion).sort());
    expect(fuera.filter((a) => dentro.includes(a))).toEqual([]);
    // Publicar nunca se esconde en el menú.
    expect(fuera).toContain('publish');
  });

  it('cada acción tiene su manejador en la delegación de eventos', () => {
    // Una acción sin manejador es un botón que no hace nada: el modo de fallo
    // que este guarda tiene que cazar cada acción nueva.
    const eventos = readFileSync('src/scripts/cms/overlay/events.js', 'utf8');
    const huerfanas = ACCIONES_BARRA.filter(
      (a) => !eventos.includes(`action === '${a.accion}'`)
    ).map((a) => a.accion);
    expect(huerfanas).toEqual([]);
  });

  it('el marcado lleva data-auth: sin sesión la barra no ofrece acciones', () => {
    // Antes «Salir» aparecía sin haber entrado, y Colecciones/Galería/Historial
    // invitaban a clics que fallaban.
    const html = botonesDeBarra();
    const botones = html.match(/<button/g) ?? [];
    expect(botones.length).toBe(ACCIONES_BARRA.length);
    expect((html.match(/data-auth/g) ?? []).length).toBe(ACCIONES_BARRA.length);
    expect((html.match(/hidden/g) ?? []).length).toBe(ACCIONES_BARRA.length);
  });

  it('las explicaciones largas solo salen donde hay puntero', () => {
    const conPuntero = botonesDeBarra();
    const sinPuntero = botonesDeBarra({ conTitulo: false });
    expect(conPuntero).toContain('title="Muestra qué cambios saldrán');
    expect(sinPuntero).not.toContain('title=');
  });

  it('las guías se ofrecen solo en superficies táctiles y empiezan apagadas', () => {
    const action = ACCIONES_BARRA.find((item) => item.accion === 'toggle-edit-guides');
    expect(action).toMatchObject({ soloTactil: true, pulsable: true });
    expect(botonesDeBarra()).toContain('data-touch-only aria-pressed="false"');
    expect(readFileSync('src/scripts/cms/overlay/styles.js', 'utf8')).toContain(
      'body.hm-cms-guides-visible [data-cms-editable-ready]'
    );
  });

  it('escapa las comillas de los títulos', () => {
    // El título de «publish» lleva paréntesis y nombres de variable; si algún
    // día lleva comillas, no debe romper el atributo.
    const html = botonesDeBarra();
    expect(html).not.toMatch(/title="[^"]*"[^ >]/);
  });
});
