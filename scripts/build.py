#!/usr/bin/env python3
"""
Monta o catálogo Maison Galbano a partir da planilha.

Roda sozinho no GitHub (Actions) a cada hora ou quando você clica em "Run workflow".
Lê a aba Produtos publicada em CSV, trata as fotos da pasta fotos/ e gera o site
na pasta _site/ (página inicial + uma página por perfume, com prévia para WhatsApp).

Teste local:  python scripts/build.py --csv caminho/do/arquivo.csv
"""
import csv, hashlib, io, json, os, re, shutil, sys, unicodedata, urllib.request
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / '_site'
FOTOS = RAIZ / 'fotos'
EXT = ('.jpg', '.jpeg', '.png', '.webp')
OFF = (247, 245, 240)
SELO = (9, 30, 15)

COLUNAS = ['id', 'marca', 'nome', 'concentracao', 'volume', 'categoria', 'perfil', 'familia_olfativa',
           'notas_topo', 'notas_coracao', 'notas_fundo', 'ocasiao', 'descricao_sensorial', 'preco',
           'disponivel', 'destaque', 'imagem', 'preco_decant', 'preco_decant_de']


def sem_acento(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()


def chave(h):
    h = sem_acento(h.strip().lower())
    return re.sub(r'[^a-z0-9]+', '_', h).strip('_')


def slugify(s):
    s = sem_acento(s.lower()).replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def baixar(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'catalogo-maison-galbano'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def ler_planilha(cfg, local):
    if local:
        texto = Path(local).read_text(encoding='utf-8-sig')
    else:
        url = (cfg.get('csv_url') or '').strip()
        reserva = RAIZ / 'modelos' / 'produtos.csv'
        if not url:
            # ainda sem planilha do Google ligada: usa a cópia dos produtos que está no repositório
            if not reserva.exists():
                sys.exit('ERRO: preencha "csv_url" no config.json com o link CSV publicado da planilha.')
            texto = reserva.read_text(encoding='utf-8-sig')
        else:
            texto = baixar(url).decode('utf-8-sig')
    linhas = list(csv.reader(io.StringIO(texto)))
    if not linhas:
        sys.exit('ERRO: a planilha veio vazia.')
    cab = [chave(h) for h in linhas[0]]
    # apóstrofo tipográfico (Collector’s) nos textos
    return [{cab[i]: (r[i] if i < len(r) else '').strip().replace("'", '’') for i in range(len(cab))} for r in linhas[1:]]


def sim(v):
    return sem_acento(str(v)).strip().lower().startswith('s')


def drive_direto(url):
    m = re.search(r'/d/([\w-]{20,})', url) or re.search(r'[?&]id=([\w-]{20,})', url)
    return f'https://drive.google.com/uc?export=download&id={m.group(1)}' if m else url


def achar_foto(pid, sufixo=''):
    alvo = (pid + sufixo).lower()
    if FOTOS.is_dir():
        for f in sorted(FOTOS.iterdir()):
            if f.suffix.lower() in EXT and f.stem.lower() == alvo:
                return f.read_bytes()
    return None


def clarear_fundo(im, limiar=None):
    """Deixa branco puro só o fundo (a área clara ligada às bordas). O frasco não é tocado.
    O limite se ajusta ao tom do fundo da foto (branco ou cinza bem claro)."""
    cinza = im.convert('L')
    w, h = cinza.size
    pontos = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    if limiar is None:
        claros = sorted(cinza.getpixel(p) for p in pontos)
        base = claros[len(claros) // 2]
        if base >= 253:
            return im  # fundo já está branco: não mexe (protege frascos brancos)
        limiar = 246 if base >= 250 else max(228, base - 6)
    bin_ = cinza.point(lambda v: 255 if v >= limiar else 0)
    for xy in pontos:
        if bin_.getpixel(xy) == 255:
            ImageDraw.floodfill(bin_, xy, 128)
    mascara = bin_.point(lambda v: 255 if v == 128 else 0)
    # faixa da borda (6%): tons claros ali são sobra de fundo (cantos cinzas, sombras de recorte)
    bx, by = max(2, int(w * .025)), max(2, int(h * .025))
    borda = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(borda)
    dr.rectangle([0, 0, w, by], fill=255); dr.rectangle([0, h - by, w, h], fill=255)
    dr.rectangle([0, 0, bx, h], fill=255); dr.rectangle([w - bx, 0, w, h], fill=255)
    claro = cinza.point(lambda v: 255 if v >= 170 else 0)
    from PIL import ImageChops
    mascara = ImageChops.lighter(mascara, ImageChops.multiply(borda, claro))
    # cantinhos extremos (3%): restos de recorte
    cx, cy = max(2, int(w * .03)), max(2, int(h * .03))
    canto = Image.new('L', (w, h), 0); dc = ImageDraw.Draw(canto)
    for x0, y0 in ((0, 0), (w - cx, 0), (0, h - cy), (w - cx, h - cy)):
        dc.rectangle([x0, y0, x0 + cx, y0 + cy], fill=255)
    mascara = ImageChops.lighter(mascara, ImageChops.multiply(canto, cinza.point(lambda v: 255 if v >= 110 else 0)))
    branco = Image.new('RGB', im.size, (255, 255, 255))
    return Image.composite(branco, im, mascara)


def abrir(dados):
    im = Image.open(io.BytesIO(dados))
    im = ImageOps.exif_transpose(im)
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        fundo = Image.new('RGB', im.size, (255, 255, 255))
        fundo.paste(im, mask=im.split()[-1])
        im = fundo
    else:
        im = im.convert('RGB')
    # só o fundo quase branco (ligado às bordas) vira branco puro; o frasco não é alterado
    return clarear_fundo(im)


def salvar(im, destino, caixa, q=84):
    im = im.copy()
    im.thumbnail(caixa, Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    im.save(destino, 'JPEG', quality=q, optimize=True, progressive=True)
    return hashlib.md5(destino.read_bytes()).hexdigest()[:8]


def numero(v):
    s = re.sub(r'[^\d.,]', '', str(v or ''))
    if not s:
        return None
    if ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif re.fullmatch(r'\d{1,3}(\.\d{3})+', s):
        s = s.replace('.', '')
    try:
        return float(s)
    except ValueError:
        return None


def com_decant(im, vial):
    # o frasco um pouco menor, à esquerda, e o decant de 5 ml ao lado
    W, H = im.size
    fundo = im.getpixel((2, 2))
    b = im.resize((int(W * .86), int(H * .86)), Image.LANCZOS)
    tela = Image.new('RGB', (W, H), fundo)
    tela.paste(b, (int(W * .02), int(H * .08)))
    vh = int(H * .42)
    v = vial.resize((int(vial.width * vh / vial.height), vh), Image.LANCZOS)
    tela.paste(v, (W - v.width - int(W * .05), H - vh - int(H * .06)), v)
    return tela


def og(im, destino, fundo=OFF):
    tela = Image.new('RGB', (1200, 630), fundo)
    f = im.copy()
    f.thumbnail((1000, 540), Image.LANCZOS)
    if fundo == OFF:  # o branco da foto some no off-white
        from PIL import ImageChops
        base = Image.new('RGB', f.size, fundo)
        f = ImageChops.multiply(f, base)
    tela.paste(f, ((1200 - f.width) // 2, (630 - f.height) // 2))
    destino.parent.mkdir(parents=True, exist_ok=True)
    tela.save(destino, 'JPEG', quality=86, optimize=True)


def main():
    local = sys.argv[sys.argv.index('--csv') + 1] if '--csv' in sys.argv else None
    cfg = json.loads((RAIZ / 'config.json').read_text(encoding='utf-8'))
    site = (cfg.get('site_url') or '').rstrip('/') + '/'

    linhas = ler_planilha(cfg, local)
    if SAIDA.exists():
        shutil.rmtree(SAIDA)
    (SAIDA / 'img').mkdir(parents=True)
    shutil.copytree(RAIZ / 'assets', SAIDA / 'assets')

    produtos, slugs, avisos = [], set(), []
    for n, r in enumerate(linhas, start=2):
        pid = r.get('id', '').strip().upper()
        nome = r.get('nome', '').strip()
        if not pid or not nome:
            continue
        marca = r.get('marca', '').strip()
        slug = slugify(f'{marca} {nome}') or slugify(pid)
        if slug in slugs:
            slug = f'{slug}-{slugify(pid)}'
        slugs.add(slug)

        # foto: pasta fotos/ (ID.jpg) ou, se não houver, o link da coluna imagem
        bruto = achar_foto(pid)
        if not bruto and r.get('imagem', '').startswith('http'):
            try:
                bruto = baixar(drive_direto(r['imagem']))
            except Exception as e:
                avisos.append(f'linha {n} ({pid}): não consegui baixar a imagem ({e})')
        img = img_ed = ''
        if bruto:
            try:
                im = abrir(bruto)
                v = salvar(im, SAIDA / 'img' / f'{slug}.jpg', (1000, 1250))
                img = f'img/{slug}.jpg?v={v}'
                og(im, SAIDA / 'img' / 'og' / f'{slug}.jpg')
                ed = achar_foto(pid, '-2')
                if ed:
                    im2 = abrir(ed)
                    v2 = salvar(im2, SAIDA / 'img' / f'{slug}-2.jpg', (1600, 1600), 82)
                    img_ed = f'img/{slug}-2.jpg?v={v2}'
                    og(im2, SAIDA / 'img' / 'og' / f'{slug}-2.jpg')
            except Exception as e:
                avisos.append(f'linha {n} ({pid}): foto com problema ({e})')
        else:
            avisos.append(f'linha {n} ({pid}): sem foto (suba fotos/{pid}.jpg)')

        produtos.append({
            'id': pid, 'slug': slug, 'marca': marca, 'nome': nome,
            **{k: r.get(k, '').strip() for k in COLUNAS if k not in ('id', 'marca', 'nome', 'disponivel', 'destaque', 'imagem')},
            'disponivel': not sem_acento(r.get('disponivel', 'sim')).strip().lower().startswith('n'),
            # só decant: disponivel = "só decant", ou preço do frasco vazio com preco_decant preenchido → o frasco não aparece
            'so_decant': 'decant' in sem_acento(r.get('disponivel', '')).lower() or (not r.get('preco', '').strip() and bool(r.get('preco_decant', '').strip())),
            'destaque': sim(r.get('destaque', '')),
            'img': img, 'img_ed': img_ed,
        })

    # decants de 5 ml: criados sozinhos para todo perfume com preço nas categorias de config.json → decant_faixas
    # (cada categoria tem a sua lista de [preço do frasco abaixo de, preço do decant])
    tabelas = cfg.get('decant_faixas') or {}
    if isinstance(tabelas, list):  # formato antigo: só árabes
        tabelas = {'Árabe': tabelas}
    tabelas = {sem_acento(k).strip().lower(): v for k, v in tabelas.items()}
    colecao = {'arabe': 'Árabes', 'designer': 'Importados', 'nicho': 'Nicho'}
    # config.json → decant_somente: {"Nicho": ["MG085", ...]} = nessa coleção, só esses perfumes têm decant
    somente = {sem_acento(k).strip().lower(): {str(i).strip().upper() for i in v} for k, v in (cfg.get('decant_somente') or {}).items() if isinstance(v, list)}
    vial = Image.open(RAIZ / 'assets' / 'decant-5ml.png').convert('RGBA')
    decants = []
    for p in produtos:
        cat = sem_acento(p['categoria']).strip().lower()
        if cat not in tabelas:
            continue
        faixas = tabelas[cat]
        valor = numero(p['preco'])
        proprio = numero(p.get('preco_decant'))  # coluna opcional: preço próprio do decant
        if cat in somente and p['id'] not in somente[cat] and proprio is None:
            continue
        pd = proprio if proprio is not None else next((pr for lim, pr in faixas if valor is not None and valor < lim), None)
        if pd is None:
            continue
        pd = f'{pd:.2f}'.replace('.', ',')
        img = ''
        if p['img']:
            try:
                base = Image.open(SAIDA / 'img' / f"{p['slug']}.jpg").convert('RGB')
                im = com_decant(base, vial)
                v = salvar(im, SAIDA / 'img' / f"{p['slug']}-decant.jpg", (1000, 1250))
                img = f"img/{p['slug']}-decant.jpg?v={v}"
                og(im, SAIDA / 'img' / 'og' / f"{p['slug']}-decant.jpg")
            except Exception as e:
                avisos.append(f"decant {p['id']}: foto com problema ({e})")
        decants.append({**p, 'id': p['id'] + '-D', 'pai': p['id'], 'slug': p['slug'] + '-decant',
                        'nome': p['nome'] + ' · Decant 5 ml', 'categoria': 'Decant', 'colecao': colecao.get(cat, p['categoria']), 'volume': '5 ml',
                        'preco': pd, 'preco_de': (f"{numero(p.get('preco_decant_de')):.2f}".replace('.', ',') if numero(p.get('preco_decant_de')) is not None else ''), 'disponivel': True if proprio is not None else p['disponivel'], 'destaque': False, 'img': img, 'img_ed': '',
                        'descricao_sensorial': 'Decant de 5 ml com o perfume original, para conhecer a fragrância antes do frasco completo. ' + p['descricao_sensorial']})
    ordem = {'Nicho': 0, 'Árabes': 1, 'Importados': 2}
    decants.sort(key=lambda d: ordem.get(d['colecao'], 9))
    produtos = [p for p in produtos if not p.get('so_decant')] + decants  # "só decant": o frasco sai do catálogo

    if not produtos:
        sys.exit('ERRO: nenhum produto com id e nome na planilha. O site atual foi mantido.')

    # marcas: banner oficial opcional na pasta fotos/marcas
    #   afnan.jpg (computador, 1920x800) · afnan-celular.jpg (1080x1350) · afnan-logo.png
    pasta_marcas = FOTOS / 'marcas'
    arquivos = {}
    if pasta_marcas.is_dir():
        for f in pasta_marcas.iterdir():
            if f.suffix.lower() in EXT:
                arquivos[slugify(f.stem)] = f
    marcas = []
    for nome_marca in sorted({p['marca'] for p in produtos if p['marca']}):
        ms = slugify(nome_marca)
        m = {'marca': nome_marca, 'slug': ms, 'banner': '', 'banner_celular': '', 'logo': ''}
        for chave_arq, caixa, campo in ((ms, (1920, 1200), 'banner'), (ms + '-celular', (1080, 1500), 'banner_celular')):
            if chave_arq in arquivos:
                try:
                    v = salvar(abrir(arquivos[chave_arq].read_bytes()), SAIDA / 'img' / 'marcas' / f'{chave_arq}.jpg', caixa, 82)
                    m[campo] = f'img/marcas/{chave_arq}.jpg?v={v}'
                except Exception as e:
                    avisos.append(f'banner {arquivos[chave_arq].name}: problema ({e})')
        if ms + '-logo' in arquivos:
            try:
                lg = Image.open(arquivos[ms + '-logo']).convert('RGBA'); lg.thumbnail((480, 160), Image.LANCZOS)
                destino = SAIDA / 'img' / 'marcas' / f'{ms}-logo.png'; destino.parent.mkdir(parents=True, exist_ok=True)
                lg.save(destino, optimize=True)
                m['logo'] = f'img/marcas/{ms}-logo.png?v={hashlib.md5(destino.read_bytes()).hexdigest()[:8]}'
            except Exception as e:
                avisos.append(f'logo {ms}: problema ({e})')
        marcas.append(m)

    # imagens institucionais
    logo = Image.open(RAIZ / 'assets' / 'logo-maison-galbano.png').convert('RGBA')
    capa = Image.new('RGB', (1200, 630), SELO)
    l = logo.copy(); l.thumbnail((460, 460), Image.LANCZOS)
    capa.paste(l, ((1200 - l.width) // 2, (630 - l.height) // 2), l)
    capa.save(SAIDA / 'assets' / 'og-capa.jpg', 'JPEG', quality=88)
    ic = Image.new('RGB', (256, 256), SELO); l2 = logo.copy(); l2.thumbnail((240, 240), Image.LANCZOS)
    ic.paste(l2, (8, 8), l2); ic.save(SAIDA / 'assets' / 'icone.png')

    versao = hashlib.md5(((RAIZ / 'assets' / 'app.js').read_bytes() + (RAIZ / 'assets' / 'estilo.css').read_bytes())).hexdigest()[:8]
    modelo = (RAIZ / 'src' / 'pagina.html').read_text(encoding='utf-8')
    config_pub = {'whatsapp': re.sub(r'\D', '', str(cfg.get('whatsapp', ''))), 'meta_pixel_id': str(cfg.get('meta_pixel_id', '')).strip(), 'csv_url': cfg.get('csv_url', ''), 'cartao_acrescimo': cfg.get('cartao_acrescimo', 0), 'parcelas': cfg.get('parcelas', 1), 'decant_faixas': cfg.get('decant_faixas', []), 'banner_nicho': cfg.get('banner_nicho', {}), 'banner_arabes': cfg.get('banner_arabes', {}), 'banner_decants': cfg.get('banner_decants', {}), 'banner_destaque': cfg.get('banner_destaque', {})}

    def js(o):
        return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')

    def attr(s):
        return (s or '').replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;')

    def gerar(caminho, base, rota, titulo, descricao, imagem, tipo='website'):
        html = modelo
        for k, v in {'__BASE__': base, '__TITULO__': attr(titulo), '__DESCRICAO__': attr(descricao),
                     '__URL__': site + caminho, '__IMAGEM__': site + imagem, '__OG_TIPO__': tipo,
                     '__VERSAO__': versao, '__CONFIG__': js(config_pub), '__ROTA__': js(rota),
                     '__PRODUTOS__': js(produtos), '__MARCAS__': js(marcas)}.items():
            html = html.replace(k, v)
        destino = SAIDA / caminho / 'index.html'
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(html, encoding='utf-8')

    gerar('', './', 'home', 'Maison Galbano Parfums — Catálogo',
          'Uma curadoria de fragrâncias extraordinárias: árabes, importados, nicho e decants de 5 ml. Perfumes 100% originais, com envio para todo o Brasil.',
          'assets/og-capa.jpg')
    for p in produtos:
        titulo = f"{p['marca']} {p['nome']} · Maison Galbano"
        resumo = ' · '.join(x for x in [p['concentracao'], p['volume']] if x)
        desc = p['descricao_sensorial'][:155].rsplit(' ', 1)[0] + '…' if len(p['descricao_sensorial']) > 160 else (p['descricao_sensorial'] or f'{resumo}. Consulte disponibilidade pelo WhatsApp.')
        imagem = f"img/og/{p['slug']}.jpg" if p['img'] else 'assets/og-capa.jpg'
        gerar(f"p/{p['slug']}/", '../../', f"p:{p['slug']}", titulo, desc, imagem, 'product')
        if p['destaque']:
            imagem_ed = f"img/og/{p['slug']}-2.jpg" if p['img_ed'] else imagem
            gerar(f"d/{p['slug']}/", '../../', f"d:{p['slug']}", f"{p['nome']} · Seleção Maison Galbano", desc, imagem_ed, 'article')

    (SAIDA / '.nojekyll').write_text('')
    (SAIDA / '404.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=' + site + '"><a href="' + site + '">Ir para o catálogo</a>', encoding='utf-8')

    print(f'OK: {len(produtos)} perfumes publicados.')
    for a in avisos:
        print('AVISO:', a)


if __name__ == '__main__':
    main()
