/**
 * P2-11 (auditoría 2026-09): renombrar un cliente en la lista le quitaba el
 * logo, porque la clave del logo sale del nombre.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { ContentService } from '../services/contentService';

function montar() {
  const db = new Database(':memory:');
  migrate(db);
  const repo = new ContentRepository(db);
  const now = '2026-09-25T00:00:00.000Z';
  repo.upsertEntry({
    id: 'clientes.lista',
    kind: 'page',
    slug: '/clientes',
    title: 'Lista de clientes',
    fields: [{ key: 'nombres', type: 'list', value: ['Acciona', 'Colbún', 'Enel'] }],
    now,
  });
  repo.upsertEntry({
    id: 'clientes.logos',
    kind: 'settings',
    slug: 'clientes/logos',
    title: 'Logos de clientes',
    fields: [
      { key: 'logo-acciona', type: 'image', value: '/clientes/acciona.png' },
      { key: 'logo-colbun', type: 'image', value: '/clientes/colbun.png' },
      { key: 'logo-enel', type: 'image', value: '/clientes/enel.png' },
    ],
    now,
  });
  return { repo, servicio: new ContentService(repo, '/tmp/no-usado') };
}

describe('P2-11: logos de clientes al renombrar', () => {
  it('el logo pasa al nombre nuevo', () => {
    const { repo, servicio } = montar();
    servicio.updateField('clientes.lista', 'nombres', ['Acciona', 'Colbún S.A.', 'Enel']);
    expect(repo.findEntry('clientes.logos')?.fields['logo-colbun-s-a']?.value).toBe(
      '/clientes/colbun.png'
    );
  });

  it('añadir y quitar a la vez no mueve logos a ciegas', () => {
    const { repo, servicio } = montar();
    servicio.updateField('clientes.lista', 'nombres', ['Acciona', 'Colbún', 'Nuevo', 'Otro']);
    expect(repo.findEntry('clientes.logos')?.fields['logo-nuevo']).toBeUndefined();
  });

  it('no pisa el logo que el nombre nuevo ya tenía', () => {
    const { repo, servicio } = montar();
    servicio.updateField('clientes.lista', 'nombres', ['Acciona', 'Enel']);
    servicio.updateField('clientes.lista', 'nombres', ['Acciona', 'Colbún']);
    expect(repo.findEntry('clientes.logos')?.fields['logo-colbun']?.value).toBe(
      '/clientes/colbun.png'
    );
  });
});
