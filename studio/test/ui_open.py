"""Opening embroidery files: a zip of designs, the design chooser, the stitch-file layer, the pie on it, export.
Usage: python3 test/ui_open.py  (puts the zip from test/emb_files/ through the app; not in the repo)"""
import asyncio, os, json, http.server, threading, functools, glob
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'test', 'out', 'open'); os.makedirs(OUT, exist_ok=True)
PORT = 8773
READY = "window.__studio && !window.__studio.stale() && window.__studio.seq() !== undefined"
ZIP = glob.glob(os.path.join(ROOT, 'test', 'emb_files', '*.zip'))[0]
SAMPLES = '/home/claude/samples_src/samples'

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, 'dist', 'test')); h.log_message = lambda *a: None
    s = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h); threading.Thread(target=s.serve_forever, daemon=True).start(); return s
async def settle(pg, t=120000):
    await pg.wait_for_function(READY, timeout=t); await pg.wait_for_timeout(500)
POINT = """([key, pick]) => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel), r = __studio.rt(L.id).result;
  let cs = []; r.parts.filter(p => p.key === key).forEach(p => cs = cs.concat(p.chords)); const c = cs[Math.floor(cs.length * pick)];
  return __studio.screen(L.tf.x + (c[0] + c[2]) / 2, L.tf.y + (c[1] + c[3]) / 2); }"""
async def items(pg): return await pg.evaluate("[...document.querySelectorAll('.pie .pie-item')].map(b => b.textContent.replace(/\\d$/, '').trim())")
async def toast(pg): return await pg.evaluate("document.querySelector('#toast').hidden ? '' : document.querySelector('#toast').textContent")

async def main():
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, color_scheme='dark')
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        await pg.goto('http://127.0.0.1:%d/index.html' % PORT); await settle(pg)
        await pg.evaluate("__studio.doc.sel = __studio.doc.layers[0].id"); await pg.keyboard.press('Delete'); await pg.wait_for_timeout(300)

        # 1. a zip with many designs: the chooser
        await pg.set_input_files('#fileInput', ZIP); await pg.wait_for_selector('.designpop', timeout=60000); await pg.wait_for_timeout(500)
        rows = await pg.evaluate("[...document.querySelectorAll('.designrow')].map(r => r.textContent)")
        print('chooser:', len(rows), 'designs'); [print('  ', r) for r in rows]
        await pg.screenshot(path=os.path.join(OUT, '01_chooser.png'))
        await pg.click('.designrow:has-text("AEthelmearc 4in Kingdom Arms")'); await pg.wait_for_timeout(300)
        print('toast:', await toast(pg))
        await pg.click('.designpop [data-close]'); await settle(pg)
        L = await pg.evaluate("(() => { const L = __studio.doc.layers[0], r = __studio.rt(L.id).result; return { type: L.type, name: L.name, size: r.size, parts: r.parts.length, st: r.stitchCount, seq: __studio.seq().stats, fit: __studio.fit().text }; })()")
        print('layer:', json.dumps(L))
        await pg.click('.viewbar [data-view=top]'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=os.path.join(OUT, '02_opened_top.png'))

        # 2. the pie on one colour: no Sew as / Direction / Merge / edge
        keys = await pg.evaluate("__studio.rt(__studio.doc.sel).result.parts.map(p => p.key)")
        pt = await pg.evaluate(POINT, [keys[1], 0.5])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(1200)
        print('pie:', await items(pg), '|', await pg.inner_text('.pie-title'))
        await pg.screenshot(path=os.path.join(OUT, '03_pie.png'))
        await pg.click('.pie-item:has-text("Leave out")'); await settle(pg)
        r = await pg.evaluate("(() => { const r = __studio.rt(__studio.doc.sel).result; return { parts: r.parts.length, ghosts: r.ghosts.length, st: __studio.seq().stats.stitches }; })()")
        print('after leave out:', json.dumps(r))
        await pg.screenshot(path=os.path.join(OUT, '04_left_out.png'))
        # bring it back from the panel's eye button
        await pg.locator('[data-block-skip]').first.scroll_into_view_if_needed()
        await pg.click('[data-block-skip][aria-pressed="false"]'); await settle(pg)
        print('back:', await pg.evaluate("__studio.rt(__studio.doc.sel).result.parts.length"))
        await pg.locator('#panelBody .blocklist').screenshot(path=os.path.join(OUT, '05_blocklist.png'))
        # sew order: last colour first
        pt = await pg.evaluate(POINT, [keys[-1], 0.5])
        await pg.mouse.click(pt[0], pt[1]); await pg.wait_for_timeout(1000)
        await pg.click('.pie-item:has-text("Sew order")'); await pg.wait_for_timeout(600)
        await pg.click('.pie-item:has-text("First")'); await settle(pg)
        print('order:', await pg.evaluate("__studio.doc.layers[0].order.slice(0, 3)"), 'first part', await pg.evaluate("__studio.rt(__studio.doc.sel).result.parts[0].key"))

        # 3. resize: clamped to 115%
        await pg.evaluate("(() => { const el = document.querySelector('[data-k=\"L.p.scale\"]'); el.value = 115; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()")
        await settle(pg)
        print('scaled 115%:', await pg.evaluate("__studio.rt(__studio.doc.sel).result.size"))
        await pg.click('[data-scale="fit"]') if await pg.locator('[data-scale="fit"]').count() else None
        await pg.wait_for_timeout(400); print('fit toast:', await toast(pg)); await settle(pg)
        print('scale now', await pg.evaluate("__studio.doc.layers[0].p.scale"))

        # 4. add text, export: the file's stitches are all there
        await pg.click('[data-act="add-text"]'); await pg.keyboard.type('Aethelmearc'); await settle(pg)
        await pg.evaluate("(() => { const L = __studio.doc.layers[1]; L.tf.y = -62; })()"); await pg.keyboard.press('Escape')
        st = await pg.evaluate("__studio.seq().stats"); print('with text:', json.dumps(st))
        files = await pg.evaluate("Object.keys(__studio.makeFiles() || {})"); print('export files:', files)

        # 5. project round trip keeps the file
        rt = await pg.evaluate("(async () => { const b = await __studio.encodeProject(); const d = await __studio.decodeProject(b); return { kb: Math.round(b.length / 1024), layers: d.doc.layers.map(l => l.type), sources: Object.values(d.sources).map(s => s.kind + ':' + s.name) }; })()")
        print('project:', json.dumps(rt))

        # 6. single files: a DST without colours, an EMB, a VP3
        await pg.set_input_files('#fileInput', os.path.join(SAMPLES, 'random3-ew.DST.dst')); await pg.wait_for_timeout(1500); print('dst toast:', await toast(pg))
        await pg.set_input_files('#fileInput', os.path.join(SAMPLES, 'random1-wilcom-e1.EMB')) if os.path.exists(os.path.join(SAMPLES, 'random1-wilcom-e1.EMB')) else None
        await pg.wait_for_timeout(800); print('emb toast:', await toast(pg))
        await pg.screenshot(path=os.path.join(OUT, '06_final.png'))
        print('\n'.join(l for l in logs if 'favicon' not in l and '404' not in l) or 'no console errors')
        await b.close()
    srv.shutdown()
asyncio.run(main())
