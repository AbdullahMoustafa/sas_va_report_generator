/* Live preview: the real data-driven content (themed), fed with the sample rows aggregated like VA would,
   including the filter actions between objects on a page. */
(function () {
  'use strict';
  var RG = window.RG = window.RG || {};
  var cur = null;

  window.addEventListener('message', function (e) {
    if (!cur || !e.data || typeof e.data !== 'object' || !Array.isArray(e.data.selections)) return;
    var v = cur.visuals.filter(function (x) { return x.frame.contentWindow === e.source; })[0];
    if (!v || !v.source) return;
    var pos = v.dims.indexOf(v.source), vals = new Set();
    e.data.selections.forEach(function (s) { var k = v.keys[s.row]; if (k) vals.add(String(k[pos])); });
    if (vals.size) cur.sel[v.id] = { field: v.source, values: vals }; else delete cur.sel[v.id];
    cur.visuals.forEach(function (t) { if (t !== v && t.ch.type !== 'filter') send(t); });
  });

  function send(v) {
    if (!v.roles || !v.loaded) return;
    var filters = [];
    if (v.ch.type !== 'filter') Object.keys(cur.sel).forEach(function (id) { if (id !== v.id) filters.push(cur.sel[id]); });
    var msg = RG.queryPreview(cur.state, cur.F, cur.rows, v.roles, filters);
    v.keys = msg.keys; delete msg.keys;
    msg.resultName = 'dd_' + v.id;
    v.frame.contentWindow.postMessage(msg, '*');
  }

  /* host: the scrolling element; page: index */
  RG.renderPreview = function (host, state, pageIndex, rows) {
    var F = RG.fields(state), page = state.pages[pageIndex];
    host.innerHTML = '';
    if (!page) return;
    var html;
    try { html = RG.buildDDC(state); } catch (err) { host.innerHTML = '<div class="hint warn" style="margin:16px">' + RG.esc(err.message) + '</div>'; return; }
    /* The layout is in % of the visible report height, like VA. A small window would make the objects too small to
       read, so the page is laid out at least BASE_W x BASE_H and zoomed down to fit (never below MIN_ZOOM; past that
       the preview scrolls sideways). */
    var BASE_W = 920, BASE_H = 700, MIN_ZOOM = 0.62;
    var L = RG.layoutPage(page, F), w = host.clientWidth || BASE_W, k = w < BASE_W ? Math.max(MIN_ZOOM, w / BASE_W) : 1,
      vh = Math.max((host.clientHeight || 600) / k, BASE_H), div = document.createElement('div');
    div.className = 'pv-page';
    if (k < 1) { div.style.width = BASE_W + 'px'; div.style.zoom = k; }
    div.style.height = (L.ph / 100 * vh) + 'px';
    host.appendChild(div);
    cur = { state: state, F: F, rows: rows, sel: {}, visuals: [] };
    function frame(params, it) {
      var f = document.createElement('iframe');
      f.name = '?' + RG.query(params.concat([['static', '1']]));
      f.style.left = it.x + '%'; f.style.width = it.w + '%';
      f.style.top = (it.y / 100 * vh) + 'px'; f.style.height = (it.h / 100 * vh) + 'px';
      f.setAttribute('title', params.filter(function (p) { return p[0] === 'title'; }).map(function (p) { return p[1]; })[0] || 'object');
      f.srcdoc = html;
      div.appendChild(f);
      return f;
    }
    frame([['visual', 'bg'], ['title', page.title || 'Page ' + (pageIndex + 1)]].concat(page.subtitle ? [['sub', page.subtitle]] : [])
      .concat(state.report.note ? [['note', state.report.note]] : []).concat([['hdr', L.hdr], ['ph', L.ph]]), { x: 0, y: 0, w: 100, h: L.ph });
    var kpi = 0;
    L.items.forEach(function (it) {
      var ch = it.ch, problems = RG.chartProblems(ch, F);
      var params = RG.visualParams(ch, F, ch.type === 'kpi' ? kpi++ : 0);
      if (problems.length) params = [['visual', 'kpi'], ['title', (ch.title || RG.CHART_TYPES[ch.type] && RG.CHART_TYPES[ch.type].label || 'Object') + ' - needs ' + problems.join(', ')]];
      var v = { id: ch.id, ch: ch, frame: null, roles: problems.length ? null : RG.roleIds(ch).filter(function (id) { return F.byId[id]; }), loaded: false };
      if (v.roles) {
        v.dims = v.roles.filter(function (id) { var k = F.byId[id].kind; return k === 'cat' || k === 'date' || k === 'year'; });
        v.source = RG.sourceField(ch);
      }
      v.frame = frame(params, it);
      v.frame.addEventListener('load', function () { v.loaded = true; send(v); });
      cur.visuals.push(v);
    });
  };
})();
