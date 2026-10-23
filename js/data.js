/* Data: CSV reading, column type / role detection, the field catalog charts are built from,
   and the VA-like aggregation used by the live preview. */
(function () {
  'use strict';
  var RG = window.RG = window.RG || {};
  var MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  var SAS0 = Date.UTC(1960, 0, 1);

  /* ---------------- CSV ---------------- */
  RG.parseCSV = function (text) {
    text = String(text || '').replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/, 1)[0] || '', delim = ',', best = -1;
    [',', ';', '\t', '|'].forEach(function (d) {
      var n = 0, q = false, i;
      for (i = 0; i < first.length; i++) { if (first[i] === '"') q = !q; else if (!q && first[i] === d) n++; }
      if (n > best) { best = n; delim = d; }
    });
    var rows = [], row = [], cell = '', inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; } else cell += c;
      } else if (c === '"') inQ = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); if (row.length > 1 || row[0] !== '') rows.push(row); }
    var headers = (rows.shift() || []).map(function (h) { return h.trim(); });
    return { headers: headers, rows: rows, delimiter: delim };
  };

  /* ---------------- values ---------------- */
  var NUM = /^[-+]?(\d+|\d{1,3}(,\d{3})+)?(\.\d+)?([eE][-+]?\d+)?(?![\s\S])/;
  function isNum(s) { return s !== '' && NUM.test(s) && /\d/.test(s); }
  function toNum(s) { return parseFloat(String(s).replace(/,/g, '')); }

  /* -> {t: ms since 1970 (UTC midnight-based), time: has a time part} or null */
  function parseDate(s) {
    s = String(s).trim();
    var m, d, h = 0, mi = 0, se = 0, time = false;
    if ((m = /^(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{2,4})(?:[:\s](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/.exec(s)) && MON[m[2].toUpperCase()] != null) {
      var y = +m[3]; if (y < 100) y += y < 50 ? 2000 : 1900;
      d = [y, MON[m[2].toUpperCase()], +m[1]];
      if (m[4] != null) { h = +m[4]; mi = +m[5]; se = +(m[6] || 0); time = true; }
    } else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) {
      d = [+m[1], m[2] - 1, +m[3]];
      if (m[4] != null) { h = +m[4]; mi = +m[5]; se = +(m[6] || 0); time = true; }
    } else if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) {
      var a = +m[1], b = +m[2];
      d = b > 12 && a <= 12 ? [+m[3], a - 1, b] : [+m[3], b - 1, a];   /* day first unless that is impossible */
      if (m[4] != null) { h = +m[4]; mi = +m[5]; se = +(m[6] || 0); time = true; }
    } else return null;
    if (d[1] < 0 || d[1] > 11 || d[2] < 1 || d[2] > 31) return null;
    return { t: Date.UTC(d[0], d[1], d[2], h, mi, se), time: time };
  }
  RG.parseDate = parseDate;

  /* ---------------- type and role detection ---------------- */
  function looksSchema(headers) {
    var h = headers.map(function (x) { return x.toLowerCase().replace(/[^a-z]/g, ''); });
    var hasName = h.some(function (x) { return /^(name|column|columnname|variable|field|fieldname)$/.test(x); });
    var hasType = h.some(function (x) { return /^(type|datatype|coltype|columntype|sastype)$/.test(x); });
    return hasName && hasType;
  }

  function guessRole(col) {
    var n = col.name.toLowerCase();
    if (col.type === 'date' || col.type === 'datetime') return 'date';
    if (col.type === 'number') {
      if (/(^|_)(id|code|phone|mobile|eid)(_|$)|emiratesid|_id$|^id_|number_?id/.test(n) && !/pct|amount|count|days/.test(n)) return 'id';
      if (/year/.test(n) && col.isInt && col.min >= 1900 && col.max <= 2100) return 'category';
      if (/(^|_)(is|has|flag|new|cluster|rank|level|grade|class|group|segment|quarter|month|week)(_|$)/.test(n) && col.isInt && col.distinct <= 50) return 'category';
      return 'measure';
    }
    if (col.rows > 20 && col.distinct > 50 && col.distinct / col.rows > 0.6) return 'id';
    if (/(^|_)(id|code|uuid|guid|key|number|no)(_|$)|emiratesid|attestation/.test(n) && col.distinct / Math.max(col.rows, 1) > 0.5) return 'id';
    return 'category';
  }

  function guessMeasure(col) {
    var n = col.name.toLowerCase();
    col.agg = /pct|percent|rate|ratio|score|avg|mean|age|index|probab|likelihood|_per_|per_/.test(n) ? 'average' : 'sum';
    if (/pct|percent|ratio|rate|probab/.test(n) && col.min >= 0 && col.max <= 1) col.fmt = 'pct';
    else if (/amount|cost|price|revenue|salary|fee|aed|usd|value/.test(n)) col.fmt = 'cur';
    else col.fmt = col.isInt && col.agg === 'sum' ? 'int' : 'dec2';
  }

  function newColumn(name) {
    return { name: name, label: RG.titleCase(name), type: 'string', role: 'category', agg: 'sum', fmt: 'int', dateGroup: 'month',
      distinct: 0, rows: 0, samples: [], isInt: true, min: null, max: null };
  }

  function profile(col, values) {
    var seen = {}, nonEmpty = 0, num = 0, date = 0, time = 0, i, v, p;
    for (i = 0; i < values.length; i++) {
      v = String(values[i] == null ? '' : values[i]).trim();
      if (v === '' || v === '.') continue;
      nonEmpty++;
      if (!seen[v]) { seen[v] = 1; col.distinct++; if (col.samples.length < 6) col.samples.push(v); }
      if (isNum(v)) {
        num++; var x = toNum(v);
        if (Math.round(x) !== x) col.isInt = false;
        col.min = col.min == null ? x : Math.min(col.min, x); col.max = col.max == null ? x : Math.max(col.max, x);
      } else if ((p = parseDate(v))) { date++; if (p.time && (p.t % 864e5) !== 0) time++; if (p.time) col._hasTime = true; }
    }
    col.rows = nonEmpty;
    if (nonEmpty && num === nonEmpty) col.type = 'number';
    else if (nonEmpty && date === nonEmpty) col.type = col._hasTime ? 'datetime' : 'date';
    else { col.type = 'string'; col.isInt = false; }
    delete col._hasTime;
  }

  /* -> {kind:'data'|'schema', columns, rows (parsed values, aligned with columns)} */
  RG.readTable = function (text, fileName) {
    var csv = RG.parseCSV(text), cols;
    if (!csv.headers.length) throw new Error('The file has no header row.');
    if (looksSchema(csv.headers)) return readSchema(csv);
    cols = csv.headers.map(function (h, j) {
      var c = newColumn(h || ('Column' + (j + 1)));
      profile(c, csv.rows.map(function (r) { return r[j]; }));
      c.role = guessRole(c);
      if (c.role === 'measure') guessMeasure(c);
      if (c.type === 'number' && c.role === 'category') c.fmt = 'int';
      return c;
    });
    return { kind: 'data', fileName: fileName, columns: cols, rows: csv.rows.map(function (r) { return cols.map(function (c, j) { return r[j] == null ? '' : r[j]; }); }) };
  };

  function readSchema(csv) {
    var h = csv.headers.map(function (x) { return x.toLowerCase().replace(/[^a-z]/g, ''); });
    function idx(re) { for (var i = 0; i < h.length; i++) if (re.test(h[i])) return i; return -1; }
    var iName = idx(/^(name|column|columnname|variable|field|fieldname)$/), iType = idx(/^(type|datatype|coltype|columntype|sastype)$/),
      iLabel = idx(/^(label|description|title)$/), iRole = idx(/^(role|usage)$/), iFmt = idx(/^(format|fmt)$/), iVals = idx(/^(values|sample|samples|examples)$/);
    var cols = csv.rows.filter(function (r) { return (r[iName] || '').trim(); }).map(function (r) {
      var c = newColumn(r[iName].trim()), t = String(r[iType] || '').toLowerCase(), f = iFmt >= 0 ? String(r[iFmt] || '').toUpperCase() : '';
      c.type = /datetime|timestamp|^dt/.test(t) || /^DATETIME|^DT/.test(f) ? 'datetime'
        : /date/.test(t) || /DATE|MMDDYY|DDMMYY|YYMMDD|MONYY/.test(f) ? 'date'
        : /num|int|double|float|decimal|real|bigint|money/.test(t) ? 'number' : 'string';
      if (iLabel >= 0 && r[iLabel]) c.label = r[iLabel].trim();
      if (iVals >= 0 && r[iVals]) { c.samples = r[iVals].split(/[|;]/).map(function (x) { return x.trim(); }).filter(Boolean); c.distinct = c.samples.length; }
      c.rows = 0; c.isInt = c.type === 'number' && !/double|float|decimal|real/.test(t);
      var role = iRole >= 0 ? String(r[iRole] || '').toLowerCase() : '';
      c.role = /measure|quant|metric|fact/.test(role) ? 'measure' : /date|time/.test(role) ? 'date' : /id|key/.test(role) ? 'id'
        : /ignore|skip|hide/.test(role) ? 'ignore' : /cat|dim|class/.test(role) ? 'category' : guessRole(c);
      if (c.role === 'measure') guessMeasure(c);
      if (/PERCENT/.test(f)) c.fmt = 'pct'; else if (/DOLLAR|NLMNY/.test(f)) c.fmt = 'cur';
      return c;
    });
    if (!cols.length) throw new Error('The schema file lists no columns.');
    return { kind: 'schema', columns: cols, rows: [] };
  }

  /* ---------------- field catalog ----------------
     Fields are what charts are built from:
       c:<col>  category      d:<col>  date (grouped by the column's dateGroup)      y:<col>  year of a date column
       m:<col>  numeric measure with its aggregation      count  rows      x:<id>  extra measure (distinct / conditional count) */
  var GROUP_LABEL = { day: 'Day', month: 'Month', quarter: 'Quarter', year: 'Year' };
  function baseName(label) { var b = label.replace(/\s*\b(date|datetime|time|dt|timestamp)\b\s*/ig, ' ').trim(); return b || label; }

  RG.fields = function (state) {
    var F = { cats: [], dates: [], measures: [], byId: {} }, data = state.data || { columns: [] };
    function add(list, f) { list.push(f); F.byId[f.id] = f; }
    (data.columns || []).forEach(function (c) {
      if (c.role === 'category' || c.role === 'id') add(F.cats, { id: 'c:' + c.name, label: c.label, col: c.name, kind: 'cat', numeric: c.type === 'number',
        distinct: c.distinct, isId: c.role === 'id' });
      if (c.role === 'date') {
        var b = baseName(c.label);
        add(F.dates, { id: 'd:' + c.name, label: c.dateGroup === 'day' ? c.label : b + ' ' + GROUP_LABEL[c.dateGroup || 'month'], col: c.name, kind: 'date',
          group: c.dateGroup || 'month', dt: c.type === 'datetime' });
        if ((c.dateGroup || 'month') !== 'year') add(F.cats, { id: 'y:' + c.name, label: /year/i.test(b) ? b : b + ' Year', col: c.name, kind: 'year', dt: c.type === 'datetime', numeric: true, distinct: c.years || 0 });
      }
      if (c.role === 'measure' && c.type === 'number') add(F.measures, { id: 'm:' + c.name, label: c.label, col: c.name, kind: 'col', agg: c.agg || 'sum',
        fmt: c.fmt || 'int', additive: (c.agg || 'sum') === 'sum' });
    });
    add(F.measures, { id: 'count', label: data.countLabel || 'Records', kind: 'count', fmt: 'int', additive: true });
    (data.extra || []).forEach(function (x) {
      var col = (data.columns || []).filter(function (c) { return c.name === x.col; })[0];
      if (!col) return;
      add(F.measures, { id: 'x:' + x.id, label: x.label, col: x.col, kind: x.kind, op: x.op || 'eq', value: x.value, fmt: x.kind === 'distinct' ? 'int' : 'int',
        additive: x.kind === 'where', numericCol: col.type === 'number' });
    });
    F.all = function () { return F.cats.concat(F.dates, F.measures); };
    return F;
  };

  /* ---------------- preview: VA-like aggregation over the sample rows ---------------- */
  function dayNum(ms) { return Math.round((ms - SAS0) / 864e5); }
  function bucket(ms, group) {
    var d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (group === 'year') return dayNum(Date.UTC(y, 0, 1));
    if (group === 'quarter') return dayNum(Date.UTC(y, m - m % 3, 1));
    if (group === 'month') return dayNum(Date.UTC(y, m, 1));
    return dayNum(Date.UTC(y, m, d.getUTCDate()));
  }
  var DATE_FMT = { day: ['DATE', 'DATE9.'], month: ['MONYY', 'MONYY7.'], quarter: ['YYQ', 'YYQC6.'], year: ['YEAR', 'YEAR4.'] };
  var NUM_FMT = { int: ['COMMA', 'COMMA12.'], dec1: ['COMMA', 'COMMA12.1'], dec2: ['COMMA', 'COMMA12.2'], pct: ['PERCENT', 'PERCENT8.1'],
    cur: ['DOLLAR', 'DOLLAR12.2'], best: ['BEST', 'BEST12.'] };
  RG.NUM_FMT = NUM_FMT;
  RG.DATE_FMT = DATE_FMT;

  /* Rows prepared once per data change: values parsed per column type */
  RG.prepareRows = function (data) {
    var cols = data.columns || [];
    return (data.rows || []).map(function (r) {
      return cols.map(function (c, j) {
        var v = String(r[j] == null ? '' : r[j]).trim();
        if (v === '' || v === '.') return null;
        if (c.type === 'number') { var n = toNum(v); return isNaN(n) ? null : n; }
        if (c.type === 'date' || c.type === 'datetime') { var p = parseDate(v); return p ? p.t : null; }
        return v;
      });
    });
  };

  /* -> {columns, data, keys} shaped like the message VA sends to a data-driven content object */
  RG.queryPreview = function (state, F, rows, roleIds, filters) {
    var cols = state.data.columns, ix = {}, i;
    cols.forEach(function (c, j) { ix[c.name] = j; });
    var roles = roleIds.map(function (id) { return F.byId[id]; }).filter(Boolean);
    var dims = roles.filter(function (f) { return f.kind === 'cat' || f.kind === 'date' || f.kind === 'year'; });
    var meas = roles.filter(function (f) { return f.kind !== 'cat' && f.kind !== 'date' && f.kind !== 'year'; });
    function keyOf(row, f) {
      var v = row[ix[f.col]];
      if (v == null) return null;
      if (f.kind === 'date') return bucket(v, f.group);
      if (f.kind === 'year') return bucket(v, 'year');
      return v;
    }
    var flt = (filters || []).map(function (x) { return { f: F.byId[x.field], set: x.values }; }).filter(function (x) { return x.f; });
    var map = {}, out = [];
    rows.forEach(function (row) {
      for (var q = 0; q < flt.length; q++) { var kv = keyOf(row, flt[q].f); if (!flt[q].set.has(String(kv))) return; }
      var keys = dims.map(function (f) { return keyOf(row, f); }), k = JSON.stringify(keys), g = map[k];
      if (!g) { g = map[k] = { keys: keys, acc: meas.map(function () { return { s: 0, n: 0, mn: null, mx: null, set: {} }; }) }; out.push(g); }
      meas.forEach(function (m, t) {
        var a = g.acc[t], v;
        if (m.kind === 'count') { a.s++; return; }
        v = row[ix[m.col]];
        if (m.kind === 'distinct') { if (v != null) a.set[v] = 1; return; }
        if (m.kind === 'where') {
          var x = m.numericCol ? toNum(m.value) : String(m.value), ok;
          if (v == null) return;
          ok = m.op === 'ne' ? v != x : m.op === 'gt' ? v > x : m.op === 'ge' ? v >= x : m.op === 'lt' ? v < x : m.op === 'le' ? v <= x : String(v) === String(x);
          if (ok) a.s++;
          return;
        }
        if (v == null) return;
        a.s += v; a.n++; a.mn = a.mn == null ? v : Math.min(a.mn, v); a.mx = a.mx == null ? v : Math.max(a.mx, v);
      });
    });
    var data = out.map(function (g) {
      return g.keys.concat(meas.map(function (m, t) {
        var a = g.acc[t];
        if (m.kind === 'distinct') return Object.keys(a.set).length;
        if (m.kind === 'col') return m.agg === 'average' ? (a.n ? a.s / a.n : null) : m.agg === 'min' ? a.mn : m.agg === 'max' ? a.mx : a.s;
        return a.s;
      }));
    });
    var columns = dims.map(function (f, j) {
      var c = { name: 'bi' + (j + 1), label: f.label, usage: 'categorical' };
      if (f.kind === 'date' || f.kind === 'year') { var df = DATE_FMT[f.kind === 'year' ? 'year' : f.group]; c.type = 'date'; c.format = { name: df[0], formatString: df[1] }; }
      else c.type = f.numeric ? 'number' : 'string';
      return c;
    }).concat(meas.map(function (m, j) {
      var nf = NUM_FMT[m.fmt] || NUM_FMT.int;
      return { name: 'bi' + (dims.length + j + 1), label: m.label, type: 'number', usage: 'quantitative', format: { name: nf[0], formatString: nf[1] } };
    }));
    return { version: '1', resultName: 'preview', rowCount: data.length, availableRowCount: data.length, columns: columns, data: data,
      keys: out.map(function (g) { return g.keys; }) };
  };

  /* ---------------- synthetic rows for the preview ----------------
     Used when only a schema (or a handful of rows) is given: resamples each column's observed values. */
  RG.synthRows = function (data, n) {
    var cols = data.columns || [], base = RG.prepareRows(data), seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var gens = cols.map(function (c, j) {
      var seen = base.map(function (r) { return r[j]; }).filter(function (v) { return v != null; });
      if (c.type === 'number') {
        var lo = seen.length ? Math.min.apply(null, seen) : 0, hi = seen.length ? Math.max.apply(null, seen) : 100;
        if (c.role === 'category' || c.role === 'id') {
          var vals = c.samples.length ? c.samples.map(toNum) : [1, 2, 3, 4, 5];
          if (c.role === 'id') return function (i) { return 100000 + i; };
          return function () { return vals[Math.floor(Math.pow(rnd(), 1.4) * vals.length)]; };
        }
        if (lo === hi) { lo = lo * 0.5; hi = hi * 1.5 || 10; }
        return function () { var v = lo + (hi - lo) * Math.pow(rnd(), 1.6); return c.isInt ? Math.round(v) : Math.round(v * 1000) / 1000; };
      }
      if (c.type === 'date' || c.type === 'datetime') {
        var a = seen.length ? Math.min.apply(null, seen) : Date.UTC(2025, 0, 1), b = seen.length ? Math.max.apply(null, seen) : Date.UTC(2026, 8, 30);
        if (b - a < 300 * 864e5) a = b - 540 * 864e5;
        return function () { var t = a + (b - a) * Math.sqrt(rnd()); return Math.floor(t / 864e5) * 864e5; };
      }
      var pool = c.samples.length ? c.samples.slice() : [];
      if (c.role === 'id') return function (i) { return (c.samples[0] ? String(c.samples[0]).replace(/\d+/g, '') : 'ID') + (100000 + i); };
      if (!pool.length) for (var k = 0; k < 8; k++) pool.push(c.label + ' ' + String.fromCharCode(65 + k));
      if (pool.length < 4 && c.distinct > pool.length) for (var q = pool.length; q < Math.min(c.distinct, 10); q++) pool.push(c.label + ' ' + (q + 1));
      return function () { return pool[Math.floor(Math.pow(rnd(), 1.5) * pool.length)]; };
    });
    var out = [];
    for (var i = 0; i < n; i++) out.push(gens.map(function (g) { return g(i); }));
    return out;
  };

  /* Distinct years per date column, so filters can be sized */
  RG.annotateYears = function (data) {
    var rows = RG.prepareRows(data);
    (data.columns || []).forEach(function (c, j) {
      if (c.type !== 'date' && c.type !== 'datetime') return;
      var ys = {};
      rows.forEach(function (r) { if (r[j] != null) ys[new Date(r[j]).getUTCFullYear()] = 1; });
      c.years = Object.keys(ys).length || 3;
    });
  };
})();
