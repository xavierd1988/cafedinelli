// =============================================================================
// PARSER ROBUSTE DES RANGÉES DE NEWSLETTER
// =============================================================================
// La newsletter est régénérée chaque matin par une IA — sa structure HTML
// n'est PAS garantie stable. Historique des structures observées :
//
//   2026-05-13 : <td>rang</td><td>Nom — desc</td><td>stats</td>
//   2026-05-15 : <td>N. Nom — desc</td><td>stats</td>
//
// Lire une colonne à position fixe est donc fragile. À la place, ce module
// identifie le nom du trend par son CONTENU :
//   - une cellule qui ressemble à une métrique ("2M+ searches", "#1 Home",
//     "+2,610%", "312K posts") est écartée
//   - une cellule qui n'est qu'un numéro de rang ("1", "12.") est écartée
//   - la cellule restante avec du vrai texte → c'est le nom
//
// Résultat : le nom est retrouvé quelle que soit sa colonne, avec ou sans
// préfixe de rang collé.
// =============================================================================

// Une cellule ressemble-t-elle à une statistique / métrique ?
function looksLikeStat(s) {
  const t = (s || "").trim();
  if (!t) return false;
  // "#1 Electronics", "#2 Home" — # suivi d'un chiffre (≠ hashtag "#FYP")
  if (/^[#]\d/.test(t)) return true;
  // "+2,610%", "+38% WoW", "-12%"
  if (/^[+\-][\d.,]/.test(t)) return true;
  if (/^[+\-]?[\d.,]+\s*%/.test(t)) return true;
  // "2M+ searches", "22M views • 3 days", "312K posts", "4.2B views"
  if (/[\d.,]+\s*[KMB]?\+?\s*(search|view|post|video|comment|like|share|stream|listen|play)/i.test(t)) {
    return true;
  }
  // "+38% WoW" (week-over-week)
  if (/\bWoW\b/i.test(t)) return true;
  return false;
}

// Retire un préfixe de rang : "1. ", "12) ", "3 - ", "07: "
export function stripRankPrefix(s) {
  return (s || "").trim().replace(/^\s*\d+\s*[.):\-]\s*/, "");
}

// La cellule n'est-elle QU'un numéro de rang ?
function isPureRank(s) {
  return /^\s*\d{1,3}\s*[.):\-]?\s*$/.test(s || "");
}

// Prend la liste des textes de cellules d'une <tr> (HTML déjà retiré,
// entités déjà décodées) et retourne le nom du trend / produit.
// Retourne "" si rien d'exploitable.
export function pickTrendName(cellTexts) {
  const cells = (cellTexts || []).map((c) => (c || "").replace(/\s+/g, " ").trim());

  // 1) Première cellule qui n'est ni une stat, ni un rang pur, et qui
  //    contient du vrai texte (au moins une lettre).
  for (const t of cells) {
    if (!t || isPureRank(t) || looksLikeStat(t)) continue;
    const name = stripRankPrefix(t).split("—")[0].trim();
    if (name.length > 1 && /[A-Za-z]/.test(name)) return name;
  }

  // 2) Fallback : première cellule non vide après strip du rang.
  for (const t of cells) {
    const name = stripRankPrefix(t).split("—")[0].trim();
    if (name.length > 1) return name;
  }

  return "";
}

function newsletterText(html) {
  return html.replace(/<[^>]+>/g, "")
    .replace(/&(?:amp|nbsp|quot|apos|lt|gt);|&#(?:\d+|x[\da-f]+);/gi, (entity) => {
      const named = { amp: "&", nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">" };
      const value = entity.slice(1, -1).toLowerCase();
      if (named[value]) return named[value];
      const code = value.startsWith("#x") ? parseInt(value.slice(2), 16) : parseInt(value.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }).replace(/\s+/g, " ").trim();
}

// Both the older table editions and the November card editions contain ranked
// rows. Keep their section boundaries: an empty section must not borrow a table
// from a later section. Offsets also let the browser mark the original rows
// without rebuilding or changing the newsletter's layout.
export function getNewsletterRows(html) {
  if (typeof html !== "string" || !html) return [];
  const headings = [...html.matchAll(/<h[234]\b[^>]*>([\s\S]*?)<\/h[234]\s*>/gi)];
  const rows = [];
  headings.forEach((heading, index) => {
    const section = newsletterText(heading[1]);
    const start = heading.index + heading[0].length;
    const body = html.slice(start, headings[index + 1]?.index ?? html.length);
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>|<div\b[^>]*>((?:(?!<\/?div\b)[\s\S])*?)<\/div\s*>|<li\b[^>]*>((?:(?!<\/?li\b)[\s\S])*?)<\/li\s*>/gi;
    for (const row of body.matchAll(rowRe)) {
      const table = row[1] !== undefined;
      const content = row[1] ?? row[2] ?? row[3];
      const cellRe = table ? /<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi : /<span\b[^>]*>([\s\S]*?)<\/span\s*>/gi;
      const cells = [...content.matchAll(cellRe)].map((cell) => newsletterText(cell[1]));
      // Card containers and explanatory paragraphs are not ranked rows.
      if (!table && (cells.length < 2 || !/^\d{1,3}\s*[.):\-]/.test(cells[0]))) continue;
      const name = pickTrendName(cells);
      if (!name || name.length < 2) continue;
      rows.push({ section, name, cells, tagName: table ? "tr" : row[2] !== undefined ? "div" : "li", start: start + row.index, openingEnd: start + row.index + row[0].indexOf(">") });
    }
  });
  return rows;
}

export function getAmazonNewsletterNames(html, limit = 30) {
  const names = [];
  const seen = new Set();
  for (const row of getNewsletterRows(html)) {
    if (!/\bamazon\b/i.test(row.section) || row.name.length < 3) continue;
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(row.name.slice(0, 80));
    if (names.length >= limit) break;
  }
  return names;
}

// Add the same interaction targets to table rows and card rows. Attribute
// values are escaped because newsletter names are plain text, not markup.
export function markNewsletterRows(html) {
  let marked = html;
  const rows = getNewsletterRows(html);
  for (const row of rows.reverse()) {
    let attribute = "";
    if (/\bamazon\b/i.test(row.section)) attribute = "data-amazon-product";
    else if (/\bgoogle\b/i.test(row.section)) attribute = "data-google-trend";
    else if (/\btiktok\b/i.test(row.section)) attribute = "data-tiktok-trend";
    else if (/\btwitter\b/i.test(row.section) || /(^|\W)x\s*[\/—]/i.test(row.section)) attribute = "data-x-trend";
    else if (/\byoutube\b/i.test(row.section)) attribute = "data-youtube-trend";
    if (!attribute) continue;
    const opening = html.slice(row.start, row.openingEnd);
    if (new RegExp(`\\b${attribute}\\s*=`, "i").test(opening)) continue;
    const value = row.name.replace(/[&"<>]/g, (char) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[char]));
    marked = `${marked.slice(0, row.openingEnd)} ${attribute}="${value}"${marked.slice(row.openingEnd)}`;
  }
  return marked;
}
