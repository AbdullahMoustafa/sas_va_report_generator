/* Builds the SAS Viya transfer package: report (BIRD XML), folders and the data-driven content job.
   The structure mirrors a package that imports and runs in SAS VA 2024.09 (BIRD 4.44.0). */
(function () {
  'use strict';
  var RG = window.RG = window.RG || {};
  var X = RG.xml;

  /* ---------------- paths ---------------- */
  RG.paths = function (state) {
    var e = state.env, parent = '/' + String(e.parentPath || '/Development').replace(/^\/+|\/+(?![\s\S])/g, ''),
      folder = (e.reportFolder || RG.slug(state.report.name, '-')).replace(/\//g, '-'),
      assets = (e.assetsFolder || 'Assets').replace(/\//g, '-'), job = e.jobName || RG.slug(state.report.name).toLowerCase() + '_ddc';
    return { parent: parent, parentName: parent.split('/').pop(), folder: folder, report: parent + '/' + folder,
      assets: parent + '/' + folder + '/' + assets, assetsName: assets, job: job, program: parent + '/' + folder + '/' + assets + '/' + job };
  };
  RG.jobUrl = function (state, pairs) {
    var server = String(state.env.server || '').replace(/\/+(?![\s\S])/, '');
    return server + '/SASJobExecution/?_program=' + RG.qp(RG.paths(state).program) + (pairs && pairs.length ? '&' + RG.query(pairs) : '');
  };

  /* ---------------- the job form: template + theme + brand ---------------- */
  RG.buildDDC = function (state) {
    var tpl = window.DDC_TEMPLATE;
    if (!tpl) throw new Error('js/ddc_template.js is missing: run python tools/build_template.py');
    var t = RG.resolveTheme(state.report), r = state.report;
    var brand = { report: r.name || 'Report', eyebrow: r.eyebrow || r.name || '', logo: r.logo || '', logoH: 0 };
    var out = tpl
      .replace(/\/\*@THEME@\*\/[\s\S]*?\/\*@\/THEME@\*\//, function () { return '/*@THEME@*/\n' + RG.themeCss(t) + '\n/*@/THEME@*/'; })
      .replace(/\/\*@BRAND@\*\/[\s\S]*?\/\*@\/BRAND@\*\//, function () { return '/*@BRAND@*/' + RG.jsSafe(JSON.stringify(brand)) + '/*@/BRAND@*/'; });
    if (out.indexOf('$') >= 0) throw new Error('The job form would contain a dollar sign; remove it from the report name / texts.');
    if (/[^\x00-\x7f]/.test(out)) throw new Error('The job form would contain non-ASCII characters.');
    return out;
  };

  /* ---------------- report XML ---------------- */
  var DATE_FMT = { day: ['DATE9', 'DTDATE9'], month: ['MONYY7', 'DTMONYY7'], quarter: ['YYQC6', 'DTYYQC6'], year: ['YEAR4', 'DTYEAR4'] };
  var NUM_FMT = { int: 'COMMA12.', dec1: 'COMMA12.1', dec2: 'COMMA12.2', pct: 'PERCENT8.1', cur: 'DOLLAR12.2', best: 'BEST12.' };
  var OPS = { eq: 'eq', ne: 'ne', gt: 'gt', ge: 'ge', lt: 'lt', le: 'le' };

  RG.buildReportXml = function (state, F) {
    var next = 10, now = RG.nowIso(), theme = RG.resolveTheme(state.report), P = RG.paths(state);
    function nm(p) { return p + (next++); }
    var ds = nm('ds'), items = {}, itemList = [], cols = {};
    (state.data.columns || []).forEach(function (c) { cols[c.name] = c; });

    /* business items of the data source, created on first use */
    function base(id) {
      if (items[id]) return items[id].name;
      var f = F.byId[id], c, name, xml;
      if (!f) throw new Error('Unknown field ' + id);
      if (f.kind === 'cat') {
        c = cols[f.col]; name = nm('bi');
        xml = '<DataItem name="' + name + '" label="' + X(f.label) + '" xref="' + X(f.col) + '"' + (c && c.type === 'number' ? ' usage="categorical"' : '') + '/>';
      } else if (f.kind === 'date' || f.kind === 'year') {
        name = nm('bi');
        var df = DATE_FMT[f.kind === 'year' ? 'year' : f.group || 'month'][f.dt ? 1 : 0];
        xml = '<DataItem name="' + name + '" label="' + X(f.label) + '" xref="' + X(f.col) + '" format="' + df + '"/>';
      } else if (f.kind === 'col') {
        name = nm('bi');
        xml = '<DataItem name="' + name + '" label="' + X(f.label) + '" xref="' + X(f.col) + '" aggregation="' + (f.agg || 'sum') + '" format="' + (NUM_FMT[f.fmt] || NUM_FMT.int) + '"/>';
      } else if (f.kind === 'count') {
        name = nm('bi');
        xml = '<PredefinedDataItem calculation="totalCount" name="' + name + '" label="' + X(f.label) + '" usage="quantitative" format="COMMA12."/>';
      } else if (f.kind === 'distinct') {
        var b = base('c:' + f.col); name = nm('bi');
        xml = '<AggregateCalculatedItem dataType="double" name="' + name + '" label="' + X(f.label) + '" format="COMMA12.">\n          <Expression>' +
          X('aggregate(countDistinct,group,${' + b + ',binned})') + '</Expression>\n        </AggregateCalculatedItem>';
      } else if (f.kind === 'where') {
        var b2 = base('c:' + f.col), v = f.numericCol ? String(parseFloat(f.value) || 0) : "'" + String(f.value).replace(/'/g, '') + "'";
        name = nm('bi');
        xml = '<CalculatedItem dataType="double" name="' + name + '" label="' + X(f.label) + '" usage="quantitative" format="COMMA12." aggregation="sum">\n          <Expression>' +
          X('cond(' + (OPS[f.op] || 'eq') + '(${' + b2 + ',' + (f.numericCol ? 'raw' : 'binned') + '},' + v + '),1,0)') + '</Expression>\n        </CalculatedItem>';
      }
      items[id] = { name: name, xml: xml, order: /^<DataItem/.test(xml) ? 0 : /^<Predefined/.test(xml) ? 1 : /^<CalculatedItem/.test(xml) ? 2 : 3 };
      itemList.push(items[id]);
      return name;
    }
    /* make sure category items of distinct / conditional measures exist (they are referenced by name) */
    F.measures.forEach(function (m) { if (m.kind === 'distinct' || m.kind === 'where') { if (!F.byId['c:' + m.col]) F.byId['c:' + m.col] = { id: 'c:' + m.col, kind: 'cat', col: m.col, label: (cols[m.col] || {}).label || m.col }; } });

    var dataDefs = [], visualEls = [], sections = [], interactions = [], styled = [], subs = {}, sectionNames = [];
    (state.pages || []).forEach(function (page, pi) {
      var L = RG.layoutPage(page, F), secName = nm('vi'), vcName = nm('ve'), vcLayout = nm('vi'), bgName = nm('ve'), z = 1, layoutXml = [];
      var visuals = [];
      sectionNames.push(secName);
      /* background and header */
      var bgUrl = RG.jobUrl(state, [['visual', 'bg'], ['title', page.title || 'Page ' + (pi + 1)]].concat(page.subtitle ? [['sub', page.subtitle]] : [])
        .concat(state.report.note ? [['note', state.report.note]] : []).concat([['hdr', L.hdr], ['ph', L.ph]]));
      visualEls.push('<WebContent url="' + X(bgUrl) + '" name="' + bgName + '" label="' + X('Background - ' + (page.title || 'Page ' + (pi + 1))) + '" selectionDisabled="true"/>');
      subs['VisualElement:' + bgName] = bgUrl; styled.push(bgName);
      layoutXml.push(visualLayout(bgName, nm('vi'), z++, 0, 0, 100, L.ph, vcLayout));

      L.items.forEach(function (it) {
        var ch = it.ch, roles = RG.roleIds(ch).filter(function (id) { return id && F.byId[id]; });
        if (!roles.length || RG.chartProblems(ch, F).length) return;
        var v = { ch: ch, parent: nm('dd'), inner: nm('dd'), prim: nm('dd'), fmt: nm('dd'), table: nm('ve'), web: nm('ve'), rel: [], added: [] };
        roles.forEach(function (id) { v.rel.push({ name: nm('bi'), base: base(id), field: id }); });
        v.sourceField = RG.sourceField(ch);
        v.params = RG.visualParams(ch, F, visuals.filter(function (x) { return x.ch.type === 'kpi'; }).length);
        v.url = RG.jobUrl(state, v.params);
        v.layout = visualLayout(v.web, nm('vi'), z++, it.x, it.y, it.w, it.h, vcLayout);
        visuals.push(v);
      });

      /* interactions: every source filters every other data object on the page (filters are never targets) */
      visuals.forEach(function (s) {
        if (!s.sourceField) return;
        var sv = s.rel.filter(function (r) { return r.field === s.sourceField; })[0];
        if (!sv) return;
        visuals.forEach(function (t) {
          if (t === s || t.ch.type === 'filter') return;
          var tv = t.rel.concat(t.added).filter(function (r) { return r.base === sv.base; })[0];
          if (!tv) { tv = { name: nm('bi'), base: sv.base, field: s.sourceField }; t.added.push(tv); }
          interactions.push('<Interaction name="' + nm('ia') + '" type="filter" derived="false">\n      <InteractionElementReference purpose="source" ref="' + s.web +
            '" variable="' + sv.name + '"/>\n      <InteractionElementReference purpose="target" ref="' + t.web + '" variable="' + tv.name + '"/>\n    </Interaction>');
        });
      });

      visuals.forEach(function (v) {
        var bis = v.rel.concat(v.added).map(function (r) { return '        <RelationalDataItem name="' + r.name + '" base="' + r.base + '"/>'; }).join('\n');
        dataDefs.push('    <ParentDataDefinition childQueryRelationship="independent" status="executable" dataSource="' + ds + '" name="' + v.parent + '">\n      <BusinessItems>\n' + bis +
          '\n      </BusinessItems>\n      <DataDefinition dataSource="' + ds + '" type="procedural" name="' + v.inner + '">\n        <ProceduralQuery type="standard">\n          <Arguments>\n            <ListArgument purpose="column">\n' +
          v.rel.map(function (r) { return '              <ReferenceValue>' + r.name + '</ReferenceValue>'; }).join('\n') +
          '\n            </ListArgument>\n          </Arguments>\n        </ProceduralQuery>\n        <ResultDefinitions>\n' +
          '          <ResultDefinition purpose="primary" maxRowsLookup="customContent" maxRowsBehavior="truncate" name="' + v.prim + '"/>\n' +
          '          <ResultDefinition purpose="formatted" maxRowsLookup="customContent" maxRowsBehavior="truncate" format="JSONX" name="' + v.fmt + '"/>\n' +
          '        </ResultDefinitions>\n      </DataDefinition>\n    </ParentDataDefinition>');
        visualEls.push('<Table columnSizing="autoFill" resultDefinitions="' + v.prim + '" name="' + v.table + '" data="' + v.parent + '" applyDynamicBrushes="yes">\n      <Columns>\n' +
          v.rel.map(function (r) { return '        <Column variable="' + r.name + '"/>'; }).join('\n') + '\n      </Columns>\n    </Table>');
        var src = v.sourceField ? v.rel.filter(function (r) { return r.field === v.sourceField; })[0] : null;
        visualEls.push('<WebContent url="' + X(v.url) + '" webContentType="webDataContent" supplementalVisuals="' + v.table + '" resultDefinitions="' + v.prim + ' ' + v.fmt +
          '" name="' + v.web + '" data="' + v.parent + '" label="' + X(v.ch.title || RG.autoTitle(v.ch, F)) + '"' + (src ? '' : ' selectionDisabled="true"') + ' applyDynamicBrushes="yes"' +
          (src ? ' sourceInteractionVariables="' + src.name + '"' : '') + '>\n      <EditorProperties>\n        <Property key="isAutoLabel">false</Property>\n' +
          (v.added.length ? '        <Property key="addedInteractionQueryDataItems">' + v.added.map(function (r) { return r.name; }).join(',') + '</Property>\n' : '') +
          '      </EditorProperties>\n    </WebContent>');
        subs['VisualElement:' + v.web] = v.url; styled.push(v.web);
        layoutXml.push(v.layout);
      });

      visualEls.push('<VisualContainer containerType="precision" name="' + vcName + '" label="' + X('Page container - ' + (page.title || 'Page ' + (pi + 1))) +
        '" selectionDisabled="true">\n      <EditorProperties>\n        <Property key="isPrecision">true</Property>\n        <Property key="isAutoLabel">false</Property>\n      </EditorProperties>\n    </VisualContainer>');
      styled.push(vcName);
      sections.push(sectionXml(secName, page.title || 'Page ' + (pi + 1), vcName, vcLayout, L.ph, layoutXml));
    });

    itemList.sort(function (a, b) { return a.order - b.order; });
    var bg = String(theme.page).toUpperCase(), css = ['.Report {\n  background-color: ' + bg + ';\n}', '.ReportElementContainer {\n  padding: 0px;\n}'];
    sectionNames.forEach(function (s) { css.push('#' + s + ' .ReportPagePadding {\n  padding: 0px;\n}'); });
    styled.forEach(function (n) { css.push('#' + n + ' .ReportElementContainer {\n  padding: 0px;\n}', '#' + n + ' .Container {\n  background-color: ' + bg + ';\n  transparency: 1;\n}'); });

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<SASReport xmlns="http://www.sas.com/sasreportmodel/bird-4.44.0" label="' + X(state.report.name) +
      '" features="promptModelV2" implicitInteractions="reportPrompt sectionPrompt sectionLink" createdLocale="en_US" createdVersion="4.44.0" dateCreated="' + now +
      '" dateModified="' + now + '" createdApplication="SAS Visual Analytics 2020" lastModifiedApplication="SAS Visual Analytics 2020" nextUniqueNameIndex="' + (next + 1) + '">\n' +
      '  <DataDefinitions>\n' + dataDefs.join('\n') + '\n  </DataDefinitions>\n' +
      '  <DataSources>\n    <DataSource label="' + X(state.env.table) + '" type="relational" name="' + ds + '">\n      <CasResource server="' + X(state.env.casServer) +
      '" library="' + X(state.env.library) + '" table="' + X(state.env.table) + '" locale="en_US"/>\n      <BusinessItemFolder>\n' +
      itemList.map(function (i) { return '        ' + i.xml; }).join('\n') + '\n      </BusinessItemFolder>\n    </DataSource>\n  </DataSources>\n' +
      '  <VisualElements>\n' + visualEls.map(function (v) { return '    ' + v; }).join('\n') + '\n  </VisualElements>\n' +
      '  <View>\n    <Header>\n' + headerXml('      ') + '    </Header>\n' + sections.join('\n') + '\n  </View>\n' +
      '  <Interactions>\n' + interactions.map(function (i) { return '    ' + i; }).join('\n') + '\n  </Interactions>\n' +
      '  <MediaSchemes>\n    <MediaScheme name="ms1">\n      <BaseStylesheetResource theme="' + X(state.env.vaTheme || 'midnight2020') + '"/>\n      <Stylesheet>\n<![CDATA[\n' + css.join('\n') +
      '\n]]>\n      </Stylesheet>\n    </MediaScheme>\n  </MediaSchemes>\n' +
      '  <MediaTargets>\n    <MediaTarget windowSize="default" scheme="ms1" name="mt2"/>\n    <MediaTarget windowSize="small" scheme="ms1" name="mt3"/>\n' +
      '    <MediaTarget windowSize="medium" scheme="ms1" name="mt4"/>\n    <MediaTarget windowSize="large" scheme="ms1" name="mt5"/>\n  </MediaTargets>\n' +
      '  <Properties>\n    <Property key="displayDataSource">' + ds + '</Property>\n  </Properties>\n' +
      '  <ExportProperties>\n    <Export destination="pdf">\n      <Property key="showCoverPage" value="true"></Property>\n      <Property key="showPageNumbers" value="true"></Property>\n    </Export>\n  </ExportProperties>\n' +
      '  <History>\n    <Versions>\n      <Version key="4.44.0" lastDate="' + now + '"/>\n    </Versions>\n    <Editors>\n      <Editor applicationName="VA">\n        <Revision editorVersion="2024.09" lastDate="' +
      now + '"/>\n      </Editor>\n    </Editors>\n  </History>\n  <SASReportState date="' + now + '">\n    <View/>\n  </SASReportState>\n</SASReport>\n';
    return { xml: xml, ds: ds, substitutions: subs, program: P.program };
  };

  function weights(ind) {
    return ['mt5', 'mt4', 'mt3'].map(function (m) { return ind + '<Weights mediaTarget="' + m + '" unit="percent">\n' + ind + '  <Weight value="100%"/>\n' + ind + '</Weights>'; }).join('\n');
  }
  function headerXml(ind) {
    return ind + '<MediaContainer target="mt2">\n' + ind + '  <ResponsiveLayout orientation="horizontal" overflow="fit">\n' + weights(ind + '    ') + '\n' +
      ind + '  </ResponsiveLayout>\n' + ind + '</MediaContainer>\n';
  }
  function pc(v) { return RG.round(v, 2) + '%'; }
  function visualLayout(ref, name, z, x, y, w, h, anchor) {
    var i = '            ';
    return i + '<Visual ref="' + ref + '" name="' + name + '">\n' + i + '  <ResponsiveConstraint zIndex="' + z + '">\n' +
      i + '    <WidthConstraint>\n' + i + '      <Width mediaTarget="mt3" preferredSizeBehavior="ignore" value="' + pc(w) + '" flexibility="flexible"/>\n' + i + '    </WidthConstraint>\n' +
      i + '    <HeightConstraint>\n' + i + '      <Height mediaTarget="mt3" preferredSizeBehavior="ignore" value="' + pc(h) + '" flexibility="flexible"/>\n' + i + '    </HeightConstraint>\n' +
      i + '    <VerticalConstraint anchor="' + anchor + '" offset="' + pc(y) + '"/>\n' + i + '    <HorizontalConstraint anchor="' + anchor + '" offset="' + pc(x) + '"/>\n' +
      i + '  </ResponsiveConstraint>\n' + i + '</Visual>';
  }
  function sectionXml(name, label, vc, vcLayout, ph, visuals) {
    return '    <Section name="' + name + '" showSelectionControl="false" label="' + X(label) + '">\n      <Header>\n' + headerXml('        ') + '      </Header>\n' +
      '      <Body>\n        <MediaContainer target="mt2">\n          <ResponsiveLayout orientation="vertical" overflow="fit"/>\n' +
      '          <Container ref="' + vc + '" name="' + vcLayout + '">\n            <ResponsiveConstraint>\n              <WidthConstraint>\n' +
      '                <Width mediaTarget="mt3" preferredSizeBehavior="ignore" value="100%" flexibility="shrinkable"/>\n              </WidthConstraint>\n              <HeightConstraint>\n' +
      '                <Height mediaTarget="mt3" preferredSizeBehavior="ignore" value="' + pc(ph) + '" flexibility="shrinkable"/>\n              </HeightConstraint>\n            </ResponsiveConstraint>\n' +
      '            <ResponsiveLayout orientation="vertical" overflow="fit">\n' + weights('              ') + '\n            </ResponsiveLayout>\n' +
      visuals.join('\n') + '\n          </Container>\n        </MediaContainer>\n      </Body>\n    </Section>';
  }

  /* ---------------- the transfer package ---------------- */
  function link(rel, uri, type, method) { var l = { method: method || 'GET', rel: rel, href: uri, uri: uri }; if (type) l.type = type; return l; }
  function connLinks(pkg, id) { return [link('self', '/transfer/packages/' + pkg + '/connectors/' + id, 'application/vnd.sas.transfer.connector')]; }
  function objLinks(pkg, id) { return [link('self', '/transfer/packages/' + pkg + '/objects/' + id, 'application/vnd.sas.transfer.object')]; }
  function stamp(user, now) { return { creationTimeStamp: now, modifiedTimeStamp: now, createdBy: user, modifiedBy: user }; }
  function b64json(o) { return RG.b64(RG.utf8(JSON.stringify(o))); }

  function folderDetail(pkg, user, now, id, name, parentId) {
    var uri = '/folders/folders/' + id, toId = RG.uuid(), links = [link('self', uri, 'application/vnd.sas.content.folder'), link('members', uri + '/members', 'application/vnd.sas.collection')];
    if (parentId) links.push(link('up', '/folders/folders/' + parentId, 'application/vnd.sas.content.folder'));
    var content = { folder: Object.assign(stamp(user, now), { version: 1, id: id, name: name }, parentId ? { parentFolderUri: '/folders/folders/' + parentId } : {}, { type: 'folder', links: links }) };
    return {
      transferObject: { links: objLinks(pkg, toId), version: 2, id: toId,
        summary: Object.assign(stamp(user, now), { id: id, type: 'folder', name: name, links: links, version: 2 }),
        content: b64json(content), state: 'enabled', connectors: [], substitutions: {} },
      connectors: []
    };
  }
  RG.buildPackage = function (state) {
    var F = RG.fields(state), P = RG.paths(state), user = state.env.user || 'sasdemo', now = RG.nowIso();
    state.ids = state.ids || {};
    ['package', 'report', 'reportFolder', 'assetsFolder', 'job'].forEach(function (k) { if (!state.ids[k]) state.ids[k] = RG.uuid(); });
    var ids = state.ids, pkg = ids.package, parentId = (state.env.parentFolderId || '').trim();
    if (!/^[0-9a-f-]{36}(?![\s\S])/i.test(parentId)) throw new Error('Enter the id of the parent folder ' + P.parent + ' (SAS Drive > folder > Properties).');
    var built = RG.buildReportXml(state, F), form = RG.buildDDC(state);
    var reportUri = '/reports/reports/' + ids.report, jobUri = '/jobDefinitions/definitions/' + ids.job;
    function pconn(folderId, folderName, childUri) {
      var id = RG.uuid();
      return { id: id, uri: '/folders/folders/' + folderId, relatedUris: [childUri], name: folderName, contentType: 'application/vnd.sas.content.folder+json',
        type: 'parentFolder', hints: {}, links: connLinks(pkg, id), forceMapping: false };
    }
    function folder(id, name, parent, parentName) {
      var d = folderDetail(pkg, user, now, id, name, parent);
      d.connectors = parent ? [pconn(parent, parentName, '/folders/folders/' + id)] : [];
      return d;
    }
    var reportContent = { object: { id: ids.report, name: state.report.name, createdBy: user, creationTimeStamp: now, modifiedBy: user, modifiedTimeStamp: now,
      imageUris: { icon: '/reports/icons/report.gif' }, version: 1 }, transferableContent: { content: built.xml, contentVersion: 49, reportStates: null } };

    return RG.deflate(RG.utf8(JSON.stringify(reportContent))).then(function (z) {
      var tableUri = 'server=' + state.env.casServer + ';library=' + state.env.library + ';table=' + state.env.table, tcId = RG.uuid(), rtoId = RG.uuid();
      var report = {
        transferObject: { links: objLinks(pkg, rtoId), version: 2, id: rtoId,
          summary: Object.assign(stamp(user, now), { id: ids.report, type: 'report', name: state.report.name, description: state.report.description || '',
            links: [link('self', reportUri, 'application/vnd.sas.report')], version: 1 }),
          content: 'TRUE###' + RG.b64(z), state: 'enabled', contentSourceLocation: P.report,
          connectors: [{ id: tcId, uri: tableUri, relatedUris: [reportUri], contentType: 'application/vnd.sas.table+json', type: 'table',
            hints: { name: built.ds, xpath: '/SASReport/DataSources[1]/DataSource[1]/CasResource[1]', 'orig-uri': tableUri }, links: connLinks(pkg, tcId), forceMapping: false }],
          substitutions: built.substitutions },
        connectors: [pconn(ids.reportFolder, P.folder, reportUri)]
      };
      var job = {
        creationTimeStamp: now, modifiedTimeStamp: now, createdBy: user, modifiedBy: user, version: 2, id: ids.job, name: P.job,
        description: 'Data-driven content objects for the SAS VA report "' + state.report.name + '" (HTML form; ?visual=.. picks the object)',
        type: 'Compute',
        parameters: [
          { version: 1, name: '_contextName', defaultValue: 'SAS Studio compute context', type: 'CHARACTER', label: 'Context Name', required: false },
          { version: 1, name: '_action', defaultValue: 'form,execute', type: 'CHARACTER', label: '', required: false }],
        code: '/* Data-driven content for SAS Visual Analytics: this job only serves its HTML form. */\n',
        links: [link('self', jobUri, 'application/vnd.sas.job.definition'), link('alternate', jobUri, 'application/vnd.sas.summary'),
          Object.assign(link('update', jobUri, 'application/vnd.sas.job.definition', 'PUT'), { responseType: 'application/vnd.sas.job.definition' }),
          link('delete', jobUri, null, 'DELETE')],
        properties: [{ name: 'form', value: form }, { name: 'pathLabel', value: P.program }]
      };
      var jtoId = RG.uuid();
      var jobDetail = {
        transferObject: { links: objLinks(pkg, jtoId), version: 2, id: jtoId,
          summary: Object.assign(stamp(user, now), { id: ids.job, type: 'jobDefinition', name: P.job, description: job.description,
            links: [link('self', jobUri, 'application/vnd.sas.job.definition')], version: 2 }),
          content: b64json(job), state: 'enabled', contentSourceLocation: P.assets, connectors: [], substitutions: {} },
        connectors: [pconn(ids.assetsFolder, P.assetsName, jobUri)]
      };
      var details = [report, folder(ids.reportFolder, P.folder, parentId, P.parentName), folder(ids.assetsFolder, P.assetsName, ids.reportFolder, P.folder),
        folder(parentId, P.parentName, null), jobDetail];
      var out = Object.assign(stamp(user, now), {
        links: [link('self', '/transfer/packages/' + pkg, 'application/vnd.sas.transfer.package'),
          link('objects', '/transfer/packages/' + pkg + '/objects', 'application/vnd.sas.collection'),
          link('connectors', '/transfer/packages/' + pkg + '/connectors', 'application/vnd.sas.collection')],
        version: 1, id: pkg, name: state.report.name, description: (state.report.description || state.report.name) + ' - SAS VA report on CAS table ' + state.env.library + '.' + state.env.table,
        options: { includeRules: 'false', includeDependencies: 'true' }, requestedItems: [reportUri, jobUri], transferObjectCount: details.length, transferDetails: details
      });
      return { json: JSON.stringify(out, null, 2), xml: built.xml, form: form, paths: P };
    });
  };
})();
