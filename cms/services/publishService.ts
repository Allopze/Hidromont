import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/unifiedConfig';
import type { PublishJobRepository } from '../repositories/PublishJobRepository';
import type { PublishJob } from '../types/cms';
import { refreshPublicSecurityHeaders } from '../security/headers';
import type { ExportService, RevertedEntry, SkippedEntry } from './exportService';
import { ErrorDeUsuario } from '../utils/errorDeUsuario';

type Exported = {
  files: string[];
  removed: string[];
  skipped: SkippedEntry[];
  revertedToFallback: RevertedEntry[];
  missingFiles?: string[];
  /** P3-08: fotos de la galería sin imagen, que no salen en el sitio. */
  galeriaSinImagen?: number;
};

const execFileAsync = promisify(execFile);

/**
 * P3-04 (auditoría 2026-09): el comando de publicación se partía con
 * `split(' ')`, así que un argumento entrecomillado (una ruta con espacios)
 * llegaba roto. Se parte como lo haría una shell sencilla: espacios fuera de
 * comillas, comillas simples o dobles para agrupar. Sin shell de por medio.
 */
export function argumentosDeComando(comando: string): string[] {
  const salida: string[] = [];
  let actual = '';
  let comilla: '"' | "'" | null = null;
  let hay = false;
  for (const c of comando.trim()) {
    if (comilla) {
      if (c === comilla) comilla = null;
      else actual += c;
    } else if (c === '"' || c === "'") {
      comilla = c;
      hay = true;
    } else if (/\s/.test(c)) {
      if (hay || actual) salida.push(actual);
      actual = '';
      hay = false;
    } else {
      actual += c;
    }
  }
  if (comilla) throw new Error(`Comando de publicación con comillas sin cerrar: ${comando}`);
  if (hay || actual) salida.push(actual);
  return salida;
}

/**
 * A-7/A-9: las omisiones y las reversiones al texto por defecto entran en el
 * log del job igual que las eliminaciones, para que queden en el historial y
 * no solo en el stderr del servidor.
 */
function noticeLines(exported: Exported): string[] {
  return [
    ...exported.skipped.map((e) => `⚠ omitida: ${e.kind} "${e.slug}" (${e.id}) — ${e.reason}`),
    ...exported.revertedToFallback.map(
      (e) => `⚠ vuelve al texto por defecto: ${e.id} («${e.title}»)`
    ),
    ...(exported.missingFiles ?? []).map((f) => `⚠ imagen o video que no existe: ${f}`),
    ...(exported.galeriaSinImagen
      ? [`⚠ ${exported.galeriaSinImagen} foto(s) de la galería sin imagen: no salen en el sitio`]
      : []),
  ];
}

interface ExecFailure extends Error {
  stdout?: string;
  stderr?: string;
}

/**
 * P2-04 / P2-24 (auditoría 2026-09): ante un fallo, el panel decía «Error al
 * procesar la solicitud» y el historial solo «Falló». Aquí se traduce la causa
 * a algo que la persona editora pueda entender o contar a soporte, y siempre
 * viaja el identificador del job.
 */
export function explicarFalloDePublicacion(error: unknown, jobId: string): ErrorDeUsuario {
  const mensaje = error instanceof Error ? error.message : String(error);
  const salida = [
    (error as ExecFailure)?.stdout ?? '',
    (error as ExecFailure)?.stderr ?? '',
    mensaje,
  ].join('\n');
  const extra = { job: jobId };
  if (/tiene \d+ foto\(s\) que el CMS no conoce/.test(mensaje)) {
    return new ErrorDeUsuario(409, mensaje.split('\n')[0], extra, mensaje);
  }
  if (/otro build en curso/i.test(salida)) {
    return new ErrorDeUsuario(
      409,
      'Ya se está compilando el sitio (otra publicación o una actualización). Espera un minuto y vuelve a publicar.',
      extra,
      mensaje
    );
  }
  const datoInvalido =
    /InvalidContentEntryDataError[^\n]*|data does not match collection schema[^\n]*/.exec(salida);
  if (datoInvalido) {
    const detalle = salida
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /\*\*[a-z]+\*\*|Expected|Required/i.test(l));
    return new ErrorDeUsuario(
      422,
      `Una ficha tiene un dato que el sitio no acepta${detalle ? ` (${detalle.replace(/\*\*/g, '')})` : ''}. Corrígelo y vuelve a publicar.`,
      extra,
      mensaje
    );
  }
  if ((error as { killed?: boolean })?.killed || /ETIMEDOUT|timed out/i.test(mensaje)) {
    return new ErrorDeUsuario(
      504,
      'La compilación del sitio tardó demasiado y se canceló. El sitio sigue como estaba; vuelve a intentarlo en unos minutos.',
      extra,
      mensaje
    );
  }
  return new ErrorDeUsuario(
    500,
    'No se pudo compilar el sitio. El sitio sigue mostrando la versión anterior y lo guardado no se perdió.',
    extra,
    mensaje
  );
}

