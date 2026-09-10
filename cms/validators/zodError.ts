/**
 * A-1 — Traduce un ZodError a algo que un editor pueda accionar.
 *
 * `handleError` comparaba `error.message` contra expresiones en español, pero
 * el `message` de un ZodError es el JSON serializado de sus issues, así que
 * ninguna casaba nunca — ni siquiera con los mensajes en español que los
 * propios schemas definen. Todo error de validación llegaba al panel como
 * «Error al procesar la solicitud»: slug inválido, alt vacío, título
 * demasiado largo, correo mal escrito, todos iguales.
 *
 * Los mensajes propios de los schemas se dejan intactos; solo se traducen los
 * incorporados de Zod, que vienen en inglés y no le sirven a nadie en un CMS
 * íntegramente en castellano.
 */
import { ZodError } from 'zod';

type Issue = ZodError['issues'][number];

export interface FieldError {
  /** Ruta del campo, o `(cuerpo)` si el error es del objeto entero. */
  field: string;
  message: string;
}

/** Prefijos de los mensajes que genera Zod por defecto. Todo lo demás es nuestro. */
const BUILT_IN =
  /^(Invalid input|Invalid option|Invalid key|Invalid value|Too big|Too small|Invalid email address|Invalid string|Unrecognized key|Invalid union|Invalid date|Not a finite number)/;

function describeOrigin(origin: unknown): string {
  if (origin === 'string') return 'caracteres';
  if (origin === 'array') return 'elementos';
  return '';
}

function translate(issue: Issue): string {
  // Mensaje escrito a mano en el schema: ya está en castellano y es más
  // específico que cualquier traducción genérica.
  if (!BUILT_IN.test(issue.message)) return issue.message;

  const i = issue as Issue & {
    expected?: string;
    minimum?: number | bigint;
    maximum?: number | bigint;
    origin?: string;
    values?: unknown[];
  };

  switch (issue.code) {
    case 'invalid_type':
      return i.expected === 'string'
        ? 'Es obligatorio.'
        : `Debe ser de tipo ${i.expected ?? 'válido'}.`;

    case 'invalid_value': {
      const opciones = Array.isArray(i.values) ? i.values.join(', ') : '';
      return opciones ? `Debe ser uno de: ${opciones}.` : 'Valor no permitido.';
    }

    case 'too_small': {
      const unidad = describeOrigin(i.origin);
      const min = Number(i.minimum ?? 0);
      if (i.origin === 'string' && min === 1) return 'No puede quedar vacío.';
      return unidad
        ? `Debe tener al menos ${min} ${unidad}.`
        : `Debe ser mayor o igual que ${min}.`;
    }

    case 'too_big': {
      const unidad = describeOrigin(i.origin);
      const max = Number(i.maximum ?? 0);
      return unidad ? `No puede superar ${max} ${unidad}.` : `Debe ser menor o igual que ${max}.`;
    }

    case 'invalid_format':
      return issue.message === 'Invalid email address'
        ? 'No parece un correo electrónico válido.'
        : 'El formato no es válido.';

    default:
      return 'Valor no válido.';
  }
}

export function fieldErrorsFromZod(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join('.') : '(cuerpo)',
    message: translate(issue),
  }));
}

/** Una sola línea legible, que es lo que el overlay pinta en `[data-status]`. */
export function summarizeZod(errors: FieldError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ');
}
