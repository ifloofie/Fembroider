"""Pie menu flows: click shapes in the view, change how they're sewn. Usage: python3 test/ui_pie.py"""
import asyncio, os, json, http.server, threading, functools
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'test', 'out', 'pie')
os.makedirs(OUT, exist_ok=True)
PORT = 8771
READY = "window.__studio && !window.__studio.stale() && window.__studio.seq() !== undefined"
STICKER = os.path.join(ROOT, 'test', 'stickers', 'sticker-strawberry.png')

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, 'dist', 'test'))
    h.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def settle(pg, t=120000):
    await pg.wait_for_function(READY, timeout=t)
    await pg.wait_for_timeout(500)

# screen point on a part of the selected layer: the middle of one of its stitches (fill) or a line stitch
POINT = """([key, pick]) => {
  const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel), r = __studio.rt(L.id).result;
  let cs = [];
  if (key === 'ghost') cs = r.ghosts[0].chords; else r.parts.filter(p => p.key === key).forEach(p => cs = cs.concat(p.chords));
  if (!cs.length) return null;
  const c = cs[Math.floor(cs.length * (pick || 0.5))];
  return __studio.screen(L.tf.x + (c[0] + c[2]) / 2, L.tf.y + (c[1] + c[3]) / 2);
}"""

async def pie_items(pg):
    return await pg.evaluate("[...document.querySelectorAll('.pie .pie-item')].map(b => b.textContent.replace(/\\d$/, '').trim())")

