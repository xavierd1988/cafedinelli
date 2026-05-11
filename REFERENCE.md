# Dinelli's Café — Référence centrale

Document unique de référence : tous les codes admin, fonctions disponibles,
positions modules, et architecture push notifications.

---

## 🎛 Codes admin

Toutes les actions admin passent par deux canaux interchangeables :

1. **Keypad de la caisse** au bar (clic sur la caisse → tape le code → Enter)
2. **Mike** au bar (clic sur Mike → tape le mot/code dans le chat)

Le **même flag Redis** est partagé, donc tous les appareils sont à jour
en moins d'1 seconde quel que soit le canal utilisé.

| Code | Action | Caisse | Mike | Effet |
|---|---|---|---|---|
| `7` | Toggle edit mode | ✅ | — | Permet de drag/resize/rotate les modules de la scène |
| `00` | **Mute** notifs (force ON) | ✅ | ✅ → "It's muted." | Coupe ntfy + Telegram sur tous tes appareils |
| `000` | **Unmute** notifs (force OFF) | ✅ | ✅ → "It's unmuted." | Réactive ntfy + Telegram partout |
| `10` → `100` | Brightness Pixoo | ✅ | — | Règle la luminosité de l'écran physique (10%, 20%, … 100%) |

### Variantes texte pour Mike

Mike accepte les synonymes naturels :

| Mike comprend… | Comme… |
|---|---|
| `mute`, `silence`, `chut`, `tais-toi`, `stfu`, `shut up` | `00` (mute) |
| `unmute`, `wake up`, `réveille`, `notif on`, `on` | `000` (unmute) |
| Tout le reste | conversation normale (Groq LLM) |

Les commandes Mike sont interceptées **avant** Groq → réponse instantanée,
zéro coût LLM.

---

## 📐 Positions modules (`lib/modulePositions.js`)

Toutes les positions des modules de la scène sont bakées dans
`lib/modulePositions.js`. En **dev** (`NODE_ENV === "development"` ou
edit mode activé via `7`), les modules sont draggables/resizables ;
en **prod** ils sont figés.

### Comment éditer

1. Active edit mode (code `7` sur la caisse)
2. Drag/resize chaque module à la souris
3. Le bouton **Save layout** (visible uniquement en edit mode) apparaît
4. Clic → télécharge un objet JSON à coller dans `modulePositions.js`

### Profils

| Profil | Largeur viewport | Usage |
|---|---|---|
| `desktop` | ≥ 1280px | écrans desktop / iPad landscape large |
| `tablet` | 768–1279px | iPad portrait / iPad landscape standard |
| `phone` | < 768px | mobile — n'utilise PAS la scène, va sur `MobileShell` empilé |

Le profil est détecté par `useDeviceClass()`. Tablet hérite de desktop
avec quelques overrides (ex: `NicknameTag` ramené visible).

### Modules positionnés

Cf. `lib/modulePositions.js` pour les valeurs exactes — chaque entrée a
`offset`, `scale`, et optionnellement `size` (pour les modules
redimensionnables type `BlackBackdrop`, `CheckeredFloor`, `PaperPanel`)
et `rotation` (degrés).

Liste des modules indexés :

- **Mobilier scène** : `Counter`, `CafeUpperFloor`, `CafeGlass`,
  `CafeDoor`, `CornerCurve`, `CornerCurve2`, `BlackBackdrop`,
  `BordeauxBackdrop`, `CheckeredFloor`
- **Enseignes** : `NeonSign`, `CafeSign`
- **Mobilier interactif** : `CashRegister`, `RadioCabinet`, `PixooMuteCat`
- **Modules flottants** : `Receipt`, `WeatherClock`, `PaperPanel`,
  `ShelfPanel`, `NicknameTag`, `SeatsCounter`

---

## 🔌 API endpoints (résumé)

| Endpoint | Method | Usage |
|---|---|---|
| `/api/seats` | GET | Lit l'état complet (seats, regulars, online, mike, eye, taxi, pixoo, etc.). `?silent=1` pour ne pas compter le caller comme visiteur. `?sid=xxx` pour identifier l'onglet. |
| `/api/seats` | POST | Pose un message au bar. Body: `{id, nickname, message}`. Déclenche notifs Telegram + ntfy. |
| `/api/secret-room` | POST | Pose un message au salon secret. Déclenche notifs. |
| `/api/stream` | GET (SSE) | Stream temps réel de l'état. `?silent=1` pour le dashboard Pixoo. `?tick=NNN` ms. |
| `/api/visitor` | POST | Ping côté Node runtime quand un visiteur charge la page. Déclenche notif "nouveau visiteur" si IP/sid jamais vue (cooldown 30s). |
| `/api/mike-thread` | POST | Conversation avec Mike (LLM + intercepteur commandes admin). |
| `/api/eye-thread` | POST | Conversation avec the Eye (variante AI). |
| `/api/ntfy` | GET | Lit l'état `muted`. |
| `/api/ntfy` | POST | Toggle (sans param). `?set=1` force mute ON. `?set=0` force OFF. |
| `/api/pixoo` | GET/POST | Toggle mute buzzer Pixoo physique (différent de ntfyMuted). |
| `/api/pixoo/brightness` | POST | Body `{level: 0-100}`. Lu par le dashboard Pixoo via SSE. |
| `/api/telegram` | GET | Debug endpoint : vérifie env vars + envoie un test push. `?mode=online` teste `notifyNewOnline`. |
| `/api/products` | GET | Liste des produits Amazon du jour. |
| `/api/newsletter` | GET | Newsletter du jour (HTML). |
| `/api/cron/generate-products` | GET | Cron quotidien — Groq + scrape Amazon (auth `Bearer CRON_SECRET`). |
| `/api/cron/rescrape-only` | GET | Re-scrape Amazon sans Groq (par défaut misses-only, `?all=1` pour forcer). |

