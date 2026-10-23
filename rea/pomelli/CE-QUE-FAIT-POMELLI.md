# Pomelli — ce que ça fait

**Recherche web, 2026-10-23.** Sources primaires : le blog officiel Google (28 oct. 2025) et le centre d'aide Google Labs. Le reste est secondaire et signalé comme tel.

---

## En une phrase

**Pomelli est un outil marketing IA expérimental de Google Labs (avec Google DeepMind) : vous donnez l'URL de votre site, il en extrait l'identité de votre marque — le « Business DNA » — puis génère des campagnes et des visuels publicitaires conformes à cette charte, éditables en langage naturel.**

Cible : les PME et petits commerces sans équipe créative. Gratuit, en beta publique.

---

## Le flux officiel, en 3 étapes

Formulation Google (blog officiel, 28 octobre 2025) : *« Pomelli uses AI to understand your unique business and generate effective, tailored campaigns in just three steps. »*

### 1. Construire le « Business DNA »
Vous entrez l'adresse de votre site. Pomelli l'analyse, ainsi que les images existantes, et en extrait automatiquement :

- le **ton de voix**
- les **polices** (y compris les polices custom)
- la **palette de couleurs**
- le **style d'image**

Google : *« All content Pomelli generates is grounded in this DNA, ensuring your content feels more authentic and consistent across all channels. »* C'est le cœur du produit : ce n'est pas un générateur générique, c'est un générateur contraint par votre charte.

### 2. Générer des idées de campagnes
Une fois le DNA établi, Pomelli propose des **idées de campagnes taillées pour votre activité** — ça répond au « je ne sais pas quoi poster ». Si vous avez déjà une idée, vous la décrivez en texte et il s'y conforme.

### 3. Éditer et produire les créas
Il génère un **jeu d'assets haut de gamme et on-brand** : posts sociaux, bannières pub, images pour le site. Vous sélectionnez ceux qui servent votre objectif, vous modifiez **le texte et l'image directement dans l'outil**, puis vous téléchargez. Les fichiers sont utilisables partout (Instagram, TikTok, Facebook, YouTube, LinkedIn…).

---

## Ce que ça produit concrètement

Posts Instagram/Facebook, stories, reels, bannières publicitaires, visuels de site, copy e-mail, variations pour A/B tests — le tout décliné dans la charte extraite du site. Depuis 2026, ça va plus loin : photographie produit, vidéo animée, catalogue, guide de marque, et même site web.

---

## Évolution du produit

| Date | Ajout | Ce que ça change |
|---|---|---|
| **28 oct. 2025** | Lancement beta publique | US, Canada, Australie, Nouvelle-Zélande · anglais uniquement |
| **janv. 2026** | *Animate* | Contenu statique → vidéo animée on-brand (Veo 3.1) |
| **19 févr. 2026** | *Photoshoot* | Une photo produit prise au téléphone → packshot studio (Nano Banana). Plus : édition par prompt, références de style, upload d'images, URL produit → campagne |
| **9 mars 2026** | Ouverture géographique | 170+ pays et territoires — interface toujours en anglais |
| **avr.–5 mai 2026** | *Product Catalog* | Vous saisissez vos produits/services une fois (nom, description, prix, images) → campagnes et photos par article |
| **19 mai 2026** (Google I/O) | *Pomelli Agent*, *Brand Books*, *Websites* | DNA construit par conversation (même **sans site existant**), guide de marque exportable en PDF, générateur de site complet |
| **juin 2026** | Publication directe Instagram | Feed, Stories, Reels publiés depuis Pomelli — fin du téléchargement/re-upload |

> ⚠️ Les dates et périmètres 2026 viennent de sources secondaires (voir § Sources). Le blog officiel ne documente que le lancement d'octobre 2025 ; il existe des divergences entre sources sur le mois exact du Catalog et sur l'ouverture européenne.

---

## Le Business DNA en détail

C'est le seul vrai différenciateur face à Canva ou Adobe Express. **Canva part du template, Pomelli part de la marque.**

- **Extrait automatiquement** : palette, polices, ton, style visuel.
- **Éditable à la main** : les retours d'usage signalent que le crawler peut récupérer un vieux logo oublié sur une page, ou une couleur appartenant à un widget tiers. Cette étape de relecture est présentée comme indispensable — tout le reste en découle.
- **Ne marche pas** sur les sites protégés par captcha ou anti-bot : Pomelli doit crawler la page pour construire le profil.
- Depuis mai 2026, l'**Agent** permet de créer un DNA **de zéro**, par conversation, pour une marque qui n'a pas encore de site.

---

## Accès, prix, limites

| | |
|---|---|
| **Prix** | Gratuit en beta expérimentale. Aucun tarif post-beta annoncé. |
| **Quota** | Quelques centaines de générations images + vidéos |
| **Compte** | N'importe quel compte Google ; les comptes Workspace peuvent nécessiter une autorisation admin |
| **Langue** | Interface **anglais uniquement** ; le modèle sous-jacent est multilingue et peut générer dans d'autres langues sur demande |
| **Géo** | 4 pays à l'origine → 170+ depuis mars 2026 |
| **Nature** | Web app autonome, desktop + mobile |

**Limites notables**
- Publication directe : **Instagram seulement** (Facebook, TikTok, LinkedIn, YouTube restent en téléchargement manuel).
- Sorties jugées « standardisées » par la critique : le DNA garantit la cohérence, pas l'originalité.
- L'IA **peut altérer les détails fins** des produits (couleurs, logos, textures) — Google recommande de relire chaque image avant publication, et propose un watermark optionnel dans les réglages.
- Ce n'est pas un CMS : pas d'e-commerce profond, pas d'intégration CRM, pas de logique métier custom.

---

## Sources

**Primaires**
- `blog.google/technology/google-labs/pomelli/` — « Create on-brand marketing content for your business with Pomelli », 28 oct. 2025, par Daniel Adonai (PM, Google Labs) et Bea Alessio (PM, Google DeepMind). *Source de référence pour les 3 étapes.*
- `support.google.com/labs/answer/16715058` — « Get started with Pomelli ». *Confirme le positionnement, l'avertissement sur la fidélité des images, le watermark optionnel, les CGU.*

**Secondaires (détaillées, à recouper)**
- `pasqualepillitteri.it/en/news/2904` — Pomelli Agent / Brand Books / Websites (I/O 2026)
- `pasqualepillitteri.it/en/news/1952` — Product Catalog
- `pasqualepillitteri.it/en/news/5458` — publication directe Instagram (juin 2026)
- `digitaltrends.com` + `incrypted.com` — Photoshoot (févr. 2026)
- `pomelli.help` — site tiers (SEO, non officiel) : utile pour la synthèse, **à ne pas citer comme source Google**

**Vidéo officielle** : `youtube.com/watch?v=rsWPISYv6tQ` — c'est exactement l'embed de la page `labs.google.com/pomelli/about` analysée dans `TEARDOWN.md`.
