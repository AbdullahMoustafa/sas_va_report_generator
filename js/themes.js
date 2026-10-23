/* Colour themes. Series palettes are the validated categorical sets (dark / light steps of the same eight hues):
   adjacent-pair CVD separation and contrast were checked against every surface below. */
(function () {
  'use strict';
  var RG = window.RG = window.RG || {};

  var DARK_SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
  var LIGHT_SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];

  function dark(o) {
    return Object.assign({
      mode: 'dark', tip: '#050c17', onAccent: '#ffffff', shadow: 'rgba(0,0,0,.5)', hover: 'rgba(255,255,255,.04)',
      series: DARK_SERIES.slice(), other: '#5b6b80'
    }, o);
  }
  function light(o) {
    return Object.assign({
      mode: 'light', tip: '#ffffff', onAccent: '#ffffff', shadow: 'rgba(15,25,40,.16)', hover: 'rgba(0,0,0,.035)',
      series: LIGHT_SERIES.slice(), other: '#98a2b3'
    }, o);
  }

  RG.THEMES = {
    midnight: dark({ label: 'Midnight Navy', page: '#07111f', card: '#0c1a2e', cardHi: '#11243e', head: '#0e2036',
      ink: '#eef4fb', ink2: '#b6c7dc', muted: '#8098b4', faint: '#4f6886',
      line: 'rgba(150,185,225,.13)', line2: 'rgba(150,185,225,.24)', accent: '#4f98ff', accent2: '#2cc4e6' }),
    graphite: dark({ label: 'Graphite', page: '#0e0f12', card: '#17191d', cardHi: '#1e2126', head: '#1b1d22', tip: '#0a0b0d',
      ink: '#f4f5f7', ink2: '#c3c6cb', muted: '#9ea2a9', faint: '#5d626b',
      line: 'rgba(255,255,255,.08)', line2: 'rgba(255,255,255,.16)', accent: '#4f8cff', accent2: '#2ccaff' }),
    ocean: dark({ label: 'Deep Teal', page: '#061416', card: '#0b2226', cardHi: '#0f2c31', head: '#0d282c', tip: '#041012',
      ink: '#ecf8f7', ink2: '#b3d3d0', muted: '#7ea5a1', faint: '#4b6f6c',
      line: 'rgba(140,210,200,.13)', line2: 'rgba(140,210,200,.24)', accent: '#2dd4bf', accent2: '#60a5fa', onAccent: '#04201d' }),
    plum: dark({ label: 'Royal Plum', page: '#0f0b18', card: '#1a1427', cardHi: '#221a33', head: '#1e172d', tip: '#0b0812',
      ink: '#f5f2fb', ink2: '#cbc2dc', muted: '#9d93b3', faint: '#5f5675',
      line: 'rgba(190,170,230,.13)', line2: 'rgba(190,170,230,.24)', accent: '#a78bfa', accent2: '#f472b6', onAccent: '#160f24' }),
    clean: light({ label: 'Clean Light', page: '#eef1f5', card: '#ffffff', cardHi: '#ffffff', head: '#f4f6f9',
      ink: '#14181f', ink2: '#3d4655', muted: '#667085', faint: '#a3acb9',
      line: 'rgba(20,30,50,.09)', line2: 'rgba(20,30,50,.17)', accent: '#2a78d6', accent2: '#0090d4' }),
    sand: light({ label: 'Desert Sand', page: '#f5f1ea', card: '#fffdf9', cardHi: '#fffdf9', head: '#f7f2ea',
      ink: '#1f1a14', ink2: '#4b4337', muted: '#7a6f5f', faint: '#b5a993',
      line: 'rgba(70,50,20,.10)', line2: 'rgba(70,50,20,.18)', accent: '#a87b2a', accent2: '#2a78d6' })
  };

  /* The theme with the user's overrides (accent colour, custom series) applied */
  RG.resolveTheme = function (report) {
    var t = Object.assign({}, RG.THEMES[report.theme] || RG.THEMES.midnight);
    t.series = (t.series || []).slice();
    if (report.accent) t.accent = report.accent;
    if (report.customSeries && report.series && report.series.length === 6) t.series = report.series.slice();
    return t;
  };

  /* The CSS block that replaces /*@THEME@*\/ in the DDC template */
  RG.themeCss = function (t) {
    var v = {
      '--page': t.page, '--card': t.card, '--card-hi': t.cardHi, '--head': t.head, '--tip': t.tip,
      '--line': t.line, '--line-2': t.line2, '--ink': t.ink, '--ink-2': t.ink2, '--muted': t.muted, '--faint': t.faint,
      '--accent': t.accent, '--accent-2': t.accent2, '--on-accent': t.onAccent, '--other': t.other,
      '--shadow': t.shadow, '--hover': t.hover
    };
    t.series.forEach(function (c, i) { v['--s' + (i + 1)] = c; });
    return ':root{' + Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(';') + '}';
  };

  /* Icon-chip accents for KPI cards: a fixed, readable set (decoration only - values stay in text colours) */
  RG.KPI_ACCENTS = ['26b5a0', 'ec6f61', 'e3a32a', '9085e9', '2cc4e6', '4f98ff'];
})();
