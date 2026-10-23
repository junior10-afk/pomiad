# PomiAD

**Une URL → un Business DNA → des campagnes → des créas exportables.**

Clone fonctionnel de Pomelli (Google Labs), construit à partir du démontage REA de la cible
(`rea/pomelli/TEARDOWN.md`) : la palette, la typographie et les breakpoints viennent du bundle réel.

## Lancer

```bash
git clone https://github.com/junior10-afk/pomiad.git
cd pomiad
node server/index.js
# http://127.0.0.1:8787
```

Aucune dépendance à installer, aucun build. Le serveur sert le front (`app/`) **et** l'API (`/api/*`).
Node 18 ou plus.

Sans clé, tout fonctionne en **mode local** : crawler réel, copie par gabarits, créas vectoriels.
Avec une clé, le texte et les images passent par le modèle — soit collée dans **Réglages**
(stockée dans le navigateur), soit dans `.env` côté serveur. Voir **[SETUP.md](SETUP.md)**.

## Déployer

Le projet est un service HTTP unique : n'importe quel hébergeur qui sait lancer une commande
Node convient (Render, Railway, Fly.io, un VPS, un conteneur).

```
commande de démarrage : node server/index.js
port                  : $PORT  (le serveur le lit et bind 0.0.0.0 automatiquement)
variables             : aucune obligatoire
```

Deux règles si tu veux que le modèle fonctionne en ligne :

1. **Ne mets pas la clé dans `.env`** — le fichier partirait dans l'image ou l'archive. Utilise les
   variables d'environnement de l'hébergeur (`GEMINI_API_KEY`, etc.), ou laisse chaque visiteur
   coller la sienne dans Réglages.
2. **HTTPS obligatoire** pour les appels aux fournisseurs depuis le navigateur.

Sans clé côté serveur, l'app reste pleinement utilisable : elle analyse les sites et compose les
créas ; seuls les textes restent sur gabarits tant qu'aucune clé n'est saisie.

## Architecture

```
server/
  index.js    serveur HTTP, routes /api, statique
  crawl.js    crawler + extraction (couleurs hex/rgb/hsl/oklch, polices, texte, ton)
  llm.js      abstraction Gemini / OpenAI / Anthropic côté serveur (clé .env)
  prompts.js  prompts produit (DNA, campagnes, édition, image)
  env.js      lecture de .env sans dépendance
app/
  index.html  styles.css  app.js  llm.js   (vanilla JS, canvas, aucune dépendance)
```

`app/llm.js` est le client « bring your own key » : il appelle le fournisseur **depuis le
navigateur**, avec la clé saisie dans les réglages. Le serveur ne voit jamais cette clé.

## Interface

Direction « éditorial olive, affiné », pensée pour un usage agence (voir `.impeccable.md`) :
filets plutôt que cartes, numérotation de section, type display très serré, mono pour toutes
les valeurs techniques. Tokens en `oklch`, neutres teintés olive, aucun noir pur.

- **Rail de marques** — chaque profil analysé est conservé (`localStorage`, 24 max), avec son
  monogramme coloré et sa palette en quatre traits. Un clic recharge le profil sans refaire l'analyse.
- **Export en série** — un bouton rend les quatre formats (1:1, 4:5, 9:16, 16:9) et les télécharge.
- **Clavier** — `Échap` remonte d'un écran, focus visible sur tous les contrôles,
  `prefers-reduced-motion` respecté.
- **Réglages** — clés par fournisseur et choix du modèle **par capacité** (texte, image), sur
  « Auto » ou en sélection explicite. La vidéo n'est pas branchée. Voir **[SETUP.md](SETUP.md)**.

## Ce qui est réel

- **Crawler** — requête serveur, pas de CORS : HTML + jusqu'à 8 feuilles de style externes,
  extraction des couleurs (`#hex`, `rgb()`, `hsl()`, `oklch()` converti en sRGB), des familles
  de polices et du texte visible. Palette construite par rôle (fond / encre / primaire / secondaire /
  accent) avec contrôle de contraste.
- **Ton de voix** — lexique FR/EN sur 6 axes, même sans clé LLM.
- **Rendu** — canvas natif, 4 formats (1:1, 4:5, 9:16, 16:9), 3 dispositions, export PNG.
- **API** — 4 routes, dégradation explicite : `501` quand aucune clé, `502` quand le site bloque,
  jamais de fausse réussite.

## Ce qui dépend de la clé

| Sans clé | Avec clé |
|---|---|
| DNA par règles | DNA réécrit par le modèle (marque, promesse, audience, ton) |
| 3 angles par gabarits | 3 angles écrits, ton respecté, longueurs contraintes |
| 10 commandes d'édition | langage naturel libre |
| créas vectoriels | fond photographique généré |

## Règle de probité

Rien n'est présenté comme extrait quand ça ne l'est pas : l'interface distingue
« analyse directe » (site lu) de « profil composé » (site inaccessible), et le serveur renvoie
toujours la source réelle du DNA.

## Dev

`dev/e2e.cjs` — parcours Playwright complet (serveur → DNA → campagnes → studio → prompt).
`dev/test.cjs` — même parcours sans serveur (repli local). `dev/live.cjs` / `dev/dump.cjs` — captures.