async def main():
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='light')
        pg = await ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        await pg.goto('http://127.0.0.1:%d/index.html' % PORT)
        await settle(pg)
        await pg.click('.viewbar [data-view=top]'); await pg.wait_for_timeout(800)

        # 1. the welcome text: click its letters
        pt = await pg.evaluate(POINT, ['fill', 0.3])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        items = await pie_items(pg)
        print('text pie:', items)
        await pg.screenshot(path=os.path.join(OUT, '01_text_pie.png'))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        assert await pg.evaluate("!document.querySelector('.pie')"), 'Esc should close'
        # drag still moves (no pie)
        x0 = await pg.evaluate("__studio.doc.layers[0].tf.x")
        await pg.mouse.move(pt[0], pt[1]); await pg.mouse.down(); await pg.mouse.move(pt[0] + 40, pt[1], steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
        x1 = await pg.evaluate("__studio.doc.layers[0].tf.x")
        print('drag moved text by', x1 - x0, 'mm; pie open after drag:', await pg.evaluate("!!document.querySelector('.pie')"))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
        # delete the text so the sticker has the hoop to itself
        await pg.evaluate("__studio.doc.sel = __studio.doc.layers[0].id"); await pg.keyboard.press('Delete'); await pg.wait_for_timeout(300)

        # 2. import a Procreate-style sticker
        await pg.set_input_files('#fileInput', STICKER)
        await settle(pg)
        await pg.click('.viewbar [data-view=top]'); await pg.wait_for_timeout(900)
        keys = await pg.evaluate("__studio.rt(__studio.doc.sel).result.parts.map(p => p.key)")
        print('sticker parts:', keys)
        lum = lambda h: 0.3 * int(h[1:3], 16) + 0.59 * int(h[3:5], 16) + 0.11 * int(h[5:7], 16)
        cols = sorted([k for k in keys if k.startswith('colour:')], key=lambda k: lum(k[7:]))
        ink, white = cols[0], cols[-1]
        await pg.screenshot(path=os.path.join(OUT, '02_sticker.png'))

        # 3. click the black linework: pie with the area in focus
        pt = await pg.evaluate(POINT, [ink, 0.35])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(600)
        print('ink pie:', await pie_items(pg), '| title', await pg.inner_text('.pie-title'))
        await pg.screenshot(path=os.path.join(OUT, '03_ink_pie.png'))
        await pg.click('.pie-item:has-text("Sew as")'); await pg.wait_for_timeout(500)
        print('sew-as ring:', await pie_items(pg))
        await pg.screenshot(path=os.path.join(OUT, '04_sew_as.png'))
        await pg.click('.pie-item:has-text("Lines")')
        await settle(pg)
        st = await pg.evaluate("({edits: __studio.doc.layers[0].edits, parts: __studio.rt(__studio.doc.sel).result.parts.map(p => p.key + (p.sub ? '/' + p.sub : '')), stats: __studio.seq().stats})")
        print('after Lines:', json.dumps(st))
        await pg.screenshot(path=os.path.join(OUT, '05_ink_lines.png'))

        # 4. leave the white border out, by keyboard: open on it, then the number key of "Leave out"
        pt = await pg.evaluate(POINT, [white, 0.5])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        items = await pie_items(pg)
        print('white pie:', items)
        await pg.keyboard.press(str(items.index('Leave out') + 1))
        await settle(pg)
        r = await pg.evaluate("({ghosts: (__studio.rt(__studio.doc.sel).result.ghosts || []).map(g => g.key), stats: __studio.seq().stats})")
        print('after Leave out:', json.dumps(r))
        await pg.screenshot(path=os.path.join(OUT, '06_white_left_out.png'))
        # click its ghost outline: Sew it is offered
        pt = await pg.evaluate(POINT, ['ghost', 0.3])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        print('ghost pie:', await pie_items(pg))
        await pg.screenshot(path=os.path.join(OUT, '07_ghost_pie.png'))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)

        # 5. sew order and merge on the pink body
        body = max([k for k in keys if k.startswith('colour:')], key=lambda k: sum(1 for _ in [0]) and len(k))  # placeholder
        body = await pg.evaluate("(() => { const r = __studio.rt(__studio.doc.sel).result; return r.parts.filter(p => p.kind === 'fill').sort((a, b) => b.chords.length - a.chords.length)[0].key; })()")
        pt = await pg.evaluate(POINT, [body, 0.5])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        await pg.click('.pie-item:has-text("Sew order")'); await pg.wait_for_timeout(400)
        print('order ring:', await pie_items(pg), '|', await pg.inner_text('.pie-title'))
        await pg.screenshot(path=os.path.join(OUT, '08_order.png'))
        await pg.click('.pie-item:has-text("First")'); await settle(pg)
        print('order now:', await pg.evaluate("__studio.doc.layers[0].order"))
        pt = await pg.evaluate(POINT, [body, 0.5])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        await pg.click('.pie-item:has-text("Merge into")'); await pg.wait_for_timeout(1200)
        print('merge ring:', await pie_items(pg))
        await pg.screenshot(path=os.path.join(OUT, '09_merge.png'))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        print('Esc goes back, pie still open:', await pg.evaluate("!!document.querySelector('.pie')"), await pie_items(pg))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)

        # 6. direction from the pie
        pt = await pg.evaluate(POINT, [body, 0.6])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        await pg.click('.pie-item:has-text("Direction")'); await pg.wait_for_timeout(400)
        print('direction ring:', await pie_items(pg))
        await pg.screenshot(path=os.path.join(OUT, '10_direction.png'))
        await pg.click('.pie-item:has-text("90°")'); await settle(pg)
        print('dirs:', await pg.evaluate("__studio.doc.layers[0].dirs"))

        # 7. sticker edge from the empty part of the layer box (right-click), then make it a bean line
        L = await pg.evaluate("(() => { const L = __studio.doc.layers[0], r = __studio.rt(L.id).result; return [L.tf.x, L.tf.y, r.size.w, r.size.h]; })()")
        corner = await pg.evaluate("(p) => __studio.screen(p[0] + p[2] / 2 - 1.5, p[1] + p[3] / 2 - 1.5)", L)
        await pg.mouse.click(corner[0], corner[1], button='right'); await pg.wait_for_timeout(500)
        print('layer pie:', await pie_items(pg))
        await pg.screenshot(path=os.path.join(OUT, '11_layer_pie.png'))
        await pg.click('.pie-item:has-text("Sticker edge")'); await settle(pg)
        pt = await pg.evaluate(POINT, ['stroke', 0.2])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(500)
        print('edge pie:', await pie_items(pg), '|', await pg.inner_text('.pie-title'))
        await pg.click('.pie-item:has-text("Sew as")'); await pg.wait_for_timeout(300)
        await pg.click('.pie-item:has-text("Bean line")'); await settle(pg)
        await pg.screenshot(path=os.path.join(OUT, '12_bean_edge.png'))

        # 8. undo walks back through the edits; the panel lists them
        print('panel badges:', await pg.evaluate("[...document.querySelectorAll('#recolorBox .areabadge')].map(b => b.textContent)"))
        await pg.locator('#recolorBox').scroll_into_view_if_needed(); await pg.locator('#recolorBox').screenshot(path=os.path.join(OUT, '13_panel.png'))
        for i in range(3): await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(250)
        await settle(pg)
        print('after 3 undos: edge', await pg.evaluate("__studio.doc.layers[0].fx.stroke.on"), 'dirs', await pg.evaluate("__studio.doc.layers[0].dirs.length"))

        # 9. dark theme look
        await pg.emulate_media(color_scheme='dark'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.documentElement.dataset.theme = 'dark'"); await pg.wait_for_timeout(300)
        pt = await pg.evaluate(POINT, [ink, 0.35])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(OUT, '14_dark_pie.png'))
        await pg.keyboard.press('Escape')

        # 9b. phone width: two columns under the hub
        await pg.set_viewport_size({'width': 390, 'height': 844}); await pg.wait_for_timeout(800)
        await pg.evaluate("document.querySelector('#view').scrollIntoView()"); await pg.wait_for_timeout(300)
        pt = await pg.evaluate(POINT, [body, 0.5])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=os.path.join(OUT, '15_phone_pie.png'))
        await pg.keyboard.press('Escape')
        await pg.set_viewport_size({'width': 1440, 'height': 900})

        # 10. project round trip keeps the edits
        rt = await pg.evaluate("(async () => { const b = await __studio.encodeProject(); const d = await __studio.decodeProject(b); return d.doc.layers[0].edits; })()")
        print('round trip edits:', json.dumps(rt))
        print('\n'.join(logs) or 'no console errors')
        await b.close()
    srv.shutdown()

asyncio.run(main())
