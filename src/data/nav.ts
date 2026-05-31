export interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

export const navItems: NavItem[] = [
  { label: 'Inicio', href: '/' },
  {
    label: 'Servicios',
    href: '/servicios',
    children: [
      { label: 'Tuberías Forzadas', href: '/servicios/tuberias-forzadas' },
      { label: 'Compuertas', href: '/servicios/compuertas' },
      { label: 'Válvulas', href: '/servicios/valvulas' },
      { label: 'Turbinas', href: '/servicios/turbinas' },
      { label: 'Limpiarrejas', href: '/servicios/limpiarrejas' },
      { label: 'Montajes Especiales', href: '/servicios/otros-montajes' },
    ],
  },
  { label: 'Proyectos', href: '/proyectos' },
  { label: 'Empresa', href: '/empresa' },
  { label: 'Calidad', href: '/calidad' },
  { label: 'Clientes', href: '/clientes' },
  { label: 'Contacto', href: '/contacto' },
];

export const ctaLabel = 'Contáctenos';
export const ctaHref = '/contacto';
