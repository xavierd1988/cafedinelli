// Liste quotidienne des 30 produits "On the shelf". Mise à jour
// automatiquement chaque matin à 9h00 (heure serveur) — voir
// lib/productsStore.js pour la logique de seed/shuffle déterministe.
//
// Le client poll cette route une fois au mount de PaperPanel. Si tu veux
// un refresh sans reload, tu peux le rappeler après 9h.

import { getDailyProducts, getProductsDateKey } from "../../../lib/productsStore.js";

export async function GET() {
  return Response.json({
    date: getProductsDateKey(),
    products: getDailyProducts(30)
  });
}
