import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { BackupService } from '../services/backupService';
import { config } from '../config/unifiedConfig';
import { copyFixRules, type CopyFixRule } from '../content/copyFixes';

/**
 * Aplica las correcciones de copy de `cms/content/copyFixes.ts` contra la base.
 *
 * Por qué no basta con el migrador de contenido auditado que ya existe: aquel
 * informa de las reglas que coinciden y calla las que no. Con 13 reglas escritas
 * a mano eso se ve; con 73, una clave mal tecleada o un `from` desactualizado
 * desaparece del informe y crees que aplicaste 73 cuando aplicaste 61. Aquí cada
 * regla cae en una de cuatro categorías y las dos malas abortan la tanda.
 */

type Estado = 'aplicable' | 'ya-aplicada' | 'campo-inexistente' | 'valor-inesperado';

interface Analisis {
  rule: CopyFixRule;
  estado: Estado;
  actual?: unknown;
  siguiente?: unknown;
  version?: number;
  entryStatus?: string;
  detalle?: string;
}

/** Lista negra de `src/test/audited-content.test.ts`, para no descubrir una
 *  frase prohibida recién después del export. */
const PROHIBIDAS = [
  '2014/68/EN',
  'cualquier dimensión',
  'cualquier diámetro y presión',
  'garantizan',
  'todos los trabajos',
  'más de 40 proyectos adicionales',
  'más de 20 proyectos adicionales',
  'te contactaremos',
  'tu mensaje',
];

function arg(nombre: string): string | undefined {
  const found = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return found?.split('=').slice(1).join('=');
}

function analizar(repository: ContentRepository, rule: CopyFixRule): Analisis {
  const entry = repository.findEntry(rule.entryId);
  if (!entry) {
    return { rule, estado: 'campo-inexistente', detalle: `no existe la entrada ${rule.entryId}` };
  }
  const field = entry.fields[rule.key];
  if (!field) {
    return {
      rule,
      estado: 'campo-inexistente',
      detalle: `la entrada no tiene el campo ${rule.key}`,
    };
  }

  const base = { version: entry.version, entryStatus: entry.status, actual: field.value };

  if (rule.mode === 'substring') {
    if (
      typeof field.value !== 'string' ||
      typeof rule.from !== 'string' ||
      typeof rule.to !== 'string'
    ) {
      return {
        rule,
        estado: 'valor-inesperado',
        ...base,
        detalle: 'substring exige valores de texto',
      };
    }
    if (field.value.includes(rule.to) && !field.value.includes(rule.from)) {
      return { rule, estado: 'ya-aplicada', ...base };
    }
    const ocurrencias = field.value.split(rule.from).length - 1;
    if (ocurrencias === 0) {
      return {
        rule,
        estado: 'valor-inesperado',
        ...base,
        detalle: 'el fragmento buscado no aparece',
      };
    }
    // replaceAll sin anclar cambiaría las dos ocurrencias sin avisar.
    if (ocurrencias > 1) {
      return {
        rule,
        estado: 'valor-inesperado',
        ...base,
        detalle: `el fragmento aparece ${ocurrencias} veces; solo se admite 1`,
      };
    }
    return {
      rule,
      estado: 'aplicable',
      ...base,
      siguiente: field.value.replace(rule.from, rule.to),
    };
  }

  if (JSON.stringify(field.value) === JSON.stringify(rule.to)) {
    return { rule, estado: 'ya-aplicada', ...base };
  }
  if (JSON.stringify(field.value) !== JSON.stringify(rule.from)) {
    return {
      rule,
      estado: 'valor-inesperado',
      ...base,
      detalle: 'el valor actual no es el esperado',
    };
  }
  return { rule, estado: 'aplicable', ...base, siguiente: rule.to };
}

function recorte(valor: unknown, largo = 150): string {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  if (texto === undefined) return 'undefined';
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}

