/* The generator UI: five steps, state kept in localStorage, project files for sharing. */
(function () {
  'use strict';
  var RG = window.RG, esc = RG.esc;
  var KEY = 'demo-report-generator:v1', OLD_KEY = 'sasva-report-generator:v1', MAX_ROWS = 5000;
  var STEPS = [
    { t: 'Report', s: 'Name, logo, colours' },
    { t: 'SAS environment', s: 'Server, CAS table, folders' },
    { t: 'Data', s: 'Sample rows or schema' },
    { t: 'Pages & charts', s: 'Layout and content' },
    { t: 'Preview & export', s: 'Check, then download' }
  ];
  var IC = {
    kpi: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    hbar: '<path d="M4 6h10M4 12h16M4 18h7"/>', vbar: '<path d="M6 20V11M12 20V4M18 20v-6"/>', line: '<path d="M3 17l6-6 4 4 8-8"/>',
    donut: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>', heatmap: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>', filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', wand: '<path d="m4 20 11-11M14 4l1.5 3L19 8.5 15.5 10 14 13l-1.5-3L9 8.5 12.5 7z"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    data: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  var STEP_ICON = ['doc', 'server', 'data', 'kpi', 'eye'];
  RG.svg = svg;
  function svg(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (IC[name] || '') + '</svg>'; }

  /* ---------------- state ---------------- */
  function defaults() {
    return {
      version: 1, step: 0, curPage: 0, previewPage: 0,
      report: { name: '', eyebrow: '', description: '', brief: '', note: '', logo: '', logoName: '', theme: 'midnight', accent: '', customSeries: false, series: null },
      env: { server: 'https://your-viya-server', casServer: 'cas-shared-default', library: 'Public', table: '', parentPath: '/Development',
        parentFolderId: '7161a746-108e-446d-89ec-cc7cb408c544', reportFolder: '', assetsFolder: 'Assets', jobName: '', user: '', vaTheme: 'midnight2020' },
      data: { kind: '', fileName: '', columns: [], rows: [], extra: [], countLabel: 'Records', synth: true },
      pages: [], pageCount: 3, ids: {}
    };
  }
  var state = load();
  var rowsCache = null, rowsKey = '';

  function load() {
    /* first run of the renamed app: carry over the work saved by the SAS VA Report Generator */
    try { var s = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || 'null'); if (s && s.version === 1) return merge(defaults(), s); } catch (e) { }
    return defaults();
  }
  function merge(a, b) { Object.keys(b).forEach(function (k) { a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? merge(a[k], b[k]) : b[k]; }); return a; }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { var s = RG.clone(state); s.data.rows = s.data.rows.slice(0, 500); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e2) { } }
    }, 250);
    document.getElementById('projName').textContent = state.report.name || 'Untitled report';
  }
  function F() { return RG.fields(state); }
  function previewRows() {
    var k = state.data.fileName + '|' + state.data.rows.length + '|' + state.data.synth + '|' + state.data.columns.map(function (c) { return c.name + c.type + c.role; }).join(',');
    if (k !== rowsKey) {
      rowsKey = k;
      rowsCache = state.data.synth || state.data.rows.length < 30 ? RG.synthRows(state.data, 1500) : RG.prepareRows(state.data);
    }
    return rowsCache;
  }

  /* ---------------- paths in state ---------------- */
  function getPath(p) { return p.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state); }
  function setPath(p, v) {
    var ks = p.split('.'), o = state;
    for (var i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  function toast(msg, bad) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast' + (bad ? ' bad' : ''); }, bad ? 6000 : 3200);
  }

  /* ---------------- validation per step ---------------- */
  function stepDone(i) {
    var e = state.env;
    if (i === 0) return !!state.report.name.trim();
    if (i === 1) return !!(e.server && e.casServer && e.library && e.table && e.parentPath && /^[0-9a-f-]{36}$/i.test(e.parentFolderId || ''));
    if (i === 2) return state.data.columns.some(function (c) { return c.role !== 'ignore'; });
    if (i === 3) { var f = F(); return state.pages.length > 0 && state.pages.every(function (p) { return (p.charts.length || p.filters.length) && p.charts.concat(p.filters).every(function (c) { return !RG.chartProblems(c, f).length; }); }); }
    return false;
  }

  /* ---------------- rendering ---------------- */
  var shownStep = -1;
  function render() {
    document.getElementById('steps').innerHTML = navHtml();
    var main = document.getElementById('main');
    main.innerHTML = [stepReport, stepEnv, stepData, stepPages, stepExport][state.step]();
    if (shownStep !== state.step) { main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter'); shownStep = state.step; }
    if (RG.AI) RG.AI.onRender();
    document.getElementById('projName').textContent = state.report.name || 'Untitled report';
    if (state.step === 4) mountPreview();
  }
  function navHtml() {
    var done = [0, 1, 2, 3].filter(stepDone).length, pct = Math.round(done / 4 * 100);
    return '<div class="steps-title">Build your report</div>' + STEPS.map(function (s, i) {
      return '<button class="step' + (state.step === i ? ' on' : '') + (stepDone(i) ? ' done' : '') + '" data-act="goto" data-i="' + i + '"><span class="n">' + (stepDone(i) ? '&#10003;' : i + 1) +
        '</span><span>' + s.t + '<small>' + s.s + '</small></span></button>';
    }).join('') +
      '<div class="progress"><div class="row"><b>' + done + ' of 4 steps ready</b><span class="spacer"></span><span class="muted small">' + pct + '%</span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<button class="ai-cta" data-ai="open">' + svg('spark') + '<span><b>Report Assistant</b><small>Ask AI for charts and pages</small></span></button>';
  }
  function head(title, sub, right) {
    return '<div class="head"><span class="hicon">' + svg(STEP_ICON[state.step]) + '</span><div class="grow"><div class="eyebrow">Step ' + (state.step + 1) + ' of 5</div><h1>' + title + '</h1><p>' + sub + '</p></div>' + (right || '') + '</div>';
  }
  function navBtns(prev, next) {
    return '<div class="nav">' + (prev ? '<button class="btn" data-act="goto" data-i="' + (state.step - 1) + '">&larr; ' + prev + '</button>' : '<span></span>') +
      (next ? '<button class="btn primary" data-act="goto" data-i="' + (state.step + 1) + '">' + next + ' &rarr;</button>' : '') + '</div>';
  }
  function field(label, path, opts) {
    opts = opts || {};
    var v = getPath(path); v = v == null ? '' : v;
    var inp = opts.select
      ? '<select data-path="' + path + '"' + (opts.re ? ' data-re="1"' : '') + '>' + opts.select.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'
      : opts.area ? '<textarea data-path="' + path + '" placeholder="' + esc(opts.ph || '') + '">' + esc(v) + '</textarea>'
        : '<input type="' + (opts.num ? 'number' : 'text') + '" data-path="' + path + '"' + (opts.num ? ' data-kind="num"' : '') + (opts.re ? ' data-re="1"' : '') +
        ' value="' + esc(v) + '" placeholder="' + esc(opts.ph || '') + '"' + (opts.min != null ? ' min="' + opts.min + '"' : '') + (opts.max != null ? ' max="' + opts.max + '"' : '') + '>';
    return '<label class="f"><span>' + label + (opts.req ? ' <i>*</i>' : '') + '</span>' + inp + (opts.help ? '<em>' + opts.help + '</em>' : '') + '</label>';
  }
  function check(label, path, re) {
    return '<label class="chk"><input type="checkbox" data-path="' + path + '" data-kind="bool"' + (re ? ' data-re="1"' : '') + (getPath(path) ? ' checked' : '') + '>' + label + '</label>';
  }

  /* ---------- step 1: report ---------- */
  function stepReport() {
    var r = state.report, t = RG.resolveTheme(r);
    var themes = Object.keys(RG.THEMES).map(function (k) {
      var th = RG.THEMES[k];
      return '<button class="theme' + (r.theme === k ? ' on' : '') + '" data-act="theme" data-k="' + k + '"><div class="sw" style="background:' + th.page + '">' +
        '<div class="bar" style="background:' + th.accent + '"></div><div class="cards">' + th.series.slice(0, 4).map(function (c) { return '<i style="background:' + th.card + ';border-bottom:3px solid ' + c + '"></i>'; }).join('') +
        '</div></div><div class="lb">' + th.label + '<small>' + th.mode + '</small></div></button>';
    }).join('');
    var series = t.series.map(function (c, i) { return '<input type="color" value="' + c + '" data-act="series" data-i="' + i + '"' + (r.customSeries ? '' : ' disabled') + '>'; }).join('');
    return head('Report', 'What the report is called and how it looks. Everything here appears in the page header of every page.') +
      '<div class="panel"><h3>Identity</h3><div class="grid g2">' +
      field('Report name', 'report.name', { req: true, ph: 'e.g. National AMR & HAI Surveillance' }) +
      field('Header line above the page title', 'report.eyebrow', { ph: 'e.g. Department of Health', help: 'Defaults to the report name' }) +
      field('Data source note (shown as a pill in the header)', 'report.note', { ph: 'e.g. WHONET AST submissions' }) +
      field('Description', 'report.description', { ph: 'Shown in SAS Drive' }) +
      '</div></div>' +
      '<div class="panel ai-panel"><h3>' + svg('spark') + ' Project brief <span class="badge">AI</span></h3>' +
      '<p class="muted small" style="margin:-4px 0 12px">Describe what the report is for: who reads it, the decisions it supports and the questions it should answer. The Report Assistant designs the pages and visuals from this brief and your data columns.</p>' +
      '<textarea data-path="report.brief" rows="4" placeholder="e.g. Detect sick-leave fraud for the inspection team: which doctors and facilities issue unusually long or frequent leaves, how fraud scores trend by month, and which specialities need an audit.">' + esc(r.brief || '') + '</textarea>' +
      '<div class="row" style="margin-top:12px"><button class="btn ai" data-ai="design"' + (state.data.columns.length ? '' : ' disabled') + '>' + svg('spark') + ' Design the report with AI</button>' +
      '<span class="muted small">' + (state.data.columns.length ? 'Replaces the pages with a design based on the brief. You can undo it.' : 'Load your data (step 3) first, so the assistant can use its columns.') + '</span></div></div>' +
      '<div class="panel"><h3>Logo</h3><div class="logo-box"><div class="logo-prev">' + (r.logo ? '<img src="' + r.logo + '" alt="">' : '<span class="muted small">No logo</span>') + '</div>' +
      '<div class="row"><label class="btn">Upload logo<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="logoFile" hidden></label>' +
      (r.logo ? '<button class="btn ghost danger" data-act="dropLogo">Remove</button>' : '') +
      '<span class="muted small">PNG, JPG or SVG. It is resized to 120 px high and stored inside the report job. A transparent PNG looks best on dark themes.</span></div></div></div>' +
      '<div class="panel"><h3>Colour theme</h3><div class="themes">' + themes + '</div>' +
      '<div class="grid g2" style="margin-top:16px"><div class="f"><span>Accent colour (selected filters, header line, highlights)</span><div class="row"><input type="color" data-act="accent" value="' + (r.accent || t.accent) + '">' +
      (r.accent ? '<button class="btn sm ghost" data-act="accentReset">Use theme accent</button>' : '<span class="muted small">Theme default</span>') + '</div></div>' +
      '<div class="f"><span>Chart colours (series 1-6)</span><div class="series">' + series + '</div>' + check('Use my own chart colours', 'report.customSeries', true) +
      '<em>The default set is checked for colour-blind safety on this theme; your own colours are used as given.</em></div></div></div>' +
      navBtns(null, 'SAS environment');
  }

  /* ---------- step 2: environment ---------- */
  function stepEnv() {
    var P = RG.paths(state);
    return head('SAS environment', 'Where the report reads its data and where it is imported. Set your Viya server URL; the default folder is /Development.') +
      '<div class="panel"><h3>Server and data</h3><div class="grid g2">' +
      field('Viya server URL', 'env.server', { req: true, ph: 'https://your-viya-server', help: 'The data-driven objects load from <code>&lt;server&gt;/SASJobExecution/</code>' }) +
      field('CAS server', 'env.casServer', { req: true }) +
      field('CAS library (caslib)', 'env.library', { req: true }) +
      field('CAS table', 'env.table', { req: true, ph: 'e.g. RSD_AMR_HAI', help: 'Must be loaded in memory, with the same column names as your CSV' }) +
      '</div></div>' +
      '<div class="panel"><h3>Folders</h3><div class="grid g2">' +
      field('Parent folder (exists already)', 'env.parentPath', { req: true, ph: '/Development', re: true }) +
      field('Parent folder ID', 'env.parentFolderId', { req: true, ph: '7161a746-108e-446d-89ec-cc7cb408c544', help: 'SAS Drive: right-click the folder > Properties > the id in its URI (/folders/folders/<b>id</b>)' }) +
      field('Report folder (created)', 'env.reportFolder', { ph: RG.slug(state.report.name, '-'), re: true }) +
      field('Assets subfolder (created)', 'env.assetsFolder', { ph: 'Assets', re: true }) +
      field('Job name (the data-driven objects)', 'env.jobName', { ph: RG.slug(state.report.name).toLowerCase() + '_ddc', re: true }) +
      field('Created by (your SAS user)', 'env.user', { ph: 'e.g. Abdullah.Abdelhamid' }) +
      '</div><div class="hint" style="margin-top:14px">The report goes to <b>' + esc(P.report) + '</b> and its data-driven objects to the job <b>' + esc(P.program) + '</b>.</div></div>' +
      '<div class="panel"><h3>Advanced</h3><div class="grid g2">' + field('VA base theme', 'env.vaTheme', { help: 'The SAS theme behind the objects (tabs, menus). midnight2020 matches the dark themes.' }) + '</div></div>' +
      navBtns('Report', 'Data');
  }

  /* ---------- step 3: data ---------- */
  var ROLE = [['category', 'Category'], ['measure', 'Measure'], ['date', 'Date'], ['id', 'ID (distinct counts, tables)'], ['ignore', 'Ignore']];
  var AGG = [['sum', 'Sum'], ['average', 'Average'], ['min', 'Minimum'], ['max', 'Maximum']];
  var FMT = [['int', '1,234'], ['dec1', '1,234.5'], ['dec2', '1,234.56'], ['pct', '12.3% (value 0-1)'], ['cur', 'Currency 1,234.56'], ['best', 'As stored']];
  var GRP = [['day', 'Day'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']];
  var TYPES = [['string', 'Text'], ['number', 'Number'], ['date', 'Date'], ['datetime', 'Date-time']];
  var OPSL = [['eq', '='], ['ne', '≠'], ['gt', '>'], ['ge', '≥'], ['lt', '<'], ['le', '≤']];
  function sel(path, opts, re, extra) {
    var v = getPath(path);
    return '<select data-path="' + path + '"' + (re ? ' data-re="1"' : '') + (extra || '') + '>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function stepData() {
    var d = state.data, cols = d.columns;
    var drop = '<label class="drop" id="drop"><b>' + (cols.length ? 'Replace the data file' : 'Drop a CSV file here, or click to choose') + '</b>' +
      '<span class="muted small">A data sample (header + rows, e.g. exported from the CAS table) <b>or</b> a schema file with the columns <code>name</code>, <code>type</code> and optionally <code>label</code>, <code>role</code>, <code>format</code>, <code>values</code>.</span>' +
      '<input type="file" accept=".csv,.txt,text/csv" id="dataFile" hidden></label>';
    if (!cols.length) return head('Data', 'The columns of your CAS table. Upload a sample so the generator can tell categories from measures and dates.') +
      '<div class="panel">' + drop + '<p class="muted small" style="margin:12px 0 0">Your data never leaves this computer: the file is read in the browser.</p></div>' +
      '<div class="panel"><h3>Example schema file</h3><pre class="small" style="margin:0;color:var(--ink-2)">name,type,label,role\nfacility_emirate,char,Emirate,category\nspecimen_collected_date,date,Collection Date,date\nast_result_cat,char,AST Result,category\nnumber_of_days,num,Days,measure</pre></div>' +
      navBtns('SAS environment', null);
    var nCat = cols.filter(function (c) { return c.role === 'category'; }).length, nMea = cols.filter(function (c) { return c.role === 'measure'; }).length,
      nDate = cols.filter(function (c) { return c.role === 'date'; }).length;
    var rowsHtml = cols.map(function (c, i) {
      var p = 'data.columns.' + i + '.', role = c.role;
      var detail = role === 'measure' ? '<div class="row" style="gap:6px;flex-wrap:nowrap">' + sel(p + 'agg', AGG) + sel(p + 'fmt', FMT) + '</div>'
        : role === 'date' ? sel(p + 'dateGroup', GRP, true) : '<span class="muted small">' + (c.type === 'number' && role === 'category' ? 'Numbers used as categories' : '') + '</span>';
      return '<tr class="' + (role === 'ignore' ? 'ignored' : '') + '"><td class="name" title="' + esc(c.name) + '">' + esc(c.name) + '</td>' +
        '<td><input type="text" data-path="' + p + 'label" value="' + esc(c.label) + '"></td>' +
        '<td>' + sel(p + 'type', TYPES, true) + '</td><td>' + sel(p + 'role', ROLE, true) + '</td><td>' + detail + '</td>' +
        '<td class="samples" title="' + esc(c.samples.join(' | ')) + '">' + (c.distinct ? '<span class="tag">' + c.distinct + ' values</span> ' : '') + esc(c.samples.slice(0, 4).join(' · ')) + '</td></tr>';
    }).join('');
    var colOpts = cols.filter(function (c) { return c.role !== 'ignore'; }).map(function (c) { return [c.name, c.label]; });
    var extras = (d.extra || []).map(function (x, i) {
      var p = 'data.extra.' + i + '.', col = cols.filter(function (c) { return c.name === x.col; })[0];
      var vals = col && col.samples.length ? '<input type="text" list="dl' + i + '" data-path="' + p + 'value" value="' + esc(x.value || '') + '" placeholder="value"><datalist id="dl' + i + '">' + col.samples.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>'
        : '<input type="text" data-path="' + p + 'value" value="' + esc(x.value || '') + '" placeholder="value">';
      return '<div class="extra">' + sel(p + 'kind', [['distinct', 'Distinct count of'], ['where', 'Count rows where']], true) + sel(p + 'col', colOpts, true) +
        (x.kind === 'where' ? sel(p + 'op', col && col.type === 'number' ? OPSL : OPSL.slice(0, 2)) + vals : '<span></span><span></span>') +
        '<input type="text" data-path="' + p + 'label" value="' + esc(x.label) + '" placeholder="Label, e.g. Resistant Results">' +
        '<button class="iconbtn" data-act="delExtra" data-i="' + i + '" title="Remove">' + svg('del') + '</button></div>';
    }).join('');
    return head('Data', 'Check how each column will be used. Categories group and filter, measures are added up (or averaged), dates drive trends.',
      '<span class="tag cat">' + nCat + ' categories</span><span class="tag mea">' + nMea + ' measures</span><span class="tag date">' + nDate + ' dates</span>') +
      '<div class="panel"><div class="row"><div><b>' + esc(d.fileName || 'Data') + '</b> <span class="muted small">' + (d.kind === 'schema' ? 'schema file, ' + cols.length + ' columns' : d.rows.length + ' rows, ' + cols.length + ' columns') +
      '</span></div><span class="spacer"></span>' + check('Preview with generated rows (based on your values)', 'data.synth') + '</div>' +
      (d.kind === 'schema' ? '<div class="hint" style="margin-top:10px">Schema only: the preview uses generated values. Add a <code>values</code> column (e.g. <code>Dubai|Sharjah|Ajman</code>) to the schema for realistic previews.</div>' : '') +
      (state.data.columns.some(function (c) { return c.role === 'date'; }) ? '<div class="hint warn" style="margin-top:10px">Date columns must be <b>SAS date or datetime</b> numeric columns in the CAS table (VA groups them with formats such as MONYY7. / DTMONYY7.). Set the type to match the CAS column.</div>' : '') +
      '<div style="overflow-x:auto;margin-top:12px"><table class="cols"><thead><tr><th>Column</th><th>Label in the report</th><th>Type</th><th>Use as</th><th>Details</th><th>Sample values</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>' +
      '<div class="panel"><h3>Extra measures</h3><p class="muted small" style="margin:-4px 0 12px">Counts that are not a column: distinct values of an ID, or rows that match a value (e.g. <i>Count rows where AST Result = Resistant</i>). A second measure makes ratios possible (e.g. % resistant = Resistant / AST results).</p>' +
      '<div class="grid g3" style="margin-bottom:12px">' + field('Label of the row count measure', 'data.countLabel', { ph: 'Records' }) + '</div>' + extras +
      '<div class="addbar"><button class="btn sm" data-act="addExtra" data-k="distinct">+ Distinct count</button><button class="btn sm" data-act="addExtra" data-k="where">+ Conditional count</button></div></div>' +
      '<div class="panel">' + drop + '</div>' +
      navBtns('SAS environment', 'Pages & charts');
  }

  /* ---------- step 4: pages and charts ---------- */
  function fieldOpts(list, none) { return (none ? [['', none]] : []).concat(list.map(function (f) { return [f.id, f.label]; })); }
  function chartEditor(ch, pi, ci, f, isFilter) {
    var p = 'pages.' + pi + '.' + (isFilter ? 'filters' : 'charts') + '.' + ci + '.', o = ch.opts || {}, probs = RG.chartProblems(ch, f), g = [];
    var cats = fieldOpts(f.cats, '(choose)'), dates = fieldOpts(f.dates, '(none)'), meas = fieldOpts(f.measures, '(choose)'), meas0 = fieldOpts(f.measures, '(none)');
    function fs(label, html) { g.push('<label class="f"><span>' + label + '</span>' + html + '</label>'); }
    function m(i, label, opt) { fs(label, sel(p + 'measures.' + i, opt ? meas0 : meas, true)); }
    var srcChk = check('Clicking it filters the other objects', p + 'source', true);
    if (isFilter) {
      fs('Field', sel(p + 'cat', fieldOpts(f.cats.concat(f.dates), '(choose)'), true));
      fs('Style', sel(p + 'opts.mode', Object.keys(RG.FILTER_MODES).map(function (k) { return [k, RG.FILTER_MODES[k]]; }), true));
      fs('Order', sel(p + 'opts.sort', [['auto', 'A to Z / ascending'], ['desc', 'Descending (newest first)']], true));
    } else switch (ch.type) {
      case 'kpi':
        fs('Shows', sel(p + 'opts.metric', [['value', 'The measure'], ['ratio', '% = measure 2 / measure 1'], ['share', 'Measure 2, with its % of measure 1']], true));
        m(0, 'Measure 1'); if (o.metric && o.metric !== 'value') m(1, 'Measure 2');
        fs('Sparkline by date', '<div class="row">' + check('Show', p + 'opts.spark', true) + (o.spark ? sel(p + 'date', dates, true) : '') + '</div>');
        fs('Line under the value', '<input type="text" data-path="' + p + 'sub" value="' + esc(ch.sub || '') + '" placeholder="automatic">');
        if (o.metric && o.metric !== 'value') fs('Name of the %', '<input type="text" data-path="' + p + 'opts.rlabel" value="' + esc(o.rlabel || '') + '" placeholder="% ' + esc((f.byId[(ch.measures || [])[1]] || {}).label || '') + '">');
        fs('Icon', sel(p + 'icon', ['', 'database', 'users', 'user', 'clock', 'coins', 'percent', 'alert', 'star', 'doc', 'hospital', 'building', 'calendar', 'pin', 'tag', 'heart', 'shield', 'flask', 'microbe', 'pill', 'trend']
          .map(function (k) { return [k, k || 'automatic']; })));
        break;
      case 'hbar':
        fs('Category', sel(p + 'cat', cats, true)); m(0, 'Measure 1');
        var hm = o.stack ? 'split' : o.metric === 'ratio' ? 'ratio' : 'value';
        fs('Bars show', '<select data-act2="hbarmode" data-p="' + p + '">' + [['value', 'Measure 1'], ['ratio', '% = measure 2 / measure 1'], ['split', 'Measure 1 split by measure 2']]
          .map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === hm ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>');
        if (o.metric === 'ratio' || o.stack) m(1, 'Measure 2');
        fs('Show top', '<input type="number" min="0" data-kind="num" data-path="' + p + 'opts.top" value="' + (o.top || '') + '" placeholder="all">');
        if (o.metric === 'ratio') {
          fs('Hide below (measure 1)', '<input type="number" min="0" data-kind="num" data-path="' + p + 'opts.min" value="' + (o.min || '') + '" placeholder="e.g. 30">');
          fs('Which bars', sel(p + 'opts.order', [['', 'Highest %'], ['volume', 'Largest measure 1, ranked by %']]));
          fs('Name of the %', '<input type="text" data-path="' + p + 'opts.rlabel" value="' + esc(o.rlabel || '') + '" placeholder="automatic">');
        }
        g.push('<div class="f"><span>Interaction</span>' + srcChk + '</div>');
        break;
      case 'vbar':
        fs('X axis', '<select data-act2="vbarx" data-p="' + p + '">' + [['', '(choose)']].concat(f.dates.map(function (x) { return [x.id, x.label + ' (date)']; }), f.cats.map(function (x) { return [x.id, x.label]; }))
          .map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] && (x[0] === ch.date || x[0] === ch.cat) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>');
        m(0, 'Measure');
        fs('Show top (categories)', '<input type="number" min="0" data-kind="num" data-path="' + p + 'opts.top" value="' + (o.top || '') + '" placeholder="all">');
        g.push('<div class="f"><span>Interaction</span>' + srcChk + '</div>');
        break;
      case 'line':
        fs('Date', sel(p + 'date', fieldOpts(f.dates, '(choose)'), true)); m(0, 'Measure 1'); m(1, o.ratio ? 'Measure 2 (for the %)' : 'Measure 2', true);
        if (!o.ratio) m(2, 'Measure 3', true);
        g.push('<div class="f"><span>Panels</span>' + check('Second panel = % measure 2 / measure 1', p + 'opts.ratio', true) + check('Measure 1 as columns', p + 'opts.bars') + '</div>');
        if (o.ratio) fs('Name of the %', '<input type="text" data-path="' + p + 'opts.rlabel" value="' + esc(o.rlabel || '') + '" placeholder="automatic">');
        break;
      case 'donut':
        fs('Category', sel(p + 'cat', cats, true)); m(0, 'Measure');
        fs('Slices before "Other"', '<input type="number" min="2" max="6" data-kind="num" data-path="' + p + 'opts.top" value="' + (o.top || 6) + '">');
        fs('Centre label', '<input type="text" data-path="' + p + 'opts.center" value="' + esc(o.center || '') + '" placeholder="measure name">');
        g.push('<div class="f"><span>Interaction</span>' + srcChk + '</div>');
        break;
      case 'heatmap':
        fs('Rows', sel(p + 'cat', cats, true)); fs('Columns', sel(p + 'cat2', cats, true));
        fs('Cells show', sel(p + 'opts.metric', [['value', 'Measure 1'], ['ratio', '% = measure 2 / measure 1']], true)); m(0, 'Measure 1');
        if (o.metric === 'ratio') { m(1, 'Measure 2'); fs('Hide below (measure 1)', '<input type="number" min="0" data-kind="num" data-path="' + p + 'opts.min" value="' + (o.min || '') + '" placeholder="e.g. 30">'); }
        fs('Max rows', '<input type="number" min="2" data-kind="num" data-path="' + p + 'opts.rows" value="' + (o.rows || 12) + '">');
        fs('Max columns', '<input type="number" min="2" data-kind="num" data-path="' + p + 'opts.cols" value="' + (o.cols || 12) + '">');
        break;
      case 'table':
        [0, 1, 2, 3].forEach(function (i) { fs('Category ' + (i + 1), sel(p + 'cats.' + i, fieldOpts(f.cats.concat(f.dates), '(none)'), true)); });
        [0, 1, 2, 3].forEach(function (i) { m(i, 'Measure ' + (i + 1), true); });
        g.push('<div class="f"><span>Extra column</span>' + check('% = measure 2 / measure 1', p + 'opts.ratio', true) + '</div>');
        if (o.ratio) fs('Hide % below (measure 1)', '<input type="number" min="0" data-kind="num" data-path="' + p + 'opts.min" value="' + (o.min || '') + '">');
        break;
    }
    if (!isFilter) fs('Size', sel(p + 'size', Object.keys(RG.SIZES).map(function (k) { return [k, RG.SIZES[k]]; }), true));
    var typeSel = isFilter ? '<span class="tag">Filter</span>' : '<select data-act2="ctype" data-p="' + p + '" style="width:auto">' +
      Object.keys(RG.CHART_TYPES).map(function (k) { return '<option value="' + k + '"' + (ch.type === k ? ' selected' : '') + '>' + RG.CHART_TYPES[k].label + '</option>'; }).join('') + '</select>';
    var kind = isFilter ? 'filters' : 'charts';
    return '<div class="item' + (probs.length ? ' bad' : '') + '"><div class="ih"><span class="ty">' + svg(isFilter ? 'filter' : ch.type) + '</span>' +
      '<input type="text" data-path="' + p + 'title" value="' + esc(ch.title || '') + '" placeholder="' + esc(RG.autoTitle(ch, f) || 'Title') + '">' + typeSel +
      '<button class="iconbtn ai" title="Ask the AI to change this" data-ai="chart" data-id="' + esc(ch.id) + '">' + svg('spark') + '</button>' +
      '<button class="iconbtn" title="Fill empty settings" data-act="fill" data-k="' + kind + '" data-i="' + ci + '">' + svg('wand') + '</button>' +
      '<button class="iconbtn" title="Move up" data-act="move" data-k="' + kind + '" data-i="' + ci + '" data-d="-1">' + svg('up') + '</button>' +
      '<button class="iconbtn" title="Move down" data-act="move" data-k="' + kind + '" data-i="' + ci + '" data-d="1">' + svg('down') + '</button>' +
      '<button class="iconbtn" title="Duplicate" data-act="dup" data-k="' + kind + '" data-i="' + ci + '">' + svg('copy') + '</button>' +
      '<button class="iconbtn" title="Delete" data-act="del" data-k="' + kind + '" data-i="' + ci + '">' + svg('del') + '</button></div>' +
      '<div class="grid g4">' + g.join('') + '</div>' + (probs.length ? '<div class="prob">Needs ' + probs.join(', ') + ' - or press the wand to fill it.</div>' : '') + '</div>';
  }
  function stepPages() {
    if (!state.data.columns.length) return head('Pages & charts', 'Upload your data first, so charts can use its columns.') + navBtns('Data', null);
    syncPages();
    var f = F(), pi = Math.min(state.curPage, state.pages.length - 1), page = state.pages[pi];
    var tabs = state.pages.map(function (p, i) {
      return '<button class="ptab' + (i === pi ? ' on' : '') + '" data-act="page" data-i="' + i + '">' + esc(p.title || 'Page ' + (i + 1)) + '<small>' + p.charts.length + '</small></button>';
    }).join('');
    var empty = !page.charts.length && !page.filters.length;
    return head('Pages & charts', 'Choose what each page shows. Leave a page empty and it gets suggested charts; leave a setting empty and the wand fills it.',
      '<div class="row"><label class="f" style="width:130px"><span>Number of pages</span><input type="number" min="1" max="12" value="' + state.pageCount + '" data-act2="pagecount"></label>' +
      '<button class="btn" data-act="suggestAll">' + svg('wand') + ' Suggest all pages</button>' +
      '<button class="btn ai" data-ai="design">' + svg('spark') + ' Design with AI</button></div>') +
      '<div class="ptabs">' + tabs + '</div>' +
      '<div class="panel"><div class="grid g2">' + field('Page title', 'pages.' + pi + '.title', { ph: 'Page ' + (pi + 1) }) + field('Subtitle', 'pages.' + pi + '.subtitle', { ph: 'One line under the title' }) + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn sm" data-act="suggestPage">' + svg('wand') + ' Suggest this page</button>' +
      '<span class="muted small">' + (empty ? 'This page is empty: it will get suggested content when you preview or export.' : 'Replaces the filters and charts below.') + '</span></div></div>' +
      '<div class="panel"><h3>Filters <span class="muted small" style="font-weight:400">filter every chart on this page</span></h3><div class="items">' +
      page.filters.map(function (x, i) { return chartEditor(x, pi, i, f, true); }).join('') + '</div>' +
      '<div class="addbar"><button class="btn sm" data-act="add" data-k="filter">+ Filter</button></div></div>' +
      '<div class="panel"><h3>Charts and KPIs</h3><div class="items">' + page.charts.map(function (x, i) { return chartEditor(x, pi, i, f, false); }).join('') + '</div>' +
      '<div class="addbar">' + Object.keys(RG.CHART_TYPES).map(function (k) { return '<button class="btn sm" data-act="add" data-k="' + k + '">' + svg(k) + ' ' + RG.CHART_TYPES[k].label + '</button>'; }).join('') +
      '<button class="btn sm ai" data-ai="custom">' + svg('spark') + ' Custom visual: describe it</button></div></div>' +
      navBtns('Data', 'Preview & export');
  }
  function blankPage() { return { id: RG.id('pg'), title: '', subtitle: '', filters: [], charts: [] }; }
  function syncPages() {
    state.pageCount = Math.max(1, Math.min(12, parseInt(state.pageCount, 10) || 1));
    while (state.pages.length < state.pageCount) state.pages.push(blankPage());
    if (state.pages.length > state.pageCount) state.pages.length = state.pageCount;
    if (state.curPage >= state.pages.length) state.curPage = state.pages.length - 1;
  }
  /* "if left empty add your suggestions": empty pages get suggested content, charts get their empty roles filled */
  function autoComplete() {
    syncPages();
    var f = F(), filled = [];
    state.pages.forEach(function (p, i) {
      if (!p.charts.length && !p.filters.length) {
        var s = RG.suggestPage(state, i, f); f = F();
        p.filters = s.filters; p.charts = s.charts; if (!p.title) p.title = s.title; if (!p.subtitle) p.subtitle = s.subtitle; filled.push(p.title || 'Page ' + (i + 1));
      }
      if (!p.title) p.title = 'Page ' + (i + 1);
      p.charts.concat(p.filters).forEach(function (c) { if (RG.chartProblems(c, f).length) RG.fillRoles(c, f); });
    });
    if (filled.length) toast('Suggested content added to: ' + filled.join(', '));
    save();
  }

  /* ---------- step 5: preview and export ---------- */
  function problems() {
    var out = [], e = state.env, f = F();
    if (!state.report.name.trim()) out.push(['err', 'Report name is empty (step 1).']);
    ['server', 'casServer', 'library', 'table', 'parentPath'].forEach(function (k) { if (!String(e[k] || '').trim()) out.push(['err', 'SAS environment: ' + k + ' is empty (step 2).']); });
    if (!/^[0-9a-f-]{36}$/i.test(e.parentFolderId || '')) out.push(['err', 'SAS environment: the parent folder ID is not a valid id (step 2).']);
    if (!state.data.columns.length) out.push(['err', 'No data columns (step 3).']);
    state.pages.forEach(function (p, i) {
      p.charts.concat(p.filters).forEach(function (c) { var pr = RG.chartProblems(c, f); if (pr.length) out.push(['err', (p.title || 'Page ' + (i + 1)) + ': "' + (c.title || RG.autoTitle(c, f)) + '" needs ' + pr.join(', ') + '.']); });
      if (p.charts.length + p.filters.length > 16) out.push(['warn', (p.title || 'Page ' + (i + 1)) + ' has ' + (p.charts.length + p.filters.length) + ' objects; pages load faster with 12 or fewer.']);
    });
    if (state.data.kind === 'schema') out.push(['warn', 'The preview uses generated values (schema file). Real values appear in VA.']);
    if (state.data.columns.some(function (c) { return c.role === 'date'; })) out.push(['warn', 'Date columns must be numeric SAS date / datetime columns in ' + e.library + '.' + e.table + '.']);
    if (!out.some(function (x) { return x[0] === 'err'; })) out.push(['ok', 'Ready to build: ' + state.pages.length + ' pages, ' + state.pages.reduce(function (a, p) { return a + p.charts.length + p.filters.length; }, 0) + ' objects.']);
    return out;
  }
  function stepExport() {
    if (!state.data.columns.length) return head('Preview & export', 'Upload your data first.') + navBtns('Pages & charts', null);
    autoComplete();
    var pi = Math.min(state.previewPage, state.pages.length - 1), P = RG.paths(state), pr = problems(), bad = pr.some(function (x) { return x[0] === 'err'; });
    var tabs = state.pages.map(function (p, i) { return '<button class="ptab' + (i === pi ? ' on' : '') + '" data-act="ppage" data-i="' + i + '">' + esc(p.title || 'Page ' + (i + 1)) + '</button>'; }).join('');
    return head('Preview & export', 'This is the report as VA will show it, using your sample rows. Click bars, pills and slices: the other objects filter like in VA.') +
      '<div class="pv-wrap"><div class="pv-bar"><div class="ptabs" style="margin:0">' + tabs + '</div><span class="spacer"></span><button class="btn sm ghost" data-act="refreshPreview">Refresh</button></div>' +
      '<div class="pv-host" id="pvHost"></div></div>' +
      '<div class="export" style="margin-top:16px"><div class="panel"><h3>Download</h3>' +
      '<div class="row"><button class="btn primary" data-act="build"' + (bad ? ' disabled' : '') + '>Download SAS package (.json)</button>' +
      '<button class="btn" data-act="saveProject">Save project</button><button class="btn ghost" data-act="dlDDC">Data-driven objects (.html)</button><button class="btn ghost" data-act="dlXML">Report XML</button></div>' +
      '<p class="small muted" style="margin:12px 0 4px">Import in SAS Environment Manager &gt; Content &gt; Import (or SAS Drive &gt; Import):</p><ol class="howto">' +
      '<li>Load <b>' + esc(e2(state.env.table)) + '</b> into <b>' + esc(state.env.casServer) + ' / ' + esc(state.env.library) + '</b> (columns as in step 3).</li>' +
      '<li>Import the package. It creates <b>' + esc(P.report) + '</b> (the report) and the job <b>' + esc(P.program) + '</b>.</li>' +
      '<li>When asked about existing objects, choose <b>replace</b>. The ids are kept in the project, so re-importing an edited report updates it.</li>' +
      '<li>Open the report in SAS Visual Analytics.</li></ol></div>' +
      '<div class="panel"><h3>Checks</h3><div class="checks">' + pr.map(function (x) { return '<div class="' + x[0] + '">' + (x[0] === 'err' ? '&#10007;' : x[0] === 'warn' ? '!' : '&#10003;') + '<span>' + esc(x[1]) + '</span></div>'; }).join('') +
      '</div><p class="small muted" style="margin:14px 0 0">Test the job on its own: <a href="' + esc(RG.jobUrl(state, [['visual', 'kpi'], ['title', 'Test']])) + '" target="_blank" rel="noopener">open the job URL</a> (after import) - you should see a card waiting for data.</p></div></div>' +
      navBtns('Pages & charts', null);
  }
  function e2(s) { return s || '(table)'; }
  function mountPreview() {
    var host = document.getElementById('pvHost');
    if (!host) return;
    requestAnimationFrame(function () { RG.renderPreview(host, state, Math.min(state.previewPage, state.pages.length - 1), previewRows()); });
  }

  /* ---------------- events ---------------- */
  var main = document.getElementById('main');
  main.addEventListener('input', function (e) {
    var t = e.target, p = t.getAttribute('data-path');
    if (!p || t.tagName === 'SELECT' || t.type === 'checkbox') return;
    setPath(p, t.getAttribute('data-kind') === 'num' ? (t.value === '' ? '' : parseFloat(t.value)) : t.value);
    save();
    if (/^report\.name|^env\.|^pages\.\d+\.title|^data\./.test(p)) renderNav();
  });
  main.addEventListener('change', function (e) {
    var t = e.target, p = t.getAttribute('data-path'), a2 = t.getAttribute('data-act2');
    if (a2) return special(a2, t);
    if (!p) return;
    if (t.type === 'checkbox') setPath(p, t.checked);
    else if (t.tagName === 'SELECT') setPath(p, t.value);
    else if (t.getAttribute('data-re')) setPath(p, t.getAttribute('data-kind') === 'num' ? parseFloat(t.value) || '' : t.value);
    else return;
    afterChange(p);
    save();
    if (t.getAttribute('data-re') || t.tagName === 'SELECT' || t.type === 'checkbox') keepScroll(render);
  });
  function keepScroll(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }
  function renderNav() {
    document.getElementById('steps').innerHTML = navHtml();
    document.getElementById('projName').textContent = state.report.name || 'Untitled report';
  }
  function afterChange(p) {
    var m;
    if ((m = /^data\.columns\.(\d+)\.(role|type)/.exec(p))) {
      var c = state.data.columns[+m[1]];
      if (c.role === 'date' && c.type !== 'date' && c.type !== 'datetime') c.type = 'date';
      if (c.role === 'measure' && c.type !== 'number') c.type = 'number';
      if (c.role === 'measure' && !c.agg) c.agg = 'sum';
    }
    if ((m = /^data\.extra\.(\d+)\.(kind|col|op|value)/.exec(p))) {
      var x = state.data.extra[+m[1]], col = state.data.columns.filter(function (c) { return c.name === x.col; })[0];
      if (!x.labelEdited) x.label = x.kind === 'distinct' ? 'Distinct ' + (col ? col.label : x.col) : (col ? col.label : x.col) + ' ' + ({ eq: '=', ne: '≠', gt: '>', ge: '≥', lt: '<', le: '≤' }[x.op || 'eq']) + ' ' + (x.value || '…');
    }
    if (/^data\.extra\.\d+\.label/.test(p)) state.data.extra[+p.split('.')[2]].labelEdited = true;
    if (/^report\.customSeries/.test(p) && state.report.customSeries && !state.report.series) state.report.series = RG.resolveTheme(state.report).series.slice();
  }
  function special(a, t) {
    var f = F(), pg = state.pages[state.curPage];
    if (a === 'pagecount') { var n = Math.max(1, Math.min(12, parseInt(t.value, 10) || 1));
      if (n < state.pages.length && state.pages.slice(n).some(function (p) { return p.charts.length || p.filters.length; }) && !confirm('Remove the last ' + (state.pages.length - n) + ' page(s) and their charts?')) { t.value = state.pageCount; return; }
      state.pageCount = n; syncPages(); }
    if (a === 'ctype') { var ch = getPath(t.getAttribute('data-p').slice(0, -1));
      ch.type = t.value; ch.title = ''; ch.opts = {}; RG.fillRoles(ch, f); }
    if (a === 'vbarx') { var c2 = getPath(t.getAttribute('data-p').slice(0, -1)); if (/^d:/.test(t.value)) { c2.date = t.value; c2.cat = ''; } else { c2.cat = t.value; c2.date = ''; } }
    if (a === 'hbarmode') { var c3 = getPath(t.getAttribute('data-p').slice(0, -1));
      c3.opts.metric = t.value === 'ratio' ? 'ratio' : 'value'; c3.opts.stack = t.value === 'split'; if ((c3.opts.metric === 'ratio' || c3.opts.stack) && (c3.measures || []).length < 2) RG.fillRoles(c3, f); }
    save(); keepScroll(render);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'INPUT' && b.type === 'color') return;
    var a = b.getAttribute('data-act'), i = +b.getAttribute('data-i'), k = b.getAttribute('data-k'), pg = state.pages[state.curPage], f;
    switch (a) {
      case 'goto': state.step = i; save(); render(); window.scrollTo(0, 0); return;
      case 'theme': state.report.theme = k; if (!state.report.customSeries) state.report.series = null; break;
      case 'accentReset': state.report.accent = ''; break;
      case 'dropLogo': state.report.logo = ''; state.report.logoName = ''; break;
      case 'page': state.curPage = i; break;
      case 'ppage': state.previewPage = i; break;
      case 'refreshPreview': rowsKey = ''; break;
      case 'addExtra': state.data.extra = state.data.extra || [];
        var c0 = state.data.columns.filter(function (c) { return k === 'distinct' ? c.role === 'id' || c.role === 'category' : c.role === 'category'; })[0] || state.data.columns[0];
        var x = { id: RG.id('m'), kind: k, col: c0 ? c0.name : '', op: 'eq', value: k === 'where' && c0 ? c0.samples[0] || '' : '', label: '' };
        x.label = k === 'distinct' ? 'Distinct ' + (c0 ? c0.label : '') : (c0 ? c0.label : '') + ' = ' + (x.value || '…');
        state.data.extra.push(x); break;
      case 'delExtra': state.data.extra.splice(i, 1); break;
      case 'add': f = F();
        if (k === 'filter') pg.filters.push(RG.fillRoles(RG.blankChart('filter', { opts: { mode: 'pills', sort: 'auto' } }), f));
        else pg.charts.push(RG.fillRoles(RG.blankChart(k, { opts: k === 'hbar' ? { top: 10 } : k === 'donut' ? { top: 6 } : {} }), f));
        break;
      case 'del': pg[k].splice(i, 1); break;
      case 'dup': var cp = RG.clone(pg[k][i]); cp.id = RG.id('ch'); pg[k].splice(i + 1, 0, cp); break;
      case 'move': var d = +b.getAttribute('data-d'), j = i + d; if (j < 0 || j >= pg[k].length) return; var tmp = pg[k][i]; pg[k][i] = pg[k][j]; pg[k][j] = tmp; break;
      case 'fill': RG.fillRoles(pg[k][i], F()); break;
      case 'suggestPage':
        if ((pg.charts.length || pg.filters.length) && !confirm('Replace the filters and charts of this page with suggestions?')) return;
        var s = RG.suggestPage(state, state.curPage, F()); pg.filters = s.filters; pg.charts = s.charts; pg.title = pg.title || s.title; pg.subtitle = pg.subtitle || s.subtitle; break;
      case 'suggestAll':
        if (state.pages.some(function (p) { return p.charts.length || p.filters.length; }) && !confirm('Replace every page with suggested content?')) return;
        syncPages(); f = F();
        state.pages.forEach(function (p, n) { var s2 = RG.suggestPage(state, n, f); f = F(); p.filters = s2.filters; p.charts = s2.charts; p.title = s2.title; p.subtitle = s2.subtitle; });
        toast('Suggested ' + state.pages.length + ' pages from your data'); break;
      case 'new': if (!confirm('Start a new report? Save the current project first if you need it.')) return;
        state = defaults(); rowsKey = ''; break;
      case 'saveProject': RG.download(RG.slug(state.report.name || 'report') + '.report-project.json', JSON.stringify(state)); toast('Project saved'); return;
      case 'build': doBuild(); return;
      case 'dlDDC': try { RG.download(RG.paths(state).job + '.html', RG.buildDDC(state), 'text/html'); } catch (err) { toast(err.message, true); } return;
      case 'dlXML': try { RG.download(RG.slug(state.report.name) + '.xml', RG.buildReportXml(state, F()).xml, 'application/xml'); } catch (err) { toast(err.message, true); } return;
      default: return;
    }
    save(); keepScroll(render);
  });
  document.addEventListener('input', function (e) {
    var t = e.target, a = t.getAttribute('data-act');
    if (a === 'accent') { state.report.accent = t.value; save(); }
    if (a === 'series') { var th = RG.resolveTheme(state.report); state.report.series = (state.report.series || th.series).slice(); state.report.series[+t.getAttribute('data-i')] = t.value; save(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, a = t.getAttribute('data-act');
    if (a === 'accent' || a === 'series') keepScroll(render);
    if (t.id === 'logoFile' && t.files[0]) readLogo(t.files[0]);
    if (t.id === 'dataFile' && t.files[0]) readData(t.files[0]);
    if (t.id === 'openProject' && t.files[0]) openProject(t.files[0]);
  });
  main.addEventListener('dragover', function (e) { var d = e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  main.addEventListener('dragleave', function (e) { var d = e.target.closest('#drop'); if (d) d.classList.remove('over'); });
  main.addEventListener('drop', function (e) { var d = e.target.closest('#drop'); if (!d) return; e.preventDefault(); if (e.dataTransfer.files[0]) readData(e.dataTransfer.files[0]); });

  /* ---------------- files ---------------- */
  function readData(file) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var t = RG.readTable(String(r.result), file.name);
        RG.annotateYears(t);
        var hadPages = state.pages.some(function (p) { return p.charts.length || p.filters.length; });
        state.data = { kind: t.kind, fileName: file.name, columns: t.columns, rows: t.rows.slice(0, MAX_ROWS), extra: [], countLabel: state.data.countLabel || 'Records', synth: t.kind === 'schema' || t.rows.length < 200 };
        if (!state.env.table) state.env.table = file.name.replace(/\.[^.]+(?![\s\S])/, '').replace(/^table_/i, '').replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
        if (hadPages) toast('Data replaced. Check the charts: roles that no longer exist are marked.');
        else toast(t.kind === 'schema' ? 'Schema read: ' + t.columns.length + ' columns' : 'Read ' + t.rows.length + ' rows and ' + t.columns.length + ' columns' + (t.rows.length > MAX_ROWS ? ' (the first ' + MAX_ROWS + ' are kept for the preview)' : ''));
        rowsKey = ''; save(); render();
      } catch (err) { toast('Could not read the file: ' + err.message, true); }
    };
    r.readAsText(file);
  }
  function readLogo(file) {
    var r = new FileReader();
    r.onload = function () {
      var url = String(r.result);
      if (/svg/.test(file.type)) { if (url.length > 150000) return toast('The SVG is too large (max 150 KB).', true); setLogo(url, file.name); return; }
      var img = new Image();
      img.onload = function () {
        var h = Math.min(120, img.height), w = Math.round(img.width * h / img.height);
        if (w > 480) { w = 480; h = Math.round(img.height * w / img.width); }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        setLogo(c.toDataURL('image/png'), file.name);
      };
      img.onerror = function () { toast('That image could not be read.', true); };
      img.src = url;
    };
    r.readAsDataURL(file);
  }
  function setLogo(url, name) { state.report.logo = url; state.report.logoName = name; save(); keepScroll(render); toast('Logo added'); }
  function openProject(file) {
    var r = new FileReader();
    r.onload = function () {
      try { var s = JSON.parse(String(r.result)); if (!s || s.version !== 1 || !s.report) throw new Error('not a generator project'); state = merge(defaults(), s); rowsKey = ''; save(); render(); toast('Project opened'); }
      catch (err) { toast('Could not open the project: ' + err.message, true); }
    };
    r.readAsText(file);
  }
  function doBuild() {
    var btn = document.querySelector('[data-act="build"]'); if (btn) btn.disabled = true;
    RG.buildPackage(state).then(function (res) {
      save();
      RG.download(RG.slug(state.report.name) + '_SAS_VA_Package.json', res.json);
      toast('Package built: import it in SAS Viya');
    }).catch(function (err) { toast('Build failed: ' + err.message, true); console.error(err); })
      .then(function () { if (btn) btn.disabled = false; });
  }

  window.addEventListener('resize', function () { if (state.step === 4) { clearTimeout(window._pvT); window._pvT = setTimeout(mountPreview, 250); } });

  /* what the Report Assistant (js/ai.js) may read and change */
  RG.app = {
    state: function () { return state; },
    fields: F,
    toast: toast,
    syncPages: syncPages,
    problems: problems,
    /* after the assistant changed the report: save, and redraw without losing the scroll position */
    refresh: function () { save(); keepScroll(render); },
    goto: function (step, page) {
      state.step = step;
      if (page != null) { if (step === 4) state.previewPage = page; else state.curPage = page; }
      save(); render(); window.scrollTo(0, 0);
    }
  };
  render();
})();
