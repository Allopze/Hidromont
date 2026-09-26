/**
 * P2-13 (auditoría 2026-09): el 82 % de la biblioteca tenía como descripción
 * el nombre del archivo («DSCF2109», «001», «whatsapp image 2026 07 03»), que
 * la sincronización de medios copia al registrar cada foto. Elegir una de esas
 * fotos pegaba esa «descripción» en el campo, sustituyendo una buena. Aquí se
 * reconoce para no usarla y pedir una descripción de verdad.
 */
const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[a-z0-9]{2,4}$/, '')
    .replace(/[_\-.()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function pareceNombreDeArchivo(alt: string | null | undefined, archivo = ''): boolean {
  const a = normalizar(alt ?? '');
  if (!a) return true;
  const base = normalizar(archivo.split('/').pop() ?? '');
  if (base && a === base) return true;
  // Códigos de cámara y numeraciones: «dscf2109», «img 20161206 113612», «001».
  if (
    /^(img|dsc|dscf|dsci|dcim|p|pic|image|imagen|foto|photo|whatsapp image)?\s*[\d\s]+( at [\d\s]+)?$/.test(
      a
    )
  )
    return true;
  return false;
}
