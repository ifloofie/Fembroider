"""Headless UI flows for Stitch Studio. Usage: python3 test/ui.py [flow ...]  (default: all)"""
import asyncio, sys, os, json, http.server, threading, functools
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'test', 'out', 'ui')
os.makedirs(OUT, exist_ok=True)
PORT = 8766

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.join(ROOT, 'dist', 'test'))
    h.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

READY = "window.__studio && !window.__studio.stale() && window.__studio.seq() !== undefined"

async def settle(pg, t=120000):
    await pg.wait_for_function(READY, timeout=t)
    await pg.wait_for_timeout(500)

async def main(flows):
    srv = serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
            args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True, color_scheme='light')
        pg = await ctx.new_page()
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR: ' + str(e)))
        await pg.goto('http://127.0.0.1:%d/index.html' % PORT)
        await settle(pg)
        info = await pg.evaluate("({layers: __studio.doc.layers.length, st: __studio.seq() && __studio.seq().stats, fit: __studio.fit().text, worker: document.querySelector('#panelBody') !== null})")
        print('boot', json.dumps(info))
        await pg.screenshot(path=os.path.join(OUT, '01_design_light.png'))

        if 'all' in flows or 'theme' in flows:
            await pg.click('.themeseg [data-theme=dark]')
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=os.path.join(OUT, '02_design_dark.png'))
            await pg.click('.themeseg [data-theme=light]')

        if 'all' in flows or 'direction' in flows:
            await pg.click('[data-act="add-emoji"]')
            await pg.click('.egrid [data-code="1f621"]')
            await settle(pg)
            await pg.click('.viewbar [data-view=top]'); await pg.wait_for_timeout(700)
            await pg.keyboard.press('d'); await pg.wait_for_timeout(900)
            L = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return [L.tf.x, L.tf.y]; })()")
            pa = await pg.evaluate("(p) => __studio.screen(p[0] + 12, p[1] - 12)", L)
            pb = await pg.evaluate("(p) => __studio.screen(p[0] + 18, p[1] - 6)", L)
            await pg.mouse.move(pa[0], pa[1]); await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(OUT, 'd_hover.png'))
            print('hover tip', await pg.evaluate("document.getElementById('tipbox').hidden ? null : document.getElementById('tipbox').textContent"))
            await pg.mouse.down(); await pg.mouse.move(pb[0], pb[1], steps=8); await pg.mouse.up()
            print('right after drag', await pg.evaluate("JSON.stringify({dirs: __studio.doc.layers.find(l => l.id === __studio.doc.sel).dirs, toast: document.getElementById('toast').textContent, tool: __studio.ui.tool, sel: __studio.doc.layers.find(l => l.id === __studio.doc.sel).name})"))
            await settle(pg)
            print('dirs', await pg.evaluate("JSON.stringify(__studio.doc.layers.find(l => l.id === __studio.doc.sel).dirs)"))
            print('report', await pg.evaluate("JSON.stringify(__studio.rt(__studio.doc.sel).result.parts.filter(p => p.report).map(p => p.report.map(r => r.method + '@' + r.angle)))"))
            print('seq', await pg.evaluate("JSON.stringify(__studio.seq().stats)"))
            await pg.screenshot(path=os.path.join(OUT, 'd_set.png'))
            await pg.click('#tab-stitch'); await pg.wait_for_timeout(300)
            await pg.hover('[data-k="doc.stitch.tatamiSpacing"]'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(OUT, 'd_tooltip.png'))
            print('tooltip', await pg.evaluate("document.getElementById('tipbox').textContent"))
            await pg.click('#tab-design'); await pg.keyboard.press('v')
            await pg.click('#panelBody [data-act="delete"]'); await settle(pg)   # leave the design as the later flows expect
            await pg.click('.viewbar [data-view="3d"]'); await pg.wait_for_timeout(500)

        if 'all' in flows or 'threads' in flows:
            await pg.click('#tab-stitch'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, 't_default.png'))
            await pg.select_option('[data-k="doc.threads.line"]', 'madeira-rayon')
            await pg.click('#panelBody [data-set="doc.threads.weight"][data-v="30"]')
            await pg.select_option('[data-k="doc.threads.needle"]', '65/9')
            await pg.wait_for_timeout(300)
            print('notes 30wt/65-9', await pg.evaluate("[...document.querySelectorAll('.tnotes li')].map(l => l.className + ': ' + l.textContent)"))
            await pg.select_option('[data-k="doc.threads.fabric"]', 'knit')
            await pg.wait_for_timeout(300)
            await pg.click('[data-act="use-rec-needle"]')
            await settle(pg)
            print('eff knit 30wt', await pg.evaluate("JSON.stringify((({R, ...e}) => e)(__studio.eff()))"))
            await pg.screenshot(path=os.path.join(OUT, 't_madeira_knit.png'))
            await pg.evaluate("document.querySelector('[data-sec=density]').scrollIntoView()")
            await pg.screenshot(path=os.path.join(OUT, 't_density.png'))
            await pg.fill('[data-k="doc.stitch.tatamiSpacing"]', '0.6'); await pg.dispatch_event('[data-k="doc.stitch.tatamiSpacing"]', 'input'); await pg.dispatch_event('[data-k="doc.stitch.tatamiSpacing"]', 'change')
            await settle(pg)
            print('custom spacing', await pg.evaluate("__studio.spec().tatamiSpacingMM"), await pg.get_attribute('[data-auto="tatamiSpacing"]', 'aria-pressed'))
            await pg.click('[data-auto="tatamiSpacing"]'); await settle(pg)
            print('back to auto', await pg.evaluate("__studio.spec().tatamiSpacingMM"))
            # Experimental: satin fill is off and folded away by default
            print('experimental', await pg.evaluate("JSON.stringify({open: document.querySelector('[data-sec=experimental]').open, satin: __studio.spec().satinFill, ctl: !!document.querySelector('[data-k=\"doc.stitch.spacing\"]')})"))
            await pg.click('[data-sec=experimental] summary'); await pg.click('[data-sec=experimental] [data-k="doc.stitch.satin"]'); await pg.wait_for_timeout(450); await settle(pg)
            print('satin on', await pg.evaluate("JSON.stringify({satin: __studio.spec().satinFill, ctl: !!document.querySelector('[data-k=\"doc.stitch.spacing\"]'), methods: __studio.rt(__studio.doc.sel).result.parts.filter(p => p.report).map(p => p.report.map(r => r.method).join(','))})"))
            await pg.click('[data-sec=experimental] [data-k="doc.stitch.satin"]'); await pg.wait_for_timeout(450); await settle(pg)
            print('satin off', await pg.evaluate("JSON.stringify(__studio.rt(__studio.doc.sel).result.parts.filter(p => p.report).map(p => p.report.map(r => r.method).join(',')))"))
            await pg.screenshot(path=os.path.join(OUT, 't_stitchpanel.png'))
            print(await pg.evaluate("__studio.worksheet().split('MATERIALS')[1].split('COLOUR')[0]"))
            await pg.click('#tab-design')
            if await pg.evaluate("__studio.doc.layers.length > 1"):
                await pg.click('#layerList .layer:last-child'); await pg.wait_for_timeout(300)
            await pg.click('#panelBody [data-color="L.colors.fill"]')
            await pg.fill('#tpSearch', 'red'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=os.path.join(OUT, 't_picker_madeira.png'))
            await pg.keyboard.press('Escape')

        if 'all' in flows or 'pickers' in flows:
            if await pg.evaluate("__studio.doc.layers.length > 1"):
                await pg.click('#layerList .layer:last-child'); await pg.wait_for_timeout(300)
            await pg.click('#panelBody [data-color="L.colors.fill"]')
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, '02b_thread_picker.png'))
            await pg.click('.threadpop .tgrid [data-hex]:nth-child(40)')
            await pg.wait_for_timeout(200)
            print('picked fill', await pg.evaluate("__studio.doc.layers[0].colors.fill"))
            await pg.keyboard.press('Escape')
            await pg.keyboard.press('Control+z')
            await pg.click('[data-act="add-emoji"]')
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=os.path.join(OUT, '02c_emoji_picker.png'))
            await pg.keyboard.press('Escape')

        if 'all' in flows or 'pride' in flows:
            await pg.click('#panelBody [data-set="ui.themeGroup"][data-v="Pride"]')
            for flag, way in [('Transgender', None), ('Pansexual', 'Blue'), ('Omnisexual', None), ('Aromantic', None), ('Asexual', 'Ace of spades'), ('Progress', None), ('Bisexual', 'Stripes')]:
                await pg.click('.flagcard[data-v="%s"]' % flag)
                if way: await pg.click('.theme[data-v="%s · %s"]' % (flag, way))
                await settle(pg)
                info = await pg.evaluate("JSON.stringify({theme: __studio.doc.theme, parts: __studio.rt(__studio.doc.sel).result.parts.map(p => p.role + (p.band !== undefined ? p.band : '')).join(' '), threads: __studio.seq().threads.map(t => t.thread.name).join(', ')})")
                print('pride', info)
                await pg.screenshot(path=os.path.join(OUT, 'p_%s.png' % flag.lower()))
            await pg.click('.themeseg [data-theme=dark]')
            await pg.click('.flagcard[data-v="Rainbow"]'); await pg.click('.theme[data-v="Rainbow · Night stripes"]')
            await settle(pg)
            await pg.screenshot(path=os.path.join(OUT, 'p_rainbow_night_dark.png'))
            await pg.click('.themeseg [data-theme=light]')

        if 'all' in flows or 'gradient' in flows:
            await pg.click('#panelBody [data-set="L.fx.stripes.mode"][data-v="gradient"]')
            await settle(pg)
            await pg.screenshot(path=os.path.join(OUT, 'g_rainbow.png'))
            print('gradient', await pg.evaluate("JSON.stringify({parts: __studio.rt(__studio.doc.sel).result.parts.map(p => p.role + (p.band ?? '') + ':' + p.chords.length).join(' '), st: __studio.seq().stats})"))
            await pg.click('#panelBody [data-set="L.fx.stripes.dir"][data-v="v"]')
            await pg.select_option('#panelBody [data-k="L.thread"]', 'metallic')
            await settle(pg)
            await pg.click('.viewbar [data-view=top]'); await pg.wait_for_timeout(700)
            await pg.screenshot(path=os.path.join(OUT, 'g_vertical_metallic_top.png'))
            await pg.click('.viewbar [data-view="3d"]'); await pg.wait_for_timeout(500)

        if 'all' in flows or 'bake' in flows:
            await pg.click('#tab-export'); await settle(pg)
            await pg.click('#panelBody [data-set="ui.bake.res"][data-v="1024"]')
            async with pg.expect_download(timeout=120000) as dl:
                await pg.click('#panelBody [data-act="bake"]')
            d = await dl.value
            path = os.path.join(OUT, d.suggested_filename); await d.save_as(path)
            print('bake download', d.suggested_filename, os.path.getsize(path))
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(OUT, 'b_export_bake.png'))
            await pg.click('#panelBody [data-set="ui.bake.bg"][data-v="fabric"]')
            async with pg.expect_download(timeout=120000) as dl:
                await pg.click('#panelBody [data-act="bake"]')
            d = await dl.value
            path = os.path.join(OUT, 'fabric_' + d.suggested_filename); await d.save_as(path)
            print('bake fabric', os.path.getsize(path))
            await pg.click('#tab-design')

        if 'all' in flows or 'text' in flows:
            # edit the text, change font, add effects
            await pg.fill('[data-k="L.p.text"]', 'Floof')
            await pg.click('.fontcard[data-v="Lobster"]')
            await pg.check('[data-k="L.fx.stroke2.on"]')
            await pg.check('[data-k="L.fx.shadow.on"]')
            await settle(pg)
            await pg.click('#panelBody [data-set="ui.themeGroup"][data-v="Classic"]')
            await pg.click('.theme[data-v="Halloween"]')
            await settle(pg)
            await pg.screenshot(path=os.path.join(OUT, '03_text_effects.png'))
            print('text', await pg.evaluate("JSON.stringify({parts: __studio.rt(__studio.doc.sel).result.parts.map(p => p.role + ':' + p.chords.length), stats: __studio.seq().stats})"))

        if 'all' in flows or 'emoji' in flows:
            await pg.click('[data-act="add-emoji"]')
            await pg.click('.egrid [data-code="1f60e"]')
            await settle(pg)
            # move it with the numeric fields
            await pg.fill('#toolpanel [data-k="L.tf.x"]', '38'); await pg.press('#toolpanel [data-k="L.tf.x"]', 'Enter')
            await pg.fill('#toolpanel [data-k="L.tf.y"]', '30'); await pg.press('#toolpanel [data-k="L.tf.y"]', 'Enter')
            await settle(pg)
            await pg.screenshot(path=os.path.join(OUT, '04_emoji.png'))
            print('emoji', await pg.evaluate("JSON.stringify(__studio.doc.layers.map(L => [L.type, L.name, L.tf.x, L.tf.y]))"), await pg.inner_text('#fitChip'))

        if 'all' in flows or 'import' in flows:
            await pg.set_input_files('#fileInput', os.path.join(ROOT, 'test', 'sample_logo.svg'))
            await settle(pg)
            await pg.fill('#toolpanel [data-k="L.tf.x"]', '-38'); await pg.press('#toolpanel [data-k="L.tf.x"]', 'Enter')
            await pg.fill('#toolpanel [data-k="L.tf.y"]', '30'); await pg.press('#toolpanel [data-k="L.tf.y"]', 'Enter')
            await settle(pg)
            await pg.screenshot(path=os.path.join(OUT, '05_import.png'))
            print('import', await pg.evaluate("JSON.stringify(__studio.rt(__studio.doc.sel).result.parts.map(p => p.role + ' ' + p.color + ' ' + p.chords.length))"))

        if 'all' in flows or 'transform' in flows:
            await pg.keyboard.press('Escape')
            await pg.click('#layerList .layer:last-child')  # bottom of list = first sewn = the text
            await pg.keyboard.press('r')
            await pg.fill('#toolpanel [data-k="L.tf.rot"]', '-8'); await pg.press('#toolpanel [data-k="L.tf.rot"]', 'Enter')
            await pg.keyboard.press('s')
            await pg.click('#toolpanel [data-scale="0.9"]')
            await settle(pg)
            await pg.keyboard.press('m')
            await pg.screenshot(path=os.path.join(OUT, '06_transform.png'))
            before = await pg.evaluate("JSON.stringify(__studio.doc.layers.map(L => [L.tf.rot, L.p.width || L.p.size]))")
            await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z')
            await settle(pg)
            after = await pg.evaluate("JSON.stringify(__studio.doc.layers.map(L => [L.tf.rot, L.p.width || L.p.size]))")
            await pg.keyboard.press('Control+Shift+z'); await pg.keyboard.press('Control+Shift+z')
            await settle(pg)
            redo = await pg.evaluate("JSON.stringify(__studio.doc.layers.map(L => [L.tf.rot, L.p.width || L.p.size]))")
            print('undo', before, '->', after, '-> redo', redo)
            # reorder: raise the text above the emoji
            await pg.click('[data-act="raise"]')
            print('order', await pg.evaluate("JSON.stringify(__studio.doc.layers.map(L => L.type))"))
            await pg.keyboard.press('v')

        if 'all' in flows or 'drag' in flows:
            # move-drag the selected layer, then scale it with a corner handle
            await pg.click('.viewbar [data-view=top]'); await pg.wait_for_timeout(700)
            await pg.keyboard.press('v')
            t0 = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return [L.name, L.tf.x, L.tf.y]; })()")
            c = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return __studio.screen(L.tf.x, L.tf.y); })()")
            await pg.mouse.move(c[0], c[1]); await pg.mouse.down(); await pg.mouse.move(c[0] + 40, c[1] + 25, steps=6); await pg.mouse.up()
            t1 = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return [L.name, L.tf.x, L.tf.y]; })()")
            print('drag move', t0, '->', t1)
            await pg.keyboard.press('s'); await pg.wait_for_timeout(200)
            w0 = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return L.p.width || L.p.size; })()")
            k = await pg.evaluate("__studio.corners()[1]")
            sc = await pg.evaluate("(k) => __studio.screen(k[0], k[1])", k)
            ctr = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return __studio.screen(L.tf.x, L.tf.y); })()")
            await pg.mouse.move(sc[0], sc[1]); await pg.mouse.down()
            await pg.mouse.move(ctr[0] + (sc[0] - ctr[0]) * 0.85, ctr[1] + (sc[1] - ctr[1]) * 0.85, steps=6); await pg.mouse.up()
            await settle(pg)
            w1 = await pg.evaluate("(() => { const L = __studio.doc.layers.find(l => l.id === __studio.doc.sel); return L.p.width || L.p.size; })()")
            print('drag scale', w0, '->', w1)
            await pg.screenshot(path=os.path.join(OUT, '06b_top_scale.png'))
            await pg.keyboard.press('r'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, '06c_rotate_gizmo.png'))
            await pg.keyboard.press('v')
            await pg.click('.viewbar [data-view="3d"]'); await pg.wait_for_timeout(700)

        if 'all' in flows or 'stitch' in flows:
            await pg.click('#tab-stitch')
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=os.path.join(OUT, '07_stitch.png'))
            await pg.fill('#sewSlider', '450'); await pg.dispatch_event('#sewSlider', 'input')
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, '08_sewout.png'))
            print('sew', await pg.inner_text('#sewVal'))
            await pg.evaluate("document.querySelector('[data-sec=perf]').open = true"); await pg.wait_for_timeout(100)
            await pg.click('#panelBody [data-set="ui.copies"][data-v="4"]')
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(OUT, '09_copies.png'))
            await pg.click('#panelBody [data-set="ui.copies"][data-v="1"]')

        if 'all' in flows or 'export' in flows:
            await pg.click('#tab-design')
            await pg.click('#panelBody [data-set="doc.hoop"][data-v="B"]')
            await pg.click('#panelBody [data-act="centre-all"]')
            await pg.wait_for_timeout(300)
            await pg.click('#tab-export')
            await settle(pg)
            await pg.fill('[data-k="doc.cardName"]', 'floof22')
            await pg.press('[data-k="doc.cardName"]', 'Enter')
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.path.join(OUT, '10_export.png'))
            print('export fit', await pg.inner_text('#fitChip'), '| action', await pg.inner_text('#estMain'), '/', await pg.inner_text('#estSub'))
            async with pg.expect_download(timeout=60000) as dl:
                await pg.click('#actionBtn')
            d = await dl.value
            path = os.path.join(OUT, d.suggested_filename)
            await d.save_as(path)
            print('download', d.suggested_filename, os.path.getsize(path))
            await pg.click('.themeseg [data-theme=dark]')
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=os.path.join(OUT, '11_export_dark.png'))

        if 'all' in flows or 'mobile' in flows:
            await pg.set_viewport_size({'width': 390, 'height': 844})
            await pg.click('#tab-design')
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(OUT, '12_mobile.png'), full_page=False)
            sw = await pg.evaluate("document.documentElement.scrollWidth")
            print('mobile scrollWidth', sw)

        for l in logs[-25:]: print('LOG', l)
        await b.close()
    srv.shutdown()

asyncio.run(main(sys.argv[1:] or ['all']))
