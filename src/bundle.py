import re, pathlib, sys
src = pathlib.Path(__file__).parent / 'src'
out = pathlib.Path(sys.argv[1])
html = (src / 'index.html').read_text(encoding='utf-8')
css = (src / 'styles.css').read_text(encoding='utf-8')
names = re.findall(r'<script src="([^"]+)"></script>', html)
js = '\n'.join((src / n).read_text(encoding='utf-8') for n in names)
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
html = re.sub(r'(<script src="[^"]+"></script>\n)+<script>boot\(\);</script>', lambda m: '<script>\n' + js + '\nboot();\n</script>', html)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
(src.parent / '_check.js').write_text(js + '\nboot;', encoding='utf-8')
print('ok', out, len(html))
