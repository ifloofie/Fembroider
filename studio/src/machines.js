// Stitch Studio machine catalogue: every embroidery machine the app can export for, with its hoops (sewing fields in
// mm, width x height as the hoop sits on the machine), the file format it reads, and how it handles jumps.
// Home single-needle hoops are listed portrait (long side front to back); multi-needle and commercial frames
// landscape, as their makers list them. "ver" marks hoop sets checked against a maker or dealer spec; the rest are
// the brand's standard set for that sewing field and should be checked against the machine's manual.
var StitchMachines = (function () {
  'use strict';

  // ---- file formats the exporter writes ----
  var FORMATS = {
    'exp-deco': { label: 'EXP+', ext: 'EXP', files: 'EXP + INF + BMP' },
    exp: { label: 'EXP', ext: 'EXP', files: 'EXP + INF' },
    jef: { label: 'JEF', ext: 'JEF', files: 'JEF' },
    pes: { label: 'PES', ext: 'PES', files: 'PES' },
    vp3: { label: 'VP3', ext: 'VP3', files: 'VP3' },
    xxx: { label: 'XXX', ext: 'XXX', files: 'XXX' },
    dst: { label: 'DST', ext: 'DST', files: 'DST' }
  };
  var KINDS = { C: 'Sew + embroider', E: 'Embroidery-only', M: 'Multi-needle', P: 'Commercial single-head', H: 'Commercial multi-head' };

  // ---- hoop helpers ----
  function cm(v) { return v % 10 ? (v / 10).toFixed(1) : String(v / 10); }
  function inch(v) {
    var q = Math.round(v / 25.4 * 4) / 4, w = Math.floor(q), f = q - w;
    return (w || (f ? '' : '0')) + ({ 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[f]);
  }
  function hoop(w, h, name, label, o) {
    o = o || {};
    var big = Math.max(w, h);
    return { key: o.key || (w + 'x' + h), name: name || (cm(w) + ' × ' + cm(h) + ' cm hoop'), label: label || (cm(w) + ' × ' + cm(h)),
      field: [w, h], open: o.open || (big > 300 ? 20 : big > 150 ? 16 : 12), r: o.r !== undefined ? o.r : (big > 300 ? 20 : big > 150 ? 14 : 10), round: !!o.round };
  }
  // Brother / Baby Lock name hoops in inches
  function bro(w, h) { return hoop(w, h, cm(w) + ' × ' + cm(h) + ' cm hoop (' + inch(w) + ' × ' + inch(h) + ' in)'); }
  function broSet(sizes) { return sizes.map(function (s) { return bro(s[0], s[1]); }); }
  // commercial tubular frames: round hoops (usable field is the square inside) plus the machine's largest frame
  function roundHoop(d) {
    var f = Math.round(d * 10 * 0.68 / 5) * 5, open = Math.round(d * 10 - f);
    return hoop(f, f, d + ' cm round frame', '⌀' + d, { key: 'r' + d, open: open, r: (f + open) / 2 - 1, round: true });
  }
  function comm(w, h) {
    var rounds = [12, 15, 18, 21, 30].filter(function (d) { return Math.round(d * 6.8) <= Math.min(w, h); }).map(roundHoop);
    return rounds.concat([hoop(w, h, 'Largest frame · ' + cm(w) + ' × ' + cm(h) + ' cm', cm(w) + ' × ' + cm(h), { r: 18 })]);
  }
  function named(list) { return list.map(function (h) { return hoop(h[0], h[1], h[2], h[3]); }); }

  var P = {
    // Brother / Baby Lock home machines (portrait)
    b100: function () { return broSet([[100, 100]]); },
    b130: function () { return broSet([[100, 100], [130, 180]]); },
    b160: function () { return broSet([[100, 100], [130, 180], [160, 260]]); },
    b180: function () { return broSet([[100, 100], [130, 180], [180, 300]]); },
    b200: function () { return broSet([[100, 100], [130, 180], [200, 300]]); },
    b200sq: function () { return broSet([[100, 100], [130, 180], [200, 200]]); },
    b200x360: function () { return broSet([[100, 100], [130, 180], [200, 300], [200, 360]]); },
    b240sq: function () { return broSet([[100, 100], [130, 180], [240, 240]]); },
    b240: function () { return broSet([[100, 100], [130, 180], [240, 240], [240, 360]]); },
    b272: function () { return broSet([[100, 100], [130, 180], [272, 272], [272, 408]]); },
    b297: function () { return broSet([[100, 100], [130, 180], [272, 272], [297, 465]]); },
    // Brother / Baby Lock multi-needle frames (landscape)
    pr6: function () { return broSet([[100, 100], [180, 130], [300, 200]]); },
    pr10: function () { return broSet([[100, 100], [180, 130], [300, 200], [360, 200]]); },
    // Janome / Elna
    j140: function () { return named([[100, 100, 'SQ10 · 10 × 10 cm'], [140, 140, 'SQ14 · 14 × 14 cm']]); },
    j400: function () { return named([[140, 140, 'SQ14b · 14 × 14 cm'], [200, 200, 'SQ20b · 20 × 20 cm']]); },
    j500: function () { return named([[140, 140, 'SQ14b · 14 × 14 cm'], [200, 200, 'SQ20b · 20 × 20 cm'], [200, 280, 'RE28b · 20 × 28 cm']]); },
    j550: function () { return named([[140, 140, 'SQ14b · 14 × 14 cm'], [200, 200, 'SQ20b · 20 × 20 cm'], [200, 360, 'RE36b · 20 × 36 cm']]); },
    j9900: function () { return named([[140, 140, 'SQ14b · 14 × 14 cm'], [170, 200, 'RE20b · 17 × 20 cm']]); },
    j15000: function () { return named([[140, 140, 'SQ14 · 14 × 14 cm'], [140, 180, 'RE18 · 14 × 18 cm'], [220, 220, 'ASQ22 · 22 × 22 cm'], [230, 230, 'SQ23 · 23 × 23 cm'], [230, 300, 'GR · 23 × 30 cm']]); },
    jm17: function () { return named([[100, 100, 'SQ10d · 10 × 10 cm'], [140, 200, 'RE20d · 14 × 20 cm'], [270, 270, 'ASQ27d · 27 × 27 cm'], [280, 280, 'SQ28d · 28 × 28 cm'], [280, 460, 'RE46d · 28 × 46 cm']]); },
    jmb: function () { return named([[50, 50, 'Hoop C · 5 × 5 cm'], [126, 110, 'Hoop A · 12.6 × 11 cm'], [150, 150, 'Hoop SQ15 · 15 × 15 cm'], [240, 200, 'Hoop RE24 · 24 × 20 cm']]); },
    // BERNINA (portrait)
    bern5: function () { return named([[100, 130, 'Medium oval hoop', 'Medium'], [145, 255, 'Large oval hoop', 'Large oval'], [165, 265, 'Midi hoop', 'Midi'], [150, 400, 'Mega hoop', 'Mega']]); },
    bern7: function () { return named([[100, 130, 'Medium oval hoop', 'Medium'], [145, 255, 'Large oval hoop', 'Large oval'], [210, 400, 'Maxi hoop', 'Maxi']]); },
    bern8: function () { return named([[100, 130, 'Medium oval hoop', 'Medium'], [145, 255, 'Large oval hoop', 'Large oval'], [210, 400, 'Maxi hoop', 'Maxi'], [260, 400, 'Jumbo hoop', 'Jumbo']]); },
    bern990: function () { return named([[100, 130, 'Medium oval hoop', 'Medium'], [145, 255, 'Large oval hoop', 'Large oval'], [210, 400, 'Maxi hoop', 'Maxi'], [260, 400, 'Jumbo hoop', 'Jumbo'], [305, 410, 'Giant hoop', 'Giant']]); },
    bernette: function () { return named([[100, 100, 'Small hoop · 10 × 10 cm'], [130, 180, 'Medium hoop · 13 × 18 cm'], [160, 260, 'Large hoop · 16 × 26 cm']]); },
    // PFAFF / Husqvarna Viking (portrait)
    pf360: function () { return named([[120, 120, 'creative 120 Square Hoop', '12 × 12'], [150, 240, 'creative Master Hoop', '15 × 24'], [200, 260, 'creative Elite Hoop', '20 × 26'], [200, 360, 'creative Deluxe Hoop', '20 × 36'], [350, 360, 'creative Grand Dream Hoop', '35 × 36']]); },
    pf200x360: function () { return named([[120, 120, 'creative 120 Square Hoop', '12 × 12'], [150, 240, 'creative Master Hoop', '15 × 24'], [200, 360, 'creative Deluxe Hoop', '20 × 36']]); },
    pf260: function () { return named([[120, 120, 'creative 120 Square Hoop', '12 × 12'], [150, 240, 'creative Master Hoop', '15 × 24'], [200, 260, 'creative Elite Hoop', '20 × 26']]); },
    pf240: function () { return named([[120, 120, 'creative 120 Square Hoop', '12 × 12'], [150, 240, 'creative Master Hoop', '15 × 24']]); },
    pf170: function () { return named([[100, 100, 'Small hoop · 10 × 10 cm'], [100, 170, 'Large hoop · 10 × 17 cm']]); },
    hv360: function () { return named([[120, 120, 'DESIGNER Splendid Square Hoop', '12 × 12'], [150, 240, 'DESIGNER Jewel Hoop', '15 × 24'], [200, 360, 'DESIGNER Royal Hoop', '20 × 36'], [350, 360, 'DESIGNER Majestic Hoop', '35 × 36']]); },
    hv200x360: function () { return named([[120, 120, 'DESIGNER Splendid Square Hoop', '12 × 12'], [150, 240, 'DESIGNER Jewel Hoop', '15 × 24'], [200, 360, 'DESIGNER Royal Hoop', '20 × 36']]); },
    hv260: function () { return named([[120, 120, 'DESIGNER Splendid Square Hoop', '12 × 12'], [150, 240, 'DESIGNER Jewel Hoop', '15 × 24'], [200, 260, 'DESIGNER Crown Hoop', '20 × 26']]); },
    hv240: function () { return named([[120, 120, 'DESIGNER Splendid Square Hoop', '12 × 12'], [150, 240, 'DESIGNER Jewel Hoop', '15 × 24']]); },
    hv170: function () { return named([[100, 100, 'Small hoop · 10 × 10 cm'], [100, 170, 'Large hoop · 10 × 17 cm']]); },
    epic3: function () { return named([[120, 120, 'DESIGNER Splendid Square Hoop II', '12 × 12'], [150, 240, 'DESIGNER Jewel Hoop II', '15 × 24'], [200, 360, 'DESIGNER Royal Hoop II', '20 × 36'], [260, 465, 'DESIGNER Regal Hoop', '26 × 46.5'], [450, 450, 'Largest optional hoop', '45 × 45']]); },
    expr750: function () { return named([[120, 120, 'creative 120 Square Hoop', '12 × 12'], [200, 260, 'creative Elite Hoop', '20 × 26'], [200, 360, 'creative Deluxe Hoop', '20 × 36'], [350, 360, 'creative Grand Dream Hoop (optional)', '35 × 36']]); },
    // Singer (portrait)
    s260: function () { return named([[100, 100, 'Small hoop · 10 × 10 cm'], [150, 260, 'Large hoop · 15 × 26 cm']]); },
    s250: function () { return named([[100, 100, 'Small hoop · 10 × 10 cm'], [150, 250, 'Large hoop · 15 × 25 cm']]); },
    s9180: function () { return named([[40, 40, 'Mini hoop · 4 × 4 cm'], [100, 100, 'Small hoop · 10 × 10 cm'], [150, 260, 'Large hoop · 15 × 26 cm']]); }
  };

  // ---- the catalogue ----
  // [brand, model, also called, kind, needles, heads, introduced ("~" = estimate), current?, hoops, format, hoops checked?, note]
  // hoops: a preset name, 'comm:WxH' for commercial frames, or an explicit list
  var ROWS = [
    ['Brother', 'SE400', '', 'C', 1, 1, '~2011', 0, 'b100', 'pes', 1, ''],
    ['Brother', 'SE600 / SE625', '', 'C', 1, 1, '~2016', 0, 'b100', 'pes', 1, ''],
    ['Brother', 'SE630', '', 'C', 1, 1, '~2019', 1, 'b100', 'pes', 1, ''],
    ['Brother', 'SE700', '', 'C', 1, 1, '~2021', 1, 'b100', 'pes', 1, 'Wi-Fi'],
    ['Brother', 'SE1900', '', 'C', 1, 1, '~2017', 1, 'b130', 'pes', 1, ''],
    ['Brother', 'SE2000', '', 'C', 1, 1, '~2021', 1, 'b130', 'pes', 0, 'Wi-Fi'],
    ['Brother', 'NV180 / NV180D', 'Innov-is', 'C', 1, 1, '~2016', 0, 'b100', 'pes', 1, ''],
    ['Brother', 'NV950 / NV980D', 'Innov-is', 'C', 1, 1, '~2014', 0, 'b100', 'pes', 1, ''],
    ['Brother', 'M370 / M380D', 'Innov-is', 'C', 1, 1, '~2023', 1, 'b100', 'pes', 1, ''],
    ['Brother', 'NS2750D', 'Innov-is', 'C', 1, 1, '~2015', 0, 'b130', 'pes', 1, ''],
    ['Brother', 'NQ1400E', 'Innov-is', 'E', 1, 1, '~2017', 0, 'b160', 'pes', 0, ''],
    ['Brother', 'NQ1700E', 'Innov-is', 'E', 1, 1, '~2021', 1, 'b160', 'pes', 0, ''],
    ['Brother', 'NQ3500D', 'Innov-is', 'C', 1, 1, '~2013', 0, 'b160', 'pes', 1, ''],
    ['Brother', 'NQ3550W', 'Innov-is', 'C', 1, 1, '~2019', 0, 'b160', 'pes', 0, ''],
    ['Brother', 'NQ3700D', 'Innov-is', 'C', 1, 1, '~2022', 1, 'b160', 'pes', 1, ''],
    ['Brother', 'NV800E', 'Innov-is', 'E', 1, 1, '~2016', 0, 'b160', 'pes', 1, ''],
    ['Brother', 'NV880E', 'Innov-is', 'E', 1, 1, '~2021', 1, 'b160', 'pes', 1, ''],
    ['Brother', 'NV2600', 'Innov-is', 'C', 1, 1, '~2016', 0, 'b160', 'pes', 1, ''],
    ['Brother', 'NV2700', 'Innov-is', 'C', 1, 1, '~2021', 1, 'b160', 'pes', 1, ''],
    ['Brother', 'PE535', '', 'E', 1, 1, '~2016', 1, 'b100', 'pes', 0, ''],
    ['Brother', 'PE800', '', 'E', 1, 1, '~2016', 1, 'b130', 'pes', 1, ''],
    ['Brother', 'PE900', '', 'E', 1, 1, '~2023', 1, 'b160', 'pes', 1, ''],
    ['Brother', 'F440E', 'Innov-is', 'E', 1, 1, '~2015', 0, 'b130', 'pes', 1, ''],
    ['Brother', 'F540E', 'Innov-is', 'E', 1, 1, '~2020', 1, 'b130', 'pes', 1, ''],
    ['Brother', 'M330E / M340E', 'Innov-is', 'E', 1, 1, '~2020', 1, 'b100', 'pes', 0, ''],
    ['Brother', 'M340ED', 'Innov-is Disney', 'E', 1, 1, '~2022', 1, 'b100', 'pes', 1, ''],
    ['Brother', 'Skitch PP1', '', 'E', 1, 1, '~2021', 1, 'b100', 'pes', 0, 'App-driven'],
    ['Brother', 'VE2200', 'DreamMaker XE · Innov-is V3', 'E', 1, 1, '~2014', 0, 'b180', 'pes', 1, ''],
    ['Brother', 'VM5100', 'DreamCreator XE · Innov-is V5', 'C', 1, 1, '~2014', 0, 'b180', 'pes', 1, ''],
    ['Brother', 'VM6200D', 'DreamWeaver XE · Innov-is V7', 'C', 1, 1, '~2014', 0, 'b180', 'pes', 1, ''],
    ['Brother', 'VE2300', 'Innov-is V3 successor', 'E', 1, 1, '~2020', 1, 'b200', 'pes', 1, ''],
    ['Brother', 'VM5200', 'Innov-is V5 successor', 'C', 1, 1, '~2020', 1, 'b200', 'pes', 1, ''],
    ['Brother', 'V3LE / V5LE', 'Innov-is limited editions', 'E', 1, 1, '~2022', 1, 'b180', 'pes', 0, ''],
    ['Brother', 'Quattro 3 (NV6750D)', 'Innov-is', 'C', 1, 1, '~2012', 0, 'b240', 'pes', 0, ''],
    ['Brother', 'XV8500D', 'Dream Machine', 'C', 1, 1, '~2015', 0, 'b240sq', 'pes', 1, ''],
    ['Brother', 'XV8550D', 'Dream Machine 2', 'C', 1, 1, '~2017', 0, 'b240', 'pes', 1, ''],
    ['Brother', 'XP1', 'Luminaire', 'C', 1, 1, '2017', 0, 'b272', 'pes', 1, ''],
    ['Brother', 'XP2', 'Luminaire 2', 'C', 1, 1, '~2020', 0, 'b272', 'pes', 1, ''],
    ['Brother', 'XP3', 'Luminaire 3', 'C', 1, 1, '~2022', 0, 'b272', 'pes', 1, ''],
    ['Brother', 'XJ1', 'Stellaire', 'C', 1, 1, '~2019', 0, 'b240', 'pes', 1, ''],
    ['Brother', 'XE1', 'Stellaire', 'E', 1, 1, '~2019', 0, 'b240', 'pes', 1, ''],
    ['Brother', 'XJ2', 'Stellaire 2', 'C', 1, 1, '~2023', 1, 'b240', 'pes', 1, ''],
    ['Brother', 'XE2', 'Stellaire 2', 'E', 1, 1, '~2023', 1, 'b240', 'pes', 1, ''],
    ['Brother', 'EV1', 'Aveneer', 'C', 1, 1, '~2024', 1, 'b297', 'pes', 1, ''],
    ['Brother', 'CX1e', 'Celeste', 'E', 1, 1, '~2025', 1, 'b240', 'pes', 1, ''],
    ['Brother', 'BX1', 'Expedition', 'C', 1, 1, '2026', 1, 'b200x360', 'pes', 0, ''],
    ['Brother', 'BX1e', 'Expedition', 'E', 1, 1, '2026', 1, 'b200x360', 'pes', 0, ''],
    ['Brother', 'VR', '', 'E', 1, 1, '~2014', 1, 'b200', 'pes', 0, ''],
    ['Brother', 'PRS100', 'Persona', 'E', 1, 1, '~2019', 0, 'b200sq', 'pes', 1, ''],
    ['Brother', 'PR1X', 'Entrepreneur One · PR1', 'E', 1, 1, '~2021', 1, 'b200', 'pes', 1, ''],
    ['Brother', 'PR650 / PR650e', 'Entrepreneur 6', 'M', 6, 1, '~2010', 0, 'pr6', 'pes', 0, ''],
    ['Brother', 'PR655', '', 'M', 6, 1, '~2015', 0, 'pr6', 'pes', 1, ''],
    ['Brother', 'PR670E', 'Entrepreneur 6-Plus', 'M', 6, 1, '~2018', 0, 'pr6', 'pes', 1, ''],
    ['Brother', 'PR680W', 'Entrepreneur 6-Plus', 'M', 6, 1, '~2020', 1, 'pr6', 'pes', 1, ''],
    ['Brother', 'PR1000e', 'Entrepreneur Pro', 'M', 10, 1, '~2012', 0, 'pr10', 'pes', 1, ''],
    ['Brother', 'PR1050X', 'Entrepreneur Pro X', 'M', 10, 1, '~2016', 0, 'pr10', 'pes', 1, ''],
    ['Brother', 'PR1055X', 'Entrepreneur Pro X', 'M', 10, 1, '2021', 0, 'pr10', 'pes', 1, ''],
    ['Brother', 'PR1060W', '', 'M', 10, 1, '2026', 1, 'pr10', 'pes', 1, ''],

    ['Baby Lock', 'Journey', '', 'C', 1, 1, '~2014', 0, 'b180', 'pes', 1, ''],
    ['Baby Lock', 'Unity', '', 'C', 1, 1, '~2014', 0, 'b180', 'pes', 1, ''],
    ['Baby Lock', 'Spirit', '', 'E', 1, 1, '~2014', 0, 'b180', 'pes', 1, ''],
    ['Baby Lock', 'Destiny', '', 'C', 1, 1, '~2015', 0, 'b240', 'pes', 1, ''],
    ['Baby Lock', 'Destiny II', '', 'C', 1, 1, '~2018', 0, 'b240', 'pes', 0, ''],
    ['Baby Lock', 'Solaris', '', 'C', 1, 1, '~2017', 0, 'b272', 'pes', 0, ''],
    ['Baby Lock', 'Solaris 2', '', 'C', 1, 1, '~2020', 0, 'b272', 'pes', 0, ''],
    ['Baby Lock', 'Solaris Vision', '', 'C', 1, 1, '~2022', 1, 'b272', 'pes', 0, ''],
    ['Baby Lock', 'Altair', '', 'C', 1, 1, '~2019', 0, 'b240', 'pes', 0, ''],
    ['Baby Lock', 'Altair 2', '', 'C', 1, 1, '2023', 1, 'b240', 'pes', 1, ''],
    ['Baby Lock', 'Radiance', '', 'C', 1, 1, '~2025', 1, 'b297', 'pes', 1, ''],
    ['Baby Lock', 'Reflection', '', 'E', 1, 1, '2025', 1, 'b240', 'pes', 1, ''],
    ['Baby Lock', 'Pathfinder', '', 'C', 1, 1, '~2020', 1, 'b200', 'pes', 1, ''],
    ['Baby Lock', 'Aerial', '', 'E', 1, 1, '~2025', 1, 'b200', 'pes', 1, ''],
    ['Baby Lock', 'Vesta', '', 'C', 1, 1, '~2021', 1, 'b160', 'pes', 1, ''],
    ['Baby Lock', 'Flare', '', 'E', 1, 1, '~2022', 1, 'b160', 'pes', 1, ''],
    ['Baby Lock', 'Bloom', '', 'E', 1, 1, '~2025', 1, 'b130', 'pes', 1, ''],
    ['Baby Lock', 'Aurora', '', 'C', 1, 1, '~2022', 1, 'b100', 'pes', 1, ''],
    ['Baby Lock', 'Meridian', '', 'E', 1, 1, '~2019', 0, 'b200sq', 'pes', 0, ''],
    ['Baby Lock', 'Meridian 2', '', 'E', 1, 1, '2023', 1, 'b240', 'pes', 1, ''],
    ['Baby Lock', 'Capella', '', 'E', 1, 1, '2023', 1, 'b200', 'pes', 1, ''],
    ['Baby Lock', 'Enterprise', '', 'M', 10, 1, '~2010', 0, 'pr10', 'pes', 1, ''],
    ['Baby Lock', 'Valiant', '', 'M', 10, 1, '~2019', 0, 'pr10', 'pes', 0, ''],
    ['Baby Lock', 'Venture', '', 'M', 10, 1, '~2021', 0, 'pr10', 'pes', 1, ''],
    ['Baby Lock', 'Venture 2', '', 'M', 10, 1, '2025', 1, 'pr10', 'pes', 0, ''],
    ['Baby Lock', 'Array', '', 'M', 6, 1, '~2021', 1, 'pr6', 'pes', 0, ''],

    ['Janome', 'MC400E', 'Memory Craft', 'E', 1, 1, '~2011', 0, 'j400', 'jef', 0, ''],
    ['Janome', 'MC500E', 'Memory Craft', 'E', 1, 1, '~2011', 1, 'j500', 'jef', 1, ''],
    ['Janome', 'MC550E', 'Memory Craft', 'E', 1, 1, '~2018', 1, 'j550', 'jef', 1, ''],
    ['Janome', 'MC230E', 'Memory Craft', 'E', 1, 1, '~2020', 0, 'j140', 'jef', 0, ''],
    ['Janome', 'MC100E', 'Memory Craft', 'E', 1, 1, '2025', 1, 'j140', 'jef', 1, ''],
    ['Janome', 'MC1000', 'Memory Craft', 'C', 1, 1, '2025', 1, 'j140', 'jef', 1, ''],
    ['Janome', 'MC9900', 'Memory Craft', 'C', 1, 1, '~2014', 0, 'j9900', 'jef', 1, ''],
    ['Janome', 'MC9850 / MC9850LE', 'Memory Craft', 'C', 1, 1, '~2017', 1, 'j9900', 'jef', 1, ''],
    ['Janome', 'Skyline S9', '', 'C', 1, 1, '~2017', 1, 'j9900', 'jef', 0, ''],
    ['Janome', 'MC14000', 'Horizon Memory Craft', 'C', 1, 1, '~2013', 0, 'j15000', 'jef', 0, ''],
    ['Janome', 'MC15000', 'Horizon Quilt Maker', 'C', 1, 1, '~2015', 1, 'j15000', 'jef', 1, ''],
    ['Janome', 'Continental M17', '', 'C', 1, 1, '~2019', 1, 'jm17', 'jef', 1, ''],
    ['Janome', 'MB-4S', '', 'M', 4, 1, '~2014', 1, 'jmb', 'jef', 0, ''],
    ['Janome', 'MB-7', '', 'M', 7, 1, '~2015', 1, 'jmb', 'jef', 0, ''],

    ['Elna', 'eXpressive 830 / 830L', '', 'E', 1, 1, '~2010', 1, 'j500', 'jef', 1, ''],
    ['Elna', 'eXpressive 850', '', 'C', 1, 1, '~2017', 0, 'j9900', 'jef', 0, ''],
    ['Elna', 'eXpressive 860', '', 'E', 1, 1, '~2019', 1, 'j550', 'jef', 0, ''],

    ['BERNINA', 'B 580', '5 Series', 'C', 1, 1, '~2011', 0, 'bern5', 'exp', 0, ''],
    ['BERNINA', 'B 535', '5 Series', 'C', 1, 1, '~2016', 0, 'bern5', 'exp', 1, ''],
    ['BERNINA', 'B 570 QE', '5 Series', 'C', 1, 1, '~2017', 1, 'bern5', 'exp', 1, ''],
    ['BERNINA', 'B 590', '5 Series', 'C', 1, 1, '~2016', 1, 'bern5', 'exp', 1, ''],
    ['BERNINA', 'B 500 E', '5 Series', 'E', 1, 1, '~2016', 1, 'bern5', 'exp', 1, ''],
    ['BERNINA', 'B 750 QE / B 780', '7 Series', 'C', 1, 1, '~2011', 0, 'bern7', 'exp', 0, ''],
    ['BERNINA', 'B 700 E', '7 Series', 'E', 1, 1, '~2016', 0, 'bern7', 'exp', 0, ''],
    ['BERNINA', 'B 770 QE', '7 Series', 'C', 1, 1, '~2015', 0, 'bern7', 'exp', 0, ''],
    ['BERNINA', 'B 790 / B 790 PLUS', '7 Series', 'C', 1, 1, '~2015', 0, 'bern7', 'exp', 0, ''],
    ['BERNINA', 'B 790 PRO', '7 Series', 'C', 1, 1, '~2021', 1, 'bern7', 'exp', 1, ''],
    ['BERNINA', 'B 700 PRO', '7 Series PRO', 'E', 1, 1, '~2024', 1, 'bern7', 'exp', 1, ''],
    ['BERNINA', 'B 735 PRO', '7 Series PRO', 'C', 1, 1, '~2024', 1, 'bern7', 'exp', 1, ''],
    ['BERNINA', 'B 770 QE PRO', '7 Series PRO', 'C', 1, 1, '~2024', 1, 'bern7', 'exp', 1, ''],
    ['BERNINA', 'B 880 / B 880 PLUS', '8 Series', 'C', 1, 1, '~2013', 0, 'bern8', 'exp', 0, ''],
    ['BERNINA', 'B 990', '', 'C', 1, 1, '~2023', 1, 'bern990', 'exp', 1, ''],
    ['BERNINA', 'E 16 / E 16 PRO', '', 'M', 16, 1, '2014', 1, 'comm:400x300', 'dst', 0, 'Largest frame not published'],

    ['bernette', 'b70 DECO', '', 'E', 1, 1, '~2017', 1, 'bernette', 'exp', 0, ''],
    ['bernette', 'b79 / b79 Yaya', '', 'C', 1, 1, '~2017', 1, 'bernette', 'exp', 0, ''],

    ['PFAFF', 'creative sensation pro / pro II', '', 'C', 1, 1, '~2011', 0, 'pf360', 'vp3', 0, ''],
    ['PFAFF', 'creative performance 5.0', '', 'C', 1, 1, '~2018', 0, 'pf360', 'vp3', 0, ''],
    ['PFAFF', 'creative icon', '', 'C', 1, 1, '2018', 0, 'pf360', 'vp3', 0, ''],
    ['PFAFF', 'creative icon 2', '', 'C', 1, 1, '2022', 1, 'pf360', 'vp3', 0, ''],
    ['PFAFF', 'creative performance 950', '', 'C', 1, 1, '2024', 1, 'pf360', 'vp3', 1, ''],
    ['PFAFF', 'creative expect 350', '', 'E', 1, 1, '~2024', 1, 'pf360', 'vp3', 0, ''],
    ['PFAFF', 'creative expression 750', '', 'C', 1, 1, '2025', 1, 'expr750', 'vp3', 1, ''],
    ['PFAFF', 'creative 4.5', '', 'C', 1, 1, '~2015', 0, 'pf200x360', 'vp3', 0, ''],
    ['PFAFF', 'creative 3.0', '', 'C', 1, 1, '~2017', 0, 'pf260', 'vp3', 0, ''],
    ['PFAFF', 'creative 1.5 / ambition 1.5', '', 'C', 1, 1, '~2016', 0, 'pf240', 'vp3', 0, ''],
    ['PFAFF', 'creative ambition 640', '', 'C', 1, 1, '~2024', 1, 'pf240', 'vp3', 1, ''],
    ['PFAFF', 'creative 350', '', 'C', 1, 1, '~2025', 1, 'pf170', 'vp3', 1, ''],

    ['Husqvarna Viking', 'Designer Diamond Royale', '', 'C', 1, 1, '~2012', 0, 'hv360', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Ruby Royale', '', 'C', 1, 1, '~2012', 0, 'hv360', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Epic', '', 'C', 1, 1, '~2015', 0, 'hv360', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Epic 2', '', 'C', 1, 1, '~2018', 0, 'hv360', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Epic 3', '', 'C', 1, 1, '~2022', 1, 'epic3', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Ruby 90', '', 'C', 1, 1, '~2018', 1, 'hv360', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Brilliance 80', '', 'C', 1, 1, '~2017', 0, 'hv200x360', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Sapphire 85', '', 'C', 1, 1, '~2016', 1, 'hv240', 'vp3', 0, ''],
    ['Husqvarna Viking', 'Designer Jade 35', '', 'C', 1, 1, '~2014', 0, 'hv240', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Topaz 20', '', 'C', 1, 1, '~2010', 0, 'hv260', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Topaz 25', '', 'C', 1, 1, '~2012', 0, 'hv240', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Topaz 30', '', 'C', 1, 1, '~2012', 0, 'hv200x360', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Topaz 40', '', 'C', 1, 1, '~2016', 1, 'hv240', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Topaz 50', '', 'C', 1, 1, '~2015', 0, 'hv200x360', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Topaz 65', '', 'C', 1, 1, '~2023', 1, 'hv200x360', 'vp3', 1, ''],
    ['Husqvarna Viking', 'Designer Quartz 29', '', 'C', 1, 1, '~2025', 1, 'hv170', 'vp3', 1, ''],

    ['Singer', 'Futura XL-550', '', 'C', 1, 1, '~2011', 0, 's250', 'xxx', 0, ''],
    ['Singer', 'Legacy SE300 / SE340', '', 'C', 1, 1, '~2012', 0, 's260', 'xxx', 0, ''],
    ['Singer', 'Quantum Stylist EM200', '', 'E', 1, 1, '~2016', 0, 's260', 'xxx', 0, ''],
    ['Singer', 'SE9180', '', 'C', 1, 1, '~2020', 1, 's9180', 'xxx', 0, ''],
    ['Singer', 'SE9185', '', 'C', 1, 1, '~2021', 1, 's9180', 'xxx', 0, 'Wi-Fi'],

    ['Poolin', 'EOC05', '', 'E', 1, 1, '~2023', 1, [[100, 100, '10 × 10 cm hoop'], [100, 235, '10 × 23.5 cm hoop']], 'dst', 1, ''],

    ['Tajima', 'SAI', '', 'P', 8, 1, '~2017', 1, 'comm:300x200', 'dst', 0, ''],
    ['Tajima', 'TEMX-C1501', 'Neo / Neo II', 'P', 15, 1, '~2010', 0, 'comm:495x355', 'dst', 0, ''],
    ['Tajima', 'TMEZ-SC1501', '', 'P', 15, 1, '~2011', 1, 'comm:500x360', 'dst', 0, ''],
    ['Tajima', 'TMBR-SC1501', '', 'P', 15, 1, '~2019', 1, 'comm:500x360', 'dst', 0, ''],
    ['Tajima', 'TMBP2-SC', '', 'P', 15, 1, '~2022', 1, 'comm:500x360', 'dst', 0, ''],
    ['Tajima', 'TMAR-KC', '', 'H', 15, '2–8', '~2015', 1, 'comm:500x360', 'dst', 0, ''],
    ['Tajima', 'TMEZ-KC', '', 'H', 15, 'multi', '~2012', 1, 'comm:500x360', 'dst', 0, ''],
    ['Tajima', 'TFMX-IIC', '', 'H', 15, 'multi', '~2014', 1, 'comm:500x360', 'dst', 0, ''],

    ['Barudan', 'BEXT-S1501CBII', 'Pro 2', 'P', 15, 1, '~2010', 0, 'comm:500x360', 'dst', 0, ''],
    ['Barudan', 'BEKT-S1501CBIII', 'Pro 3', 'P', 15, 1, '~2017', 1, 'comm:500x360', 'dst', 0, ''],
    ['Barudan', 'BEVT-Z1501CBII', 'Elite Pro II', 'P', 15, 1, '~2014', 1, 'comm:500x360', 'dst', 0, ''],
    ['Barudan', 'BEVT-S901CAII', 'XL II', 'P', 9, 1, '~2014', 1, 'comm:500x360', 'dst', 0, ''],
    ['Barudan', 'BEKY-S15xxCII', 'K-Series', 'H', 15, '2–8', '~2016', 1, 'comm:500x360', 'dst', 0, ''],
    ['Barudan', 'BEKS-S1512C / S1515C', '', 'H', 15, '12–15', '~2016', 1, 'comm:500x360', 'dst', 0, ''],

    ['Happy', 'HCH-701P', 'Journey / Peace', 'M', 7, 1, '~2016', 1, 'comm:290x285', 'dst', 1, ''],
    ['Happy', 'HCS3-1201', 'Voyager', 'P', 12, 1, '~2019', 1, 'comm:290x285', 'dst', 1, ''],
    ['Happy', 'HCD3-1501', '', 'P', 15, 1, '~2018', 1, 'comm:520x400', 'dst', 1, ''],
    ['Happy', 'HCU2-1501', '', 'P', 15, 1, '~2014', 1, 'comm:600x400', 'dst', 1, ''],
    ['Happy', 'HCR3 series', '', 'H', 15, '2–12', '~2018', 1, 'comm:360x450', 'dst', 1, 'Per head'],

    ['SWF', 'MAS-12', '', 'P', 12, 1, '~2016', 1, 'comm:330x200', 'dst', 0, ''],
    ['SWF', 'MAS-15', '', 'P', 15, 1, '~2018', 1, 'comm:330x200', 'dst', 0, ''],
    ['SWF', 'ES-T1501C', 'ES Series', 'P', 15, 1, '~2020', 1, 'comm:460x300', 'dst', 0, ''],
    ['SWF', 'K-UH15xx', '', 'H', 15, '4–8', '~2015', 1, 'comm:400x450', 'dst', 0, 'Per head'],
    ['SWF', 'KE dual / KX series', '', 'H', 15, '4–12', '~2018', 1, 'comm:450x400', 'dst', 0, ''],

    ['ZSK', 'Sprint 6 / 7 / 8', '', 'P', '12–18', 1, '~2015', 1, 'comm:400x300', 'dst', 0, ''],
    ['ZSK', 'RACER S / Classic', '', 'H', 12, '1–12', '~2012', 1, 'comm:400x400', 'dst', 0, ''],
    ['ZSK', 'RACER W', '', 'H', 12, '1–6', '~2015', 1, 'comm:495x400', 'dst', 0, 'Wide format'],
    ['ZSK', 'RACER II', '', 'H', 18, '2–6', '~2018', 1, 'comm:495x400', 'dst', 0, ''],
    ['ZSK', 'RACER 1XL / 2XL', '', 'H', 24, '1–2', '~2020', 1, 'comm:700x700', 'dst', 0, 'Per head'],

    ['Melco', 'Amaya XTS', '', 'P', 16, 1, '~2010', 0, 'comm:360x300', 'dst', 0, ''],
    ['Melco', 'Amaya Bravo', '', 'P', 16, 1, '~2011', 0, 'comm:320x265', 'dst', 0, ''],
    ['Melco', 'EMT16 / EMT16 Plus', '', 'P', 16, 1, '~2012', 0, 'comm:400x350', 'dst', 0, ''],
    ['Melco', 'EMT16X', '', 'P', 16, 1, '~2018', 1, 'comm:410x400', 'dst', 0, ''],
    ['Melco', 'Summit', '', 'P', 16, 1, '~2017', 1, 'comm:400x350', 'dst', 0, ''],
    ['Melco', 'Bravo X', '', 'P', 16, 1, '~2023', 1, 'comm:320x265', 'dst', 0, ''],

    ['Ricoma', 'EM-1010', '', 'M', 10, 1, '~2017', 1, 'comm:310x210', 'dst', 1, ''],
    ['Ricoma', 'Creator 10', '', 'M', 10, 1, '~2025', 1, 'comm:310x210', 'dst', 0, ''],
    ['Ricoma', 'MT-1501 / MT-1501-TC', '', 'P', 15, 1, '~2016', 1, 'comm:500x360', 'dst', 0, ''],
    ['Ricoma', 'MT-2001-8S', '', 'P', 20, 1, '~2022', 1, 'comm:500x360', 'dst', 1, ''],
    ['Ricoma', 'Swift 15', '', 'P', 15, 1, '~2025', 1, 'comm:500x360', 'dst', 0, ''],
    ['Ricoma', 'SWM 2-head 20-needle', '', 'H', 20, 2, '~2024', 1, 'comm:500x360', 'dst', 0, ''],
    ['Ricoma', 'CHT2 series', '', 'H', 15, '2–12', '~2020', 1, 'comm:500x360', 'dst', 0, '']
  ];

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function hoopsOf(spec) {
    if (Array.isArray(spec)) return named(spec);
    if (spec.indexOf('comm:') === 0) { var d = spec.slice(5).split('x'); return comm(+d[0], +d[1]); }
    return P[spec]();
  }
  function largest(list) { return list.reduce(function (a, h) { return h.field[0] * h.field[1] > a.field[0] * a.field[1] ? h : a; }); }

  var MACHINES = {}, ORDER = [];
  function add(m) { MACHINES[m.id] = m; ORDER.push(m.id); }
  function finish(m) {
    var f = FORMATS[m.fmt], keys = Object.keys(m.hoops), big = keys.reduce(function (a, k) { var h = m.hoops[k]; return h.field[0] * h.field[1] > a[0] * a[1] ? h.field : a; }, [0, 0]);
    m.format = f.label; m.ext = f.ext; m.files = m.files || f.files; m.max = big;
    var needles = typeof m.needles === 'number' && m.needles === 1 ? 'Single needle' : m.needles + ' needles';
    var heads = m.heads && m.heads !== 1 ? ' · ' + m.heads + ' heads' : '';
    m.blurb = m.blurb || (KINDS[m.kind] + ' · ' + needles + heads + ' · ' + (m.trims ? 'trims jumps' : 'no trimmer') + ' · ' + f.label + (m.cur ? '' : ' · discontinued'));
    m.search = [m.brand, m.model, m.aka, m.name, f.label, KINDS[m.kind], m.kind === 'M' || m.kind === 'P' || m.kind === 'H' ? 'multi-needle multineedle' : 'home', m.note || ''].join(' ').toLowerCase();
    m.compact = m.search.replace(/[^a-z0-9]/g, '');
    return m;
  }

  // the two machines the app started with keep their ids and hoop keys, so saved designs reopen unchanged
  add(finish({ id: 'deco330', brand: 'BERNINA', model: 'Deco 330', aka: 'bernette Deco 330 / 340', name: 'Bernina Deco 330', kind: 'E', needles: 1, heads: 1, year: '~2010', cur: 0,
    fmt: 'exp-deco', folder: 'EmbF5', media: 'memory card', trims: false, spm: 600, defaultHoop: 'A', ver: 1,
    blurb: 'Single needle · no trimmer · EXP+ on a memory card',
    hoops: { A: hoop(126, 110, 'Hoop A', 'Hoop A', { open: 14, r: 12 }), B: hoop(140, 200, 'Hoop B', 'Hoop B', { open: 14, r: 14 }), C: hoop(50, 50, 'Free-arm hoop C', 'C · free-arm', { open: 10, r: 8 }) } }));
  add(finish({ id: 'eoc06', brand: 'Poolin', model: 'EOC06', aka: '', name: 'Poolin EOC06', kind: 'E', needles: 1, heads: 1, year: '~2023', cur: 1,
    fmt: 'dst', folder: '', media: 'USB stick', trims: true, spm: 800, defaultHoop: 'L', ver: 1,
    blurb: 'Single needle · trims after each colour · DST on a USB stick or Wi-Fi',
    hoops: { S: hoop(140, 140, '14 × 14 cm hoop', '14 × 14', { open: 16, r: 12 }), M: hoop(200, 200, '20 × 20 cm hoop', '20 × 20', { open: 16, r: 14 }), L: hoop(200, 280, '20 × 28 cm hoop', '20 × 28', { open: 16, r: 16 }) } }));

  ROWS.forEach(function (r) {
    var list = hoopsOf(r[8]), hoops = {}, kind = r[3], big = largest(list).field;
    list.forEach(function (h) { var k = h.key; delete h.key; hoops[k] = h; });
    var keys = Object.keys(hoops), multi = kind === 'M' || kind === 'P' || kind === 'H';
    // jumps: commercial and multi-needle machines trim; small entry-level home machines generally do not
    var trims = multi || r[0] === 'Poolin' || (r[0] !== 'Singer' && big[0] * big[1] > 140 * 140);
    add(finish({
      id: slug(r[0] + ' ' + r[1]), brand: r[0], model: r[1], aka: r[2], name: r[0] + ' ' + r[1], kind: kind, needles: r[4], heads: r[5], year: r[6], cur: r[7],
      fmt: r[9], ver: r[10], note: r[11], folder: '', media: 'USB stick', trims: trims,
      spm: kind === 'P' ? 1200 : multi ? 1000 : big[0] * big[1] >= 240 * 360 ? 850 : 700,
      defaultHoop: keys[keys.length - 1], hoops: hoops
    }));
  });

  // brands in the order the picker lists them
  var BRANDS = ['Brother', 'Baby Lock', 'Janome', 'Elna', 'BERNINA', 'bernette', 'PFAFF', 'Husqvarna Viking', 'Singer', 'Poolin',
    'Tajima', 'Barudan', 'Happy', 'SWF', 'ZSK', 'Melco', 'Ricoma'];
  ORDER.forEach(function (id) { var b = MACHINES[id].brand; if (BRANDS.indexOf(b) < 0) BRANDS.push(b); });
  ORDER.sort(function (a, b) { return BRANDS.indexOf(MACHINES[a].brand) - BRANDS.indexOf(MACHINES[b].brand) || ORDER.indexOf(a) - ORDER.indexOf(b); });

  function search(q) {
    var toks = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return ORDER.slice();
    return ORDER.filter(function (id) {
      var m = MACHINES[id];
      // one- and two-character terms ("3", "xl") match at the start of a word, so "epic 3" is not matched by "VP3"
      return toks.every(function (t) {
        var c = t.replace(/[^a-z0-9]/g, '');
        if (c.length <= 2) return (' ' + m.search.replace(/[^a-z0-9]+/g, ' ')).indexOf(' ' + c) >= 0;
        return m.search.indexOf(t) >= 0 || m.compact.indexOf(c) >= 0;
      });
    });
  }

  return { MACHINES: MACHINES, ORDER: ORDER, BRANDS: BRANDS, FORMATS: FORMATS, KINDS: KINDS, search: search };
})();
if (typeof module !== 'undefined') module.exports = StitchMachines;
