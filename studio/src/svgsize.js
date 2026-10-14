// Give an SVG explicit pixel width/height so it rasterises crisply at the size we need.
function svgAtSize(svg, px) {
  var m = svg.match(/<svg\b[^>]*>/i);
  if (!m) return svg;
  var tag = m[0];
  var vb = tag.match(/viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)/i);
  var w = vb ? parseFloat(vb[3]) : parseFloat((tag.match(/\bwidth\s*=\s*["']?([\d.]+)/i) || [])[1] || px);
  var h = vb ? parseFloat(vb[4]) : parseFloat((tag.match(/\bheight\s*=\s*["']?([\d.]+)/i) || [])[1] || px);
  var s = px / Math.max(w, h);
  var nw = Math.max(1, Math.round(w * s)), nh = Math.max(1, Math.round(h * s));
  var t2 = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
  if (!vb && w && h) t2 = t2.replace(/<svg\b/i, '<svg viewBox="0 0 ' + w + ' ' + h + '"');
  t2 = t2.replace(/<svg\b/i, '<svg width="' + nw + '" height="' + nh + '"');
  return svg.replace(tag, t2);
}
if (typeof module !== 'undefined') module.exports = svgAtSize;
