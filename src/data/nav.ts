import { getCmsText } from './cms';

export interface NavItem {
  label: string;
  href: string;
  cmsField: string;
  children?: { label: string; href: string; cmsField: string }[];
}

/**
 * A3-001: valida que un href de navegación sea una ruta interna segura antes de
 * usarlo. Si el CMS exportó un valor vacío o malformado (p. ej. un operador borró
 * el campo por accidente), cae al fallback en lugar de romper la navegación.
 *
 * Reglas: debe empezar con `/`, no contener espacios ni `//`, y no tener caracteres
 * obviamente peligrosos. Rutas externas (http/https/mailto/tel) se rechazan también:
 * la navegación del sitio es siempre interna.
 */
function safeHref(cmsField: string, fallback: string): string {
  const value = getCmsText('layout.header', cmsField, fallback);
  if (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/\s/.test(value) &&
    !/[<>"]/.test(value) &&
    !/^(https?:|mailto:|tel:)/i.test(value)
  ) {
    return value;
  }
  // Valor inválido o vacío: usar el fallback hardcodeado.
  if (import.meta.env.DEV && value !== fallback) {
    console.warn(
      `[nav] href inválido para layout.header.${cmsField}: "${value}". Usando fallback "${fallback}".`
    );
  }
  return fallback;
}

export const navItems: NavItem[] = [
  {
    label: getCmsText('layout.header', 'navInicio', 'Inicio'),
    href: safeHref('hrefInicio', '/'),
    cmsField: 'navInicio',
  },
  {
    label: getCmsText('layout.header', 'navServicios', 'Servicios'),
    href: safeHref('hrefServicios', '/servicios'),
    cmsField: 'navServicios',
    children: [
      {
        label: getCmsText('layout.header', 'navServiciosCompuertas', 'Compuertas'),
        href: safeHref('hrefServiciosCompuertas', '/servicios/compuertas'),
        cmsField: 'navServiciosCompuertas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosInfraestructuras', 'Infraestructuras'),
        href: safeHref('hrefServiciosInfraestructuras', '/servicios/infraestructuras'),
        cmsField: 'navServiciosInfraestructuras',
      },
      {
        label: getCmsText('layout.header', 'navServiciosLimpiarrejas', 'Limpiarrejas'),
        href: safeHref('hrefServiciosLimpiarrejas', '/servicios/limpiarrejas'),
        cmsField: 'navServiciosLimpiarrejas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosMontajes', 'Montajes Especiales'),
        href: safeHref('hrefServiciosMontajes', '/servicios/otros-montajes'),
        cmsField: 'navServiciosMontajes',
      },
      {
        label: getCmsText('layout.header', 'navServiciosTanques', 'Tanques Especiales'),
        href: safeHref('hrefServiciosTanques', '/servicios/tanques-especiales'),
        cmsField: 'navServiciosTanques',
      },
      {
        label: getCmsText('layout.header', 'navServiciosTuberias', 'Tuberías y Blindajes'),
        href: safeHref('hrefServiciosTuberias', '/servicios/tuberias-forzadas'),
        cmsField: 'navServiciosTuberias',
      },
      {
        label: getCmsText('layout.header', 'navServiciosTurbinas', 'Turbinas'),
        href: safeHref('hrefServiciosTurbinas', '/servicios/turbinas'),
        cmsField: 'navServiciosTurbinas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosValvulas', 'Válvulas'),
        href: safeHref('hrefServiciosValvulas', '/servicios/valvulas'),
        cmsField: 'navServiciosValvulas',
      },
    ],
  },
  {
    label: getCmsText('layout.header', 'navProyectos', 'Proyectos'),
    href: safeHref('hrefProyectos', '/proyectos'),
    cmsField: 'navProyectos',
  },
  {
    label: getCmsText('layout.header', 'navGaleria', 'Galería'),
    href: safeHref('hrefGaleria', '/galeria'),
    cmsField: 'navGaleria',
  },
  {
    label: getCmsText('layout.header', 'navEmpresa', 'Empresa'),
    href: safeHref('hrefEmpresa', '/empresa'),
    cmsField: 'navEmpresa',
  },
  {
    label: getCmsText('layout.header', 'navClientes', 'Clientes'),
    href: safeHref('hrefClientes', '/clientes'),
    cmsField: 'navClientes',
  },
  {
    label: getCmsText('layout.header', 'navContacto', 'Contacto'),
    href: safeHref('hrefContacto', '/contacto'),
    cmsField: 'navContacto',
  },
];

export const ctaLabel = getCmsText('layout.header', 'ctaLabel', 'Contáctenos');
export const ctaHref = safeHref('ctaHref', '/contacto');
