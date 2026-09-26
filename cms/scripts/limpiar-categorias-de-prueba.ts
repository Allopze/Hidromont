/**
 * `npm run cms:limpiar-categorias-de-prueba [-- --aplicar]`
 *
 * P3-08 (auditoría 2026-09): antes de que las e2e usaran una base aparte,
 * dejaron en la base local 41 categorías de galería de prueba («Teclado
 * 1790085885353», «Repintado …», «Axe …»). La primera publicación desde esa
 * base las llevó a `gallery.json`.
 *
 * Por defecto solo lista lo que borraría. Con `--aplicar`, borra las
 * categorías cuyo nombre acaba en una marca de tiempo de milisegundos (13
 * cifras) y que no tienen ninguna foto. Una categoría con fotos nunca se toca.
 * Ejecutar también en el VPS antes de sincronizar o publicar desde otra base.
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DE_PRUEBA = /\s\d{13}$/;

try {
  migrate();
  const db = getDb();
  const aplicar = process.argv.includes('--aplicar');
  const candidatas = (
    db
      .prepare(
        `SELECT c.id, c.name, (SELECT COUNT(*) FROM gallery_items i WHERE i.category_id = c.id) AS fotos
         FROM gallery_categories c ORDER BY c.position`
      )
      .all() as Array<{ id: string; name: string; fotos: number }>
  ).filter((c) => DE_PRUEBA.test(c.name) && c.fotos === 0);

  if (candidatas.length === 0) {
    process.stdout.write('No hay categorías de prueba.\n');
  } else if (!aplicar) {
    process.stdout.write(
      `${candidatas.length} categoría(s) de prueba, sin fotos:\n${candidatas
        .map((c) => `  · ${c.name}`)
        .join('\n')}\nRepite con -- --aplicar para borrarlas.\n`
    );
  } else {
    const borrar = db.prepare('DELETE FROM gallery_categories WHERE id = ?');
    db.transaction(() => candidatas.forEach((c) => borrar.run(c.id)))();
    process.stdout.write(`Borradas ${candidatas.length} categoría(s) de prueba.\n`);
  }
} catch (error) {
  captureException(error, { action: 'limpiarCategoriasDePrueba' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
