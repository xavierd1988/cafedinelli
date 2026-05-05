// Liste quotidienne des produits "On the shelf". 30 articles tirés
// chaque jour d'un pool café/cosy via un shuffle déterministe seedé sur
// la date courante (jour calendaire qui démarre à 9h00 du matin pour
// matcher la publication newsletter). Tout le monde voit la même
// sélection le même jour, sans Redis ni I/O.

const POOL = [
  { emoji: "🫖",  name: "Glass teapot",            search: "glass+teapot+borosilicate" },
  { emoji: "☕",  name: "Stoneware mug",           search: "stoneware+coffee+mug" },
  { emoji: "📓",  name: "Lined notebook",          search: "lined+notebook+leather" },
  { emoji: "🍯",  name: "Wildflower honey",        search: "wildflower+honey+jar" },
  { emoji: "🪔",  name: "Brass desk lamp",         search: "brass+desk+lamp" },
  { emoji: "🥄",  name: "Coffee scoop",            search: "brass+coffee+scoop" },
  { emoji: "📚",  name: "Hopper art book",         search: "edward+hopper+book" },
  { emoji: "🍪",  name: "Tin cookie box",          search: "tin+cookie+box" },
  { emoji: "🌿",  name: "Loose-leaf tea tin",      search: "loose+leaf+tea+tin" },
  { emoji: "🥖",  name: "Linen bread bag",         search: "linen+bread+bag" },
  { emoji: "🧂",  name: "Sugar bowl",              search: "sugar+bowl+with+lid" },
  { emoji: "🪵",  name: "Wood cutting board",      search: "wood+cutting+board" },
  { emoji: "🕯️", name: "Beeswax candle",          search: "beeswax+candle" },
  { emoji: "🧺",  name: "Cotton tea towel",        search: "cotton+tea+towel" },
  { emoji: "📰",  name: "Newspaper rack",          search: "wooden+newspaper+rack" },
  { emoji: "☕",  name: "Bialetti moka pot",       search: "bialetti+moka+pot" },
  { emoji: "🫘",  name: "Coffee beans pouch",      search: "specialty+coffee+beans" },
  { emoji: "🪞",  name: "Cafe wall mirror",        search: "vintage+cafe+wall+mirror" },
  { emoji: "🧱",  name: "Ceramic milk jug",        search: "ceramic+milk+jug" },
  { emoji: "🪑",  name: "Bistro stool",            search: "bistro+counter+stool" },
  { emoji: "🪟",  name: "Linen curtain panel",     search: "linen+curtain+panel" },
  { emoji: "📻",  name: "Vintage radio",           search: "tabletop+vintage+radio" },
  { emoji: "🎨",  name: "Hopper poster print",     search: "edward+hopper+poster" },
  { emoji: "📖",  name: "Coffee atlas",            search: "world+coffee+atlas+book" },
  { emoji: "🥛",  name: "Milk frother",            search: "handheld+milk+frother" },
  { emoji: "🍵",  name: "Matcha bowl",             search: "matcha+chawan+bowl" },
  { emoji: "🪴",  name: "Terracotta planter",      search: "terracotta+planter" },
  { emoji: "🧴",  name: "Olive oil cruet",         search: "olive+oil+cruet+glass" },
  { emoji: "🪣",  name: "Coffee filters box",      search: "v60+coffee+filters" },
  { emoji: "🎼",  name: "Jazz vinyl LP",           search: "blue+note+jazz+vinyl" },
  { emoji: "✏️",  name: "Pencil set",              search: "blackwing+pencil+set" },
  { emoji: "📒",  name: "Daily planner",           search: "leather+daily+planner" },
  { emoji: "🖋️", name: "Fountain pen",            search: "lamy+fountain+pen" },
  { emoji: "🎒",  name: "Canvas tote",             search: "natural+canvas+tote+bag" },
  { emoji: "🥣",  name: "Stoneware bowl",          search: "stoneware+breakfast+bowl" },
  { emoji: "☕",  name: "Espresso cup set",        search: "porcelain+espresso+cups" },
  { emoji: "🪥",  name: "Wooden brush",            search: "wooden+counter+brush" },
  { emoji: "🪡",  name: "Embroidery hoop",         search: "embroidery+hoop+kit" },
  { emoji: "🎩",  name: "Wool felt hat",           search: "wool+felt+fedora" },
  { emoji: "🌻",  name: "Dried flower bouquet",    search: "dried+flower+bouquet" },
  { emoji: "🧶",  name: "Wool throw",              search: "merino+wool+throw" },
  { emoji: "📐",  name: "Brass ruler",             search: "brass+ruler+18inch" },
  { emoji: "🍞",  name: "Sourdough cookbook",      search: "sourdough+cookbook" },
  { emoji: "🥐",  name: "Pastry guide book",       search: "advanced+bread+pastry+book" },
  { emoji: "🥃",  name: "Heavy tumbler glass",     search: "heavy+old+fashioned+glass" },
  { emoji: "🪙",  name: "Brass tray",              search: "brass+entryway+tray" },
  { emoji: "🥃",  name: "Whisky decanter",         search: "crystal+whisky+decanter" },
  { emoji: "📦",  name: "Storage tin set",         search: "kitchen+storage+tin+set" },
  { emoji: "🎲",  name: "Wood domino set",         search: "wooden+domino+set" },
  { emoji: "🪑",  name: "Cane chair",              search: "rattan+cane+chair" },
  { emoji: "🍶",  name: "Glass carafe",            search: "glass+water+carafe" },
  { emoji: "🧃",  name: "Bamboo straws",           search: "bamboo+reusable+straws" },
  { emoji: "🪟",  name: "Stained glass panel",     search: "small+stained+glass+panel" },
  { emoji: "📆",  name: "Wall calendar",           search: "letterpress+wall+calendar" },
  { emoji: "🎪",  name: "Apron canvas",            search: "natural+canvas+apron" },
  { emoji: "🥨",  name: "Pretzel jar",             search: "glass+jar+with+latch" },
  { emoji: "🍇",  name: "Cheese board",            search: "marble+cheese+board" },
  { emoji: "🪟",  name: "Vintage scale",           search: "vintage+kitchen+scale" },
  { emoji: "📕",  name: "Vintage paperback",       search: "penguin+classics+set" },
  { emoji: "🪞",  name: "Standing mirror",         search: "freestanding+vanity+mirror" },
  { emoji: "🕰️", name: "Mantle clock",            search: "small+mantle+clock" }
];

// Deterministic shuffle (mulberry32 seedé) — produit la même séquence
// pour tous les visiteurs un jour donné, sans backend partagé.
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}
function seededShuffle(arr, seed) {
  const out = [...arr];
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Date "produit" : la nouvelle sélection débute après 9h du matin (heure
// locale serveur). Avant 9h, on est encore sur la sélection de la veille.
// Format YYYY-MM-DD utilisé comme seed.
export function getProductsDateKey() {
  const now = new Date();
  if (now.getHours() < 9) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().slice(0, 10);
}

export function getDailyProducts(count = 30) {
  const key = getProductsDateKey();
  const seed = hashStr(`cafe-products-${key}`);
  const shuffled = seededShuffle(POOL, seed);
  return shuffled.slice(0, count).map((p, i) => ({
    id: `${key}-${i}`,
    emoji: p.emoji,
    name: p.name,
    amazonUrl: `https://www.amazon.com/s?k=${p.search}`
  }));
}
