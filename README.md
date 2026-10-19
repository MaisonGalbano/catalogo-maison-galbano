# Catálogo Maison Galbano Parfums

Site: https://maisongalbano.github.io/catalogo-maison-galbano/

## No dia a dia
- **Produtos, preços, disponível, destaque:** na planilha do Google (aba Produtos).
- **Fotos:** pasta `fotos/` deste repositório. O nome da foto é o id do perfume: `MG001.jpg`.
  Segunda foto (página de destaque): `MG001-2.jpg`.
- **Atualizar na hora:** aba **Actions** → **Publicar catálogo** → **Run workflow**.
  Sem clicar, atualiza sozinho a cada hora. Preço e disponibilidade mudam no site quase na hora.

## Configuração (uma vez)
Arquivo `config.json`: link CSV da planilha, número do WhatsApp (só dígitos, com 55) e ID do Meta Pixel.

## Não precisa mexer
`assets/` (visual), `src/` (modelo das páginas), `scripts/` (montagem), `.github/` (automação).
Logo oficial em `assets/logo-maison-galbano.png` — não alterar.

## Decants de 5 ml

Todo perfume da categoria **Árabe** com preço ganha sozinho um decant de 5 ml na seção Decants (com a foto do frasco e um decant pequeno ao lado). Não precisa colocar nada na planilha: o preço sai pela faixa do frasco e a disponibilidade acompanha o frasco.

As faixas ficam em `config.json` → `decant_faixas` (cada par é: frasco abaixo de R$ X → decant R$ Y):
abaixo de 200 → 38 · 250 → 40 · 300 → 42 · 350 → 45 · 400 → 47 · 450 → 55 · 500 → 60 · 600 → 70 · 800 → 75.
Decant aparece só com o preço no Pix (sem parcelamento).
