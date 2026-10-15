#!/usr/bin/env python3
"""Assemble Fembroider:
  dist/artifact.html      single file for the claude.ai artifact (three.js from cdnjs)
  dist/test/index.html    same page with a local three.js, for headless tests
  ../desktop/app/         Electron renderer files (separate scripts, strict CSP)
"""
import json, os, shutil, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
DESK = os.path.join(ROOT, '..', 'desktop', 'app')

def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()

template = read('index.html')
assets, engine, export, svgsize, machines = read('assets.gen.js'), read('engine.js'), read('export.js'), read('svgsize.js'), read('machines.js')
app = '(STUDIO_ASSETS.ready || Promise.resolve()).then(function () {\n' + '\n'.join(read(n) for n in ['app_core.js', 'app_threads.js', 'app_scene.js', 'app_direction.js', 'app_tips.js', 'app_ui.js', 'app_export.js', 'app_project.js', 'app_boot.js']) + '\n});\n'
engine_source = 'var ENGINE_SOURCE = ' + json.dumps(engine).replace('</', '<\\/') + ';\n'

def safe(js):
    # nothing inside an inline <script> may close it
    return re.sub(r'</(script)', r'<\\/\1', js, flags=re.I)

inline = '\n'.join(safe(x) for x in [assets, engine, export, machines, svgsize, engine_source, app])
CDN = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'

os.makedirs(os.path.join(DIST, 'test'), exist_ok=True)
with open(os.path.join(DIST, 'artifact.html'), 'w', encoding='utf-8') as f:
    f.write(template.replace('<!--SCRIPTS-->', CDN + '\n<script>\n' + inline + '\n</script>'))
shutil.copy(os.path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js'), os.path.join(DIST, 'test', 'three.min.js'))
with open(os.path.join(DIST, 'test', 'index.html'), 'w', encoding='utf-8') as f:
    f.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' +
            template.replace('<!--SCRIPTS-->', '<script src="three.min.js"></script>\n<script>\n' + inline + '\n</script>') + '</body></html>')

# ---- desktop renderer ----
if os.path.isdir(os.path.dirname(DESK)):
    keep = {'icon.png'}
    if os.path.isdir(DESK):
        for n in os.listdir(DESK):
            p = os.path.join(DESK, n)
            if n in keep: continue
            shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    else:
        os.makedirs(DESK)
    files = {'assets.js': assets, 'engine.js': engine, 'export.js': export, 'machines.js': machines, 'svgsize.js': svgsize, 'engine_source.js': engine_source, 'app.js': app}
    for n, s in files.items():
        with open(os.path.join(DESK, n), 'w', encoding='utf-8') as f: f.write(s)
    shutil.copy(os.path.join(ROOT, 'node_modules', 'three', 'build', 'three.min.js'), os.path.join(DESK, 'three.min.js'))
    csp = ("default-src 'none'; script-src 'self'; worker-src blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; "
           "img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
    scripts = ''.join('<script src="%s"></script>\n' % n for n in ['three.min.js', 'assets.js', 'engine.js', 'export.js', 'machines.js', 'svgsize.js', 'engine_source.js', 'app.js'])
    page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<meta http-equiv="Content-Security-Policy" content="%s">\n</head>\n<body>\n' % csp) + template.replace('<!--SCRIPTS-->', scripts) + '</body>\n</html>\n'
    with open(os.path.join(DESK, 'index.html'), 'w', encoding='utf-8') as f: f.write(page)

for p in ['artifact.html', 'test/index.html']:
    print(p, os.path.getsize(os.path.join(DIST, p)) // 1024, 'KB')
