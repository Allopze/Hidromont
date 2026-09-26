import { describe, expect, it } from 'vitest';
import { pareceNombreDeArchivo } from '../scripts/cms/overlay/alt';

describe('P2-13: descripciones que son nombres de archivo', () => {
  it('reconoce códigos de cámara, numeraciones y el nombre del propio archivo', () => {
    for (const [alt, archivo] of [
      ['DSCF2109', 'DSCF2109.webp'],
      ['001', '001.jpg'],
      ['101 1746', ''],
      ['IMG_20161206_113612', ''],
      ['whatsapp image 2026 07 03 at 15.25.49', ''],
      ['compuerta-plana-azul', '/uploads/cms/compuerta-plana-azul.webp'],
      ['', ''],
    ]) {
      expect(pareceNombreDeArchivo(alt, archivo), alt).toBe(true);
    }
  });

  it('acepta descripciones reales', () => {
    for (const alt of [
      'Compuertas planas azules instaladas entre machones de hormigón',
      'Tanque de GLP 30.000 galones en fabricación en taller',
      'Válvula DN 1600 instalada en el túnel',
    ]) {
      expect(pareceNombreDeArchivo(alt, 'foto.webp'), alt).toBe(false);
    }
  });
});
