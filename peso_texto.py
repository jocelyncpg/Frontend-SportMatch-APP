#!/usr/bin/env python3
"""Agrega fontWeight: '400' a todo estilo con fontSize que no tenga peso.

Uso (desde la carpeta del proyecto):
  python3 peso_texto.py            # solo muestra qué cambiaría
  python3 peso_texto.py --aplicar  # modifica los archivos
"""
import os, re, sys

APLICAR = '--aplicar' in sys.argv
CARPETAS = ['app', 'components']
PAT = re.compile(r'fontSize:\s*[\d.]+')

def bloque(s, pos):
    """Devuelve (inicio, fin) del objeto { ... } más interno que contiene pos."""
    prof = 0
    i = pos
    while i >= 0:
        c = s[i]
        if c == '}':
            prof += 1
        elif c == '{':
            if prof == 0:
                break
            prof -= 1
        i -= 1
    ini = i
    prof = 0
    j = ini
    while j < len(s):
        c = s[j]
        if c == '{':
            prof += 1
        elif c == '}':
            prof -= 1
            if prof == 0:
                return ini, j
        j += 1
    return ini, len(s)

total = 0
archivos = 0
for base in CARPETAS:
    for raiz, _, fs in os.walk(base):
        for f in fs:
            if not f.endswith('.tsx'):
                continue
            ruta = os.path.join(raiz, f)
            s = open(ruta, encoding='utf-8').read()
            cambios = []
            for m in PAT.finditer(s):
                ini, fin = bloque(s, m.start())
                texto = s[ini:fin]
                if 'fontWeight' in texto or '...' in texto:
                    continue
                cambios.append(m.end())
            if not cambios:
                continue
            for pos in sorted(set(cambios), reverse=True):
                s = s[:pos] + ", fontWeight: '400'" + s[pos:]
            total += len(cambios)
            archivos += 1
            print(f'{len(cambios):3d}  {ruta}')
            if APLICAR:
                open(ruta, 'w', encoding='utf-8').write(s)
print(f'\n{total} estilos en {archivos} archivos' + (' (aplicado)' if APLICAR else ' (no se modificó nada; usa --aplicar)'))
