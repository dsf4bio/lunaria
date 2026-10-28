// Aggiorna le parti di index.html che servono a Google, partendo dall'array `products`:
// - le schede prodotto scritte direttamente nell'HTML (tra <!-- PRODOTTI:INIZIO --> e <!-- PRODOTTI:FINE -->)
// - i dati strutturati JSON-LD (tra <!-- SEO:JSONLD:INIZIO --> e <!-- SEO:JSONLD:FINE -->)
// - il numero di "idee selezionate" in alto e la data in sitemap.xml
//
// Da lanciare dalla cartella del sito, ogni volta che modifichi i prodotti:
//   node strumenti/aggiorna-seo.mjs

import { readFileSync, writeFileSync } from "node:fs";

const SITE = "https://www.lunaria.click/";
const page = "index.html";
let html = readFileSync(page, "utf8");

function readArray(name) {
  const match = html.match(new RegExp("const " + name + " = (\\[[\\s\\S]*?\\n    \\]);"));
  if (!match) throw new Error("Non trovo l'array " + name + " in " + page);
  return new Function("return " + match[1])();
}

const products = readArray("products");
const categories = readArray("CATEGORIES");

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const sized = (url, px) => /^https:\/\/m\.media-amazon\.com\/images\/I\//.test(url)
  ? url.replace(/\._[^/]*_\.(jpg|jpeg|png)$/i, "._AC_SL" + px + "_.$1")
  : url;

const firstImage = (p) => (p.images || []).map((u) => String(u || "").trim()).find(Boolean) || "";

// ---------- Schede statiche (stessa struttura di quelle create dal JavaScript) ----------
const cards = products.map((p) => {
  const tint = categories.find((c) => c.label === p.category)?.tint;
  const img = firstImage(p);
  const benefits = (p.benefits || []).filter(Boolean).slice(0, 3);
  return [
    `<article class="card" id="p-${esc(p.id)}" data-category="${esc(p.category)}"${tint ? ` style="--tint: ${tint}"` : ""}>`,
    `<div class="card-media">${img ? `<img src="${esc(sized(img, 600))}" alt="${esc(p.title)}" loading="lazy" width="600" height="600" referrerpolicy="no-referrer">` : ""}</div>`,
    `<div class="card-body">`,
    `<p class="card-cat">${esc(p.category)}</p>`,
    `<h3 class="card-title">${esc(p.title)}</h3>`,
    `<div class="card-details"><p class="card-desc">${esc(p.description)}</p>`,
    benefits.length ? `<ul class="card-benefits">${benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "",
    `</div>`,
    p.affiliateUrl ? `<div class="card-actions"><a class="btn btn-affiliate" href="${esc(p.affiliateUrl)}" target="_blank" rel="sponsored nofollow noopener noreferrer">Vedi su Amazon</a></div>` : "",
    `</div>`,
    `</article>`,
  ].join("");
}).join("\n");

// ---------- Dati strutturati ----------
const jsonld = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": SITE + "#website",
      url: SITE,
      name: "Lunaria",
      inLanguage: "it-IT",
      description: "Una selezione di prodotti beauty e benessere per donna più amati su Amazon.it.",
    },
    {
      "@type": "ItemList",
      "@id": SITE + "#prodotti",
      name: "Prodotti beauty e benessere per lei più amati su Amazon.it",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.title,
        url: SITE + "#p-" + p.id,
        ...(firstImage(p) ? { image: sized(firstImage(p), 600) } : {}),
      })),
    },
  ],
};
// "<" scritto come \u003c: il JSON non può chiudere per errore il tag <script>
const jsonldTag = `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>`;

function between(start, end, content) {
  const re = new RegExp("(<!-- " + start + " -->)[\\s\\S]*?(<!-- " + end + " -->)");
  if (!re.test(html)) throw new Error("Non trovo i segnaposto " + start + " / " + end);
  html = html.replace(re, (_, a, b) => a + "\n" + content + "\n" + b);
}

between("PRODOTTI:INIZIO", "PRODOTTI:FINE", cards);
between("SEO:JSONLD:INIZIO", "SEO:JSONLD:FINE", "  " + jsonldTag);
html = html.replace(/<span>\d+ idee selezionate<\/span>/, `<span>${products.length} idee selezionate</span>`);
writeFileSync(page, html);

// ---------- Data di aggiornamento nella sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const sitemap = readFileSync("sitemap.xml", "utf8").replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`);
writeFileSync("sitemap.xml", sitemap);

console.log(`Aggiornati ${products.length} prodotti, dati strutturati e sitemap (${today}).`);
