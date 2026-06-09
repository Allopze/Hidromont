import { getCmsText } from './cms';

export interface NavItem {
  label: string;
  href: string;
  cmsField: string;
  children?: { label: string; href: string; cmsField: string }[];
}

export const navItems: NavItem[] = [
  { label: getCmsText('layout.header', 'navInicio', 'Inicio'), href: '/', cmsField: 'navInicio' },
  {
    label: getCmsText('layout.header', 'navServicios', 'Servicios'),
    href: '/servicios',
    cmsField: 'navServicios',
    children: [
      {
        label: getCmsText('layout.header', 'navServiciosTuberias', 'Tuberías Forzadas'),
        href: '/servicios/tuberias-forzadas',
        cmsField: 'navServiciosTuberias',
      },
      {
        label: getCmsText('layout.header', 'navServiciosCompuertas', 'Compuertas'),
        href: '/servicios/compuertas',
        cmsField: 'navServiciosCompuertas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosValvulas', 'Válvulas'),
        href: '/servicios/valvulas',
        cmsField: 'navServiciosValvulas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosTurbinas', 'Turbinas'),
        href: '/servicios/turbinas',
        cmsField: 'navServiciosTurbinas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosLimpiarrejas', 'Limpiarrejas'),
        href: '/servicios/limpiarrejas',
        cmsField: 'navServiciosLimpiarrejas',
      },
      {
        label: getCmsText('layout.header', 'navServiciosMontajes', 'Montajes Especiales'),
        href: '/servicios/otros-montajes',
        cmsField: 'navServiciosMontajes',
      },
    ],
  },
  { label: getCmsText('layout.header', 'navProyectos', 'Proyectos'), href: '/proyectos', cmsField: 'navProyectos' },
  { label: getCmsText('layout.header', 'navEmpresa', 'Empresa'), href: '/empresa', cmsField: 'navEmpresa' },
  { label: getCmsText('layout.header', 'navCalidad', 'Calidad'), href: '/calidad', cmsField: 'navCalidad' },
  { label: getCmsText('layout.header', 'navClientes', 'Clientes'), href: '/clientes', cmsField: 'navClientes' },
  { label: getCmsText('layout.header', 'navContacto', 'Contacto'), href: '/contacto', cmsField: 'navContacto' },
];

export const ctaLabel = getCmsText('layout.header', 'ctaLabel', 'Contáctenos');
export const ctaHref = '/contacto';
