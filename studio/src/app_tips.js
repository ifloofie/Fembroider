  // ===================== tooltips =====================
  // Hovering (or focusing) a setting explains it. Settings in the right-hand panel show their help beside the panel,
  // like a slicer; everything else shows it next to the control.
  var tipEl = document.createElement('div');
  tipEl.className = 'tipbox'; tipEl.hidden = true; tipEl.setAttribute('role', 'tooltip'); tipEl.id = 'tipbox';
  document.body.appendChild(tipEl);
  function showTip(html, x, y) {
    tipEl.innerHTML = html; tipEl.hidden = false;
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x)) + 'px';
    tipEl.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y)) + 'px';
  }
  function hideTip() { tipEl.hidden = true; }
  var TIPS = {
    // design: text
    'L.p.text': ['Text', 'The words to stitch. Script fonts join the letters; keep it short for a cap or chest logo.'],
    'L.p.tail': ['Swoop', 'A sports-script swash under the word. Classic hooks off the last letter and tapers under the first; Long sweep runs out past it; Flick curls up at the front; Bar is an even underline; Lead-in starts from the first letter; Twin adds a pinstripe.'],
    'L.p.tailWeight': ['Swoop weight', 'How thick the swoop is compared with the letters. Very thin swoops (under about 2 mm with an outline) are hard to sew cleanly.'],
    'L.p.tilt': ['Slant', 'Leans the lettering forward. Script fonts already slant; this adds to it.'],
    'L.p.width': ['Width', 'Total width in millimetres, including outlines. Leave blank to use the font’s natural size.'],
    'L.colors.fill': ['Fill colour', 'The thread for the inside of the letters. The chart shows your chosen thread brand.'],
    'L.fx.stripes.mode': ['Fill style', 'Solid uses one thread. Stripes sews bands of different threads (flag style). Gradient blends neighbouring threads row by row.'],
    'L.fx.stripes.dir': ['Direction', 'Which way the stripes or gradient run across the design.'],
    'L.fx.stripes.dither': ['Dither', 'How rows are shared between two neighbouring colours in a gradient. Diffusion gives the smoothest blend; Ordered gives an even, regular mix.'],
    'L.thread': ['Thread material', 'Overrides the material for this layer only, for example metallic accents. Changes density, satin width and the PBR look.'],
    'L.p.size': ['Size', 'The largest side of the artwork in millimetres. Stitches are recalculated at the new size, so density stays correct.'],
    'L.p.palette': ['Colours', '“From SVG fills” keeps the artwork’s own flat colours. “Reduce” groups similar colours, for gradients or many shades.'],
    'L.p.maxColors': ['Max colours', 'How many thread colours a picture is reduced to. Each colour is a thread change.'],
    'L.p.art': ['Artwork', 'Auto tells flat art (prints, logos, line art: kept sharp) from paintings and photos (smoothed into calmer areas). Pick one if Auto guesses wrong.'],
    'L.p.blur': ['Smoothing', 'Softens brush strokes, grain and hatching before the colours are chosen. Paintings and photos sew cleaner with fewer jumps at 0.6–1 mm; logos and flat art can use 0.'],
    'L.p.removeBg': ['Remove background', 'Drops the colour that fills the picture’s border, so only the artwork is stitched.'],
    'L.fx.stroke.on': ['Outline stroke', 'A satin border around the shape, sewn last. It covers the fill’s edge and makes small lettering crisp.'],
    'L.fx.stroke.width': ['Outline width', 'Width of the satin border. Around 1.2–2 mm reads well; narrower than 0.8 mm can look broken.'],
    'L.colors.stroke': ['Outline colour', 'Thread for the outline stroke.'],
    'L.fx.stroke2.on': ['Second stroke', 'A second border outside the first, for a two-colour team look. Sewn before the fill.'],
    'L.fx.stroke2.width': ['Second stroke width', 'Width of the outer border.'],
    'L.colors.stroke2': ['Second stroke colour', 'Thread for the outer border.'],
    'L.fx.shadow.on': ['Drop shadow', 'An offset fill behind the design, sewn first, for a 3D varsity look.'],
    'L.fx.shadow.dist': ['Shadow distance', 'How far the shadow is offset from the design.'],
    'L.fx.shadow.angle': ['Shadow direction', 'Which way the shadow falls.'],
    'L.colors.shadow': ['Shadow colour', 'Thread for the drop shadow.'],
    'doc.fabric': ['Fabric colour', 'The colour of your garment. Used in the preview, and very dark or very light fabric makes Auto sew a little denser so the fabric doesn’t show through.'],
    'doc.hoop': ['Hoop', 'The hoop you will use on the selected machine. The dashed line is its sewing field; the design must fit inside it to export. Pick the machine from the button at the top left: search by brand, model or file format.'],
    'ui.allHoops': ['Other hoops', 'Shows the other hoop outlines for comparison.'],
    'ui.themeGroup': ['Colourway group', 'Classic team-style colourways, or Pride flags with several colourways each.'],
    'L.tf.x': ['X position', 'Horizontal position of the layer’s centre, from the hoop centre (mm).'],
    'L.tf.y': ['Y position', 'Vertical position of the layer’s centre, from the hoop centre (mm).'],
    'L.tf.rot': ['Angle', 'Rotation of the layer in degrees.'],
    // stitch
    'doc.threads.line': ['Thread line', 'The brand and range you sew with. Colours match its chart, and the worksheet lists its thread numbers.'],
    'doc.threads.weight': ['Thread weight', 'Higher numbers are finer. 40 wt is standard; 30 wt covers more with fewer stitches; 60 wt suits tiny lettering.'],
    'doc.threads.snap': ['Match colours to this chart', 'Snaps every colour to the nearest real thread in your chosen range, so the preview shows what will sew.'],
    'doc.threads.needle': ['Needle size', 'Bigger numbers are thicker needles. The panel warns when the needle is too small for the thread, and Auto loosens density for big needles.'],
    'doc.threads.point': ['Needle point', 'Sharp for wovens, ballpoint for knits (it slips between loops instead of cutting them), metallic for metallic thread.'],
    'doc.threads.fabric': ['Fabric', 'What you’re stitching on. Changes pull compensation, underlay and density, and recommends a backing.'],
    'doc.stitch.tatamiAngle': ['Fill angle', 'Angle of the fill rows in every area of every layer. Auto picks one per area. To set the direction of one area, use the Stitch direction tool (D).'],
    'doc.stitch.spacing': ['Satin spacing', 'Distance between neighbouring satin stitches. Auto sets about 85% of the thread’s pressed-flat width (0.27 mm for 40 wt) so rows just overlap. Smaller is denser; much smaller stiffens the fabric and can break thread.'],
    'doc.stitch.strokeSpacing': ['Stroke spacing', 'Distance between stitches in outline strokes (both strokes, every layer), independent of the letter fill. Auto sets about 65% of the thread’s pressed-flat width (0.21 mm for 40 wt), since outlines show from every side. Raise it to soften a wide, stiff border; lower it if a thin outline looks broken.'],
    'doc.stitch.tatamiSpacing': ['Fill spacing', 'Distance between tatami fill rows in wide areas. Auto sets about 95% of the thread’s pressed-flat width (0.30 mm for 40 wt). If the fabric shows through the fill, make this smaller.'],
    'doc.stitch.pullComp': ['Pull compensation', 'Thread tension pulls stitching narrower than drawn, so each row is sewn this much wider in total. Stretchy fabric needs more.'],
    'doc.stitch.minStitch': ['Shortest stitch', 'Needle points closer than this are merged. Very short stitches can cut fabric or snap thread.'],
    'doc.stitch.satin': ['Satin fill (experimental)', 'Sews narrow strokes as satin columns that follow the letter instead of fill rows. Glossier when it works, but still unreliable at complex joins and loops. Off by default.'],
    'doc.stitch.satinMax': ['Satin up to', 'Shapes wider than this are filled with tatami instead of satin, because long satin stitches snag and loosen.'],
    'doc.stitch.split': ['Split satin over', 'Satin stitches longer than this are split into staggered pieces so they lie flat.'],
    'doc.stitch.tatamiStitch': ['Stitch length', 'Length of each stitch along a fill row. Longer is smoother; shorter holds better on stretchy fabric.'],
    'doc.stitch.underlay': ['Underlay', 'Stitches sewn first under the top stitching. They anchor the fabric and lift the top stitches so they cover better.'],
    'doc.stitch.fillMode': ['Gap repair', 'What to do if a curved satin leaves a gap: Patch fills just the spot, Re-fill re-sews that area in one direction.'],
    'ui.speed': ['Playback speed', 'How fast the stitch-out preview plays.'],
    'ui.light': ['Lighting', 'Where the preview light comes from. Raking light shows texture and gaps best.'],
    'ui.twist': ['Twist', 'How tightly the thread is twisted in the preview: the diagonal sheen on each stitch.'],
    'ui.sharp': ['Sheen sharpness', 'How tight the highlight on the thread is. Rayon is sharp and glossy; cotton is soft.'],
    'ui.spec': ['Sheen strength', 'How bright the thread highlight is in the preview.'],
    'ui.fidelity': ['Fidelity', 'Preview quality. Low draws flat stitches and is fastest; High adds roundness and twist. Ultra models each stitch as two twisted plies with fibre detail, pinched where the needle goes in, and renders at a higher resolution: best for close-ups and screenshots, heavier on the graphics card.'],
    'ui.copies': ['Stress test', 'Draws several copies of the design to check the preview stays smooth on your graphics card.'],
    // export
    'doc.cardName': ['File name', 'Up to 8 letters, numbers or underscores. This is the name the machine shows on its screen.'],
    'doc.formats.exp': ['Bernina EXP+', 'Also saves the Deco 330 set (EXP, INF, BMP) in an EmbF5 folder.'],
    'doc.formats.pes': ['Brother PES', 'Also saves a PES file, for Brother and Baby Lock machines.'],
    'doc.formats.jef': ['Janome JEF', 'Also saves a JEF file, for Janome machines and many others.'],
    'doc.formats.dst': ['Tajima DST', 'Also saves a DST file, the format most commercial machines and digitizers read.'],
    'doc.formats.sheet': ['Worksheet', 'A text sheet with the colour order, thread numbers, needle, backing and loading steps.'],
    'ui.bake.res': ['Texture resolution', 'Pixel size of the baked maps. 2K is plenty for a chest logo; 4K for close-ups.'],
    'ui.bake.bg': ['Background', 'None gives transparent maps (an alpha channel) to use as a decal. Fabric bakes a twill fabric in.'],
    'ui.bake.normal': ['Normal map format', 'OpenGL is Substance Painter’s and Blender’s default; DirectX is for Unreal and 3ds Max.'],
    // buttons
    'act:centre-all': ['Centre design', 'Moves all layers together so the design is centred in the hoop.'],
    'act:save-zip': ['Save machine files', 'The files for the selected machine (Deco 330: EXP, INF and BMP in an EmbF5 folder; Poolin EOC06: a DST), plus the formats and worksheet you ticked.'],
    'act:write-card': ['Write to card or stick', 'Writes the selected machine’s files straight onto the memory card or USB stick (into EmbF5 for the Deco 330).'],
    'act:bake': ['Bake PBR maps', 'Renders base colour, normal, roughness, metallic, height and AO textures of the stitching for 3D software.'],
    'act:use-rec-needle': ['Use recommended needle', 'Switches to the needle the panel recommends for your thread and fabric.'],
    'act:stitch-auto': ['Reset to Auto', 'Every density, satin and fill setting goes back to following your thread, needle and fabric.'],
    'act:raise': ['Raise', 'Moves the layer up: it sews later, on top.'],
    'act:lower': ['Lower', 'Moves the layer down: it sews earlier, underneath.'],
    'act:duplicate': ['Duplicate', 'Copies the selected layer (Ctrl+D).'],
    'act:delete': ['Delete', 'Removes the selected layer (Del). Ctrl+Z brings it back.'],
    'auto': ['Auto', 'When on, this value follows your thread, needle and fabric. Drag the slider to set your own; click Auto to go back.']
  };
  function tipFor(el) {
    var t = el.dataset.k ? TIPS[el.dataset.k] : el.dataset.set ? TIPS[el.dataset.set] : el.dataset.act ? TIPS['act:' + el.dataset.act] : el.dataset.auto ? TIPS.auto : null;
    return t || null;
  }
  // tag rows and buttons in a freshly rendered panel with their help
  function applyTips(root) {
    root.querySelectorAll('[data-k], [data-set], [data-act], [data-auto]').forEach(function (el) {
      var t = tipFor(el); if (!t) return;
      var host = el.dataset.auto || el.dataset.act ? el : (el.closest('.row') || el);
      host.dataset.tipT = t[0]; host.dataset.tipD = t[1];
    });
  }
  var tipTimer = null, tipHost = null;
  function placeTip(host) {
    var r = host.getBoundingClientRect(), panel = host.closest('#panel');
    tipEl.innerHTML = '<span class="tt">' + esc(host.dataset.tipT) + '</span>' + esc(host.dataset.tipD);
    tipEl.hidden = false;
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight, x, y;
    if (panel && window.innerWidth > 820) { var pr = panel.getBoundingClientRect(); x = pr.left - w - 10; y = r.top + r.height / 2 - h / 2; }
    else { x = r.left; y = r.bottom + 8; if (y + h > window.innerHeight - 8) y = r.top - h - 8; }
    tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x)) + 'px';
    tipEl.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y)) + 'px';
  }
  document.addEventListener('mouseover', function (e) {
    var host = e.target.closest && e.target.closest('[data-tip-t]');
    if (host === tipHost) return;
    tipHost = host; clearTimeout(tipTimer);
    if (!host) { if (!(gesture && gesture.mode === 'dir') && ui.tool !== 'direction') hideTip(); else if (e.target !== canvas) hideTip(); return; }
    tipTimer = setTimeout(function () { placeTip(host); }, 450);
  });
  document.addEventListener('focusin', function (e) {
    var host = e.target.closest && e.target.closest('[data-tip-t]');
    if (host && e.target.matches(':focus-visible')) { tipHost = host; placeTip(host); }
  });
  document.addEventListener('focusout', function () { tipHost = null; hideTip(); });
  document.addEventListener('pointerdown', function (e) { if (e.target !== canvas) { clearTimeout(tipTimer); hideTip(); } }, true);
  document.addEventListener('scroll', function () { hideTip(); }, true);
