/* Shared helpers for the Demo Report Generator. Everything hangs off window.RG. */
(function () {
  'use strict';
  var RG = window.RG = window.RG || {};

  RG.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return (x + 0x100).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  RG.id = function (prefix) { return (prefix || 'x') + Math.random().toString(36).slice(2, 9); };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  RG.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  /* XML attribute / text escaping (apostrophes as &apos; like VA writes them) */
  RG.xml = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  /* Form encoding like Python's quote_plus, which the working packages use in their job URLs */
  RG.qp = function (s) {
    return encodeURIComponent(String(s)).replace(/%20/g, '+').replace(/[!'()*]/g, function (c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
  };

  RG.slug = function (s, sep) {
    sep = sep == null ? '_' : sep;
    var out = String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, sep);
    while (sep && out.charAt(0) === sep) out = out.slice(1);
    while (sep && out.charAt(out.length - 1) === sep) out = out.slice(0, -1);
    return out || 'report';
  };

  RG.nowIso = function () { return new Date().toISOString().replace(/\.\d{3}Z/, 'Z'); };

  /* Bytes -> base64 without blowing the call stack on big inputs */
  RG.b64 = function (bytes) {
    var s = '', i, CH = 0x8000;
    for (i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };
  RG.utf8 = function (str) { return new TextEncoder().encode(str); };

  /* zlib (RFC 1950) deflate, which is what SAS writes after "TRUE###" for report content */
  RG.deflate = function (bytes) {
    if (typeof CompressionStream === 'undefined') {
      return Promise.reject(new Error('This browser cannot compress the report. Use a current Chrome or Edge.'));
    }
    var cs = new CompressionStream('deflate');
    var stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
  };

  /* For text that goes into the SAS job form: ASCII only and no dollar sign */
  RG.jsSafe = function (str) {
    return String(str).replace(/[\u0080-\uffff$]/g, function (c) {
      return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
  };

  RG.download = function (name, text, type) {
    var blob = text instanceof Blob ? text : new Blob([text], { type: type || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  RG.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  RG.round = function (n, d) { var k = Math.pow(10, d == null ? 2 : d); return Math.round(n * k) / k; };

  RG.titleCase = function (s) {
    return String(s || '').replace(/[_\-.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim()
      .replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); })
      .replace(/\b(Id|Pct|Amr|Hai|Ast|Uae|Kpi)\b/g, function (m) { return m === 'Pct' ? '%' : m.toUpperCase(); })
      .replace(/ (Of|And|The|In|By|Per|To|For|On|At)\b/g, function (m) { return m.toLowerCase(); })
      .replace(/ (En|Ar)(?![\s\S])/, '');
  };
})();
