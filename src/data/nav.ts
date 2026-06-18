import { getCmsText } from './cms';

export interface NavItem {
  label: string;
  href: string;
  cmsField: string;
  children?: { label: string; href: string; cmsField: string }[];
}

export const navItems: NavItem[] = [
  { label: getCmsText('layout.header', 'navInicio', 'Inicio'), href: getCmsText('layout.header', 'hrefInicio', '/'), cmsField: 'navInicio' },
  {
    label: getCmsText('layout.header', 'navServicios', 'Servicios'),
    href: getCmsText('layout.header', 'hrefServicios', '/servicios'),
    cmsField: 'navServicios',
    children: [
      {
        label: getCmsText('layout.header', 'navServiciosTuberias', 'Tuberías Forzadas'),
        href: getCmsText('layout.header', 'hrefServiciosTuberias', '/servicios/tuberias-forzadas'),
        cmsField: 'navServiciosTuberias',
      },
      {
        label: getCmsText('layout.header', 'navServiciosCompuertas', 'Compuertas'),
        href: getCmsText('layout.header', 'hrefServiciosCompuertas', '/servicios/compuertas'),
        cmsField: 'navServiciosCompuertas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosValvulas', 'Válvulas'),
        href: getCmsText('layout.header', 'hrefServiciosValvulas', '/servicios/valvulas'),
        cmsField: 'navServiciosValvulas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosTurbinas', 'Turbinas'),
        href: getCmsText('layout.header', 'hrefServiciosTurbinas', '/servicios/turbinas'),
        cmsField: 'navServiciosTurbinas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosLimpiarrejas', 'Limpiarrejas'),
        href: getCmsText('layout.header', 'hrefServiciosLimpiarrejas', '/servicios/limpiarrejas'),
        cmsField: 'navServiciosLimpiarrejas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosMontajes', 'Montajes Especiales'),
        href: getCmsText('layout.header', 'hrefServiciosMontajes', '/servicios/otros-montajes'),
        cmsField: 'navServiciosMontajes',
      },
    ],
  },
  { label: getCmsText('layout.header', 'navProyectos', 'Proyectos'), href: getCmsText('layout.header', 'hrefProyectos', '/proyectos'), cmsField: 'navProyectos' },
  { label: getCmsText('layout.header', 'navEmpresa', 'Empresa'), href: getCmsText('layout.header', 'hrefEmpresa', '/empresa'), cmsField: 'navEmpresa' },
  { label: getCmsText('layout.header', 'navClientes', 'Clientes'), href: getCmsText('layout.header', 'hrefClientes', '/clientes'), cmsField: 'navClientes' },
  { label: getCmsText('layout.header', 'navContacto', 'Contacto'), href: getCmsText('layout.header', 'hrefContacto', '/contacto'), cmsField: 'navContacto' },
];

export const ctaLabel = getCmsText('layout.header', 'ctaLabel', 'Contáctenos');
export const ctaHref = getCmsText('layout.header', 'ctaHref', '/contacto');
