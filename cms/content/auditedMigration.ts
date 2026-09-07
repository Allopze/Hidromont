export interface AuditedFieldRow {
  entryId: string;
  key: string;
  value: unknown;
}

export interface AuditedValueRule {
  entryId: string;
  key: string;
  from: unknown;
  to: unknown;
  mode?: 'whole' | 'substring';
}

export interface AuditedMatch extends AuditedValueRule {
  nextValue: unknown;
}

export function findAuditedMatches(
  rows: readonly AuditedFieldRow[],
  rules: readonly AuditedValueRule[]
): AuditedMatch[] {
  const rowByField = new Map(rows.map((row) => [`${row.entryId}\0${row.key}`, row]));

  return rules.flatMap((rule) => {
    const row = rowByField.get(`${rule.entryId}\0${rule.key}`);
    if (!row) return [];

    if (rule.mode === 'substring') {
      if (
        typeof row.value !== 'string' ||
        typeof rule.from !== 'string' ||
        typeof rule.to !== 'string' ||
        !row.value.includes(rule.from)
      ) {
        return [];
      }
      return [{ ...rule, nextValue: row.value.replaceAll(rule.from, rule.to) }];
    }

    if (JSON.stringify(row.value) !== JSON.stringify(rule.from)) return [];
    return [{ ...rule, nextValue: rule.to }];
  });
}

export const auditedValueRules: AuditedValueRule[] = [
  {
    entryId: 'contact.form',
    key: 'requiredNote',
    from: 'Los campos marcados con * son obligatorios. Te contactaremos a la brevedad.',
    to: 'Los campos marcados con * son obligatorios. Le contactaremos después de revisar su consulta.',
  },
  {
    entryId: 'contacto.gracias',
    key: 'description',
    from: 'Tu mensaje ha sido enviado correctamente. El equipo de Hidromont Chile te contactará a la brevedad.',
    to: 'Su mensaje fue enviado correctamente. El equipo de Hidromont Chile le contactará después de revisarlo.',
  },
  {
    entryId: 'contacto.gracias',
    key: 'subtitle',
    from: 'Tu mensaje fue enviado correctamente. Te contactaremos a la brevedad.',
    to: 'Su mensaje fue enviado correctamente. Le contactaremos después de revisarlo.',
  },
  {
    entryId: 'empresa.maquinaria',
    key: 'subtitle',
    from: 'Contamos con maquinaria industrial de alto rendimiento para fabricación, mecanizado, soldadura, corte y montaje de equipos hidromecánicos de cualquier dimensión.',
    to: 'El taller dispone de equipos para fabricación, mecanizado, soldadura, corte y montaje de componentes hidromecánicos.',
  },
  {
    entryId: 'service-image.turbinas',
    key: 'image',
    from: '/fotos/curadas/turbinas.jpg',
    to: '/fotos/curadas/turbinas-obra-1.webp',
  },
  {
    entryId: 'service-image.turbinas',
    key: 'imageAlt',
    from: 'Sala de máquinas con turbinas hidráulicas',
    to: 'Mantenimiento de componente de turbina hidráulica en taller',
  },
  {
    entryId: 'service-image.turbinas',
    key: 'imageWidth',
    from: 474,
    to: 1200,
  },
  {
    entryId: 'service-image.turbinas',
    key: 'imageHeight',
    from: 271,
    to: 900,
  },
  {
    entryId: 'proyectos.ch-los-condores',
    key: 'alcance',
    from: 'Ingeniería, fabricación y montaje de tubería forzada DN 2200, bifurcación y ramales DN 2200-1600, blindaje vertical de 500 m en pique subterráneo, acceso vehicular y pieza de conexión. Tubería de aducción DN 3200 de 1.100 m y blindaje DN 3400.',
    to: 'Fabricación y montaje de 1.200 m de blindaje DN 2200 y ramales DN 1600, incluidos 132 m instalados en pique. Peso total documentado: 2.448 t.',
  },
  {
    entryId: 'proyectos.ch-los-condores',
    key: 'diametro',
    from: 'DN 2200 / DN 3200 / DN 3400',
    to: 'DN 2200 / DN 1600',
  },
  {
    entryId: 'proyectos.ch-los-condores',
    key: 'longitud',
    from: '1.600 m tubería forzada + 1.100 m aducción + 500 m vertical',
    to: '1.200 m, incluidos 132 m en pique',
  },
  {
    entryId: 'proyectos.embalse-chironta',
    key: 'diametro',
    from: 'DN 1600 / DN 1400 / DN 800',
    to: 'DN 1600 / DN 1400 / DN 800 / DN 700 / DN 350',
  },
  // La regla de 'proyectos.ch-dorias' se retiró: el catálogo de la matriz
  // identifica la obra como C.H. Doiras (Asturias, 2007), no como un proyecto
  // chileno, y la chimenea Ø 6.000 que fijaba no tiene respaldo en ninguna
  // fuente. Aplicarla hoy reescribiría el dato corregido.
  {
    entryId: 'servicios.valvulas',
    key: 'body',
    from: 'Fabricamos válvulas de cualquier diámetro y presión de trabajo. Nuestro equipo de ingeniería dimensiona cada válvula conforme a las normativas aplicables y realiza pruebas de presión y estanqueidad antes de la entrega.',
    to: 'El diámetro y la presión de trabajo se definen según las condiciones hidráulicas y las normas aplicables a cada proyecto. Antes de la entrega se realizan las pruebas de presión y estanqueidad especificadas para el equipo.',
    mode: 'substring',
  },
];