---

## 📲 Push notifications — architecture

### Canaux

| Canal | Latence iPhone | Setup | Mute par |
|---|---|---|---|
| **Telegram** (bot `@Dinellis_cafe_bot`) | 300–500ms | env Vercel `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | flag Redis `cafe:ntfy:muted` (codes `00`/`000`) |
| **ntfy.sh** (topic `dinellis-xavier-9k2pq`) | 1–3s | env Vercel `NTFY_TOPIC` | même flag |
| **Pixoo buzzer** (physique au bar) | <100ms | rien | flag Redis `cafe:pixoo:muted` (clic chat 🐱 dans la fenêtre du café) |

Les deux premiers (Telegram + ntfy) partent **en parallèle** depuis
Vercel via `Promise.all`. Mute via `00` les coupe tous les deux.

### Évents qui déclenchent une notif

| Évent | Canaux | Cooldown |
|---|---|---|
| Message au bar (`/api/seats` POST) | Telegram + ntfy | aucun |
| Message au salon secret (`/api/secret-room` POST) | Telegram + ntfy | aucun |
| Nouveau visiteur (`/api/visitor` POST) | Telegram + ntfy | 30s partagé (`cafe:online:lastnotif`) |

### Apple Watch

L'app Watch reflète automatiquement les notifs Telegram et ntfy de
l'iPhone si **"Mirror my iPhone alerts"** est activé dans
Watch app → My Watch → Notifications → Telegram/ntfy.

### Chaîne d'affichage Pixoo (séparée des notifs)

```
Vercel state ──SSE──→ dashboard.py (Mac) ──HTTP──→ Pixoo 64
```

Le dashboard Python (`~/projets/pixoo-dashboard/dashboard.py`) lit
l'état du café via SSE et push l'écran physique : stats live (compteur
regulars, online, heure 12h, °F), messages 10s avec bip, brightness
dynamique via le code caisse 10-100.

Indépendant des push iPhone — si le Mac est éteint, les notifs Telegram
continuent.

---

## 🔧 Comment ajouter une nouvelle commande à la caisse

1. Édite `components/CafeScene.jsx` → fonction `submitKeypad` du
   composant `CashRegister`
2. Ajoute un `else if (v === "TON_CODE") { ... }` avant le test
   `/^\d+$/` (sinon il sera capté par brightness)
3. Le handler doit `setFeedback("ok")` ou `setFeedback("reject")` pour
   feedback UI
4. Si besoin d'un endpoint serveur, crée-le dans `app/api/...`
5. Document le code dans la table en haut de ce fichier

## 🔧 Comment ajouter une commande Mike

1. Édite `app/api/mike-thread/route.js`
2. Le bloc commenté `// 1.b — Commandes admin` intercepte la question
   avant Groq
3. Ajoute ton match (`q === "tonmotcle"`) et la logique
4. Retourne `Response.json({ thread: finalThread })` pour court-circuiter
   Groq
5. Document le mot dans la table "Variantes texte pour Mike" ci-dessus

---

## 🚨 Variables d'environnement Vercel

| Var | Usage | Critique ? |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Base Redis | ✅ tout dépend de ça |
| `GROQ_API_KEY` | Mike, Eye, génération produits, newsletter enrichment | ✅ |
| `NEWSLETTER_SECRET` | Auth webhook newsletter | ✅ |
| `CRON_SECRET` | Auth `/api/cron/*` | ✅ |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Push iPhone Telegram | optionnel — sans, on tombe sur ntfy seul |
| `NTFY_TOPIC` | Push ntfy.sh | optionnel — sans, pas de push ntfy |

Ces vars sont gérées via `vercel env add` ou le dashboard Vercel
(Settings → Environment Variables). N'oublie pas de **redéployer** ou
trigger un re-build pour que les nouvelles vars soient prises en compte.

---

## 🧪 Debug rapide

```bash
# Vérifier que Telegram marche depuis Vercel
curl -s 'https://cafedinelli.vercel.app/api/telegram' | jq

# Tester notifyNewOnline isolé
curl -s 'https://cafedinelli.vercel.app/api/telegram?mode=online' | jq

# Mute / unmute via API direct (équiv. caisse)
curl -X POST 'https://cafedinelli.vercel.app/api/ntfy?set=1'  # mute
curl -X POST 'https://cafedinelli.vercel.app/api/ntfy?set=0'  # unmute
curl 'https://cafedinelli.vercel.app/api/ntfy'                # état actuel

# Brightness direct
curl -X POST 'https://cafedinelli.vercel.app/api/pixoo/brightness' \
  -H 'Content-Type: application/json' -d '{"level":50}'

# Test message au bar (déclenche les notifs)
curl -X POST 'https://cafedinelli.vercel.app/api/seats' \
  -H 'Content-Type: application/json' \
  -d '{"id":1,"nickname":"Debug","message":"test"}'
```

---

## 📍 Quick-find

| Tu cherches… | Va dans… |
|---|---|
| Une position de module | `lib/modulePositions.js` |
| Un code caisse | `components/CafeScene.jsx` → `submitKeypad` |
| Une commande Mike | `app/api/mike-thread/route.js` → bloc `1.b` |
| Une commande Eye | `app/api/eye-thread/route.js` |
| Le helper Telegram | `lib/telegramPush.js` |
| Le helper ntfy | `lib/ntfyPush.js` |
| Le helper "nouveau visiteur" | `lib/onlineNotifier.js` |
| Le state store unifié | `lib/stateStore.js` (cafe:state + snapshotSignature) |
| Le dashboard Pixoo Python | `~/projets/pixoo-dashboard/dashboard.py` (hors-repo) |
