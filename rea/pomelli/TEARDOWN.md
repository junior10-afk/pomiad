# Pomelli (labs.google.com) — démontage REA

**Cible** : `https://labs.google.com/pomelli/about/`
**Date** : 2026-10-23 · **Méthode** : capture HTTP + `rea analyze-javascript-application` (statique, aucune exécution du code cible)

---

## 1. Verdict

`https://labs.google.com/pomelli` répond **302 → `/pomelli/about`** pour tout visiteur non authentifié. La page fournie **n'est pas l'application** : c'est une coquille marketing statique (6,8 ko de HTML + un bundle Angular de 390 ko).

Conséquence : il n'y a **aucune logique produit, aucun endpoint d'API, aucun prompt, aucun pipeline** à décompiler ici. Le seul contenu propre à Pomelli tient dans 4 chaînes de texte, 4 images et un embed YouTube.

Le produit réel est derrière `accounts.google.com/ServiceLogin?continue=https://labs.google.com/pomelli` — inaccessible en analyse statique sans session Google.

---

## 2. Preuves collectées

| Artefact | URL | Taille | SHA-256 (12) |
|---|---|---|---|
| `about.html` | `labs.google.com/pomelli/about/` | 6 785 o | `e8fd77776166` |
| `bundle/app_bundle.js` | `gstatic.com/_/bettany/MjAyNjEwMjEuMDFfcDA/foundry_about%2Fapp_bundle.js` | 390 503 o | `d33e5c428c06` |
| `bundle/theme.css` | `…/foundry_about%2Fapp/theme.css` | 39 067 o | `12cecd82a9a0` |
| `analysis.json` | sortie REA du bundle | 41,78 Mo | graphe sémantique |

Assets (tous `200 OK`, servis par `…/foundry_about/assets/`) : `hero-left.png` 1 226 124 o · `hero-right.png` 1 537 252 o · `hero-top.png` 382 575 o · `hero-bottom.png` 327 146 o · `google_labs.svg` 11 385 o · `footer-google.svg` 2 379 o.

Négatif notable : `…/foundry_about%2Fapp/app.css` renvoie **404** — les styles sont inlinés dans le bundle, le `<link>` du `<head>` ne sert à rien.

---

## 3. Stack reconstruite (observé dans le bundle)

- **Angular Ivy, composants standalone** — sélecteurs `app-root`, `app-intro` ; code compilé (`defineComponent`, `ngCspNonce`, `[1,"app-intro"]`).
- **Template interne Google « Foundry / Bettany »** — chemin de build `_/bettany/MjAyNjEwMjEuMDFfcDA/foundry_about/` : build daté **2026-10-21**, canal `p0`. C'est le gabarit de page « about » des expériences Labs, pas une app sur mesure.
- **Angular Material 3** — `mat-flat-button`, `mat-mdc-*`, palette par tokens `--mat-sys-*`.
- **zone.js présent** (scheduler, microtasks) — pas de build zoneless.
- **CSS inliné par composant** dans le bundle (le `styles: [...]` compilé contient tout le SCSS, `sourceMappingURL` encore présent : `intro.css.map`).
- **Google Sans Flex** via `fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000`, Material Icons.
- **GA4** : `G-ESCX0B7T6T`, `dataLayer`, `isEea: false`.
- **Garde-fou `window.ppConfig`** (script inline en tête, nonce CSP) : anti-prototype-pollution sur `Object.prototype.__proto__`, heartbeat 0,5, `sendBeacon` vers `csp.withgoogle.com/csp/proto/<productName>`. C'est de l'infra Google, **pas** du code Pomelli.
- `window.BETTANY_CONFIG` (base64) + `<base href="/pomelli/about">`.

---

## 4. Arborescence de la page (reconstruite depuis le template compilé)

```
app-root
└── section-wrapper.section-wrapper--intro
    ├── app-intro                                    (composant rv)
    │   ├── .bg                                      4 images de fond : hero-left/right (desktop),
    │   │                                            hero-top/bottom (≤600px)
    │   ├── .app-header > a.labs-link[href=labs.google.com] > img google_labs.svg
    │   ├── .hero-content > .foundry-badge-wrapper
    │   │   ├── svg.badge-svg (blob 60 pts, stroke var(--mat-sys-primary), clip-path)
    │   │   └── .foundry-badge
    │   │       ├── h1  « Pomelli »                  (160px / 120px / 90px, letter-spacing -8px)
    │   │       └── p   « Easily generate on-brand content for your business »   (max-width 391px)
    │   └── a.cta-button[target=_blank]
    │       └── button[mat-flat-button color=primary] « Let's get started »
    │           → accounts.google.com/ServiceLogin?continue=https://labs.google.com/pomelli
    ├── .video-wrapper > .video-container > iframe youtube.com/embed/rsWPISYv6tQ (100%/100%, allowfullscreen)
    └── .app-footer
        ├── img footer-google.svg
        └── a Privacy Notice · Terms & Privacy · Third Party Notices
            (policies.google.com/privacy, /terms, support.google.com/adspolicy/answer/6086450)
```

