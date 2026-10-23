# Brancher un modèle de langage

Deux chemins. Le premier ne demande rien d'autre qu'une clé collée dans l'app.

---

## 1. Dans l'app (recommandé)

1. Ouvre **Réglages** en bas du rail de gauche.
2. Choisis le fournisseur.
3. Colle la clé, clique **Enregistrer**, puis **Tester la clé**.
4. La pastille du rail passe de `gabarits locaux` à `gemini · gemini-2.5-flash`.

La clé est stockée dans le `localStorage` de **ton** navigateur. Elle part directement du
navigateur vers le fournisseur : elle ne transite jamais par le serveur de l'app.

### Où prendre une clé

| Fournisseur | Lien | Modèle par défaut | Appel direct depuis le navigateur |
|---|---|---|---|
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-2.5-flash` | ✅ vérifié |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) | `claude-sonnet-4-5` | ✅ vérifié |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `gpt-4o-mini` | ❌ bloqué par CORS |

Gemini a un palier gratuit et suffit largement. Pour OpenAI, le navigateur est bloqué par CORS :
utilise le chemin serveur ci-dessous.

Le champ **Modèle** est optionnel : laissé vide, le défaut du fournisseur s'applique. Les noms de
modèles évoluent — si l'appel renvoie « model not found », mets le nom courant dans ce champ.

### Ce que la clé change

| Sans clé | Avec clé |
|---|---|
| profil de marque calculé par règles | marque, promesse, audience et ton réécrits par le modèle |
| trois angles à partir de gabarits | trois angles écrits, ton respecté, longueurs contraintes |
| dix commandes d'édition | langage naturel libre |
| — | fonds de créa générés (voir §3) |

Le crawler, lui, fonctionne sans aucune clé.

---

## 2. Côté serveur (`.env`)

Utile pour OpenAI, ou pour un déploiement partagé où l'on ne veut pas que chaque visiteur colle
sa clé. La clé reste alors sur la machine et le front appelle `/api/*`.

```ini
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LLM_PROVIDER=auto        # auto | gemini | openai | anthropic
LLM_MODEL=               # vide = défaut du provider
IMAGE_PROVIDER=          # gemini | openai | none
IMAGE_MODEL=
```

Puis `node server/index.js`. Au démarrage :

```
  texte   gemini / gemini-2.5-flash
  image   gemini / gemini-2.5-flash-image
```

Ordre de priorité à l'exécution : **clé saisie dans les réglages** → clé du serveur → gabarits.

---

## 3. Images (optionnel)

Le bouton **Fond IA** du studio génère un fond photographique composé sous le texte. Il nécessite
`IMAGE_PROVIDER` + une clé côté serveur — ce chemin n'est pas disponible depuis les réglages,
car la génération d'image n'est pas exposée par les trois API texte de la même façon.

Sans clé image, les créas restent composés en vectoriel : c'est le mode par défaut, et il est
volontairement propre.

---

## 4. Sécurité

- La clé saisie dans les réglages ne quitte pas le navigateur. Efface-la avec **Effacer**.
- `.env` n'est pas versionné (`.gitignore`). Vérifié : absent du dépôt.
- Le serveur écoute sur `127.0.0.1` en local, `0.0.0.0` seulement quand `PORT` est défini.
- Sur un déploiement public, mets la clé en **variable d'environnement de la plateforme**, jamais
  dans `.env` : le fichier partirait dans l'archive au prochain déploiement.
