/**
 * P2-04 (auditoría 2026-09): los errores se clasificaban con expresiones
 * regulares sobre el texto del mensaje, así que un fallo del build o del
 * disco llegaba al panel como «Error al procesar la solicitud» (400) y un
 * conflicto real como 400 genérico. Un error de este tipo lleva su estado HTTP
 * y el mensaje que ve la persona editora; `BaseController` lo respeta tal cual.
 */
export class ErrorDeUsuario extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly mensajeUsuario: string,
    public readonly extra: Record<string, unknown> = {},
    detalle?: string
  ) {
    super(detalle ?? mensajeUsuario);
    this.name = 'ErrorDeUsuario';
  }
}