Animation : `fadeIn` — `opacity 0 → 1` sur **2 s, délai 500 ms, ease-out** (sur `.bg`).

**CSS mort intéressant** : le bundle embarque `.section-wrapper--description` (`h3` 88px, `min-height: 80vh`, `padding: 10vh 24px`) alors qu'aucun nœud de ce type n'est rendu. La version « description produit » de la page about a été **remplacée par la vidéo** sans nettoyer la feuille de style. C'est le seul indice d'une itération sur cette page.

---

## 5. Design system (directement réutilisable)

Palette Material 3, **thème sombre**, extraite de `theme.css` :

| Rôle | Valeur |
|---|---|
| `background` / `surface` | `#13140e` (noir-olive) |
| `primary` | `#c1cd7d` (olive clair) |
| `on-primary` | `#2c3400` |
| `primary-container` | `#424b08` |
| `secondary` | `#c5caa3` · `secondary-container` `#45492c` |
| `tertiary` | `#05372e` (vert profond) |
| `on-surface` | `#e5e3d9` (crème) · `on-surface-variant` `#c7c8b6` |
| `outline` | `#919282` · `outline-variant` `#46483b` |
| `surface-container` | `#1e1f20` / `-high` `#282a2c` / `-highest` `#333537` |
| `error` | `#ffb4ab` |

Typo : **Google Sans Flex** (axe optique 6→144, poids 1→1000). Échelle hero : 160 / 120 / 90 px selon breakpoint. Breakpoints : **1024 / 768 / 600 px**. Grain de fond : `backdrop-filter: blur(5px)` derrière un `clip-path` en blob, images de fond en `background-size: contain` collées aux bords.

---

## 6. Ce que le visuel encode

Les deux collages du hero ne sont pas décoratifs, ils décrivent le produit :

- **hero-left** : carte palette `#34534d` / `#80979a` / `#d3b79c`, chips de ton de voix (« Inspiring », « Confident », « Authentic », « …forward »), packshots produits, mockup « YOUR BRAND VEGAN SOAP ».
- **hero-right** : carte typographique « **Aa — Ivypresto Headline** », packshots, mockup canette « YOUR BRAND ».

→ L'ADN de marque tel que Google le vend = **palette + typographie + imagerie + ton de voix**, injecté ensuite dans des créas générées. Le nom de police « Ivypresto Headline » est un vrai spécimen (pas une police système), donc la démo suggère une détection de polices réelles.

---

## 7. Faits produit (sources tierces — **non** vérifiés auprès de Google)

- Google Labs × Google DeepMind, expérience lancée publiquement vers le **28 octobre 2025**.
- Entrée : **URL du site** de la marque → analyse → « **Business DNA** » (couleurs, polices, style d'image, ton).
- Sortie : contenus marketing **éditables** (posts sociaux, visuels publicitaires), campagnes multi-plateformes.
- Cible : PME / e-commerçants sans équipe créative ; accès gratuit.

Ces points viennent de `pomelli.help`, `pomelliailabs.com`, `ai-bot.cn` et de la presse secondaire — **aucune source primaire Google** n'a été consultée. À traiter comme contexte, pas comme preuve.

---

## 8. Limites et inconnues

- **Non observé** : aucun runtime exécuté. Rien ici ne prouve un comportement à l'exécution.
- **Hors d'atteinte** : l'application authentifiée (`/pomelli` après login) — pas de session Google, donc pas d'API, pas de modèle, pas de prompt, pas de schéma de données.
- **Pas de SSR** : le HTML est une coquille vide (`<app-root></app-root>`), tout est client-side.
- Le bundle ne contient **aucun** identifiant d'API produit, aucun nom de modèle, aucune clé.
- Le contenu marketing de la page (titre, sous-titre, CTA) est **codé en dur** dans le composant compilé, pas chargé depuis un CMS.

---

## 9. Suites possibles

1. **RE de l'app réelle** — lancer un Chrome avec `--remote-debugging-port`, se connecter avec ton compte, puis `rea analyze-web-bundle` + `export-web-scripts` pour capturer le bundle applicatif, le trafic réseau et le flux Business DNA.
2. **Spécification de reconstruction** — décrire le flux (URL → DNA → génération → éditeur) à partir de l'app capturée, avec les obligations de reconstruction.
3. **Rebuild du landing** — le design system ci-dessus (§5) suffit à reproduire la page à l'identique.
