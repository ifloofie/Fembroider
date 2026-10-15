  // ===================== 3D scene =====================
  var canvas = $('view');
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (err) {
    var msg = document.createElement('div');
    msg.className = 'float'; msg.setAttribute('role', 'alert');
    msg.style.cssText = 'left:50%;top:40%;transform:translate(-50%,-50%);padding:20px 24px;max-width:420px;font-size:14px;line-height:1.5';
    msg.innerHTML = '<b style="display:block;font-size:16px;margin-bottom:6px">3D preview unavailable</b>This device or browser has WebGL turned off, so the stitch preview cannot start. Enable hardware acceleration in your browser settings, or update the graphics driver, then reload.';
    $('workspace').appendChild(msg);
    throw err;
  }
  renderer.setClearColor(0x000000, 0);
  var scene = new THREE.Scene();
  var FOV = 30;
  var persp = new THREE.PerspectiveCamera(FOV, 1, 2, 8000);
  var ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 6000);
  persp.up.set(0, 0, 1); ortho.up.set(0, 0, 1);
  var camera = persp;
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  var sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-120, -200, 300); scene.add(sun);
  var gl = renderer.getContext();
  var dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
  var GPU_NAME = dbgExt ? gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  var LIGHTS = { top: { dir: [0.25, -0.35, 1.0], spec: 1.0 }, raking: { dir: [0.95, -0.55, 0.32], spec: 1.15 }, soft: { dir: [-0.45, -0.7, 0.75], spec: 0.6 } };

  // ---- thread ribbons: one instanced draw per layer, shading in world space ----
  var threadVS = [
    'attribute vec3 iA; attribute vec3 iB; attribute vec3 iMisc; attribute vec3 iCol;',
    'uniform float uWidth; uniform float uPile; uniform float uLevel;',
    'varying vec3 vW; varying vec3 vT; varying vec3 vS; varying vec2 vUV; varying float vLen; varying float vAO; varying float vSeed; varying vec3 vCol; varying float vMat;',
    'void main(){',
    '  float u = position.x; float v = position.y;',
    '  vec2 d = iB.xy - iA.xy; float len = max(length(d), 0.001); vec2 dir = d / len; vec2 side = vec2(-dir.y, dir.x);',
    '  float h = uPile * min(0.10 + 0.05 * len, 0.42);',
    '  float a = max(sin(3.14159 * u), 0.002);',
    '  float z = mix(iA.z, iB.z, u) + h * pow(a, 0.55);',
    '  float slope = clamp(h * 0.55 * pow(a, -0.45) * 3.14159 * cos(3.14159 * u) / len, -3.0, 3.0);',
    '  float endD = min(u, 1.0 - u) * len;',
    '  float pinch = uLevel > 2.5 ? mix(0.62, 1.0, smoothstep(0.0, 0.32, endD)) : 1.0;',
    '  float bulge = uLevel > 2.5 ? uWidth * 0.30 * pinch * sqrt(max(1.0 - v * v, 0.0)) * smoothstep(0.0, 0.2, endD) : 0.0;',
    '  vec3 pos = vec3(mix(iA.xy, iB.xy, u) + side * v * uWidth * 0.5 * pinch, z + bulge);',
    '  mat3 m3 = mat3(modelMatrix);',
    '  vT = normalize(m3 * vec3(dir, slope)); vS = normalize(m3 * vec3(side, 0.0));',
    '  vUV = vec2(u, v); vLen = len; vAO = iMisc.x; vSeed = iMisc.y; vCol = iCol; vMat = iMisc.z;',
    '  vec4 wp = modelMatrix * vec4(pos, 1.0); vW = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');
  var threadFS = [
    'uniform vec3 uLight; uniform float uLevel; uniform float uTwist; uniform float uSharp; uniform float uSpec; uniform float uOut; uniform float uDim; uniform float uWidth;',
    'varying vec3 vW; varying vec3 vT; varying vec3 vS; varying vec2 vUV; varying float vLen; varying float vAO; varying float vSeed; varying vec3 vCol; varying float vMat;',
    'void main(){',
    '  float metal = step(2.5, vMat);',
    '  float specK = vMat < 0.5 ? 1.0 : vMat < 1.5 ? 0.75 : vMat < 2.5 ? 0.22 : 1.7;',
    '  float sharpK = vMat < 0.5 ? 1.0 : vMat < 1.5 ? 0.8 : vMat < 2.5 ? 0.3 : 1.25;',
    '  vec3 T = normalize(vT);',
    '  vec3 S = normalize(vS - T * dot(vS, T));',
    '  vec3 N0 = normalize(cross(T, S)); if (N0.z < 0.0) N0 = -N0;',
    '  float vv = clamp(vUV.y, -1.0, 1.0);',
    '  vec3 N = N0;',
    '  if (uLevel > 0.5) N = normalize(N0 * sqrt(max(1.0 - vv * vv * 0.9, 0.0)) + S * vv * 0.95);',
    '  float stripe = 1.0, occ = 1.0, fib = 1.0, jit = 1.0, spec2 = 0.0; vec3 Bd = T;',
    '  if (uLevel > 1.5 && uLevel < 2.5) { float ph = vUV.x * vLen * uTwist + vv * 0.6 + vSeed; stripe = 0.84 + 0.16 * (0.5 + 0.5 * sin(6.2832 * ph)); }',
    // Ultra: two plies twisted round each other at ~35 degrees, each a rounded strand with a groove between,
    // fine fibres running the other way, and per-stitch variation in how the thread lies
    '  if (uLevel > 2.5) {',
    '    float sAl = vUV.x * vLen, tAc = vv * 0.5 * uWidth;',
    '    float P = 0.5 / max(uTwist, 0.05);',
    '    float f = fract((sAl - tAc * 1.43) / P + vSeed * 3.0);',
    '    Bd = normalize(T * 0.819 + S * 0.574);',
    '    vec3 Q = normalize(cross(N0, Bd));',
    '    N = normalize(N + Q * (f - 0.5) * 1.7);',
    '    occ = 0.6 + 0.4 * pow(max(sin(3.14159 * f), 0.0), 0.7);',
    '    float fc = (sAl * 0.94 + tAc * 0.34) / 0.03;',
    '    float fa = clamp(1.0 - fwidth(fc) * 1.5, 0.0, 1.0);',
    '    fib = 1.0 - 0.1 * fa * (0.5 + 0.5 * sin(6.2832 * fc + vSeed * 20.0));',
    '    jit = 1.0 + (vSeed - 0.5) * 0.07;',
    '  }',
    '  vec3 L = normalize(uLight); vec3 V = normalize(cameraPosition - vW);',
    '  float dif = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);',
    '  float spec = 0.0;',
    '  if (uLevel > 2.5) {',
    '    vec3 Hh = normalize(L + V);',
    '    vec3 T1 = normalize(Bd + N * 0.08), T2 = normalize(Bd - N * 0.12);',
    '    float t1 = dot(T1, Hh), t2 = dot(T2, Hh);',
    '    float lit = smoothstep(-0.2, 0.35, dot(N0, L)) * (0.5 + 0.5 * occ);',
    '    spec = pow(sqrt(max(0.0, 1.0 - t1 * t1)), uSharp * sharpK * 1.6) * uSpec * specK * lit;',
    '    spec2 = pow(sqrt(max(0.0, 1.0 - t2 * t2)), uSharp * sharpK * 0.5) * uSpec * specK * 0.45 * lit;',
    '  } else if (uLevel > 0.5) {',
    '    vec3 Tt = normalize(T + N * (stripe - 0.92) * 1.6);',
    '    vec3 Hh = normalize(L + V); float th = dot(Tt, Hh);',
    '    spec = pow(sqrt(max(0.0, 1.0 - th * th)), uSharp * sharpK) * uSpec * specK * smoothstep(-0.2, 0.35, dot(N0, L));',
    '  }',
    '  float k = clamp(0.22 / vLen, 0.02, 0.35);',
    '  float e = smoothstep(0.0, k, vUV.x) * smoothstep(1.0, 1.0 - k, vUV.x);',
    '  float edge = 1.0 - 0.22 * vv * vv;',
    '  float shade = (0.34 + 0.76 * dif) * vAO * mix(0.68, 1.0, e) * stripe * edge * occ * fib * jit;',
    '  vec3 specCol = mix(vec3(1.0, 0.98, 0.95), vCol * 1.5 + 0.08, metal);',
    '  vec3 col = vCol * shade * (1.0 - 0.5 * metal) + specCol * spec * mix(0.4, 1.0, e) + vCol * spec2 * mix(0.3, 1.0, e);',
    '  if (uOut > 0.5) { float hs = step(0.5, fract((vW.x - vW.y) / 3.0)); col = mix(col, vec3(0.93, 0.55, 0.02), 0.5 * hs); }',
    '  col = mix(col, vec3(0.5), uDim);',
    '  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);',
    '}'
  ].join('\n');
  var shared = {
    uWidth: { value: 0.32 }, uPile: { value: 1.0 }, uLight: { value: new THREE.Vector3(0.95, -0.55, 0.32) },
    uLevel: { value: 2 }, uTwist: { value: 18 / 25.4 }, uSharp: { value: 40 }, uSpec: { value: 0.45 }
  };
  function makeThreadMat() {
    return new THREE.ShaderMaterial({ vertexShader: threadVS, fragmentShader: threadFS, side: THREE.DoubleSide,
      uniforms: Object.assign({}, shared, { uOut: { value: 0 }, uDim: { value: 0 } }) });
  }
  function ribbonTemplate(along, across) {
    var g = new THREE.BufferGeometry(), pos = [], idx = [];
    for (var i = 0; i <= along; i++) for (var j = 0; j <= across; j++) pos.push(i / along, -1 + 2 * j / across, 0);
    for (var a = 0; a < along; a++) for (var b = 0; b < across; b++) {
      var p = a * (across + 1) + b, q = p + across + 1;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.userData.tris = along * across * 2;
    return g;
  }
  var TEMPLATE = ribbonTemplate(6, 1), TEMPLATE_ULTRA = ribbonTemplate(16, 6);
  function threadTemplate() { return ui.fidelity >= 3 ? TEMPLATE_ULTRA : TEMPLATE; }
  var layerRoot = new THREE.Group(); scene.add(layerRoot);

  function buildLayerMesh(L) {
    var r = rt(L.id);
    if (r.group) { layerRoot.remove(r.group); r.mesh.geometry.dispose(); }
    if (!r.result) return;
    var parts = r.result.parts, n = 0;
    parts.forEach(function (p) { n += p.chords.length; });
    var A3 = new Float32Array(n * 3), B3 = new Float32Array(n * 3), M3 = new Float32Array(n * 3), C3 = new Float32Array(n * 3), k = 0, seed = 12345;
    parts.forEach(function (p, pi) {
      var col = lin(partColor(L, p)), z = 0.02 + pi * 0.14;
      p.chords.forEach(function (c) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        A3[k * 3] = c[0]; A3[k * 3 + 1] = c[1]; A3[k * 3 + 2] = z;
        B3[k * 3] = c[2]; B3[k * 3 + 1] = c[3]; B3[k * 3 + 2] = z;
        M3[k * 3] = c[6] === undefined ? 1 : c[6]; M3[k * 3 + 1] = (seed % 1000) / 1000; M3[k * 3 + 2] = THREADTYPE[layerMaterial(L)].code;
        C3[k * 3] = col[0]; C3[k * 3 + 1] = col[1]; C3[k * 3 + 2] = col[2];
        k++;
      });
    });
    var g = new THREE.InstancedBufferGeometry();
    var TT = threadTemplate(); g.setAttribute('position', TT.getAttribute('position')); g.setIndex(TT.getIndex());
    g.setAttribute('iA', new THREE.InstancedBufferAttribute(A3, 3));
    g.setAttribute('iB', new THREE.InstancedBufferAttribute(B3, 3));
    g.setAttribute('iMisc', new THREE.InstancedBufferAttribute(M3, 3));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(C3, 3));
    g.instanceCount = n;
    if (!r.mat) r.mat = makeThreadMat();
    var mesh = new THREE.Mesh(g, r.mat); mesh.frustumCulled = false;
    var grp = new THREE.Group(); grp.add(mesh);
    r.group = grp; r.mesh = mesh; r.count = n;
    layerRoot.add(grp);
    placeLayer(L);
  }
  function recolorLayer(L) {
    var r = rt(L.id); if (!r.mesh || !r.result) return;
    var C = r.mesh.geometry.getAttribute('iCol'), k = 0;
    r.result.parts.forEach(function (p) { var col = lin(partColor(L, p)); p.chords.forEach(function () { C.setXYZ(k++, col[0], col[1], col[2]); }); });
    C.needsUpdate = true;
    var Mi = r.mesh.geometry.getAttribute('iMisc'), code = THREADTYPE[layerMaterial(L)].code;
    if (Mi.getZ(0) !== code) { for (var i = 0; i < Mi.count; i++) Mi.setZ(i, code); Mi.needsUpdate = true; }
    requestDraw(); scheduleShadow();
  }
  function placeLayer(L) {
    var r = rt(L.id); if (!r.group) return;
    var idx = doc.layers.indexOf(L), s = r.preview || 1;
    r.group.position.set(L.tf.x, L.tf.y, idx * 0.22);
    r.group.rotation.set(0, 0, L.tf.rot * Math.PI / 180);
    r.group.scale.set((L.tf.mx ? -1 : 1) * s, (L.tf.my ? -1 : 1) * s, 1);
    r.group.visible = L.visible;
  }
  // after undo/redo or structural changes: drop meshes of deleted layers, re-place, re-render
  function syncScene() {
    var ids = {}; doc.layers.forEach(function (L) { ids[L.id] = 1; });
    RT.forEach(function (r, id) { if (!ids[id]) { if (r.group) layerRoot.remove(r.group); RT.delete(id); } });
    doc.layers.forEach(function (L) { var r = rt(L.id); if (r.group) { recolorLayer(L); placeLayer(L); } requestRender(L); });
    styleHoops(); sceneChanged();
  }

  // ---- build plate, fabric in the hoop, shadow from the stitches ----
  var plateVS = 'varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
  var plateFS = [
    'uniform sampler2D uShadow; uniform vec3 uFab; uniform vec3 uLight; uniform vec2 uOpen; uniform float uOpenR; uniform vec2 uField; uniform vec2 uPlate;',
    'uniform vec3 uBase; uniform vec3 uMinor; uniform vec3 uMajor; uniform vec3 uFieldCol;',
    'varying vec3 vW;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    'float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }',
    'float gridLine(vec2 p, float step, float w){ vec2 g = abs(fract(p / step + 0.5) - 0.5) * step; vec2 fw = fwidth(p) * w; vec2 l = 1.0 - smoothstep(vec2(0.0), fw, g); return max(l.x, l.y); }',
    'void main(){',
    '  vec2 p = vW.xy;',
    '  if (abs(p.x) > uPlate.x || abs(p.y) > uPlate.y) discard;',
    '  vec3 L = normalize(uLight);',
    '  vec2 sp = p - L.xy / max(L.z, 0.25) * 0.45;',
    '  vec2 uv = (sp + uPlate) / (2.0 * uPlate);',
    '  float sh = texture2D(uShadow, vec2(uv.x, 1.0 - uv.y)).r;',
    '  vec3 col;',
    '  if (sdRound(p, uOpen, uOpenR) < 0.0) {',
    '    float t = (p.x + p.y) / 0.75; float fw = fwidth(t);',
    '    float twill = (0.5 + 0.5 * sin(6.2832 * t)) * clamp(1.0 - fw * 1.6, 0.0, 1.0);',
    '    float mott = noise(p * 0.35) * 0.6 + noise(p * 1.7) * 0.4;',
    '    col = uFab * (0.93 + 0.08 * mott) * (1.0 - 0.07 * twill);',
    '    col *= (0.55 + 0.45 * clamp(L.z * 1.2, 0.0, 1.0)) * (1.0 - 0.42 * sh);',
    '    vec2 a = abs(p) - uField; float dF = max(a.x, a.y);',
    '    float px = length(fwidth(p));',
    '    float border = 1.0 - smoothstep(0.0, 1.4 * px, abs(dF));',
    '    float dash = step(0.35, fract((abs(p.x) + abs(p.y)) / 5.0));',
    '    col = mix(col, uFieldCol, border * dash * 0.95);',
    '    float inF = 1.0 - step(0.0, dF);',
    '    float cross = 1.0 - smoothstep(0.0, 1.1 * px, min(abs(p.x), abs(p.y)));',
    '    float tick = gridLine(p, 10.0, 1.0) * (1.0 - smoothstep(1.5, 1.5 + px, min(abs(p.x), abs(p.y))));',
    '    col = mix(col, uFieldCol, 0.4 * max(cross, tick) * inF);',
    '  } else {',
    '    col = uBase;',
    '    col = mix(col, uMinor, gridLine(p, 10.0, 1.0) * 0.6);',
    '    col = mix(col, uMajor, gridLine(p, 50.0, 1.4) * 0.85);',
    '    col *= 1.0 - 0.3 * sh;',
    '    float edge = min(uPlate.x - abs(p.x), uPlate.y - abs(p.y));',
    '    col *= 0.86 + 0.14 * smoothstep(0.0, 6.0, edge);',
    '  }',
    '  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);',
    '}'
  ].join('\n');
  var shadowCanvas = document.createElement('canvas'); shadowCanvas.width = PLATE[0] * 2; shadowCanvas.height = PLATE[1] * 2;
  var shadowTex = new THREE.CanvasTexture(shadowCanvas); shadowTex.minFilter = THREE.LinearFilter; shadowTex.magFilter = THREE.LinearFilter;
  var plateMat = new THREE.ShaderMaterial({ vertexShader: plateVS, fragmentShader: plateFS, extensions: { derivatives: true },
    uniforms: {
      uShadow: { value: shadowTex }, uFab: { value: new THREE.Vector3() }, uLight: { value: new THREE.Vector3(0.95, -0.55, 0.32) },
      uOpen: { value: new THREE.Vector2(70, 62) }, uOpenR: { value: 12 }, uField: { value: new THREE.Vector2(63, 55) },
      uPlate: { value: new THREE.Vector2(PLATE[0] / 2, PLATE[1] / 2) },
      uBase: { value: new THREE.Vector3() }, uMinor: { value: new THREE.Vector3() }, uMajor: { value: new THREE.Vector3() }, uFieldCol: { value: new THREE.Vector3() }
    } });
  var plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE[0], PLATE[1]), plateMat);
  plate.position.z = -0.05; scene.add(plate);
  var axes = (function () {
    var o = new THREE.Vector3(-PLATE[0] / 2 + 8, -PLATE[1] / 2 + 8, 0.2);
    return [[1, 0, 0, 0xd8322b], [0, 1, 0, 0x2f9a3a], [0, 0, 1, 0x2f6fe0]].map(function (a) { var h = new THREE.ArrowHelper(new THREE.Vector3(a[0], a[1], a[2]), o, 22, a[3], 5, 3); scene.add(h); return h; });
  })();
  // the work surface grows to hold the machine's largest hoop (commercial frames reach 70 cm)
  function sizePlate() {
    var w = 330, h = 380;
    Object.keys(HOOPS).forEach(function (k) { var H = HOOPS[k]; w = Math.max(w, H.field[0] + H.open + 116); h = Math.max(h, H.field[1] + H.open + 136); });
    if (w === PLATE[0] && h === PLATE[1]) return;
    PLATE = [w, h];
    var px = Math.min(2, 1600 / Math.max(w, h));
    shadowCanvas.width = Math.round(w * px); shadowCanvas.height = Math.round(h * px);
    shadowTex.dispose(); shadowTex = new THREE.CanvasTexture(shadowCanvas); shadowTex.minFilter = THREE.LinearFilter; shadowTex.magFilter = THREE.LinearFilter;
    plateMat.uniforms.uShadow.value = shadowTex; plateMat.uniforms.uPlate.value.set(w / 2, h / 2);
    plate.geometry.dispose(); plate.geometry = new THREE.PlaneGeometry(w, h);
    axes.forEach(function (a) { a.position.set(-w / 2 + 8, -h / 2 + 8, 0.2); });
    scheduleShadow();
  }

  var shadowPending = false;
  function scheduleShadow() { if (!shadowPending) { shadowPending = true; requestAnimationFrame(drawShadow); } }
  function drawShadow() {
    shadowPending = false;
    var c = shadowCanvas, x = c.getContext('2d'), s = c.width / PLATE[0];
    x.setTransform(1, 0, 0, 1, 0, 0); x.filter = 'none';
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    var tmp = drawShadow.tmp || (drawShadow.tmp = document.createElement('canvas'));
    tmp.width = c.width; tmp.height = c.height;
    var t = tmp.getContext('2d');
    t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, tmp.width, tmp.height);
    t.strokeStyle = '#fff'; t.lineCap = 'round';
    copyOffsets().forEach(function (off) {
      doc.layers.forEach(function (L) {
        var r = rt(L.id); if (!L.visible || !r.result) return;
        var sc = r.preview || 1, rad = L.tf.rot * Math.PI / 180;
        t.setTransform(s, 0, 0, -s, c.width / 2, c.height / 2);
        t.translate(L.tf.x + off[0], L.tf.y + off[1]); t.rotate(rad); t.scale((L.tf.mx ? -1 : 1) * sc, (L.tf.my ? -1 : 1) * sc);
        t.lineWidth = shared.uWidth.value * 1.4; t.beginPath(); // contact shadow hugs the thread, so gaps between rows stay visible
        r.result.parts.forEach(function (p) { p.chords.forEach(function (ch) { t.moveTo(ch[0], ch[1]); t.lineTo(ch[2], ch[3]); }); });
        t.stroke();
      });
    });
    x.filter = 'blur(4px)'; x.drawImage(tmp, 0, 0); x.filter = 'none';
    shadowTex.needsUpdate = true; requestDraw();
  }

  // ---- hoops: transparent rounded frames ----
  function roundedRect(path, w, h, r) {
    var x = -w / 2, y = -h / 2;
    path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
    return path;
  }
  function ring(ow, oh, orr, iw, ih, irr, z0, hgt) {
    var shape = roundedRect(new THREE.Shape(), ow, oh, orr);
    shape.holes.push(roundedRect(new THREE.Path(), iw, ih, irr));
    var g = new THREE.ExtrudeGeometry(shape, { depth: hgt, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, z0); return g;
  }
  function labelTexture(text, color) {
    var c = document.createElement('canvas'); c.width = 768; c.height = 96;
    var x = c.getContext('2d');
    x.font = '600 52px "IBM Plex Sans", "Segoe UI", sans-serif'; x.fillStyle = color; x.textBaseline = 'middle';
    x.fillText(text, 6, 50);
    var tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
  }
  var hoopObjs = {};
  // hoop frames for the current machine; rebuilt when the machine changes
  function buildHoops() {
  sizePlate();
  Object.keys(hoopObjs).forEach(function (k) {
    var g = hoopObjs[k]; scene.remove(g);
    g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
  });
  hoopObjs = {};
  Object.keys(HOOPS).forEach(function (k) {
    var H = HOOPS[k], fw = H.field[0], fh = H.field[1], ow = fw + H.open, oh = fh + H.open, r = H.r;
    var grp = new THREE.Group();
    var fill = new THREE.MeshLambertMaterial({ color: 0x9fb4cc, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    var edgeMat = new THREE.LineBasicMaterial({ color: 0x5c6b7a, transparent: true, opacity: 0.8 });
    [ring(ow + 10, oh + 10, r + 5, ow, oh, r, -6, 7.5), ring(ow + 26, oh + 26, r + 13, ow + 11, oh + 11, r + 5.5, -6, 9.5)].forEach(function (g) {
      var m = new THREE.Mesh(g, fill); m.renderOrder = 2; grp.add(m);
      var ln = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), edgeMat); ln.renderOrder = 3; grp.add(ln);
    });
    var labText = (H.label.indexOf('Hoop') === 0 || H.label.indexOf('·') > 0 ? H.label.replace(' · ', ' ') + '  ' : '') + fw + ' × ' + fh + ' mm';
    var lab = new THREE.Mesh(new THREE.PlaneGeometry(66, 66 * 96 / 768), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    lab.position.set(-(ow + 26) / 2 + 33, -(oh + 26) / 2 - 6, 0.15);
    grp.add(lab);
    grp.userData = { fill: fill, edge: edgeMat, label: lab, labText: labText, outer: [ow + 26, oh + 26] };
    hoopObjs[k] = grp; scene.add(grp);
  });
  }
  buildHoops();
  function styleHoops() {
    var dark = isDark();
    Object.keys(hoopObjs).forEach(function (k) {
      var g = hoopObjs[k], on = k === doc.hoop, u = g.userData;
      g.visible = on || ui.allHoops;
      u.fill.opacity = on ? 0.2 : 0.06;
      u.fill.color.set(on ? accentHex(0.45) : 0xb5bec8);
      u.edge.color.set(on ? accentHex(0) : 0x8a96a3);
      u.edge.opacity = on ? 0.95 : 0.45;
      var col = dark ? (on ? '#dfe5ee' : '#8d96a5') : (on ? '#1d2733' : '#7c8796');
      if (u.labCol !== col) { if (u.label.material.map) u.label.material.map.dispose(); u.label.material.map = labelTexture(u.labText, col); u.label.material.needsUpdate = true; u.labCol = col; }
    });
    var H = HOOPS[doc.hoop], pu = plateMat.uniforms;
    pu.uOpen.value.set((H.field[0] + H.open) / 2, (H.field[1] + H.open) / 2);
    pu.uOpenR.value = H.r;
    pu.uField.value.set(H.field[0] / 2, H.field[1] / 2);
    pu.uFab.value.fromArray(lin(doc.fabric));
    $('machineName').textContent = machine().name; $('machineHoop').textContent = /\d/.test(H.label) ? H.label + ' cm' : H.label + ' · ' + H.field[0] + '×' + H.field[1];
    requestDraw();
  }
  // the UI accent (palette and light/dark) as a three.js colour, optionally lightened toward white
  function accentHex(lighten) {
    var v = (getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#196ef0').trim();
    if (!/^#[0-9a-f]{6}$/i.test(v)) v = '#196ef0';
    var n = parseInt(v.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, t = lighten || 0;
    return (Math.round(r + (255 - r) * t) << 16) | (Math.round(g + (255 - g) * t) << 8) | Math.round(b + (255 - b) * t);
  }
  function onSceneTheme() {
    var d = isDark(), pu = plateMat.uniforms;
    pu.uBase.value.fromArray(d ? [0.055, 0.06, 0.07] : [0.60, 0.62, 0.65]);
    pu.uMinor.value.fromArray(d ? [0.10, 0.11, 0.125] : [0.46, 0.48, 0.52]);
    pu.uMajor.value.fromArray(d ? [0.19, 0.21, 0.24] : [0.34, 0.36, 0.40]);
    var ac = accentHex(d ? 0.15 : 0); pu.uFieldCol.value.fromArray([((ac >> 16) & 255) / 255, ((ac >> 8) & 255) / 255, (ac & 255) / 255].map(function (c) { return Math.pow(c, 2.2); }));
    styleHoops(); buildGizmo(); requestDraw();
  }

  // ---- selection gizmo ----
  var gizmo = new THREE.Group(); gizmo.renderOrder = 10; scene.add(gizmo);
  function gizmoMat(col, op) { return new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op === undefined ? 1 : op, depthTest: false }); }
  function handleSize() { return Math.max(1.4, cam.dist * 0.011); }
  function buildGizmo() {
    while (gizmo.children.length) { var c = gizmo.children.pop(); if (c.geometry) c.geometry.dispose(); }
    var L = selLayer(); if (!L || !L.visible || ui.stage !== 'design') { requestDraw(); return; }
    var corners = layerCorners(L); if (!corners) { requestDraw(); return; }
    var blue = accentHex(0), z = 6;
    var box = new THREE.BufferGeometry().setFromPoints(corners.concat([corners[0]]).map(function (p) { return new THREE.Vector3(p[0], p[1], z); }));
    var line = new THREE.Line(box, gizmoMat(blue)); line.renderOrder = 10; gizmo.add(line);
    var hs = handleSize();
    if (ui.tool === 'scale') {
      corners.forEach(function (p) {
        var g = new THREE.PlaneGeometry(hs * 1.6, hs * 1.6);
        var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: blue, depthTest: false }));
        m.position.set(p[0], p[1], z + 0.1); m.renderOrder = 11; gizmo.add(m);
      });
    }
    if (ui.tool === 'direction') drawDirGizmo(L, z);
    if (ui.tool === 'rotate') {
      var c0 = [L.tf.x, L.tf.y], R = rotateRadius(L), pts = [];
      for (var i = 0; i <= 120; i++) { var a = i / 120 * Math.PI * 2; pts.push(new THREE.Vector3(c0[0] + R * Math.cos(a), c0[1] + R * Math.sin(a), z)); }
      var rl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gizmoMat(blue, 0.9)); rl.renderOrder = 10; gizmo.add(rl);
      var a0 = (L.tf.rot + 90) * Math.PI / 180;
      var knob = new THREE.Mesh(new THREE.CircleGeometry(hs * 1.1, 24), new THREE.MeshBasicMaterial({ color: blue, depthTest: false }));
      knob.position.set(c0[0] + R * Math.cos(a0), c0[1] + R * Math.sin(a0), z + 0.1); knob.renderOrder = 11; gizmo.add(knob);
    }
    requestDraw();
  }
  function rotateRadius(L) { var s = layerSize(L); return s ? Math.hypot(s.w, s.h) / 2 + 8 : 30; }

  // ---- stress-test copies ----
  var copyGroup = new THREE.Group(); scene.add(copyGroup);
  function compBounds() {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    doc.layers.forEach(function (L) { if (!L.visible) return; var c = layerCorners(L); if (c) c.forEach(function (p) { b.minX = Math.min(b.minX, p[0]); b.maxX = Math.max(b.maxX, p[0]); b.minY = Math.min(b.minY, p[1]); b.maxY = Math.max(b.maxY, p[1]); }); });
    if (!isFinite(b.minX)) b = { minX: -50, minY: -25, maxX: 50, maxY: 25 };
    return b;
  }
  function effCopies() { return ui.stage === 'stitch' ? ui.copies : 1; }
  function copyOffsets() {
    var n = effCopies();
    if (n <= 1) return [[0, 0]];
    var b = compBounds(), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    var sx = b.maxX - b.minX + 18, sy = b.maxY - b.minY + 18, out = [];
    for (var i = 0; i < n; i++) out.push([(i % cols - (cols - 1) / 2) * sx, -(Math.floor(i / cols) - (rows - 1) / 2) * sy]);
    return out;
  }
  function rebuildCopies() {
    while (copyGroup.children.length) copyGroup.remove(copyGroup.children[0]);
    var offs = copyOffsets();
    layerRoot.position.set(offs[0][0], offs[0][1], 0);
    for (var i = 1; i < offs.length; i++) {
      var g = new THREE.Group();
      doc.layers.forEach(function (L) { var r = rt(L.id); if (!r.group) return; var c = new THREE.Group(); c.add(new THREE.Mesh(r.mesh.geometry, r.mat)); c.children[0].frustumCulled = false; c.position.copy(r.group.position); c.rotation.copy(r.group.rotation); c.scale.copy(r.group.scale); c.visible = r.group.visible; g.add(c); });
      g.position.set(offs[i][0], offs[i][1], 0);
      copyGroup.add(g);
    }
  }

  // ---- camera (Cura-style) ----
  var cam = { theta: -Math.PI / 2, phi: 0.85, dist: 330, tx: 0, ty: 0 };
  var VIEWS = { '3d': { theta: -Math.PI / 2, phi: 0.85 }, front: { theta: -Math.PI / 2, phi: 1.42 }, top: { theta: -Math.PI / 2, phi: 0.0015 }, left: { theta: Math.PI, phi: 1.42 }, right: { theta: 0, phi: 1.42 } };
  var anim = null;
  function frustumH() { return 2 * cam.dist * Math.tan(FOV * Math.PI / 360); }
  function placeCamera() {
    var sp = Math.sin(cam.phi), dir = new THREE.Vector3(sp * Math.cos(cam.theta), sp * Math.sin(cam.theta), Math.cos(cam.phi));
    var tgt = new THREE.Vector3(cam.tx, cam.ty, 0);
    persp.position.copy(tgt).addScaledVector(dir, cam.dist); persp.lookAt(tgt);
    ortho.position.copy(tgt).addScaledVector(dir, 2000); ortho.lookAt(tgt);
    var hh = frustumH() / 2, aspect = persp.aspect;
    ortho.left = -hh * aspect; ortho.right = hh * aspect; ortho.top = hh; ortho.bottom = -hh; ortho.updateProjectionMatrix();
    camera = ui.ortho ? ortho : persp;
  }
  function frameDist(theta, phi) {
    var span = hoopObjs[doc.hoop].userData.outer.slice();
    var b = compBounds(); span = [Math.max(span[0], 2 * Math.max(Math.abs(b.minX), Math.abs(b.maxX)) + 10), Math.max(span[1], 2 * Math.max(Math.abs(b.minY), Math.abs(b.maxY)) + 10)];
    if (effCopies() > 1) { var offs = copyOffsets(); offs.forEach(function (o) { span[0] = Math.max(span[0], 2 * Math.abs(o[0]) + (b.maxX - b.minX)); span[1] = Math.max(span[1], 2 * Math.abs(o[1]) + (b.maxY - b.minY)); }); }
    var sp = Math.sin(phi), dir = new THREE.Vector3(sp * Math.cos(theta), sp * Math.sin(theta), Math.cos(phi));
    var right = new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0), up = new THREE.Vector3().crossVectors(dir, right).normalize();
    var ex = 0, ey = 0, toward = 0, c = new THREE.Vector3();
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sy) { [-6, 4].forEach(function (z) {
      c.set(sx * (span[0] / 2 + 10), sy * (span[1] / 2 + 16), z);
      ex = Math.max(ex, Math.abs(c.dot(right))); ey = Math.max(ey, Math.abs(c.dot(up))); toward = Math.max(toward, c.dot(dir));
    }); }); });
    // the floating panels cover the right side; frame against the uncovered part of the viewport
    var vw = canvas.clientWidth || 1, vh = canvas.clientHeight || 1, freeW = Math.max(vw * 0.45, vw - (vw > 820 ? 470 : 0));
    var aspect = Math.max(0.4, freeW / vh), tanH = Math.tan(FOV * Math.PI / 360);
    var need = Math.max(ey + 14, (ex + 14) / aspect);
    return 1.12 * need / tanH + toward;
  }
  function viewTargetX() { var vw = canvas.clientWidth || 1; if (vw <= 820) return 0; var shift = (470 - 70) / 2; return shift * frustumH() / (canvas.clientHeight || 1); }
  function goTo(view, instant) {
    var v = VIEWS[view] || VIEWS['3d'];
    ui.view = view;
    document.querySelectorAll('.viewbar [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
    var d = frameDist(v.theta, v.phi);
    var save = cam.dist; cam.dist = d; var shift = viewTargetX(); cam.dist = save;
    var right = [-Math.sin(v.theta), Math.cos(v.theta)];
    var to = { theta: v.theta, phi: v.phi, dist: d, tx: right[0] * shift, ty: right[1] * shift };
    var dt = to.theta - cam.theta; dt = Math.atan2(Math.sin(dt), Math.cos(dt)); to.theta = cam.theta + dt;
    if (instant || reduceMotion) { Object.assign(cam, to); requestDraw(); buildGizmo(); return; }
    anim = { from: Object.assign({}, cam), to: to, t0: performance.now(), dur: 380 };
  }
  function markCustomView() {
    if (ui.view === 'custom') return;
    ui.view = 'custom';
    document.querySelectorAll('.viewbar [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
  }
  var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  function planeHit(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    placeCamera(); raycaster.setFromCamera(ndc, camera);
    var out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(ground, out) ? [out.x, out.y] : null;
  }
  function pan(dx, dy) {
    var k = frustumH() / canvas.clientHeight;
    var rx = -Math.sin(cam.theta), ry = Math.cos(cam.theta), ux = -Math.cos(cam.theta), uy = -Math.sin(cam.theta), c = Math.max(Math.cos(cam.phi), 0.3);
    cam.tx += (-rx * dx + ux * dy / c) * k; cam.ty += (-ry * dx + uy * dy / c) * k;
    var lim = Math.max(PLATE[0], PLATE[1]); cam.tx = Math.max(-lim, Math.min(lim, cam.tx)); cam.ty = Math.max(-lim, Math.min(lim, cam.ty));
  }
  function zoomAt(f, cx, cy) {
    var hit = cx === undefined ? null : planeHit(cx, cy), nd = Math.min(2400, Math.max(18, cam.dist * f));
    if (hit) { var t = 1 - nd / cam.dist; cam.tx += (hit[0] - cam.tx) * t; cam.ty += (hit[1] - cam.ty) * t; }
    cam.dist = nd;
  }

  // ---- frame loop ----
  var dirty = true, last = performance.now(), frames = [], drawTimes = [], lastGizmoDist = 0;
  function requestDraw() { dirty = true; }
  function resize() {
    var r = canvas.getBoundingClientRect();
    // Ultra renders above screen resolution (supersampling) so fine ply and fibre detail stays smooth
    var scale = ui.fidelity === 0 ? 0.75 : 1, dpr = ui.fidelity >= 3 ? Math.min((window.devicePixelRatio || 1) * 1.5, 3) : Math.min(window.devicePixelRatio || 1, ui.fidelity === 2 ? 2 : 1.25) * scale;
    renderer.setPixelRatio(dpr); renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
    persp.aspect = Math.max(1, r.width) / Math.max(1, r.height); persp.updateProjectionMatrix();
    ui.resText = Math.round(r.width * dpr) + ' × ' + Math.round(r.height * dpr);
    // keep a preset view framed when the window changes size
    var sz = Math.round(r.width) + 'x' + Math.round(r.height);
    if (resize.last && resize.last !== sz && ui.view !== 'custom' && !anim) goTo(ui.view, true);
    resize.last = sz;
    requestDraw();
  }
  new ResizeObserver(resize).observe(canvas);
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function tick(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    if (anim) {
      var t = Math.min(1, (now - anim.t0) / anim.dur), k = ease(t);
      ['theta', 'phi', 'dist', 'tx', 'ty'].forEach(function (key) { cam[key] = anim.from[key] + (anim.to[key] - anim.from[key]) * k; });
      if (t >= 1) { anim = null; buildGizmo(); }
      dirty = true;
    }
    if (ui.bench) { cam.theta += dt * 0.35; dirty = true; }
    if (ui.playing) {
      ui.sew = Math.min(1, ui.sew + dt * ui.speed / 12);
      applySew();
      if (ui.sew >= 1) { ui.playing = false; refreshPlay(); }
    }
    if (dirty) {
      if (Math.abs(cam.dist - lastGizmoDist) / cam.dist > 0.08) { lastGizmoDist = cam.dist; buildGizmo(); }
      placeCamera();
      renderer.render(scene, camera);
      ui.calls = renderer.info.render.calls;
      dirty = false;
      if (ui.bench) { frames.push(now - last); if (frames.length > 120) frames.shift(); }
      drawTimes.push(now); if (drawTimes.length > 240) drawTimes.shift();
    }
    last = now;
    requestAnimationFrame(tick);
  }

  // stitch-out playback across layers in sewing order
  function totalChords() { var n = 0; doc.layers.forEach(function (L) { var r = rt(L.id); if (L.visible && r.result) n += r.count || 0; }); return n; }
  function applySew() {
    var total = totalChords(), upto = Math.round(total * ui.sew), acc = 0, cur = null;
    doc.layers.forEach(function (L) {
      var r = rt(L.id); if (!r.mesh) return;
      var n = r.count || 0, show = L.visible ? Math.max(0, Math.min(n, upto - acc)) : 0;
      r.mesh.geometry.instanceCount = show;
      if (L.visible && upto > acc && upto <= acc + n && r.result) {
        var k = upto - acc, kk = 0;
        for (var i = 0; i < r.result.parts.length; i++) { kk += r.result.parts[i].chords.length; if (kk >= k) { cur = { L: L, part: r.result.parts[i] }; break; } }
      }
      if (L.visible) acc += n;
    });
    copyGroup.children.forEach(function (g) { g.children.forEach(function (c, i) { var L = doc.layers[i]; var r = L && rt(L.id); if (r && r.mesh) c.children[0].geometry = r.mesh.geometry; }); });
    if (ui.sew >= 1) doc.layers.forEach(function (L) { var r = rt(L.id); if (r.mesh) r.mesh.geometry.instanceCount = r.count; });
    var v = $('sewVal');
    if (v) v.textContent = upto.toLocaleString() + ' / ' + total.toLocaleString() + (cur ? ' · ' + (cur.L.name || '') : '');
    var sl = $('sewSlider'); if (sl && document.activeElement !== sl) sl.value = Math.round(ui.sew * 1000);
    ui.sewCurrent = cur;
    requestDraw();
  }
