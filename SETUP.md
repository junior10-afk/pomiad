# Brancher une API : clés et modèles

Tout se règle depuis **Réglages**, en bas du rail de gauche.

---

## 1. Les clés

Trois lignes, une par fournisseur. Remplis seulement celles que tu as — les autres restent vides
et sont simplement ignorées.

| Fournisseur | Où prendre la clé | Appel direct depuis le navigateur |
|---|---|---|
| **Gemini** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | ✅ vérifié |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/settings/keys) | ✅ vérifié |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | ❌ bloqué par CORS |

Sans clé, l'app n'écrit rien : elle lit le site et affiche le profil, puis s'arrête. Les campagnes
et l'édition au prompt demandent un modèle — c'est volontaire, il n'y a pas de texte de secours.

Les clés vont dans le `localStorage` de **ton** navigateur et partent directement vers le
fournisseur. Elles ne transitent jamais par le serveur de l'app. **Tout effacer** les supprime.

Le point vert à droite d'une ligne indique une clé présente.

---

## 2. Les modèles, capacité par capacité

Sous les clés, un tableau à trois lignes — **Texte**, **Image**, **Vidéo** — et deux colonnes :
le fournisseur, puis le modèle.

- **Auto** partout par défaut : l'app prend le premier fournisseur qui a une clé et le modèle
  par défaut de ce fournisseur.
- Tu peux forcer un fournisseur précis (les fournisseurs sans clé sont grisés) et un modèle précis.
- La liste des modèles est **lue chez le fournisseur** quand il l'expose (Gemini), filtrée par
  capacité : les modèles d'image n'apparaissent pas dans « Texte », et les embeddings, TTS,
  Imagen et Veo sont écartés. Pour OpenAI et Anthropic, une courte liste de repli est utilisée.
- Chaque changement est enregistré immédiatement, sans bouton.

Défauts en mode Auto :

| Capacité | Gemini | OpenAI | Anthropic |
|---|---|---|---|
| Texte | `gemini-2.5-flash` | `gpt-4o-mini` | `claude-sonnet-4-5` |
| Image | `gemini-2.5-flash-image` | `gpt-image-1` | — |

### Ce que pilote chaque capacité

- **Texte** → profil de marque, trois angles de campagne, édition au prompt.
- **Image** → bouton **Fond IA** du studio : un fond photographique composé sous le texte.
- **Vidéo** → **pas branché**, et la ligne est volontairement grisée. Générer une vidéo demande un
  modèle dédié (Veo, Sora), une génération de plusieurs minutes et un lecteur dans le studio :
  c'est une passe à part, pas une case à cocher. Je ne mets pas un bouton qui ne fait rien.

---

## 3. Vérifier que ça marche

1. Colle la clé → **Enregistrer**.
2. **Tester** → doit afficher `ok — gemini / gemini-2.5-flash`.
3. La pastille du rail passe de `gabarits locaux` à `gemini · gemini-2.5-flash`.
4. Analyse un site : la case **Source** du profil doit dire **« analyse + modèle »**.
   Si elle dit « analyse directe », le modèle n'a pas été appelé.

---

## 4. Le chemin serveur (`.env`), en secours

Utile pour OpenAI (CORS) ou pour un déploiement partagé où l'on ne veut pas que chaque visiteur
colle sa clé.

```ini
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
LLM_PROVIDER=auto        # auto | gemini | openai | anthropic
LLM_MODEL=
IMAGE_PROVIDER=          # gemini | openai | none
IMAGE_MODEL=
```

Ordre de priorité à l'exécution : **clé des réglages** → clé du serveur → gabarits.

Le crawler, lui, ne dépend d'aucune clé.

---

## 5. Sécurité

- Une clé saisie dans les réglages ne quitte pas le navigateur.
- `.env` n'est pas versionné. Sur un déploiement public, mets la clé en **variable d'environnement
  de la plateforme**, jamais dans `.env` : le fichier partirait dans l'archive au prochain déploiement.
- Le serveur écoute sur `127.0.0.1` en local, `0.0.0.0` seulement quand `PORT` est défini.
