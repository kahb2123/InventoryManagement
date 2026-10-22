/**
 * Single source of truth for every colour in the app.
 *
 * `tailwind.config.js` feeds this into Tailwind, so `bg-brand-500`,
 * `text-danger-700` and friends all resolve from here. Charts and swatches
 * import it through `src/lib/colors.js`.
 *
 * Contrast rules used here (WCAG 2.1, text on white / canvas):
 *   - every shade used as small body text is >= 4.5:1 (AA)
 *   - every shade used as a UI fill is >= 3:1
 *   - ink-muted 7.6:1, ink-faint 5.4:1, brand-600 6.6:1
 *   - success/warning/danger-600 and darker are AA as text; their 50 tint
 *     is the background for the matching 700 text
 */
export const palette = {
  /** Sidebar, headers and other dark chrome. */
  navy: {
    50: '#F2F5FA',
    100: '#E4EAF3',
    200: '#C7D3E6',
    300: '#9DB0CE',
    400: '#6B85B2',
    500: '#465F93',
    600: '#2F4877',
    700: '#1D325C',
    800: '#122544',
    900: '#0B1F3A',
    950: '#061324',
  },

  /** Primary action colour. */
  brand: {
    50: '#EAF1FF',
    100: '#CFE0FF',
    200: '#9DC1FF',
    300: '#6A9FFF',
    400: '#3D80FF',
    500: '#1769FF',
    600: '#0B51D6',
    700: '#0A3FA8',
    800: '#0C3480',
    900: '#0C2B65',
  },

  /** Secondary accent, used with dark text on the 400/500 steps. */
  cyan: {
    50: '#E6FBFD',
    100: '#C3F5FA',
    200: '#8CEBF5',
    300: '#55DEEF',
    400: '#26CFE4',
    500: '#19C6D9',
    600: '#0FA3B3',
    700: '#0E8090',
    800: '#116771',
    900: '#13545C',
  },

  /** Positive state. 700 is the lightest step that stays AA as text. */
  success: {
    50: '#ECFDF3',
    100: '#D1FADF',
    200: '#A6F4C5',
    300: '#6CE9A6',
    400: '#32D583',
    500: '#12B76A',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  /** Caution state. 700 is the lightest step that stays AA as text. */
  warning: {
    50: '#FFFAEB',
    100: '#FEF0C7',
    200: '#FEDF89',
    300: '#FEC84B',
    400: '#FDB022',
    500: '#F79009',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  /** Destructive / error state. 700 is the lightest step that stays AA as text. */
  danger: {
    50: '#FEF3F2',
    100: '#FEE4E2',
    200: '#FECDCA',
    300: '#FDA29B',
    400: '#F97066',
    500: '#F04438',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  /**
   * Neutral family: text, borders and subtle surfaces.
   * `ink` is the default body colour, `ink-muted` secondary text and
   * `ink-faint` the lightest step that still passes AA as text.
   */
  ink: {
    DEFAULT: '#172033',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    muted: '#475569',
    faint: '#5F6B7F',
  },

  /** Hairline borders and dividers. */
  line: '#E2E8F0',

  /** Page background behind the cards. */
  canvas: '#F4F7FB',
};

export default palette;