async function main() {
  const aplicar = process.argv.includes('--apply');
  const batch = arg('batch');
  const permitirDesajuste = process.argv.includes('--allow-mismatch');
  const permitirVacio = process.argv.includes('--allow-empty');

  const reglas = batch ? copyFixRules.filter((r) => r.batch === batch) : copyFixRules;
  if (reglas.length === 0) {
    throw new Error(batch ? `Ninguna regla en la tanda «${batch}».` : 'El manifiesto está vacío.');
  }

  // Con dos bases posibles (CMS_DATABASE_PATH), operar sobre la equivocada es
  // un modo de fallo barato de prevenir.
  process.stdout.write(`Base de datos: ${config.cms.databasePath}\n`);
  process.stdout.write(`Tanda: ${batch ?? '(todas)'} · ${reglas.length} regla(s)\n`);
  process.stdout.write(`Modo: ${aplicar ? 'APLICAR' : 'revisión (--check)'}\n\n`);

  const duplicadas = new Map<string, number>();
  for (const r of reglas) {
    const clave = `${r.entryId}\0${r.key}`;
    duplicadas.set(clave, (duplicadas.get(clave) ?? 0) + 1);
  }
  const repetidas = [...duplicadas.entries()].filter(([, n]) => n > 1);
  if (repetidas.length > 0) {
    throw new Error(
      `Reglas duplicadas sobre el mismo campo (se pisarían entre sí):\n${repetidas
        .map(([clave, n]) => `  ${clave.replace('\0', '.')} ×${n}`)
        .join('\n')}`
    );
  }

  const vacias = reglas.filter((r) => r.to === '');
  if (vacias.length > 0 && !permitirVacio) {
    throw new Error(
      `Estas reglas dejan el campo vacío, y getCmsText devuelve '' sin caer al fallback:\n${vacias
        .map((r) => `  ${r.entryId}.${r.key}`)
        .join('\n')}\nUse --allow-empty si es deliberado.`
    );
  }

  const conProhibidas = reglas.flatMap((r) => {
    const texto =
      typeof r.to === 'string'
        ? r.to.toLocaleLowerCase('es')
        : JSON.stringify(r.to).toLocaleLowerCase('es');
    const hits = PROHIBIDAS.filter((p) => texto.includes(p.toLocaleLowerCase('es')));
    return hits.length > 0 ? [`  ${r.entryId}.${r.key}: ${hits.join(', ')}`] : [];
  });
  if (conProhibidas.length > 0) {
    throw new Error(
      `El texto nuevo trae frases que audited-content.test.ts prohíbe:\n${conProhibidas.join('\n')}`
    );
  }

  migrate();
  const db = getDb();
  const repository = new ContentRepository(db);

  const analisis = reglas.map((rule) => analizar(repository, rule));
  const por = (estado: Estado) => analisis.filter((a) => a.estado === estado);

  for (const a of por('aplicable')) {
    process.stdout.write(`~ ${a.rule.entryId}.${a.rule.key}  [v${a.version}]\n`);
    process.stdout.write(`  - ${recorte(a.actual)}\n`);
    process.stdout.write(`  + ${recorte(a.siguiente)}\n`);
    if (a.entryStatus !== 'published') {
      // Un campo en borrador no llega al sitio: el informe diría «aplicado» y
      // el visitante seguiría viendo el fallback del .astro.
      process.stdout.write(`  ! la entrada está en «${a.entryStatus}»: no se publica\n`);
    }
    process.stdout.write('\n');
  }

  const resumen = [
    `aplicables:        ${por('aplicable').length}`,
    `ya aplicadas:      ${por('ya-aplicada').length}`,
    `campo inexistente: ${por('campo-inexistente').length}`,
    `valor inesperado:  ${por('valor-inesperado').length}`,
  ].join('\n');
  process.stdout.write(`${resumen}\n`);

  const rotas = [...por('campo-inexistente'), ...por('valor-inesperado')];
  if (rotas.length > 0) {
    process.stdout.write('\nReglas que no calzan:\n');
    for (const a of rotas) {
      process.stdout.write(`  ✗ ${a.rule.entryId}.${a.rule.key} — ${a.detalle}\n`);
      if (a.actual !== undefined)
        process.stdout.write(`     en la base: ${recorte(a.actual, 110)}\n`);
    }
    if (!permitirDesajuste) {
      throw new Error(
        `${rotas.length} regla(s) no calzan con la base. Corrija el manifiesto (o use --allow-mismatch si sabe lo que hace).`
      );
    }
  }

  if (!aplicar) {
    process.stdout.write('\nRevisión únicamente. Use --apply para escribir.\n');
    return;
  }
  if (por('aplicable').length === 0) {
    process.stdout.write('\nNada que aplicar.\n');
    return;
  }

  const backup = await new BackupService(db).createBackup();
  process.stdout.write(`\nBackup creado: ${backup.file}\n`);

  const ahora = new Date().toISOString();
  for (const a of por('aplicable')) {
    // expectedVersion: si alguien editó la entrada desde el panel entre la
    // revisión y este momento, la transacción aborta en vez de pisarlo.
    repository.updateField(a.rule.entryId, a.rule.key, a.siguiente, ahora, undefined, a.version);
    process.stdout.write(`  ✓ ${a.rule.entryId}.${a.rule.key}\n`);
  }
  process.stdout.write(`\n${por('aplicable').length} campo(s) actualizado(s).\n`);
  process.stdout.write('Siguiente paso: npm run cms:export\n');
}

main().catch((error) => {
  process.stderr.write(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
