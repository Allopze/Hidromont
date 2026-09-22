/**
 * `ejecutarUnaVez` es la guarda contra el doble envío del panel.
 *
 * Contexto: un inventario del overlay dio 4 de 7 formularios y 5 de 11
 * acciones de escritura con alguna protección, y la que había era un efecto
 * colateral del `disabled` que pone `setButtonLoading`. En el formulario de
 * imagen, un doble clic duplicaba la subida del archivo.
 */
import { describe, expect, it, vi } from 'vitest';
import { ejecutarUnaVez, estaOcupado } from '../scripts/cms/overlay/submit';

/** Un doble mínimo de elemento: solo hace falta `dataset`. */
function ambito() {
  return { dataset: {} as Record<string, string> };
}

/**
 * Doble de botón con la superficie que usa `setButtonLoading`. Se construye a
 * mano en vez de montar un DOM, igual que hace `cms-mobile-menu.test.ts`: es
 * lógica de estado y no necesita navegador.
 */
function boton() {
  const b = {
    disabled: false,
    innerHTML: 'Guardar',
    textContent: 'Guardar',
    atributos: {} as Record<string, string>,
    closest: () => b,
    hasAttribute: (n: string) => n in b.atributos,
    getAttribute: (n: string) => b.atributos[n] ?? null,
    setAttribute: (n: string, v: string) => {
      b.atributos[n] = v;
    },
    removeAttribute: (n: string) => {
      delete b.atributos[n];
    },
  };
  return b;
}

describe('ejecutarUnaVez', () => {
  it('ejecuta la tarea y devuelve su resultado', async () => {
    const a = ambito();
    await expect(ejecutarUnaVez(a, async () => 'listo')).resolves.toBe('listo');
  });

  it('ignora la segunda llamada mientras la primera sigue viva', async () => {
    const a = ambito();
    const tarea = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 'primera';
    });

    const enVuelo = ejecutarUnaVez(a, tarea);
    // El doble clic: llega antes de que la primera termine.
    const segunda = await ejecutarUnaVez(a, tarea);

    expect(segunda).toBeUndefined();
    expect(await enVuelo).toBe('primera');
    expect(tarea).toHaveBeenCalledTimes(1);
  });

  it('vuelve a admitir trabajo una vez terminado', async () => {
    const a = ambito();
    await ejecutarUnaVez(a, async () => 1);
    await expect(ejecutarUnaVez(a, async () => 2)).resolves.toBe(2);
  });

  it('libera el ámbito aunque la tarea falle', async () => {
    const a = ambito();
    await expect(
      ejecutarUnaVez(a, async () => {
        throw new Error('fallo de red');
      })
    ).rejects.toThrow('fallo de red');

    expect(estaOcupado(a)).toBe(false);
    // Y el reintento es posible: es el caso real tras un error de red.
    await expect(ejecutarUnaVez(a, async () => 'reintento')).resolves.toBe('reintento');
  });

  it('restaura el botón en el camino feliz, no solo en el de error', async () => {
    // Tres llamadas del panel lo hacían solo en el `catch` y dependían de un
    // repintado para el resto; si ese repintado fallaba, el botón se quedaba
    // colgado en «Respaldando...» para siempre.
    const a = ambito();
    const btn = boton();

    await ejecutarUnaVez(a, async () => 'ok', { boton: btn, textoCarga: 'Guardando...' });

    expect(btn.disabled).toBe(false);
    expect(btn.atributos['data-loading']).toBeUndefined();
    expect(btn.innerHTML).toBe('Guardar');
  });

  it('marca el botón mientras trabaja', async () => {
    const a = ambito();
    const btn = boton();

    await ejecutarUnaVez(
      a,
      async () => {
        expect(btn.disabled).toBe(true);
        expect(btn.atributos['data-loading']).toBe('true');
        expect(btn.innerHTML).toContain('Guardando...');
      },
      { boton: btn, textoCarga: 'Guardando...' }
    );
  });

  it('tolera que el repintado haya destruido el botón', async () => {
    // Varios flujos repintan el panel entero al terminar, así que el botón que
    // se pasó al empezar puede no existir al restaurar.
    const a = ambito();
    const huerfano = { closest: () => null };

    await expect(ejecutarUnaVez(a, async () => 'ok', { boton: huerfano })).resolves.toBe('ok');
    expect(estaOcupado(a)).toBe(false);
  });

  it('un ámbito ausente no ejecuta nada', async () => {
    const tarea = vi.fn();
    await expect(ejecutarUnaVez(null as unknown as HTMLElement, tarea)).resolves.toBeUndefined();
    expect(tarea).not.toHaveBeenCalled();
  });
});
