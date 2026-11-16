// Series colors in fixed order, one step per mode: the first five slots of the reference categorical palette,
// validated for color-vision deficiencies and contrast on the light (#ffffff) and dark (#1a1a1a) surfaces.
const SERIES = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
];

export const MAXIMUM_SERIES = SERIES.length;
// Above this many points a line shows no markers; points stay reachable through the hover radius.
export const MAXIMUM_POINTS_WITH_MARKERS = 300;

export function seriesColor(index, isDark) {
  return SERIES[index][isDark ? 'dark' : 'light'];
}

export function translucent(hex, alpha = 0.15) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

export function chartInk(isDark) {
  return {
    text: isDark ? '#ededed' : '#1a1a1a',
    muted: isDark ? '#a3a3a3' : '#5c5c5c',
    grid: isDark ? '#2e2e2e' : '#e5e5e5',
    tooltipBackground: isDark ? '#262626' : '#1a1a1a',
    tooltipBorder: isDark ? '#404040' : '#1a1a1a',
  };
}