export class PublishService {
  // CMS-5: exportContent/exportContentWithGallery/publishContent all read the
  // DB and write the same shared files (src/data/cms-content.json,
  // src/content/*/*.md, src/data/gallery.json), and publishContent additionally
  // shells out to `npm run build`/`check` against the same working tree. Two
  // of these running concurrently (a double-click, or two admins) would race
  // on those writes and could interleave two builds in the same cwd. A single
  // in-process boolean is enough here — this is one Node process per server,
  // not a multi-instance deployment — and rejecting outright (not queueing) is
  // simpler and gives the caller an immediate, actionable error.
  private busy = false;

  private acquireLock(): void {
    if (this.busy) {
      throw new ErrorDeUsuario(
        409,
        'Ya hay una publicación en curso. Espera a que termine y vuelve a intentarlo.'
      );
    }
    this.busy = true;
  }

  constructor(
    private readonly exportService: ExportService,
    private readonly publishJobRepository: PublishJobRepository
  ) {}

  async exportContent(): Promise<{
    job: PublishJob;
    exported: Exported;
    galleryExported?: { file: string; count: number; sinImagen?: number };
  }> {
    this.acquireLock();
    try {
      const startedAt = new Date().toISOString();
      const job = this.publishJobRepository.start({
        action: 'export',
        now: startedAt,
        logs: [`${startedAt} export started`],
      });

      try {
        const exported = await this.exportService.exportContent();
        this.exportService.pruneOrphanDerivatives();
        const completedAt = new Date().toISOString();
        const completed = this.publishJobRepository.finish({
          id: job.id,
          status: 'succeeded',
          now: completedAt,
          logs: [
            ...job.logs,
            `${completedAt} exported ${exported.files.length} file(s)`,
            ...exported.files.map((file) => `file: ${file}`),
            ...exported.removed.map((file) => `removed (renamed/unpublished/deleted): ${file}`),
            ...noticeLines(exported),
          ],
        });
        return { job: completed, exported };
      } catch (error) {
        this.failJob(job, error);
        throw error;
      }
    } finally {
      this.busy = false;
    }
  }

  async exportContentWithGallery(): Promise<{
    job: PublishJob;
    exported: Exported;
    galleryExported: { file: string; count: number; sinImagen?: number };
  }> {
    this.acquireLock();
    try {
      const startedAt = new Date().toISOString();
      const job = this.publishJobRepository.start({
        action: 'export',
        now: startedAt,
        logs: [`${startedAt} export started (content + gallery)`],
      });

      try {
        // P0-01: galería primero (ver publishContent).
        const galleryExported = await this.exportService.exportGallery();
        const exported = await this.exportService.exportContent();
        this.exportService.pruneOrphanDerivatives();
        if (galleryExported.sinImagen) {
          (exported as { galeriaSinImagen?: number }).galeriaSinImagen = galleryExported.sinImagen;
        }
        const completedAt = new Date().toISOString();
        const completed = this.publishJobRepository.finish({
          id: job.id,
          status: 'succeeded',
          now: completedAt,
          logs: [
            ...job.logs,
            `${completedAt} exported ${exported.files.length} file(s)`,
            ...exported.files.map((file) => `file: ${file}`),
            ...exported.removed.map((file) => `removed (renamed/unpublished/deleted): ${file}`),
            ...noticeLines(exported),
            `gallery: ${galleryExported.count} items → ${galleryExported.file}`,
          ],
        });
        return { job: completed, exported, galleryExported };
      } catch (error) {
        this.failJob(job, error);
        throw error;
      }
    } finally {
      this.busy = false;
    }
  }

