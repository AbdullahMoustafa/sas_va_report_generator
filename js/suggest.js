/* Chart types, role rules, suggestions and the page layout. */
(function () {
  'use strict';
  var RG = window.RG = window.RG || {};

  RG.CHART_TYPES = {
    kpi: { label: 'KPI card', icon: 'grid', roles: 'One or two measures; optional date for a sparkline' },
    hbar: { label: 'Bar chart (horizontal)', icon: 'bars', roles: 'Category + measure (second measure for % or split bars)' },
    vbar: { label: 'Column chart', icon: 'columns', roles: 'Category or date + measure' },
    line: { label: 'Line / trend', icon: 'trend', roles: 'Date + 1-3 measures (one panel each)' },
    donut: { label: 'Donut', icon: 'donut', roles: 'Category + measure' },
    heatmap: { label: 'Heatmap', icon: 'grid', roles: 'Two categories + measure' },
    table: { label: 'Table', icon: 'table', roles: 'Categories + measures' }
  };
  RG.FILTER_MODES = { pills: 'Pills (few values)', dropdown: 'Drop-down (single choice)', list: 'Check list (many values, sidebar)' };
  RG.SIZES = { auto: 'Auto', third: '1/3 width', half: '1/2 width', twothirds: '2/3 width', full: 'Full width' };

  function pickIcon(text) {
    var t = String(text).toLowerCase();
    return /percent|%|rate|ratio|share|pct/.test(t) ? 'percent' : /record|row|count|frequency|total/.test(t) ? 'database'
      : /patient|customer|user|people|employee|staff|member/.test(t) ? 'users' : /doctor|physician/.test(t) ? 'user'
      : /day|duration|time|hour|minute|wait/.test(t) ? 'clock' : /amount|cost|price|revenue|salary|fee|aed|usd|value/.test(t) ? 'coins'
      : /score|risk|fraud|alert|resist|error|fail/.test(t) ? 'alert' : /facilit|hospital|clinic|branch|site/.test(t) ? 'hospital'
      : /doc|leave|case|claim|file|report/.test(t) ? 'doc' : /organism|microbe|bacteria/.test(t) ? 'microbe' : /antibiotic|drug|medic/.test(t) ? 'pill'
      : 'star';
  }
  RG.pickIcon = pickIcon;

  /* ---------------- roles: the ordered field ids a chart sends to VA ---------------- */
  RG.roleIds = function (ch) {
    var m = (ch.measures || []).filter(Boolean);
    switch (ch.type) {
      case 'filter': return [ch.cat];
      case 'kpi': return (ch.opts.spark && ch.date ? [ch.date] : []).concat(m.slice(0, ch.opts.metric && ch.opts.metric !== 'value' ? 2 : 1));
      case 'hbar': return [ch.cat].concat(m.slice(0, ch.opts.metric === 'ratio' || ch.opts.stack ? 2 : 1));
      case 'vbar': return [ch.cat || ch.date].concat(m.slice(0, 1));
      case 'line': return [ch.date].concat(m.slice(0, ch.opts.ratio ? 2 : 3));
      case 'donut': return [ch.cat].concat(m.slice(0, 1));
      case 'heatmap': return [ch.cat, ch.cat2].concat(m.slice(0, ch.opts.metric === 'ratio' ? 2 : 1));
      case 'table': return (ch.cats || []).filter(Boolean).concat(m);
    }
    return [];
  };
  /* the category a chart filters other objects by (null when it is not a filter source) */
  RG.sourceField = function (ch) {
    if (ch.type === 'filter') return ch.cat;
    if (ch.source === false) return null;
    if (ch.type === 'hbar' || ch.type === 'donut') return ch.cat;
    if (ch.type === 'vbar') return ch.cat || ch.date;
    return null;
  };

  /* what is missing before a chart can be built */
  RG.chartProblems = function (ch, F) {
    var p = [], m = (ch.measures || []).filter(function (id) { return F.byId[id]; });
    function need(id, what) { if (!id || !F.byId[id]) p.push(what); }
    switch (ch.type) {
      case 'filter': need(ch.cat, 'a category'); break;
      case 'kpi': if (!m.length) p.push('a measure'); if (ch.opts.metric && ch.opts.metric !== 'value' && m.length < 2) p.push('a second measure (ratio = 2nd / 1st)'); break;
      case 'hbar': case 'donut': need(ch.cat, 'a category'); if (!m.length) p.push('a measure');
        if (ch.type === 'hbar' && (ch.opts.metric === 'ratio' || ch.opts.stack) && m.length < 2) p.push('a second measure'); break;
      case 'vbar': if (!(ch.cat && F.byId[ch.cat]) && !(ch.date && F.byId[ch.date])) p.push('a category or date'); if (!m.length) p.push('a measure'); break;
      case 'line': need(ch.date, 'a date'); if (!m.length) p.push('a measure'); if (ch.opts.ratio && m.length < 2) p.push('a second measure'); break;
      case 'heatmap': need(ch.cat, 'a row category'); need(ch.cat2, 'a column category'); if (!m.length) p.push('a measure'); break;
      case 'table': if (!(ch.cats || []).filter(function (id) { return F.byId[id]; }).length) p.push('at least one category'); break;
    }
    return p;
  };

  /* ---------------- suggestions ---------------- */
  function rankCats(F) {
    var cats = F.cats.filter(function (c) { return !c.isId; });
    function score(c) { var d = c.distinct || 8; return d >= 2 && d <= 30 ? 100 - Math.abs(d - 8) : d > 30 ? 40 - Math.min(d, 400) / 20 : 0; }
    return cats.slice().sort(function (a, b) { return score(b) - score(a); });
  }
  function primaryMeasure(F) {
    var cols = F.measures.filter(function (m) { return m.kind === 'col' && m.additive; });
    var named = cols.filter(function (m) { return /amount|total|count|days|value|cost|qty|quantity|revenue|sales|result/i.test(m.label); });
    return (named[0] || cols[0] || F.byId.count).id;
  }
  function blank(type, extra) {
    return Object.assign({ id: RG.id('ch'), type: type, title: '', cat: '', cat2: '', date: '', cats: [], measures: [], size: 'auto', source: true, opts: {} }, extra || {});
  }
  RG.blankChart = blank;

  function ensureDistinct(state, F) {
    var idCol = F.cats.filter(function (c) { return c.isId && !c.numeric; })[0] || F.cats.filter(function (c) { return c.isId; })[0];
    if (!idCol) return null;
    state.data.extra = state.data.extra || [];
    var ex = state.data.extra.filter(function (x) { return x.kind === 'distinct' && x.col === idCol.col; })[0];
    if (!ex) { ex = { id: RG.id('m'), kind: 'distinct', col: idCol.col, label: 'Distinct ' + idCol.label }; state.data.extra.push(ex); }
    return 'x:' + ex.id;
  }

  /* fill the empty roles of a chart from the catalog */
  RG.fillRoles = function (ch, F) {
    var cats = rankCats(F), pm = primaryMeasure(F), date = F.dates[0] && F.dates[0].id;
    ch.opts = ch.opts || {};
    function cat(i) { var c = cats[i] || cats[0]; return c ? c.id : ''; }
    if (!ch.measures || !ch.measures.filter(function (id) { return F.byId[id]; }).length) ch.measures = ch.type === 'filter' ? [] : [pm];
    switch (ch.type) {
      case 'filter': if (!F.byId[ch.cat]) ch.cat = (F.cats.filter(function (c) { return c.kind === 'year'; })[0] || cats[0] || {}).id || ''; break;
      case 'hbar': case 'donut': if (!F.byId[ch.cat]) ch.cat = ch.type === 'donut' ? (cats.filter(function (c) { return (c.distinct || 9) <= 8; })[0] || cats[0] || {}).id || '' : cat(0); break;
      case 'vbar': if (!F.byId[ch.cat] && !F.byId[ch.date]) { if (date) ch.date = date; else ch.cat = cat(0); } break;
      case 'line': if (!F.byId[ch.date]) ch.date = date || ''; break;
      case 'heatmap': if (!F.byId[ch.cat]) ch.cat = cat(0); if (!F.byId[ch.cat2] || ch.cat2 === ch.cat) ch.cat2 = cat(1) !== ch.cat ? cat(1) : cat(2); break;
      case 'table': if (!(ch.cats || []).filter(function (id) { return F.byId[id]; }).length) ch.cats = cats.slice(0, 3).map(function (c) { return c.id; }); break;
      case 'kpi': if (ch.opts.spark && !F.byId[ch.date]) ch.date = date || ''; break;
    }
    if (!ch.title) ch.title = RG.autoTitle(ch, F);
    if (ch.type === 'kpi' && !ch.icon) ch.icon = pickIcon(ch.title);
    return ch;
  };

  RG.autoTitle = function (ch, F) {
    function L(id) { return F.byId[id] ? F.byId[id].label : ''; }
    var m1 = L((ch.measures || [])[0]), m2 = L((ch.measures || [])[1]);
    switch (ch.type) {
      case 'filter': return L(ch.cat);
      case 'kpi': return ch.opts.metric === 'ratio' ? (ch.opts.rlabel || '% ' + m2) : ch.opts.metric === 'share' ? m2 : m1;
      case 'hbar': return (ch.opts.metric === 'ratio' ? (ch.opts.rlabel || '% ' + m2) : (ch.opts.top ? 'Top ' + ch.opts.top + ' ' : '') + m1) + ' by ' + L(ch.cat);
      case 'vbar': return m1 + ' by ' + L(ch.cat || ch.date);
      case 'line': return (ch.opts.ratio ? m1 + ' and ' + (ch.opts.rlabel || '% ' + m2) : (ch.measures || []).slice(0, 3).map(L).join(', ')) + ' over time';
      case 'donut': return m1 + ' by ' + L(ch.cat);
      case 'heatmap': return (ch.opts.metric === 'ratio' ? (ch.opts.rlabel || '% ' + m2) : m1) + ': ' + L(ch.cat) + ' × ' + L(ch.cat2);
      case 'table': return 'Details';
    }
    return '';
  };

  /* Suggested content for page i (0-based). Only used for pages the user left empty.
     A conditional count (e.g. AST Result = Resistant) next to its base count makes ratio views: % KPIs, a % trend panel,
     % bars / heatmap cells (hidden below a minimum base, 30 by default) and a % table column. */
  RG.suggestPage = function (state, i, F) {
    var cats = rankCats(F), pm = primaryMeasure(F), date = F.dates[0] && F.dates[0].id,
      year = F.cats.filter(function (c) { return c.kind === 'year'; })[0] || F.cats.filter(function (c) { return /year/i.test(c.label); })[0],
      low = cats.filter(function (c) { return c.kind !== 'year' && (c.distinct || 6) >= 2 && (c.distinct || 6) <= 8; }),
      mid = cats.filter(function (c) { return c.kind !== 'year' && (c.distinct || 12) > 2; }),
      distinctId = ensureDistinct(state, F);
    F = RG.fields(state);
    var pmF = F.byId[pm], wm = F.measures.filter(function (m) { return m.kind === 'where'; })[0],
      base = wm ? (pmF && pmF.additive ? pm : 'count') : pm, other = F.measures.filter(function (m) { return m.kind === 'col' && m.id !== pm; }),
      rl = wm ? '% ' + wm.label.replace(/\s*(results?|count|records?)\s*/ig, ' ').trim() : '', MIN = 30;
    var page = { filters: [], charts: [] };
    function filter(c, mode, sort) { if (c) page.filters.push(blank('filter', { cat: c.id, opts: { mode: mode || (c.distinct > 9 ? 'list' : 'pills'), sort: sort || (c.kind === 'year' ? 'desc' : 'auto') } })); }
    function chart(type, x) { var ch = RG.fillRoles(blank(type, x), F); page.charts.push(ch); return ch; }
    function kpi(id, x) {
      var f = F.byId[id]; if (!f) return;
      chart('kpi', Object.assign({ measures: [id], date: f.additive && date ? date : '', opts: { spark: !!(f.additive && date) }, sub: f.kind === 'distinct' ? 'Distinct count' : '' }, x || {}));
    }
    function ratioKpis() {
      if (!wm) return;
      chart('kpi', { measures: [base, wm.id], date: date || '', opts: { metric: 'share', spark: !!date, rlabel: rl }, title: wm.label, icon: 'alert' });
      chart('kpi', { measures: [base, wm.id], opts: { metric: 'ratio', rlabel: rl }, title: rl, icon: 'percent' });
    }
    if (i === 0) {
      page.title = 'Overview'; page.subtitle = 'Key figures at a glance';
      filter(year, 'pills', 'desc'); filter(low[0], 'pills');
      kpi(base);
      if (wm) ratioKpis(); else if (pm !== base) kpi(pm);
      [distinctId, other[0] && other[0].id].filter(Boolean).slice(0, wm ? 1 : 2).forEach(function (id) { kpi(id); });
      if (date) chart('line', wm ? { date: date, measures: [base, wm.id], opts: { ratio: true, bars: true, rlabel: rl } } : { date: date, measures: [pm], opts: { bars: pmF && pmF.additive } });
      if (wm && (low[0] || mid[0])) chart('hbar', { cat: (low[0] || mid[0]).id, measures: [base, wm.id], opts: { metric: 'ratio', min: MIN, rlabel: rl } });
      if (mid[0]) chart('hbar', { cat: mid[0].id, measures: wm ? [base, wm.id] : [pm], opts: { top: 10, stack: !!wm } });
      if (!wm && (low[0] || low[1])) chart('donut', { cat: (low[1] || low[0]).id, measures: [pm], opts: { top: 6 } });
      else if (!wm && mid[1]) chart('hbar', { cat: mid[1].id, measures: [pm], opts: { top: 10 } });
    } else if (i === 1) {
      page.title = wm ? rl.replace(/^%\s*/, '') + ' analysis' : 'Breakdown'; page.subtitle = wm ? 'How often, where and for what' : 'Where the numbers come from';
      filter(year, 'pills', 'desc'); if (mid[0] && (mid[0].distinct || 12) > 8) filter(mid[0], 'list'); else filter(low[0], 'pills');
      if (wm) {
        kpi(base); ratioKpis();
        if (mid[1]) chart('hbar', { cat: mid[1].id, measures: [base, wm.id], opts: { metric: 'ratio', top: 20, order: 'volume', min: MIN, rlabel: rl } });
        if (mid[0] && mid[1]) chart('heatmap', { cat: mid[0].id, cat2: mid[1].id, measures: [base, wm.id], opts: { metric: 'ratio', rows: 12, cols: 12, min: MIN, rlabel: rl } });
        if (mid[0] && mid[1]) chart('table', { cats: [mid[0].id, mid[1].id], measures: [base, wm.id], opts: { ratio: true, min: MIN, rlabel: rl } });
      } else {
        if (mid[1]) chart('hbar', { cat: mid[1].id, measures: [pm], opts: { top: 15 } });
        if (mid[0] && mid[1]) chart('heatmap', { cat: mid[0].id, cat2: (mid[2] || mid[1]).id, measures: [pm], opts: { rows: 12, cols: 10 } });
        if (date) chart('vbar', { date: date, measures: [other[0] ? other[0].id : pm] });
        if (mid[2]) chart('hbar', { cat: mid[2].id, measures: [pm], opts: { top: 10 } });
      }
    } else if (i === 2) {
      page.title = 'Details'; page.subtitle = 'Every combination, searchable and sortable';
      filter(year, 'pills', 'desc'); filter(low[0], 'pills');
      kpi(base); if (wm) ratioKpis(); if (distinctId) kpi(distinctId); else if (pm !== base) kpi(pm);
      var tm = wm ? [base, wm.id] : [pm].concat(other.slice(0, 2).map(function (m) { return m.id; }));
      if (mid[2] || low[1]) chart('hbar', { cat: (mid[2] || low[1]).id, measures: [tm[0]], opts: { top: 15 } });
      if (low[1] || low[0]) chart('donut', { cat: (low[1] || low[0]).id, measures: [tm[0]], opts: { top: 6 } });
      chart('table', { cats: cats.slice(0, 3).map(function (c) { return c.id; }), measures: tm.filter(function (x, k, a) { return a.indexOf(x) === k; }), opts: wm ? { ratio: true, min: MIN, rlabel: rl } : {} });
    } else {
      var focus = mid[(i - 2) % Math.max(mid.length, 1)] || cats[0];
      page.title = focus ? 'By ' + focus.label : 'Page ' + (i + 1); page.subtitle = '';
      filter(year, 'pills', 'desc'); if (focus) filter(focus, (focus.distinct || 12) > 9 ? 'list' : 'pills');
      kpi(base); if (wm) ratioKpis(); else kpi('count');
      if (date) chart('line', wm ? { date: date, measures: [base, wm.id], opts: { ratio: true, bars: true, rlabel: rl } } : { date: date, measures: [pm] });
      mid.filter(function (c) { return !focus || c.id !== focus.id; }).slice(0, 2).forEach(function (c) {
        chart('hbar', wm ? { cat: c.id, measures: [base, wm.id], opts: { metric: 'ratio', top: 10, order: 'volume', min: MIN, rlabel: rl } } : { cat: c.id, measures: [pm], opts: { top: 10 } }); });
    }
    page.filters = page.filters.filter(function (f, k, a) { return f.cat && a.map(function (x) { return x.cat; }).indexOf(f.cat) === k; });
    var seen = {};
    page.charts = page.charts.filter(function (c) { var k = c.type + JSON.stringify(RG.roleIds(c)) + JSON.stringify(c.opts); if (seen[k]) return false; seen[k] = 1; return true; });
    return page;
  };

  /* ---------------- layout (units: % of the report width / of the visible report height) ---------------- */
  var X0 = 1.5, WIDTH = 97, GAP = 1.5, TOP = 9.6, HDR = 8.5, FILTER_H = 6.4, KPI_H = 16.4;
  var ROW_H = { hbar: 36, vbar: 36, donut: 36, heatmap: 48, line: 36, table: 44 };
  var SPAN = { third: 4, half: 6, twothirds: 8, full: 12 };

  function autoSpans(charts) {
    var spans = [], i = 0;
    while (i < charts.length) {
      var a = charts[i], b = charts[i + 1];
      if (a.size !== 'auto') { spans.push(SPAN[a.size] || 6); i++; continue; }
      if (a.type === 'line' || a.type === 'table' || !b) { spans.push(12); i++; continue; }
      if (b.size !== 'auto') { spans.push(Math.max(4, 12 - (SPAN[b.size] || 6))); i++; continue; }
      if (b.type === 'line' || b.type === 'table') { spans.push(12); i++; continue; }
      if (a.type === 'donut' && b.type !== 'donut') { spans.push(4, 8); }
      else if (b.type === 'donut' && a.type !== 'donut') { spans.push(8, 4); }
      else spans.push(6, 6);
      i += 2;
    }
    return spans;
  }
  function rowHeight(ch) {
    var h = ROW_H[ch.type] || 36;
    if (ch.type === 'hbar' && (ch.opts.top || 0) > 12) h = 46 + ((ch.opts.top || 0) > 18 ? 18 : 0);
    if (ch.type === 'line' && ((ch.measures || []).length > 1 || ch.opts.ratio)) h = 42;
    if (ch.type === 'line' && (ch.measures || []).length > 2 && !ch.opts.ratio) h = 50;
    if (ch.height) h = ch.height;
    return h;
  }

  /* -> {ph, items:[{ch, x, y, w, h}]} */
  RG.layoutPage = function (page, F) {
    var items = [], filters = page.filters || [], charts = page.charts || [], kpis = charts.filter(function (c) { return c.type === 'kpi'; }),
      others = charts.filter(function (c) { return c.type !== 'kpi'; }), side = filters.some(function (f) { return f.opts.mode === 'list'; }),
      cx = side ? X0 + 20.5 + GAP : X0, cw = side ? WIDTH - 20.5 - GAP : WIDTH, y = TOP, i;
    if (!side && filters.length) {
      var ws = filters.map(function (f) { return f.opts.mode === 'pills' ? Math.min(4, Math.max(1.2, 1 + ((F && F.byId[f.cat] && F.byId[f.cat].distinct) || 6) / 3)) : 1.2; }),
        tot = ws.reduce(function (a, b) { return a + b; }, 0), x = X0, avail = WIDTH - GAP * (filters.length - 1);
      filters.forEach(function (f, k) { var w = avail * ws[k] / tot; items.push({ ch: f, x: x, y: y, w: w, h: FILTER_H }); x += w + GAP; });
      y += FILTER_H + 1;
    }
    var perRow = kpis.length === 5 ? 5 : Math.min(4, kpis.length), kw;
    for (i = 0; i < kpis.length; i += perRow) {
      var row = kpis.slice(i, i + perRow); kw = (cw - GAP * (row.length - 1)) / row.length;
      row.forEach(function (k, j) { items.push({ ch: k, x: cx + j * (kw + GAP), y: y, w: kw, h: KPI_H }); });
      y += KPI_H + GAP;
    }
    var spans = autoSpans(others), col = 0, rowItems = [], rowH = 0, unit = (cw + GAP) / 12;
    function flush() { rowItems.forEach(function (it) { it.h = rowH; }); if (rowItems.length) y += rowH + GAP; rowItems = []; rowH = 0; col = 0; }
    others.forEach(function (ch, k) {
      var s = Math.min(12, spans[k] || 6);
      if (col + s > 12) flush();
      var it = { ch: ch, x: cx + col * unit, y: y, w: s * unit - GAP, h: 0 };
      items.push(it); rowItems.push(it); rowH = Math.max(rowH, rowHeight(ch)); col += s;
      if (col >= 12) flush();
    });
    flush();
    var last = items.filter(function (it) { return it.ch.type !== 'filter' && it.ch.type !== 'kpi'; }), lastY = last.length ? Math.max.apply(null, last.map(function (it) { return it.y; })) : null;
    if (lastY != null && y < 100) { last.forEach(function (it) { if (it.y === lastY) it.h += 100 - y; }); y = 100; }
    var ph = Math.max(100, RG.round(y + 0.5, 1));
    if (side) {
      var sy = TOP, pills = filters.filter(function (f) { return f.opts.mode !== 'list'; }), lists = filters.filter(function (f) { return f.opts.mode === 'list'; });
      pills.forEach(function (f) { items.push({ ch: f, x: X0, y: sy, w: 20.5, h: FILTER_H }); sy += FILTER_H + 1; });
      var lh = (ph - 1.5 - sy - GAP * (lists.length - 1)) / lists.length;
      lists.forEach(function (f) { items.push({ ch: f, x: X0, y: sy, w: 20.5, h: lh }); sy += lh + GAP; });
    }
    items.forEach(function (it) { it.x = RG.round(it.x); it.y = RG.round(it.y); it.w = RG.round(it.w); it.h = RG.round(it.h); });
    return { ph: ph, hdr: HDR, items: items };
  };

  /* ---------------- URL parameters of one object ---------------- */
  RG.visualParams = function (ch, F, k) {
    var p = [], o = ch.opts || {};
    function add(key, v) { if (v !== '' && v != null && v !== false) p.push([key, v === true ? 1 : v]); }
    add('visual', ch.type === 'filter' ? 'filter' : ch.type);
    add('title', ch.title || RG.autoTitle(ch, F));
    switch (ch.type) {
      case 'filter':
        add('mode', o.mode || 'pills'); add('sort', o.sort && o.sort !== 'auto' ? o.sort : ''); break;
      case 'kpi':
        add('metric', o.metric && o.metric !== 'value' ? o.metric : ''); add('spark', o.spark && ch.date ? 1 : '');
        add('icon', ch.icon || pickIcon(ch.title)); add('accent', ch.accent || RG.KPI_ACCENTS[(k || 0) % RG.KPI_ACCENTS.length]); add('sub', ch.sub || '');
        add('rlabel', o.rlabel || ''); break;
      case 'hbar':
        add('metric', o.metric === 'ratio' ? 'ratio' : ''); add('stack', o.stack && o.metric !== 'ratio' ? 1 : ''); add('top', o.top || '');
        add('order', o.metric === 'ratio' && o.order === 'volume' ? 'volume' : ''); add('min', o.metric === 'ratio' ? o.min || '' : ''); add('rlabel', o.rlabel || '');
        add('select', ch.source === false ? 0 : ''); break;
      case 'vbar': add('top', o.top || ''); add('select', ch.source === false ? 0 : ''); break;
      case 'line': add('ratio', o.ratio ? 1 : ''); add('bars', o.bars ? 1 : ''); add('rlabel', o.rlabel || ''); break;
      case 'donut': add('top', o.top || 6); add('center', o.center || ''); add('select', ch.source === false ? 0 : ''); break;
      case 'heatmap': add('metric', o.metric === 'ratio' ? 'ratio' : ''); add('rows', o.rows || 12); add('cols', o.cols || 12);
        add('min', o.metric === 'ratio' ? o.min || '' : ''); add('rlabel', o.rlabel || ''); break;
      case 'table': add('cats', (ch.cats || []).filter(function (id) { return F.byId[id]; }).length); add('ratio', o.ratio ? 1 : '');
        add('min', o.ratio ? o.min || '' : ''); add('rlabel', o.rlabel || ''); break;
    }
    return p;
  };
  RG.query = function (pairs) { return pairs.map(function (kv) { return RG.qp(kv[0]) + '=' + RG.qp(kv[1]); }).join('&'); };
})();
