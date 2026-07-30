import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,md,mdx,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0065A9',
          dark: '#004B7D',
          light: '#E6F2FA',
        },
        accent: '#00A6D6',
        text: {
          DEFAULT: '#1F2933',
          muted: '#5B6770',
        },
        border: '#D9E2EC',
        surface: '#FFFFFF',
        background: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F8FA',
          strong: '#0F2433',
        },
        success: '#2E7D32',
        warning: '#B7791F',
        error: '#C62828',
      },
      fontFamily: {
        heading: ['"Roboto Condensed"', 'Arial', 'sans-serif'],
        body: ['Inter', 'Arial', 'sans-serif'],
        mono: ['"Roboto Mono"', 'monospace'],
      },
      // UIUX-2 fix: `text-caption` was used across the codebase (Eyebrow,
      // Badge) but this key never existed, so Tailwind silently dropped the
      // utility and those elements inherited ~16px instead of the intended
      // 0.75rem — matches --font-size-caption in tokens.css.
      fontSize: {
        caption: '0.75rem',
      },
      borderRadius: {
        xs: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 36, 51, 0.08)',
        md: '0 8px 24px rgba(15, 36, 51, 0.10)',
        lg: '0 16px 40px rgba(15, 36, 51, 0.14)',
      },
      maxWidth: {
        container: '1200px',
        wide: '1320px',
      },
      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '240ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      // B1-003: z-index scale alineada con los tokens CSS de tokens.css.
      zIndex: {
        base: '0',
        raised: '10',
        dropdown: '20',
        sticky: '50',
        overlay: '100',
        toast: '1000',
      },
      typography: {
        DEFAULT: {
          css: {
            // colors
            '--tw-prose-body': '#1F2933',
            '--tw-prose-headings': '#004B7D',
            '--tw-prose-lead': '#5B6770',
            '--tw-prose-links': '#0065A9',
            '--tw-prose-bold': '#1F2933',
            '--tw-prose-counters': '#5B6770',
            '--tw-prose-bullets': '#0065A9',
            '--tw-prose-hr': '#D9E2EC',
            '--tw-prose-quotes': '#004B7D',
            '--tw-prose-quote-borders': '#0065A9',
            '--tw-prose-captions': '#5B6770',
            '--tw-prose-code': '#1F2933',
            '--tw-prose-pre-code': '#E6F2FA',
            '--tw-prose-pre-bg': '#0F2433',
            '--tw-prose-th-borders': '#D9E2EC',
            '--tw-prose-td-borders': '#D9E2EC',
            // headings → heading font
            h1: { fontFamily: '"Roboto Condensed", Arial, sans-serif', fontWeight: '700', letterSpacing: '-0.01em' },
            h2: { fontFamily: '"Roboto Condensed", Arial, sans-serif', fontWeight: '700', letterSpacing: '-0.01em' },
            h3: { fontFamily: '"Roboto Condensed", Arial, sans-serif', fontWeight: '600', letterSpacing: '-0.01em' },
            h4: { fontFamily: '"Roboto Condensed", Arial, sans-serif', fontWeight: '600' },
            // tables → design-system style
            'thead th': { backgroundColor: '#E6F2FA', color: '#004B7D', fontWeight: '700', padding: '12px 16px' },
            'tbody td': { padding: '12px 16px', borderBottomColor: '#D9E2EC' },
            // links
            'a': { fontWeight: '500', textDecorationThickness: '1px', textUnderlineOffset: '4px' },
            'a:hover': { color: '#004B7D' },
          },
        },
      },
    },
  },
  plugins: [typography],
};
