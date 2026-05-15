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
