import palette from './palette.js';

/**
 * Data-visualisation colours.
 *
 * Charts and swatches are painted as SVG fills and inline styles, so they
 * need plain hex values rather than Tailwind classes. They are derived from
 * `src/lib/palette.js` so the two never drift apart.
 */
export const CHART = {
  brand: palette.brand[500],
  cyan: palette.cyan[500],
  navy: palette.navy[900],
  grid: palette.ink[200],
  axis: palette.ink[500],
  axisStrong: palette.ink[600],
  tooltipBorder: palette.line,
  tooltipCursor: palette.ink[100],
  surface: '#FFFFFF',
};

/**
 * Categorical series palette for pie and multi-series charts.
 * Hues are spaced far enough apart to stay distinguishable side by side.
 */
export const CATEGORICAL = [
  palette.brand[500],
  palette.cyan[500],
  palette.warning[500],
  '#7C3AED',
  palette.danger[500],
  palette.success[500],
];

/** Swatch colours offered when colour-coding a category. */
export const CATEGORY_COLORS = [
  palette.brand[500],
  palette.cyan[500],
  palette.navy[900],
  palette.warning[500],
  palette.danger[500],
  '#7C3AED',
  palette.success[500],
  '#E11D48',
  palette.ink[500],
];

export default CHART;
