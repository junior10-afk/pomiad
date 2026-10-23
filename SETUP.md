# Ce qu'il me faut pour que PomiAD soit un vrai Pomelli

**Une seule clé suffit** : une clé Google AI Studio (Gemini). Elle débloque le texte **et** les images.
Gratuite, sans carte bancaire, quota large pour un usage de test.

---

## 1. Où prendre la clé

1. Va sur **https://aistudio.google.com/apikey**
2. Connecte-toi avec un compte Google.
3. « Create API key » → choisis un projet → copie la clé (`AIza…`).

Pour le texte seul, c'est tout. La même clé sert aussi pour `gemini-2.5-flash-image` (Nano Banana).

---

## 2. Où la coller

Ouvre **`.env`** à la racine du projet (déjà créé, vide) et remplis :

```ini
GEMINI_API_KEY=AIza...
```

C'est tout. Le reste a des valeurs par défaut :

```ini
LLM_PROVIDER=auto        # détecte tout seul la clé présente
LLM_MODEL=               # vide = gemini-2.5-flash
IMAGE_PROVIDER=          # vide = même provider que le texte
IMAGE_MODEL=             # vide = gemini-2.5-flash-image
```

Puis relance le serveur :

```bash
node server/index.js
```

Au démarrage il affiche l'état réel :

```
  PomiAD  http://127.0.0.1:8787
  .env    chargé
  texte   gemini / gemini-2.5-flash
  image   gemini / gemini-2.5-flash-image
```

---

## 3. Vérifier que ça marche

```bash
curl -s http://127.0.0.1:8787/api/health
```

`llm.configured` et `image.configured` doivent passer à `true`.
Dans l'interface, la pastille en haut à droite affiche `gemini · gemini-2.5-flash`
au lieu de `mode local`.

---

## 4. Ce que la clé change, endpoint par endpoint

| Endpoint | Sans clé | Avec clé |
|---|---|---|
| `POST /api/analyze` | crawler réel + palette/typo/ton extraits par règles | idem, **plus** la marque, la promesse, l'audience et le ton réécrits par le modèle à partir des signaux |
| `POST /api/campaigns` | 3 angles à partir de gabarits | 3 angles **écrits** avec le ton de voix, headlines ≤ 52 caractères |
| `POST /api/edit` | parseur de 10 intentions | langage naturel libre : « fais plus respirer », « parle de la nouvelle collection » |
| `POST /api/image` | bouton inactif, message explicite | fond photographique généré (Nano Banana), composé sous le texte avec un voile de lisibilité |

Le crawler, lui, fonctionne **sans aucune clé** — c'est du code local, pas un service.

---

## 5. Autres fournisseurs (optionnel)

Le serveur est agnostique. Une clé suffit, la détection est automatique (`LLM_PROVIDER=auto`).

| Provider | Variable | Modèle texte par défaut | Modèle image |
|---|---|---|---|
| Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` | `gemini-2.5-flash-image` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` | `gpt-image-1` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` | — (texte seulement) |

Si tu as les deux, force le choix avec `LLM_PROVIDER=gemini` ou `openai`.
Les noms de modèles évoluent : si un appel renvoie « model not found », mets le nom courant
dans `LLM_MODEL` / `IMAGE_MODEL` sans toucher au code.

---

## 6. Sécurité

- Les clés vivent **uniquement** dans `.env`, lu par le serveur Node. Elles ne sont jamais
  envoyées au navigateur : le front appelle `/api/*`, jamais Google directement.
- `.env` est dans `.gitignore`. Ne le commit pas.
- Le serveur écoute sur `127.0.0.1` seulement — pas exposé au réseau.

---

## 7. Ce qui reste à ma charge une fois la clé en place

Je pourrai alors :
- régler les prompts sur de vrais résultats (longueurs, ton, cohérence des trois angles) ;
- ajouter la génération d'image **à partir d'un produit** (photo envoyée comme référence) ;
- faire tourner une évaluation : 10 sites, comparer DNA extrait vs DNA attendu.

Dis-moi juste quand la clé est dans `.env`.
