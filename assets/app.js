/* Catálogo Maison Galbano — não é preciso editar este arquivo.
   Produtos vêm da planilha; número do WhatsApp e Pixel ficam em config.json. */
(function () {
  'use strict';
  var CFG = window.CONFIG || {};
  var PRODUTOS = window.PRODUTOS || [];
  var ROTA = window.ROTA || 'home';

  var CATEGORIAS = ['Árabes', 'Importados', 'Nicho', 'Decants'];
  var CAT_KEY = { 'Árabes': 'Árabe', 'Importados': 'Designer', 'Decants': 'Decant' };   // nome no site → valor da coluna categoria
  var CAT_ROT = { 'Árabe': 'Árabes', 'Designer': 'Importados', 'Decant': 'Decants' };    // valor da planilha → nome no site
  var COLECOES = [
    { nome: 'Árabes', frase: 'A intensidade e o luxo do Oriente' },
    { nome: 'Importados', frase: 'Os clássicos das grandes grifes' },
    { nome: 'Nicho', frase: 'Perfumaria artística e rara' }
  ];
  var CAPA_COL = { 'Importados': 'MG129', 'Nicho': 'MG092' };   // foto de capa de cada coleção (se faltar, usa o destaque ou o primeiro)
  var DESCOBERTA = [
    { rot: 'Masculinos', f: function (p) { return p.perfil === 'Masculino'; } },
    { rot: 'Femininos', f: function (p) { return p.perfil === 'Feminino'; } },
    { rot: 'Compartilháveis', f: function (p) { return p.perfil === 'Compartilhável'; } },
    { rot: 'Seleção Maison Galbano', f: function (p) { return p.destaque; } }
  ];
  var marcaSel = '';  // marca escolhida nos quadrinhos de Marcas (filtra o acervo)
  var st = { cat: null, dsub: '', desc: null, perfil: '', familia: '', ocasiao: '', busca: '' };
  var ordem = 'rec';   // ordenação do acervo
  var ORDENS = [['rec', 'Recomendados'], ['menor', 'Menor preço'], ['maior', 'Maior preço'], ['az', 'Nome (A–Z)']];

  // ── utilidades ──
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lista(s) { return String(s || '').split(/[,;\/]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }); }
  function nomeTodo(p) { return p.marca + ' ' + p.nome; }
  // busca sem acento e sem diferenciar maiúsculas, por nome, marca, notas, família, ocasião...
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function textoBusca(p) {
    return p._busca || (p._busca = norm([p.marca, p.nome, p.concentracao, p.perfil, p.familia_olfativa, p.notas_topo, p.notas_coracao, p.notas_fundo, p.ocasiao, CAT_ROT[p.categoria] || p.categoria, p.colecao].join(' ')));
  }
  function linkDe(p) { try { return new URL('p/' + p.slug + '/', document.baseURI).href; } catch (e) { return ''; } }
  function preco(v) {
    var s = String(v || '').replace(/[^\d.,]/g, '');
    if (!s) return 'Consulte';
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 'Consulte' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Preço no Pix (o da planilha) + parcelado no cartão, calculado sozinho
  function num(v) {
    var s = String(v || '').replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s);
  }
  function brl(n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function blocoPreco(p, completo) {
    if (!p.disponivel) return '<span class="preco-pix">Sob consulta</span>';
    var n = num(p.preco);
    if (isNaN(n)) return '<span class="preco-pix">Consulte</span>';
    var k = Number(CFG.parcelas || 0), a = Number(CFG.cartao_acrescimo || 0);
    var de = num(p.preco_de);   // preço "de" (riscado), quando há promoção
    var h = '<span class="preco-pix">' + (!isNaN(de) && de > n ? '<s class="preco-de">' + brl(de) + '</s> ' : '') + brl(n) + ' <small>no Pix</small></span>';
    if (k > 1 && p.categoria !== 'Decant') {
      var parcela = Math.ceil(Math.round(n * 100 * (1 + a / 100)) / k) / 100;
      h += '<span class="preco-parc">ou ' + k + 'x de ' + brl(parcela) + ' sem juros' +
        (completo ? ' no cartão (total ' + brl(parcela * k) + ')' : '') + '</span>';
    }
    return h;
  }
  function valor(p) { return blocoPreco(p, false); }
  function valorCompleto(p) { return blocoPreco(p, true); }
  function wa(p) {
    var msg = p
      ? 'Olá! Conheci esta fragrância pelo catálogo Maison Galbano e gostaria de consultar disponibilidade e condições do ' + nomeTodo(p) + '.\n' + linkDe(p)
      : 'Olá! Conheci o catálogo Maison Galbano e gostaria de falar com um especialista.';
    return 'https://wa.me/' + String(CFG.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
  }
  function porId(id) { for (var i = 0; i < PRODUTOS.length; i++) if (PRODUTOS[i].id === id) return PRODUTOS[i]; return null; }
  function porSlug(s) { for (var i = 0; i < PRODUTOS.length; i++) if (PRODUTOS[i].slug === s) return PRODUTOS[i]; return null; }
  function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on'); }, 2200); }

  // ── Meta Pixel (PageView, ViewContent, Lead) ──
  if (CFG.meta_pixel_id) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', String(CFG.meta_pixel_id)); fbq('track', 'PageView');
  }
  function track(ev, p) {
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', ev, p ? { content_name: nomeTodo(p), content_ids: [p.id], content_type: 'product', currency: 'BRL' } : {});
  }

  // ── componentes ──
  function card(p) {
    return '<a class="card' + (p.disponivel ? '' : ' sem-estoque') + '" href="p/' + p.slug + '/">' +
      '<div class="foto">' + (p.img ? '<img src="' + p.img + '" alt="' + esc(nomeTodo(p)) + '" loading="lazy" decoding="async">' : '<span class="sem-foto">Foto em breve</span>') + '</div>' +
      '<div class="info"><p class="eyebrow">' + esc(p.marca) + '</p><h3 class="nome">' + esc(p.nome) + '</h3>' +
      '<span class="preco">' + valor(p) + (p.disponivel ? '' : '<span class="selo-esg">Esgotado no momento</span>') + '</span></div></a>';
  }

  var MARCAS = window.MARCAS || [];

  // marcas com seus perfumes (a do destaque primeiro, depois as com mais perfumes)
  function marcas() {
    var dest = PRODUTOS.filter(function (p) { return p.destaque; }).slice(-1)[0];  // o destaque mais recente vai para a capa
    return MARCAS.map(function (m) {
      return { marca: m.marca, slug: m.slug, banner: m.banner, banner_celular: m.banner_celular, logo: m.logo,
        produtos: PRODUTOS.filter(function (p) { return p.marca === m.marca && !p.pai; }) };
    }).filter(function (m) { return m.produtos.length; }).sort(function (a, b) {
      if (dest && a.marca === dest.marca) return -1;
      if (dest && b.marca === dest.marca) return 1;
      return b.produtos.length - a.produtos.length || a.marca.localeCompare(b.marca, 'pt-BR');
    });
  }

  function slideInstitucional(dest) {
    return '<div class="slide s-inst capa"><div class="wrap capa-corpo"><div class="capa-txt">' +
        '<p class="eyebrow">Maison Galbano · Parfums</p>' +
        '<h1 class="tese">Uma curadoria de fragrâncias <em>extraordinárias.</em></h1>' +
        '<p class="sub">Perfumes que transformam presença em assinatura.</p>' +
        '<div class="cta-linha"><a class="btn" href="#acervo">Explorar o acervo</a>' +
        '<a class="btn claro" href="' + wa() + '" target="_blank" rel="noopener" data-lead>Falar com um especialista</a></div>' +
      '</div>' +
      (dest && dest.img ? '<a class="arco-wrap" href="d/' + dest.slug + '/"><div class="arco"><img src="' + dest.img + '" alt="' + esc(nomeTodo(dest)) + '"></div>' +
        '<div class="arco-legenda"><span class="eyebrow">Em destaque · ' + esc(dest.marca) + '</span><span>' + esc(dest.nome) + '</span></div></a>' : '') +
      '</div></div>';
  }

  // banner dos nichos mais vendidos: os códigos (MG...) ficam em config.json → banner_nicho.ids
  function slideNicho() {
    var b = CFG.banner_nicho || {};
    var ps = (b.ids || []).map(function (id) { return porId(String(id).trim().toUpperCase()); }).filter(function (p) { return p && p.img; });
    if (!ps.length) return '';
    var t = esc(b.titulo || 'Os ícones da perfumaria de nicho.').replace(/(de nicho\.?)$/, '<em>$1</em>');
    return '<div class="slide s-nicho"><div class="wrap s-nicho-in">' +
      '<div class="s-nicho-txt"><p class="eyebrow">' + esc(b.chamada || 'Nicho · Os mais desejados') + '</p>' +
        '<h2 class="h-display">' + t + '</h2>' +
        (b.texto ? '<p class="s-nicho-sub">' + esc(b.texto) + '</p>' : '') +
        '<a class="link-fino" href="#resultado" data-cat-link="Nicho">Ver todos os nichos</a></div>' +
      '<div class="s-nicho-grade">' + ps.slice(0, 6).map(function (p) {
        return '<a class="s-nicho-item" href="p/' + p.slug + '/"><div class="s-nicho-foto"><img src="' + p.img + '" alt="' + esc(nomeTodo(p)) + '" decoding="async"></div>' +
          '<span class="eyebrow">' + esc(p.marca) + '</span><span class="s-nicho-nome">' + esc(p.nome) + '</span></a>';
      }).join('') + '</div>' +
      '</div></div>';
  }

  function slideMarca(m) {
    if (m.banner) {   // banner oficial da fabricante (pasta fotos/marcas)
      return '<a class="slide s-oficial" href="#resultado" data-marca="' + esc(m.marca) + '"><picture>' +
        (m.banner_celular ? '<source media="(max-width: 759px)" srcset="' + m.banner_celular + '">' : '') +
        '<img src="' + m.banner + '" alt="' + esc(m.marca) + '"></picture></a>';
    }
    var p = m.produtos.filter(function (x) { return x.destaque; })[0] || m.produtos[0];
    var link = p.destaque ? 'd/' + p.slug + '/' : 'p/' + p.slug + '/';
    return '<div class="slide s-marca"><div class="wrap s-marca-grid">' +
      '<a class="s-marca-img" href="' + link + '"><img src="' + (p.img_ed || p.img) + '" alt="' + esc(nomeTodo(p)) + '"></a>' +
      '<div class="s-marca-txt"><p class="eyebrow">A casa</p><h2 class="h-display">' + esc(m.marca) + '</h2>' +
      '<p class="s-marca-prod">' + esc(p.nome) + '</p><a class="link-fino" href="#resultado" data-marca="' + esc(m.marca) + '">Ver ' + esc(m.marca) + '</a></div>' +
      '</div></div>';
  }

  function vitrine(dest, ms) {
    var slides = [slideInstitucional(dest)];
    var nicho = slideNicho(); if (nicho) slides.unshift(nicho);  // banner dos nichos abre a vitrine
    ms.forEach(function (m) { if (m.banner) slides.push(slideMarca(m)); });
    if (dest) ms.forEach(function (m) { if (m.marca === dest.marca && !m.banner && (dest.img_ed || dest.img)) slides.push(slideMarca(m)); });
    slides = slides.slice(0, 7);
    return '<header class="topo"><div class="wrap topo-in">' +
        '<a href="./" class="topo-logo"><img src="assets/logo-maison-galbano.png" alt="Maison Galbano" width="52" height="52"></a>' +
        '<nav class="topo-nav"><a href="#colecoes">Coleções</a><a href="#acervo">Acervo</a><a href="#resultado" data-cat-link="Decants">Decants</a></nav>' +
      '</div></header>' +
      '<section class="vitrine" aria-label="Destaques" aria-roledescription="carrossel">' +
        '<div class="trilho" id="trilho">' + slides.join('') + '</div>' +
        (slides.length > 1 ? '<div class="pontos" id="pontos">' + slides.map(function (_, i) { return '<button type="button" aria-label="Destaque ' + (i + 1) + '" data-slide="' + i + '"' + (i ? '' : ' aria-current="true"') + '></button>'; }).join('') + '</div>' : '') +
      '</section>' +
      '<div class="faixa"><div class="wrap faixa-in"><span>100% originais</span><span>Envio para todo o Brasil</span><span>Decants de 5 ml</span><span>Atendimento pelo WhatsApp</span></div></div>';
  }

  // coleções na entrada: Árabes · Importados · Nicho (no lugar da lista de marcas)
  function daColecao(c) {
    var lista = PRODUTOS.filter(function (p) { return p.categoria === (CAT_KEY[c] || c) && !p.pai; });
    return lista.filter(function (p) { return p.destaque; }).reverse().concat(lista.filter(function (p) { return !p.destaque; }));
  }
  function secaoColecoes() {
    var cs = COLECOES.map(function (c) { return { nome: c.nome, frase: c.frase, produtos: daColecao(c.nome) }; }).filter(function (c) { return c.produtos.length; });
    if (!cs.length) return '';
    return '<section id="colecoes" class="colecoes"><div class="wrap">' +
      '<div class="sec-topo"><div><p class="eyebrow">Maison Galbano</p><h2 class="h-display">Coleções</h2></div></div>' +
      '<div class="grade-col">' + cs.map(function (c) {
        var capa = c.produtos.filter(function (p) { return p.img && p.id === CAPA_COL[c.nome]; })[0] || c.produtos.filter(function (p) { return p.img; })[0];
        return '<a href="#resultado" class="tile-col" data-cat-link="' + c.nome + '">' +
          '<div class="foto">' + (capa ? '<img src="' + capa.img + '" alt="" loading="lazy">' : '') + '</div>' +
          '<div class="txt"><span class="nome-col">' + c.nome + '</span><span class="frase">' + c.frase + '</span>' +
          '<small>' + c.produtos.length + (c.produtos.length === 1 ? ' fragrância' : ' fragrâncias') + '</small></div></a>';
      }).join('') + '</div></div></section>' +
      cs.map(function (c) {
        return '<section class="sec-col"><div class="wrap">' +
          '<div class="sec-topo"><div><p class="eyebrow">Coleção</p><h2 class="h-display">' + c.nome + '</h2></div>' +
          '<a class="link-fino" href="#resultado" data-cat-link="' + c.nome + '">Ver todos</a></div></div>' +
          '<div class="fileira">' + c.produtos.slice(0, 12).map(card).join('') + '</div></section>';
      }).join('');
  }

  // pastas de decants: Nicho · Árabes · Importados (pasta vazia aparece como "em breve")
  function pastasDecant() {
    return '<div class="pastas-dec grade-col">' + ['Nicho', 'Árabes', 'Importados'].map(function (c) {
      var ds = PRODUTOS.filter(function (p) { return p.pai && p.colecao === c; });
      var capa = ds.filter(function (p) { return p.img; })[0];
      var txt = '<div class="txt"><span class="nome-col">Decants ' + c + '</span><small>' + (ds.length ? ds.length + (ds.length === 1 ? ' decant' : ' decants') + ' de 5 ml' : 'Em breve') + '</small></div>';
      var foto = '<div class="foto">' + (capa ? '<img src="' + capa.img + '" alt="" loading="lazy">' : '<p class="ml">5<small>ml</small></p>') + '</div>';
      return ds.length ? '<a href="#resultado" class="tile-col" data-cat-link="Decants" data-dsub="' + c + '">' + foto + txt + '</a>'
                       : '<div class="tile-col vazia">' + foto + txt + '</div>';
    }).join('') + '</div>';
  }

  // carrossel: passa sozinho; para quando a pessoa mexe
  function iniciarVitrine() {
    var tr = $('#trilho'), pts = [].slice.call(document.querySelectorAll('#pontos button'));
    if (!tr || pts.length < 2) return;
    var timer = null;
    function atual() { return Math.round(tr.scrollLeft / tr.clientWidth); }
    function ir(i) { tr.scrollTo({ left: tr.clientWidth * i, behavior: 'smooth' }); }
    function parar() { clearInterval(timer); timer = null; }
    tr.addEventListener('scroll', function () { var i = atual(); pts.forEach(function (b, j) { if (i === j) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }); }, { passive: true });
    pts.forEach(function (b) { b.addEventListener('click', function () { parar(); ir(Number(b.getAttribute('data-slide'))); }); });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) { tr.addEventListener(ev, parar, { passive: true }); });
    if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) timer = setInterval(function () { ir((atual() + 1) % pts.length); }, 6500);
  }

  function opcoes(nome, rot, valores, atual) {
    if (!valores.length) return '';
    return '<label for="f-' + nome + '"><span class="eyebrow">' + rot + '</span><select id="f-' + nome + '" data-filtro="' + nome + '"><option value="">Todos</option>' +
      valores.map(function (v) { return '<option' + (v === atual ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></label>';
  }

  function home() {
    var dest = PRODUTOS.filter(function (p) { return p.destaque; }).slice(-1)[0];  // o destaque mais recente vai para a capa
    var perfis = uniq(PRODUTOS.map(function (p) { return p.perfil; }));
    var familias = uniq(PRODUTOS.map(function (p) { return p.familia_olfativa; }));
    var ocasioes = uniq([].concat.apply([], PRODUTOS.map(function (p) { return lista(p.ocasiao).map(cap); })));
    var ms = marcas();
    return vitrine(dest, ms) + secaoColecoes() +
    '<section class="apres-sec"><div class="wrap"><div class="apres measure">' +
      '<p class="eyebrow">A Maison</p>' +
      '<p class="lede">Perfumaria árabe, importada e de nicho, com decants para conhecer cada fragrância antes do frasco. Uma seleção feita em São Paulo, com envio para todo o Brasil.</p>' +
      '<figure class="filosofia"><blockquote>“Na Maison Galbano, perfume original não é uma escolha. É uma obrigação e uma forma de respeito aos nossos clientes.”</blockquote><figcaption>Edson e Isabel, fundadores</figcaption></figure>' +
    '</div></div></section>' +

    '<section id="acervo" style="padding-top:0"><div class="wrap"><p class="eyebrow" style="margin-bottom:6px">O acervo</p></div>' +
      // barra que acompanha a rolagem: abas das coleções + busca + ordenação
      '<div class="filtro-fixo"><div class="wrap">' +
        '<div class="abas" role="group" aria-label="Coleções"><button type="button" data-cat="" aria-pressed="true">Todas</button>' + CATEGORIAS.map(function (c) {
          var n = PRODUTOS.filter(function (p) { return p.categoria === (CAT_KEY[c] || c); }).length;
          return '<button type="button" data-cat="' + c + '" aria-pressed="false">' + c + '<span class="qtd">' + (n || 'em breve') + '</span></button>';
        }).join('') + '</div>' +
        '<div class="linha-busca"><label class="sr" for="busca">Buscar</label><input id="busca" class="busca" type="search" placeholder="Nome, marca ou nota" autocomplete="off">' +
        '<label class="sr" for="ordem">Ordenar</label><select id="ordem" class="ordem">' + ORDENS.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === ordem ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '</div></div>' +
      '<div class="wrap">' +
      '<div class="ferramentas">' +
        '<div class="chips">' + DESCOBERTA.map(function (d, i) { return '<button type="button" class="chip" data-desc="' + i + '" aria-pressed="false">' + d.rot + '</button>'; }).join('') + '</div>' +
        '<div class="refinar">' + opcoes('perfil', 'Perfil', perfis, st.perfil) + opcoes('familia', 'Família olfativa', familias, st.familia) + opcoes('ocasiao', 'Ocasião', ocasioes, st.ocasiao) + '</div>' +
        '<button type="button" class="limpar" id="limpar" hidden>Limpar filtros</button>' +
      '</div>' +
      '<div class="acervo-topo" id="resultado" style="scroll-margin-top:84px"><h2 class="h-display" id="tituloGrade" style="font-size:30px"></h2><span class="contagem" id="contagem"></span></div>' +
      // divisão dos decants (Nicho · Árabes · Importados) aparece antes dos frascos
      '<div class="chips subdec" id="subdec" hidden>' + [['', 'Todos os decants'], ['Nicho', 'Decants Nicho'], ['Árabes', 'Decants Árabes'], ['Importados', 'Decants Importados']].map(function (d) {
        return '<button type="button" class="chip" data-dsub="' + d[0] + '" aria-pressed="false">' + d[1] + '</button>'; }).join('') + '</div>' +
      '<div class="grade" id="grade"></div>' +
    '</div></section>' +

    '<section class="autent"><div class="wrap">' +
      '<p class="eyebrow">Nosso compromisso</p><h2 class="h-display">A autenticidade é inegociável.</h2>' +
      '<div class="pilares">' +
        '<div class="pilar"><h3>100% originais</h3><p>Trabalhamos apenas com perfumes originais.</p></div>' +
        '<div class="pilar"><h3>Curadoria especializada</h3><p>Cada fragrância é escolhida por quem vive a perfumaria.</p></div>' +
        '<div class="pilar"><h3>Atendimento personalizado</h3><p>Ajudamos você a encontrar a sua assinatura, sem pressa.</p></div>' +
        '<div class="pilar"><h3>Envio para todo o Brasil</h3><p>Do nosso acervo em São Paulo até a sua porta.</p></div>' +
      '</div></div></section>' +

    '<section class="decants" id="decants" style="background:var(--bege)"><div class="wrap">' +
      '<p class="ml">5<small>ml</small></p>' +
      '<div style="display:grid;gap:18px" class="measure"><p class="eyebrow">Decants</p><h2 class="h-display">Descubra antes de escolher.</h2>' +
      '<p>Grandes fragrâncias merecem ser descobertas sem pressa. Nossos decants permitem explorar diferentes universos olfativos antes de investir no frasco completo.</p>' +
      '</div>' + pastasDecant() +
      '<div id="kits" hidden><!-- Reservado: discovery sets e kits de 3 e 5 decants --></div>' +
    '</div></section>' + rodape();
  }

  function rodape() {
    return '<footer class="fim"><section><div class="wrap"><div class="blocos">' +
      '<div><p class="eyebrow">Nossa história</p><h3>Edson e Isabel</h3><p>A Maison Galbano nasceu no fim de 2024, das mãos de um casal apaixonado por perfumaria. Edson coleciona e estuda fragrâncias há anos; Isabel vende perfumes desde 2015 e acompanha cada cliente como consultora.</p></div>' +
      '<div><p class="eyebrow">Como comprar</p><h3>Pelo WhatsApp</h3><ol class="passos"><li>Escolha a fragrância no catálogo.</li><li>Toque em “Consultar esta fragrância”.</li><li>Confirmamos disponibilidade, valor e envio com você.</li></ol></div>' +
      '<div><p class="eyebrow">Entregas e contato</p><h3>Para todo o Brasil</h3><p>Enviamos a partir de São Paulo para todo o país.</p>' +
      '<p>Instagram <a href="https://instagram.com/maisongalbano" target="_blank" rel="noopener">@maisongalbano</a></p>' +
      '<div style="margin-top:20px"><a class="btn claro" href="' + wa() + '" target="_blank" rel="noopener" data-lead>Falar com um especialista</a></div></div>' +
      '</div><div class="assinatura"><span>Maison Galbano Parfums · São Paulo</span><span>Perfumes 100% originais</span></div></div></section></footer>';
  }

  function barra() { return '<nav class="barra"><div class="wrap"><a href="./#acervo" id="voltar">← Catálogo</a><a class="wm" href="./">Galbano</a></div></nav>'; }

  function niveis(p) { return [['Topo', p.notas_topo], ['Coração', p.notas_coracao], ['Fundo', p.notas_fundo]].filter(function (n) { return n[1]; }); }
  function ficha(p) { return [p.concentracao, p.volume].filter(Boolean).map(esc).join(' · '); }

  function pagina(p) {
    var nv = niveis(p);
    var dados = [['Família olfativa', p.familia_olfativa], ['Perfil', p.perfil], ['Ocasião', p.ocasiao], ['Coleção', CAT_ROT[p.categoria] || p.categoria]].filter(function (d) { return d[1]; });
    return barra() + '<div class="pdp-grid">' +
      '<div class="pdp-foto">' + (p.img ? '<img src="' + p.img + '" alt="' + esc(nomeTodo(p)) + '">' : '') + '</div>' +
      '<article class="pdp wrap">' +
        '<div class="pdp-cab"><p class="eyebrow">' + esc(p.marca) + '</p><h1 class="h-display">' + esc(p.nome) + '</h1><p class="ficha">' + ficha(p) + '</p></div>' +
        '<div class="preco-linha"><span class="valor" data-valor>' + valorCompleto(p) + '</span>' + (p.disponivel ? '<span class="disp" data-disp>Disponível</span>' : '') + '</div>' +
        '<div class="acoes"><a class="btn" href="' + wa(p) + '" target="_blank" rel="noopener" data-lead="' + esc(p.id) + '">Consultar esta fragrância</a>' +
        '<button type="button" class="copiar" id="copiar">Compartilhar esta fragrância</button></div>' +
        (p.descricao_sensorial ? '<p class="desc">' + esc(p.descricao_sensorial) + '</p>' : '') +
        (nv.length ? '<div class="piramide"><h2 class="eyebrow">Pirâmide olfativa</h2>' + nv.map(function (n) { return '<div class="nivel"><span class="rot">' + n[0] + '</span><span class="notas">' + esc(n[1]) + '</span></div>'; }).join('') + '</div>' : '') +
        (dados.length ? '<dl class="dados">' + dados.map(function (d) { return '<div><dt>' + d[0] + '</dt><dd>' + esc(d[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
        (p.destaque ? '<a class="editorial-link" href="d/' + p.slug + '/"><span class="eyebrow">Seleção Maison Galbano</span><span>Ler a página editorial →</span></a>' : '') +
      '</article></div>' + rodape() +
      // barra fixa de compra no celular: aparece quando o botão principal sai da tela
      '<div class="cta-espaco"></div><div class="cta-fixa oculta" id="ctaFixa"><div class="cta-preco">' + valor(p) + '</div>' +
      '<a class="btn" href="' + wa(p) + '" target="_blank" rel="noopener" data-lead="' + esc(p.id) + '">Consultar</a></div>';
  }

  function destaque(p) {
    var nv = niveis(p);
    return barra() +
      '<header class="ed-capa"><div class="wrap"><p class="eyebrow">Seleção Maison Galbano</p>' +
      '<p class="eyebrow" style="color:var(--verde);letter-spacing:.3em">' + esc(p.marca) + '</p><h1 class="h-display">' + esc(p.nome) + '</h1></div>' +
      '<div class="img"><img src="' + (p.img_ed || p.img) + '" alt="' + esc(nomeTodo(p)) + '"></div></header>' +
      (p.descricao_sensorial ? '<section><div class="wrap"><div class="ed-lede measure" style="margin-inline:auto"><p class="eyebrow">A fragrância</p><p>' + esc(p.descricao_sensorial) + '</p></div></div></section>' : '') +
      (nv.length ? '<section class="ed-notas" style="padding-top:0"><div class="wrap"><p class="eyebrow" style="margin-bottom:28px">Pirâmide olfativa' + (p.familia_olfativa ? ' · ' + esc(p.familia_olfativa) : '') + '</p><div class="col">' +
        nv.map(function (n) { return '<div class="ed-nivel"><span class="eyebrow">' + n[0] + '</span><ul>' + lista(n[1]).map(function (x) { return '<li>' + esc(cap(x)) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div></div></section>' : '') +
      '<section class="ed-fecho"><div class="wrap"><p class="eyebrow" style="color:var(--champanhe)">' + esc(p.marca) + '</p>' +
      '<p class="ficha">' + [p.concentracao, p.volume, p.perfil].filter(Boolean).map(esc).join(' · ') + '</p>' +
      '<div class="valor" data-valor>' + valorCompleto(p) + '</div>' +
      '<a class="btn" href="' + wa(p) + '" target="_blank" rel="noopener" data-lead="' + esc(p.id) + '">Consultar esta fragrância</a>' +
      '<a class="link-fino" style="color:var(--bege);justify-self:center" href="p/' + p.slug + '/">Ficha completa</a></div></section>' + rodape();
  }

  // ── filtros ──
  function aplicar() {
    var g = $('#grade'); if (!g) return;
    var b = st.busca;
    var termos = norm(b).split(/\s+/).filter(Boolean);
    var res = PRODUTOS.filter(function (p) {
      // decants só aparecem na aba Decants (ou na busca, quando o perfume é vendido só em decant)
      return (!p.pai || st.cat === 'Decants' || (b && !porId(p.pai))) &&
        (!marcaSel || p.marca === marcaSel) &&
        (!st.cat || p.categoria === (CAT_KEY[st.cat] || st.cat)) &&
        (st.cat !== 'Decants' || !st.dsub || p.colecao === st.dsub) &&
        (st.desc === null || DESCOBERTA[st.desc].f(p)) &&
        (!st.perfil || p.perfil === st.perfil) &&
        (!st.familia || p.familia_olfativa === st.familia) &&
        (!st.ocasiao || lista(p.ocasiao).map(cap).indexOf(st.ocasiao) > -1) &&
        termos.every(function (x) { return textoBusca(p).indexOf(x) > -1; });
    });
    // ordenação: (nos decants, a divisão primeiro) → esgotados no fim → critério escolhido
    var grp = { 'Nicho': 0, 'Árabes': 1, 'Importados': 2 };
    var pr = function (p) { var n = num(p.preco); return isNaN(n) ? null : n; };
    var cmp = { menor: function (x, y) { return (pr(x) === null ? 1e9 : pr(x)) - (pr(y) === null ? 1e9 : pr(y)); },
                maior: function (x, y) { return (pr(y) === null ? -1 : pr(y)) - (pr(x) === null ? -1 : pr(x)); },
                az: function (x, y) { return nomeTodo(x).localeCompare(nomeTodo(y), 'pt-BR'); } }[ordem] || function () { return 0; };
    res = res.map(function (p, i) { return [p, i]; }).sort(function (A, B) {
      var x = A[0], y = B[0];
      return (st.cat === 'Decants' ? (grp[x.colecao] || 0) - (grp[y.colecao] || 0) : 0) ||
        (x.disponivel ? 0 : 1) - (y.disponivel ? 0 : 1) || cmp(x, y) || A[1] - B[1];
    }).map(function (a) { return a[0]; });
    var titulo = marcaSel || (termos.length ? 'Busca: “' + st.busca + '”' : null) || (st.desc !== null ? DESCOBERTA[st.desc].rot : (st.cat === 'Decants' && st.dsub ? 'Decants ' + st.dsub : (st.cat || 'Todas as fragrâncias')));
    var sd = $('#subdec');
    if (sd) { sd.hidden = st.cat !== 'Decants'; [].forEach.call(sd.querySelectorAll('[data-dsub]'), function (el) { el.setAttribute('aria-pressed', el.getAttribute('data-dsub') === (st.dsub || '')); }); }
    $('#tituloGrade').textContent = titulo;
    $('#contagem').textContent = res.length + (res.length === 1 ? ' fragrância' : ' fragrâncias');
    var ult = null;
    g.innerHTML = res.length ? res.map(function (p) {
      // em "Todos os decants", cada divisão ganha o seu título antes dos frascos
      var cab = (st.cat === 'Decants' && !st.dsub && p.colecao && p.colecao !== ult) ? '<h3 class="grupo-dec">Decants ' + p.colecao + '</h3>' : '';
      if (p.colecao) ult = p.colecao;
      return cab + card(p);
    }).join('') : '<p class="vazio">' + (termos.length ? 'Nenhuma fragrância encontrada. Tente outro nome, marca ou nota.' : 'Nenhuma fragrância com essa combinação. Novas chegam em breve.') + '</p>';
    [].forEach.call(document.querySelectorAll('[data-cat]'), function (el) { el.setAttribute('aria-pressed', (el.getAttribute('data-cat') || null) === st.cat); });
    [].forEach.call(document.querySelectorAll('[data-desc]'), function (el) { el.setAttribute('aria-pressed', Number(el.getAttribute('data-desc')) === st.desc); });
    $('#limpar').hidden = !(marcaSel || st.cat || st.desc !== null || st.perfil || st.familia || st.ocasiao || st.busca);
  }

  function iniciarCtaFixa() {
    var bar = $('#ctaFixa'), alvo = document.querySelector('.acoes .btn');
    if (!bar || !alvo || !('IntersectionObserver' in window)) { if (bar) bar.classList.remove('oculta'); return; }
    new IntersectionObserver(function (en) { bar.classList.toggle('oculta', en[0].isIntersecting); }).observe(alvo);
  }

  // ── render ──
  function render() {
    var app = $('#app'), p;
    if (ROTA.indexOf('p:') === 0 && (p = porSlug(ROTA.slice(2)))) { app.innerHTML = pagina(p); track('ViewContent', p); iniciarCtaFixa(); }
    else if (ROTA.indexOf('d:') === 0 && (p = porSlug(ROTA.slice(2)))) { app.innerHTML = destaque(p); track('ViewContent', p); }
    else { app.innerHTML = home(); aplicar(); iniciarVitrine(); }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : e.target.parentNode;
    var el;
    // "← Catálogo": se veio do catálogo, volta para o mesmo ponto da lista
    if (t.closest('#voltar') && document.referrer.indexOf(location.origin) === 0 && history.length > 1) { e.preventDefault(); history.back(); return; }
    // links internos (#acervo, #resultado...): rola até lá sem recarregar a página
    // (links do Instagram/anúncios chegam com ?fbclid=... e o navegador recarregaria)
    var ancora = t.closest('a[href^="#"]');
    if (ancora) {
      var alvo = document.getElementById(ancora.getAttribute('href').slice(1));
      if (alvo) { e.preventDefault(); setTimeout(function () { alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 0); }
    }
    if (t.closest('[data-cat],[data-cat-link],[data-dsub],[data-busca],[data-desc]') || t.id === 'limpar') marcaSel = '';
    if ((el = t.closest('[data-marca]'))) {
      st = { cat: null, dsub: '', desc: null, perfil: '', familia: '', ocasiao: '', busca: '' }; marcaSel = el.getAttribute('data-marca');
      var bm = $('#busca'); if (bm) bm.value = ''; [].forEach.call(document.querySelectorAll('[data-filtro]'), function (s) { s.value = ''; }); aplicar(); return;
    }
    if ((el = t.closest('[data-dsub]')) && !el.hasAttribute('data-cat-link')) { st.cat = 'Decants'; st.dsub = el.getAttribute('data-dsub'); st.desc = null; aplicar(); return; }
    if ((el = t.closest('[data-cat]'))) { st.cat = el.getAttribute('data-cat') || null; st.dsub = ''; st.desc = null; aplicar(); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
    if ((el = t.closest('[data-cat-link]'))) { st.cat = el.getAttribute('data-cat-link'); st.dsub = el.getAttribute('data-dsub') || ''; st.desc = null; aplicar(); }
    if ((el = t.closest('[data-busca]'))) { st = { cat: null, dsub: '', desc: null, perfil: '', familia: '', ocasiao: '', busca: el.getAttribute('data-busca').toLowerCase() }; var bi = $('#busca'); if (bi) bi.value = el.getAttribute('data-busca'); aplicar(); }
    if ((el = t.closest('[data-desc]'))) { var i = Number(el.getAttribute('data-desc')); st.desc = st.desc === i ? null : i; st.cat = null; aplicar(); return; }
    if ((el = t.closest('[data-lead]'))) track('Lead', porId(el.getAttribute('data-lead')));
    if (t.id === 'limpar') {
      st = { cat: null, dsub: '', desc: null, perfil: '', familia: '', ocasiao: '', busca: '' };
      $('#busca').value = ''; [].forEach.call(document.querySelectorAll('[data-filtro]'), function (s) { s.value = ''; }); aplicar();
    }
    if (t.id === 'copiar') {
      var url = location.href.split('#')[0];
      var p = porSlug(ROTA.slice(2));
      if (navigator.share) { navigator.share({ title: p ? nomeTodo(p) : 'Maison Galbano', url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link copiado'); }, function () { toast('Copie o link na barra do navegador'); });
      else toast('Copie o link na barra do navegador');
    }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'busca') { marcaSel = ''; st.busca = e.target.value.trim(); aplicar(); } });
  document.addEventListener('change', function (e) { if (e.target.id === 'ordem') { ordem = e.target.value; aplicar(); } });
  document.addEventListener('change', function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-filtro'); if (f) { st[f] = e.target.value; aplicar(); } });

  // ── preço e disponibilidade ao vivo da planilha (o resto atualiza a cada publicação) ──
  function parseCSV(text) {
    var L = [], l = [], c = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { l.push(c); c = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; l.push(c); L.push(l); l = []; c = ''; }
      else c += ch;
    }
    if (c !== '' || l.length) { l.push(c); L.push(l); }
    if (!L.length) return [];
    var h = L[0].map(function (x) { return x.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); });
    return L.slice(1).map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = (r[j] || '').trim(); }); return o; });
  }
  function aoVivo() {
    if (!CFG.csv_url || !window.fetch) return;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    fetch(CFG.csv_url + (CFG.csv_url.indexOf('?') > -1 ? '&' : '?') + 't=' + Math.floor(Date.now() / 60000), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) {
        var mudou = false, vivo = {};
        parseCSV(txt).forEach(function (row) {
          vivo[(row.id || '').trim().toUpperCase()] = row;
          var p = porId((row.id || '').trim().toUpperCase()); if (!p) return;
          var disp = !/^n/i.test(row.disponivel || 'sim');
          if (p.preco !== row.preco || p.disponivel !== disp) { p.preco = row.preco; p.disponivel = disp; mudou = true; }
        });
        // decants acompanham o preço e a disponibilidade do frasco
        PRODUTOS.forEach(function (d) {
          if (!d.pai) return;
          var pai = porId(d.pai); if (!pai) return;
          var proprio = vivo[d.pai] ? vivo[d.pai].preco_decant : '';
          var novo = d.preco, disp = pai.disponivel;
          if (proprio && !isNaN(num(proprio))) { novo = proprio; disp = true; }
          else {
            var n = num(pai.preco), tb = CFG.decant_faixas || {};
            if (Object.prototype.toString.call(tb) === '[object Array]') tb = { 'Árabe': tb };
            var f = tb[pai.categoria] || [];
            for (var i = 0; i < f.length; i++) if (!isNaN(n) && n < f[i][0]) { novo = f[i][1] + ',00'; break; }
          }
          if (d.preco !== novo || d.disponivel !== disp) { d.preco = novo; d.disponivel = disp; mudou = true; }
        });
        if (mudou) {
          var y = window.scrollY, busca = st.busca;
          render(); if ($('#busca')) $('#busca').value = busca; window.scrollTo(0, y);
        }
      })
      .catch(function () { /* sem problema: fica com os dados da última publicação */ })
      .then(function () { clearTimeout(timer); });
  }

  render();
  if (location.hash === '#acervo') setTimeout(function () { var a = $('#acervo'); if (a) a.scrollIntoView(); }, 0);
  aoVivo();
})();