  async publishContent(): Promise<{
    job: PublishJob;
    exported: Exported;
    galleryExported: { file: string; count: number; sinImagen?: number };
    publish: { stdout: string; stderr: string };
  }> {
    this.acquireLock();
    try {
      const startedAt = new Date().toISOString();
      const job = this.publishJobRepository.start({
        action: 'publish',
        now: startedAt,
        logs: [`${startedAt} publish started`],
      });

      try {
        // CMS-1 fix: publish previously only re-exported page/collection content
        // and never regenerated src/data/gallery.json, so publishing after
        // editing/reordering gallery items shipped the *previous* gallery.
        // P0-01: la galería va PRIMERO. Su guarda es lo único del export que
        // puede abortar; si lo hace después del contenido, deja los .md y el
        // JSON escritos sin compilar.
        const galleryExported = await this.exportService.exportGallery();
        const exported = await this.exportService.exportContent();
        this.exportService.pruneOrphanDerivatives();
        if (galleryExported.sinImagen) {
          (exported as { galeriaSinImagen?: number }).galeriaSinImagen = galleryExported.sinImagen;
        }
        const [command, ...args] = argumentosDeComando(config.cms.publishCheckCommand);
        const result = await execFileAsync(command, args, {
          cwd: config.rootDir,
          timeout: config.cms.publishTimeoutMs,
        });

        // A-6: con el CMS y el sitio en el mismo proceso, `npm run build`
        // regenera el dist/ que este servidor sirve, así que el cambio queda
        // en línea sin más pasos. Pero el HTML nuevo puede traer otros
        // scripts inline, y la CSP se calcula de él: hay que recalcularla.
        refreshPublicSecurityHeaders();
        const completedAt = new Date().toISOString();
        const completed = this.publishJobRepository.finish({
          id: job.id,
          status: 'succeeded',
          now: completedAt,
          logs: [
            ...job.logs,
            `${completedAt} exported ${exported.files.length} file(s)`,
            ...exported.removed.map((file) => `removed (renamed/unpublished/deleted): ${file}`),
            ...noticeLines(exported),
            `gallery: ${galleryExported.count} items → ${galleryExported.file}`,
            `publish: ${config.cms.publishCheckCommand}`,
            ...this.nonEmptyLines(result.stdout, 'stdout'),
            ...this.nonEmptyLines(result.stderr, 'stderr'),
          ],
        });

        return {
          job: completed,
          exported,
          galleryExported,
          publish: {
            stdout: result.stdout,
            stderr: result.stderr,
          },
        };
      } catch (error) {
        const completed = this.failJob(job, error);
        throw explicarFalloDePublicacion(error, completed.id);
      }
    } finally {
      this.busy = false;
    }
  }

  listJobs(): PublishJob[] {
    return this.publishJobRepository.list();
  }

  getJob(id: string): PublishJob {
    const job = this.publishJobRepository.find(id);
    if (!job) throw new Error(`Publish job ${id} not found`);
    return job;
  }

  private failJob(job: PublishJob, error: unknown): PublishJob {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Unknown publish error';
    return this.publishJobRepository.finish({
      id: job.id,
      status: 'failed',
      now: completedAt,
      logs: [...job.logs, `${completedAt} failed: ${message}`, ...this.errorOutput(error)],
    });
  }

  private errorOutput(error: unknown): string[] {
    const execError = error as ExecFailure;
    return [
      ...this.nonEmptyLines(execError.stdout, 'stdout'),
      ...this.nonEmptyLines(execError.stderr, 'stderr'),
    ];
  }

  private nonEmptyLines(value: string | undefined, prefix: string): string[] {
    return (value ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `${prefix}: ${line}`);
  }
}
