// Embroidery file readers: DST, EXP (+ INF colours), JEF, PES, PEC, VP3, XXX, HUS, and designs inside a ZIP.
// Ported from pyembroidery by Tatarize / EmbroidePy (MIT licence, copyright (c) 2018; full text in
// studio/vendor/pyembroidery/LICENSE). Output: millimetres, y up, colour blocks of stitch runs (a run is a
// stretch of consecutive needle points; jumps and trims start a new run). Nothing here touches the DOM.
var StitchRead = (function () {
  'use strict';
  var PEC = [null,["#0e1f7c","Prussian Blue"],["#0a55a3","Blue"],["#008777","Teal Green"],["#4b6baf","Cornflower Blue"],["#ed171f","Red"],["#d15c00","Reddish Brown"],["#913697","Magenta"],["#e49acb","Light Lilac"],["#915fac","Lilac"],["#9ed67d","Mint Green"],["#e8a900","Deep Gold"],["#feba35","Orange"],["#ffff00","Yellow"],["#70bc1f","Lime Green"],["#ba9800","Brass"],["#a8a8a8","Silver"],["#7d6f00","Russet Brown"],["#ffffb3","Cream Brown"],["#4f5556","Pewter"],["#000000","Black"],["#0b3d91","Ultramarine"],["#770176","Royal Purple"],["#293133","Dark Gray"],["#2a1301","Dark Brown"],["#f64a8a","Deep Rose"],["#b27624","Light Brown"],["#fcbbc5","Salmon Pink"],["#fe370f","Vermilion"],["#f0f0f0","White"],["#6a1c8a","Violet"],["#a8ddc4","Seacrest"],["#2584bb","Sky Blue"],["#feb343","Pumpkin"],["#fff36b","Cream Yellow"],["#d0a660","Khaki"],["#d15400","Clay Brown"],["#66ba49","Leaf Green"],["#134a46","Peacock Blue"],["#878787","Gray"],["#d8ccc6","Warm Gray"],["#435607","Dark Olive"],["#fdd9de","Flesh Pink"],["#f993bc","Pink"],["#003822","Deep Green"],["#b2afd4","Lavender"],["#686ab0","Wisteria Violet"],["#efe3b9","Beige"],["#f73866","Carmine"],["#b54b64","Amber Red"],["#132b1a","Olive Green"],["#c70156","Dark Fuchsia"],["#fe9e32","Tangerine"],["#a8deeb","Light Blue"],["#00673e","Emerald Green"],["#4e2990","Purple"],["#2f7e20","Moss Green"],["#ffcccc","Flesh Pink"],["#ffd911","Harvest Gold"],["#095ba6","Electric Blue"],["#f0f970","Lemon Yellow"],["#e3f35b","Fresh Green"],["#ff9900","Orange"],["#fff08d","Cream Yellow"],["#ffc8c8","Applique"]];
  var HUS = [["#000000","Black"],["#0000e7","Blue"],["#00c600","Green"],["#ff0000","Red"],["#840084","Purple"],["#ffff00","Yellow"],["#848484","Grey"],["#8484e7","Light Blue"],["#00ff84","Light Green"],["#ff7b31","Orange"],["#ff8ca5","Pink"],["#845200","Brown"],["#ffffff","White"],["#000084","Dark Blue"],["#008400","Dark Green"],["#7b0000","Dark Red"],["#ff6384","Light Red"],["#522952","Dark Purple"],["#ff00ff","Light Purple"],["#ffde00","Dark Yellow"],["#ffff9c","Light Yellow"],["#525252","Dark Grey"],["#d6d6d6","Light Grey"],["#ff5208","Dark Orange"],["#ff9c5a","Light Orange"],["#ff52b5","Dark Pink"],["#ffc6de","Light Pink"],["#523100","Dark Brown"],["#b5a584","Light Brown"]];
  var JEF = [null,["#000000","Black"],["#ffffff","White"],["#ffff17","Yellow"],["#ff6600","Orange"],["#2f5933","Olive Green"],["#237336","Green"],["#65c2c8","Sky"],["#ab5a96","Purple"],["#f669a0","Pink"],["#ff0000","Red"],["#b1704e","Brown"],["#0b2f84","Blue"],["#e4c35d","Gold"],["#481a05","Dark Brown"],["#ac9cc7","Pale Violet"],["#fcf294","Pale Yellow"],["#f999b7","Pale Pink"],["#fab381","Peach"],["#c9a480","Beige"],["#970533","Wine Red"],["#a0b8cc","Pale Sky"],["#7fc21c","Yellow Green"],["#e5e5e5","Silver Gray"],["#889b9b","Gray"],["#98d6bd","Pale Aqua"],["#b2e1e3","Baby Blue"],["#368ba0","Powder Blue"],["#4f83ab","Bright Blue"],["#386a91","Slate Blue"],["#071650","Navy Blue"],["#f999a2","Salmon Pink"],["#f9676b","Coral"],["#e3311f","Burnt Orange"],["#e2a188","Cinnamon"],["#b59474","Umber"],["#e4cf99","Blond"],["#ffcb00","Sunflower"],["#e1add4","Orchid Pink"],["#c3007e","Peony Purple"],["#80004b","Burgundy"],["#540571","Royal Purple"],["#b10525","Cardinal Red"],["#cae0c0","Opal Green"],["#899856","Moss Green"],["#5c941a","Meadow Green"],["#003114","Dark Green"],["#5dae94","Aquamarine"],["#4cbf8f","Emerald Green"],["#007772","Peacock Green"],["#595b61","Dark Gray"],["#fffff2","Ivory White"],["#b15818","Hazel"],["#cb8a07","Toast"],["#986c80","Salmon"],["#98692d","Cocoa Brown"],["#4d3419","Sienna"],["#4c330b","Sepia"],["#33200a","Dark Sepia"],["#523a97","Violet Blue"],["#0d217e","Blue Ink"],["#1e77ac","Sola Blue"],["#b2dd53","Green Dust"],["#f33689","Crimson"],["#de649e","Floral Pink"],["#984161","Wine"],["#4c5612","Olive Drab"],["#4c881f","Meadow"],["#e4de79","Mustard"],["#cb8a1a","Yellow Ocher"],["#cba21c","Old Gold"],["#ff9805","Honey Dew"],["#fcb257","Tangerine"],["#ffe505","Canary Yellow"],["#f0331f","Vermilion"],["#1a842d","Bright Green"],["#386cae","Ocean Blue"],["#e3c4b4","Beige Gray"],["#e3ac81","Bamboo"]];

  // a design with no colours of its own (DST, EXP) gets these, one per thread change, until the user picks threads
  var DEFAULTS = ['#1f3a93', '#c0392b', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#2c3e50', '#d35400', '#7f8c8d', '#e84393', '#00a8ff'];
  function hex6(n) { return '#' + ('000000' + (n & 0xffffff).toString(16)).slice(-6); }
  function s8(b) { return b > 127 ? b - 256 : b; }
  function s16(v) { v &= 0xffff; return v > 0x7fff ? v - 0x10000 : v; }
  function s32(v) { return v | 0; }

  function Buf(u8) { this.u = u8; this.p = 0; }
  Buf.prototype.left = function () { return this.u.length - this.p; };
  Buf.prototype.u8 = function () { return this.p < this.u.length ? this.u[this.p++] : null; };
  Buf.prototype.u16le = function () { var a = this.u8(), b = this.u8(); return b === null ? null : a | (b << 8); };
  Buf.prototype.u16be = function () { var a = this.u8(), b = this.u8(); return b === null ? null : (a << 8) | b; };
  Buf.prototype.u24le = function () { var a = this.u8(), b = this.u8(), c = this.u8(); return c === null ? null : a | (b << 8) | (c << 16); };
  Buf.prototype.u24be = function () { var a = this.u8(), b = this.u8(), c = this.u8(); return c === null ? null : (a << 16) | (b << 8) | c; };
  Buf.prototype.u32le = function () { var a = this.u16le(), b = this.u16le(); return b === null ? null : (a + b * 65536) >>> 0; };
  Buf.prototype.u32be = function () { var a = this.u16be(), b = this.u16be(); return b === null ? null : (a * 65536 + b) >>> 0; };
  Buf.prototype.skip = function (n) { this.p += n; };
  Buf.prototype.str = function (n) { var s = ''; for (var i = 0; i < n && this.p < this.u.length; i++) { var c = this.u[this.p++]; s += String.fromCharCode(c); } return s; };
  Buf.prototype.utf8 = function (n) { var a = this.u.subarray(this.p, Math.min(this.u.length, this.p + n)); this.p += n; try { return new TextDecoder('utf-8').decode(a); } catch (e) { return ''; } };

  // commands in file units (0.1 mm), y up: S stitch, J jump, T trim, C colour change
  function Pat() { this.cmds = []; this.x = 0; this.y = 0; this.threads = []; this.meta = {}; }
  Pat.prototype.stitch = function (dx, dy) { this.x += dx; this.y += dy; this.cmds.push([this.x, this.y, 'S']); };
  Pat.prototype.move = function (dx, dy) { this.x += dx; this.y += dy; this.cmds.push([this.x, this.y, 'J']); };
  Pat.prototype.moveAbs = function (x, y) { this.x = x; this.y = y; this.cmds.push([this.x, this.y, 'J']); };
  Pat.prototype.trim = function () { this.cmds.push([this.x, this.y, 'T']); };
  Pat.prototype.colour = function () { this.cmds.push([this.x, this.y, 'C']); };
  Pat.prototype.thread = function (t) { this.threads.push(t); };

  // ---------- DST (Tajima) ----------
  function bit(b, n) { return (b >> n) & 1; }
  function readDST(u8) {
    var f = new Buf(u8), out = new Pat();
    var head = f.str(512);
    head.split(/[\r\n]/).forEach(function (line) {
      line = line.replace(/\0/g, '').trim(); if (line.length < 4) return;
      var k = line.slice(0, 2), v = line.slice(3).trim();
      if (k === 'LA') out.meta.name = v;
      else if (k === 'TC') { var t = v.split(',').map(function (s) { return s.trim(); }); if (/^#[0-9a-f]{6}$/i.test(t[0])) out.thread({ color: t[0].toLowerCase(), name: t[1] || '', code: t[2] || '' }); }
    });
    f.p = 512;
    while (f.left() >= 3) {
      var b0 = f.u8(), b1 = f.u8(), b2 = f.u8();
      var dx = bit(b2, 2) * 81 - bit(b2, 3) * 81 + bit(b1, 2) * 27 - bit(b1, 3) * 27 + bit(b0, 2) * 9 - bit(b0, 3) * 9 + bit(b1, 0) * 3 - bit(b1, 1) * 3 + bit(b0, 0) - bit(b0, 1);
      var dy = bit(b2, 5) * 81 - bit(b2, 4) * 81 + bit(b1, 5) * 27 - bit(b1, 4) * 27 + bit(b0, 5) * 9 - bit(b0, 4) * 9 + bit(b1, 7) * 3 - bit(b1, 6) * 3 + bit(b0, 7) - bit(b0, 6);
      if ((b2 & 0xf3) === 0xf3) break;
      else if ((b2 & 0xc3) === 0xc3) { out.move(dx, dy); out.colour(); }
      else if ((b2 & 0x43) === 0x43) out.move(dx, dy);          // sequin mode: the move only
      else if ((b2 & 0x83) === 0x83) out.move(dx, dy);
      else out.stitch(dx, dy);
    }
    return out;
  }

  // ---------- EXP (Melco / Bernina), and the INF colour list that comes with it ----------
  function readEXP(u8) {
    var f = new Buf(u8), out = new Pat();
    while (f.left() >= 2) {
      var a = f.u8(), b = f.u8();
      if (a !== 0x80) { out.stitch(s8(a), s8(b)); continue; }
      var ctl = b; if (f.left() < 2) break;
      var x = s8(f.u8()), y = s8(f.u8());
      if (ctl === 0x80) { out.trim(); continue; }
      if (ctl === 0x02) { out.stitch(x, y); continue; }
      if (ctl === 0x04) { out.move(x, y); continue; }
      if (ctl === 0x01) { out.colour(); if (x || y) out.move(x, y); continue; }
      break;
    }
    return out;
  }
  function readINF(u8) {
    var f = new Buf(u8), list = [];
    f.skip(12); var n = f.u32be();
    for (var j = 0; j < n && f.left() > 2; j++) {
      var len = f.u16be() - 2; if (len < 7 || f.left() < len) break;
      var d = f.u.subarray(f.p, f.p + len); f.skip(len);
      var rest = Array.prototype.slice.call(d, 7), z = rest.indexOf(0);
      var name = z > 0 ? String.fromCharCode.apply(null, rest.slice(0, z)) : '';
      var rest2 = z >= 0 ? rest.slice(z + 1) : [], z2 = rest2.indexOf(0);
      list.push({ color: hex6((d[2] << 16) | (d[3] << 8) | d[4]), name: name, brand: z2 > 0 ? String.fromCharCode.apply(null, rest2.slice(0, z2)) : '' });
    }
    return list;
  }

  // ---------- JEF (Janome) ----------
  function readJEF(u8) {
    var f = new Buf(u8), out = new Pat();
    var off = f.u32le(); f.skip(20); var n = f.u32le(); f.skip(88);
    var idx = [];
    for (var i = 0; i < n && f.left() >= 4; i++) idx.push(Math.abs(s32(f.u32le())));
    idx.forEach(function (k, i) {
      var t = k ? JEF[k % JEF.length] : null;
      // colour 0 means "stop, same thread": repeat the previous one
      out.thread(t ? { color: t[0], name: t[1], brand: 'Janome' } : (out.threads[i - 1] || null));
    });
    f.p = off;
    while (f.left() >= 2) {
      var a = f.u8(), b = f.u8();
      if (a !== 0x80) { out.stitch(s8(a), s8(b)); continue; }
      var ctl = b; if (f.left() < 2) break;
      var x = s8(f.u8()), y = s8(f.u8());
      if (ctl === 0x02) { out.move(x, y); continue; }
      if (ctl === 0x01) { out.colour(); continue; }
      break;   // 0x10 = end
    }
    return out;
  }

  // ---------- PEC (Brother), also the stitch block inside every PES ----------
  function s12(v) { v &= 0xfff; return v > 0x7ff ? v - 0x1000 : v; }
  function s7(v) { return v > 63 ? v - 128 : v; }
  function readPECAt(u8, start, out) {
    var f = new Buf(u8); f.p = start;
    f.skip(3); var label = f.str(16).replace(/\0/g, '').trim(); out.meta.name = out.meta.name || label;
    f.skip(15); f.u8(); f.u8(); f.skip(12);
    var cc = f.u8(), count = cc + 1, cols = [];
    for (var i = 0; i < count; i++) cols.push(f.u8());
    f.skip(0x1d0 - cc); f.u24le(); f.skip(11);
    while (f.left() >= 2) {
      var v1 = f.u8(), v2 = f.u8();
      if (v1 === 0xff && v2 === 0x00) break;
      if (v1 === 0xfe && v2 === 0xb0) { f.skip(1); out.colour(); continue; }
      var jump = false, trim = false, x, y;
      if (v1 & 0x80) { if (v1 & 0x20) trim = true; if (v1 & 0x10) jump = true; x = s12((v1 << 8) | v2); v2 = f.u8(); if (v2 === null) break; }
      else x = s7(v1);
      if (v2 & 0x80) { if (v2 & 0x20) trim = true; if (v2 & 0x10) jump = true; var v3 = f.u8(); if (v3 === null) break; y = s12((v2 << 8) | v3); }
      else y = s7(v2);
      if (jump) out.move(x, -y);
      else if (trim) { out.trim(); out.move(x, -y); }
      else out.stitch(x, -y);
    }
    return cols;
  }
  function pecThreads(cols, chart, out) {
    var T = function (k) { var t = PEC[k % PEC.length] || PEC[1]; return { color: t[0], name: t[1], brand: 'Brother' }; };
    if (!chart || !chart.length) { cols.forEach(function (k) { out.thread(T(k)); }); return; }
    if (chart.length >= cols.length) { chart.forEach(function (t) { out.thread(t); }); return; }
    var map = {}, left = chart.slice();     // tabled mode: each PEC index takes the next listed thread
    cols.forEach(function (k) { if (!map[k]) map[k] = left.length ? left.shift() : T(k); out.thread(map[k]); });
  }
  function readPEC(u8) { var out = new Pat(); pecThreads(readPECAt(u8, 8, out), null, out); return out; }
  function readPES(u8) {
    var f = new Buf(u8), out = new Pat(), ver = f.str(8);
    if (ver === '#PEC0001') { pecThreads(readPECAt(u8, 8, out), null, out); return out; }
    var pecAt = f.u32le(), chart = [];
    out.meta.version = ver.slice(4);
    try { chart = pesThreads(f, ver, out); } catch (e) { chart = []; }
    pecThreads(readPECAt(u8, pecAt, out), chart, out);
    return out;
  }
  function pesStr(f) { var n = f.u8(); return n ? f.utf8(n) : ''; }
  function pesThreads(f, ver, out) {
    var v = { '#PES0050': 5, '#PES0055': 5, '#PES0056': 5, '#PES0060': 6, '#PES0070': 7, '#PES0080': 8, '#PES0090': 9, '#PES0100': 10 }[ver];
    if (!v) { if (ver === '#PES0040') { f.skip(4); out.meta.name = pesStr(f) || out.meta.name; } return []; }
    f.skip(4);
    var nm = pesStr(f); if (nm) out.meta.name = nm;
    pesStr(f); var au = pesStr(f); if (au) out.meta.author = au; pesStr(f); pesStr(f);
    if (v === 5) { f.skip(24); pesStr(f); f.skip(24); }
    else if (v === 6 || v === 7) { f.skip(36); pesStr(f); f.skip(24); }
    else if (v === 8) { f.skip(38); pesStr(f); f.skip(26); }
    else { f.skip(14); pesStr(f); f.skip(v === 9 ? 30 : 38); pesStr(f); f.skip(34); }
    if (f.u16le() || f.u16le() || f.u16le()) return [];      // programmable fills, motifs, feathers: thread list not reachable
    var n = f.u16le(), list = [];
    for (var i = 0; i < n && f.left() > 8; i++) {
      var code = pesStr(f), col = f.u24be(); f.skip(5);
      var desc = pesStr(f), brand = pesStr(f); pesStr(f);
      list.push({ color: hex6(col), name: desc, code: code, brand: brand });
    }
    return list;
  }

  // ---------- VP3 (Pfaff / Husqvarna Viking) ----------
  function readVP3(u8) {
    var f = new Buf(u8), out = new Pat();
    var skipStr = function () { var n = f.u16be(); f.skip(n); };
    var str8 = function () { var n = f.u16be(); return f.utf8(n); };
    f.skip(6); skipStr(); f.skip(7); skipStr(); f.skip(32);
    var cx = s32(f.u32be()) / 100, cy = s32(f.u32be()) / 100;
    f.skip(27); skipStr(); f.skip(24); skipStr();
    var n = f.u16be();
    for (var b = 0; b < n && f.left() > 10; b++) {
      f.skip(3); var dist = f.u32be(), end = dist + f.p;
      var sx = s32(f.u32be()) / 100, sy = s32(f.u32be()) / 100;
      var ax = sx + cx, ay = sy + cy;
      if (ax !== 0 && ay !== 0) out.moveAbs(ax, ay);
      var ncol = f.u8(); f.u8(); var col = 0;
      for (var m = 0; m < ncol; m++) { col = f.u24be(); f.u8(); f.u16be(); }
      f.u8(); f.u8();
      var code = str8(), desc = str8(), brand = str8();
      out.thread({ color: hex6(col), name: desc, code: code, brand: brand });
      f.skip(15); f.skip(3);
      while (f.p < end - 1) {
        var x = s8(f.u8()), y = s8(f.u8());
        if ((x & 0xff) !== 0x80) { out.stitch(x, -y); continue; }
        if (y === 0x01) {
          var X = s16((f.u8() << 8) | f.u8()), Y = s16((f.u8() << 8) | f.u8());
          out.stitch(X, -Y); f.skip(2);
        } else if (y === 0x03) out.trim();
      }
      f.p = end;
      if (b + 1 < n) out.colour();
    }
    return out;
  }

  // ---------- XXX (Singer) ----------
  function readXXX(u8) {
    var f = new Buf(u8), out = new Pat();
    f.p = 0x27; var n = f.u16le(); f.p = 0x100;
    while (f.left() > 0) {
      var b1 = f.u8();
      if (b1 === 0x7d || b1 === 0x7e) { var x = f.u16le(), y = f.u16le(); if (y === null) break; out.move(s16(x), s16(y)); continue; }
      var b2 = f.u8(); if (b2 === null) break;
      if (b1 !== 0x7f) { out.stitch(s8(b1), s8(b2)); continue; }
      var b3 = f.u8(), b4 = f.u8(); if (b4 === null) break;
      if (b2 === 0x01) out.move(s8(b3), s8(b4));
      else if (b2 === 0x03) { out.trim(); if (b3 || b4) out.move(s8(b3), s8(b4)); }
      else if (b2 === 0x08 || (b2 >= 0x0a && b2 <= 0x17)) out.colour();
      else if (b2 === 0x7f || b2 === 0x18) break;
    }
    f.skip(2);
    for (var i = 0; i < n && f.left() >= 4; i++) out.thread({ color: hex6(f.u32be()), name: '' });
    return out;
  }

  // ---------- HUS (Husqvarna Viking): three streams, each packed with the ARC-style Huffman/LZ "EmbCompress" ----------
  function expand(data, size) {
    var pos = 0, total = data.length * 8, out = [], blockLeft = -1, ch = null, di = null;
    function bits(start, len) {
      var end = start + len - 1, b0 = start >> 3, b1 = end >> 3, v = 0;
      for (var i = b0; i <= b1; i++) v = v * 256 + (i < data.length ? data[i] : 0);
      var unused = (8 - (end + 1) % 8) % 8;
      return Math.floor(v / Math.pow(2, unused)) % Math.pow(2, len);
    }
    function peek(n) { return bits(pos, n); }
    function pop(n) { var v = bits(pos, n); pos += n; return v; }
    function Huff(lengths, dflt) {
      var h = { dflt: dflt || 0, lengths: lengths, table: null, w: 0 };
      if (lengths) {
        h.w = Math.max.apply(null, lengths); h.table = [];
        var size2 = Math.pow(2, h.w);
        for (var bl = 1; bl <= h.w; bl++) { size2 /= 2; for (var k = 0; k < lengths.length; k++) if (lengths[k] === bl) for (var r = 0; r < size2; r++) h.table.push(k); }
      }
      h.look = function (v16) { if (!h.table) return [h.dflt, 0]; var v = h.table[v16 >> (16 - h.w)]; return [v, h.lengths[v]]; };
      return h;
    }
    function varLen() { var m = pop(3); if (m !== 7) return m; for (var q = 0; q < 13; q++) { if (pop(1) === 1) m++; else break; } return m; }
    function lenHuff() {
      var n = pop(5); if (n === 0) return Huff(null, pop(5));
      var L = new Array(n).fill(0), i = 0;
      while (i < n) { if (i === 3) i += pop(2); L[i] = varLen(); i++; }
      return Huff(L, 8);
    }
    function charHuff(lh) {
      var n = pop(9); if (n === 0) return Huff(null, pop(9));
      var L = new Array(n).fill(0), i = 0;
      while (i < n) {
        var h = lh.look(peek(16)), c = h[0]; pos += h[1];
        if (c === 0) i += 1; else if (c === 1) i += 3 + pop(4); else if (c === 2) i += 20 + pop(9); else { L[i] = c - 2; i++; }
      }
      return Huff(L);
    }
    function distHuff() {
      var n = pop(5); if (n === 0) return Huff(null, pop(5));
      var L = []; for (var i = 0; i < n; i++) L.push(varLen());
      return Huff(L);
    }
    while (total > pos && (size === undefined || out.length <= size)) {
      if (blockLeft <= 0) { blockLeft = pop(16); var lh = lenHuff(); ch = charHuff(lh); di = distHuff(); }
      blockLeft--;
      var h = ch.look(peek(16)); pos += h[1];
      var c = h[0];
      if (c <= 255) out.push(c);
      else if (c === 510) break;
      else {
        var len = c - 253, hd = di.look(peek(16)); pos += hd[1];
        var back = hd[0] === 0 ? 0 : Math.pow(2, hd[0] - 1) + pop(hd[0] - 1);
        back += 1;
        var at = out.length - back;
        for (var k = 0; k < len; k++) out.push(out[at + k]);
      }
      if (out.length > 4e6) break;
    }
    return out;
  }
  function readHUS(u8) {
    var f = new Buf(u8), out = new Pat();
    f.u32le(); var n = f.u32le(), nc = f.u32le();
    f.skip(8);
    var co = f.u32le(), xo = f.u32le(), yo = f.u32le();
    f.skip(10);
    for (var i = 0; i < nc; i++) { var t = HUS[f.u16le() % HUS.length]; out.thread({ color: t[0], name: t[1], brand: 'Husqvarna Viking' }); }
    var cmd = expand(u8.subarray(co, xo), n), xs = expand(u8.subarray(xo, yo), n), ys = expand(u8.subarray(yo), n);
    var m = Math.min(cmd.length, xs.length, ys.length);
    for (var k = 0; k < m; k++) {
      var c = cmd[k], x = s8(xs[k]), y = s8(ys[k]);
      if (c === 0x80) out.stitch(x, y);
      else if (c === 0x81) out.move(x, y);
      else if (c === 0x84) { out.move(x, y); out.colour(); }
      else if (c === 0x88) { if (x || y) out.move(x, y); out.trim(); }
      else break;
    }
    return out;
  }

  var READERS = { dst: readDST, exp: readEXP, jef: readJEF, pes: readPES, pec: readPEC, vp3: readVP3, xxx: readXXX, hus: readHUS };
  var RANK = { pes: 9, vp3: 8, hus: 7, jef: 6, xxx: 5, pec: 4, exp: 3, dst: 3 };
  var KNOWN_OTHER = { emb: 'Wilcom’s own working file (.EMB) can only be opened in Wilcom. Look for a PES, DST, EXP or JEF version of the same design.',
    art: 'Bernina ARTlink files (.ART) are compressed working files. Look for an EXP or PES version of the same design.',
    hus: '', pxf: 'Pulse working files (.PXF) can only be opened in Pulse.', ofm: 'Melco working files (.OFM) can only be opened in DesignShop.' };
  function extOf(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function canRead(name) { return !!READERS[extOf(name)]; }

  // file units -> a design: colour blocks of runs, in mm (y up), centred later by the app
  function finish(p, fmt) {
    var blocks = [], cur = null, run = null, nC = 0, nS = 0, nJ = 0, nT = 0;
    function newBlock() { cur = { runs: [], stitches: 0 }; blocks.push(cur); run = null; }
    newBlock();
    var lastPen = null;
    p.cmds.forEach(function (c) {
      var x = c[0] / 10, y = c[1] / 10;
      if (c[2] === 'S') {
        if (!run) { run = lastPen && !cur.runs.length && false ? [lastPen] : []; cur.runs.push(run); }
        run.push([x, y]); cur.stitches++; nS++; lastPen = [x, y];
      } else if (c[2] === 'J') { run = null; nJ++; }
      else if (c[2] === 'T') { run = null; nT++; }
      else if (c[2] === 'C') { newBlock(); nC++; }
    });
    // each block takes the thread with its index; blocks with no stitches (a change right at the start) are dropped
    var noColours = !p.threads.length;
    var out = [];
    blocks.forEach(function (b, i) {
      var t = p.threads[i] || (noColours ? null : p.threads[p.threads.length - 1]);
      if (!b.stitches) return;
      b.runs = b.runs.filter(function (r) { return r.length; });
      b.color = t && t.color ? t.color : DEFAULTS[out.length % DEFAULTS.length];
      b.name = t && t.name || ''; b.code = t && t.code || ''; b.brand = t && t.brand || '';
      out.push(b);
    });
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    out.forEach(function (b) { b.runs.forEach(function (r) { r.forEach(function (q) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }); }); });
    if (!out.length) throw new Error('There are no stitches in this file.');
    return { format: fmt.toUpperCase(), name: p.meta.name || '', author: p.meta.author || '', blocks: out, noColours: noColours,
      bounds: { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 }, stats: { stitches: nS, jumps: nJ, trims: nT, changes: nC } };
  }
  // read one file. companions: other files in the same folder or zip ({ name: Uint8Array }) for an EXP's INF
  function read(u8, name, companions) {
    var ext = extOf(name), fn = READERS[ext];
    if (!fn) {
      var why = KNOWN_OTHER[ext];
      throw new Error(why || 'Fembroider can open PES, DST, EXP, JEF, VP3, HUS, XXX and PEC embroidery files.');
    }
    var p;
    try { p = fn(u8); } catch (e) { throw new Error('This ' + ext.toUpperCase() + ' file could not be read: it may be damaged or a variant we don’t know yet.'); }
    if (ext === 'exp' && companions) {
      var base = name.replace(/\.[^.]+$/, '').toLowerCase();
      Object.keys(companions).forEach(function (k) {
        if (extOf(k) === 'inf' && k.replace(/\.[^.]+$/, '').toLowerCase() === base) { try { p.threads = readINF(companions[k]); } catch (e) { /* keep defaults */ } }
      });
    }
    return finish(p, ext);
  }

  // ---------- ZIP (stored or deflated entries); inflateRaw(Uint8Array) -> Promise<Uint8Array> ----------
  function unzip(u8, inflateRaw) {
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), eocd = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return Promise.reject(new Error('This zip file could not be read.'));
    var n = dv.getUint16(eocd + 10, true), at = dv.getUint32(eocd + 16, true), list = [];
    for (var k = 0; k < n && at + 46 <= u8.length; k++) {
      if (dv.getUint32(at, true) !== 0x02014b50) break;
      var method = dv.getUint16(at + 10, true), csize = dv.getUint32(at + 20, true), usize = dv.getUint32(at + 24, true);
      var nl = dv.getUint16(at + 28, true), xl = dv.getUint16(at + 30, true), cl = dv.getUint16(at + 32, true), lho = dv.getUint32(at + 42, true);
      var nm = new TextDecoder().decode(u8.subarray(at + 46, at + 46 + nl));
      at += 46 + nl + xl + cl;
      if (/\/$/.test(nm) || /(^|\/)(__MACOSX|\.)/.test(nm)) continue;
      if (usize > 40e6) continue;
      var dataAt = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      list.push({ name: nm, method: method, data: u8.subarray(dataAt, dataAt + csize) });
    }
    return Promise.all(list.map(function (e) {
      if (e.method === 0) return { name: e.name, data: e.data };
      if (e.method === 8) return inflateRaw(e.data).then(function (d) { return { name: e.name, data: d }; }, function () { return null; });
      return null;
    })).then(function (r) { return r.filter(Boolean); });
  }
  // the designs in a set of files: one entry per design name, keeping the format that carries the most (thread names first)
  function designsIn(files) {
    var by = {};
    files.forEach(function (f) {
      var ext = extOf(f.name); if (!RANK[ext]) return;
      var base = f.name.replace(/^.*\//, '').replace(/\.[^.]+$/, '').trim(), key = base.toLowerCase().replace(/\s+/g, ' ');
      var cur = by[key];
      if (!cur || RANK[ext] > RANK[extOf(cur.name)]) by[key] = { base: base, name: f.name, data: f.data, formats: (cur ? cur.formats : []) };
      by[key].formats.push(ext.toUpperCase());
    });
    return Object.keys(by).sort().map(function (k) { return by[k]; });
  }

  return { read: read, canRead: canRead, extOf: extOf, unzip: unzip, designsIn: designsIn, expand: expand,
    formats: Object.keys(READERS) };
})();
if (typeof module !== 'undefined') module.exports = StitchRead;
