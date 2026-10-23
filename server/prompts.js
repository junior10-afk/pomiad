'use strict';

const SYSTEM_DNA = `Tu es directeur de création. À partir des signaux réellement extraits d'un site
(titre, description, couleurs, polices, texte visible), tu construis l'identité de marque utilisable
pour produire des publicités. Tu ne fabriques jamais d'information : si un signal manque, tu restes
générique plutôt que d'inventer un fait précis (chiffre, label, prix, certification).
Tu écris en français.`;

function dnaPrompt(signals) {
  const colors = signals.colors.slice(0, 16).map((c) => c.hex + ' (' + c.count + '×)').join(', ');
  const fonts = signals.fonts.slice(0, 5).map((f) => f.name + ' (' + f.count + '×)').join(', ');
  const user = `Signaux du site
Titre : ${signals.title || '(aucun)'}
Description : ${signals.description || '(aucune)'}
Couleurs détectées (les plus utilisées d'abord) : ${colors || '(aucune)'}
Polices déclarées : ${fonts || '(aucune)'}
Texte visible (extrait) : ${signals.text.slice(0, 2500)}

Réponds avec ce JSON exactement :
{
  "brand": "nom de marque lisible, 1-3 mots, sans slogan",
  "offer": "ce que la marque vend, une seule ligne, max 88 caractères, concret",
  "audience": "à qui ça s'adresse, une ligne, max 90 caractères",
  "tone": ["adjectif", "adjectif", "adjectif"],
  "palette": { "bg": "#hex", "ink": "#hex", "primary": "#hex", "secondary": "#hex", "accent": "#hex" }
}

Contraintes palette :
- choisis en priorité parmi les couleurs détectées ci-dessus ;
- bg = la couleur de fond dominante, ink = une couleur de texte lisible dessus (contraste ≥ 4.5) ;
- primary = la couleur de marque la plus reconnaissable ; secondary et accent = deux nuances distinctes ;
- si les couleurs détectées sont inutilisables (site monochrome, erreurs), propose une palette cohérente
  avec le positionnement, en hexadécimal valide.`;

  return { system: SYSTEM_DNA, user };
}

const SYSTEM_CAMPAIGN = `Tu es concepteur-rédacteur publicitaire. Tu écris des accroches courtes,
concrètes, sans jargon marketing, sans superlatif creux, sans emoji. Tu respectes le ton de voix fourni
et tu ne promets rien que la marque ne puisse tenir. Tu écris en français.`;

function campaignsPrompt(dna) {
  const user = `Marque : ${dna.brand}
Ce qu'elle vend : ${dna.offer}
Audience : ${dna.audience}
Ton de voix : ${(dna.tone || []).join(', ')}
Palette : fond ${dna.palette.bg}, encre ${dna.palette.ink}, primaire ${dna.palette.primary}

Écris trois angles de campagne distincts :
1. "Manifeste" — une prise de position, pas un argumentaire produit.
2. "Produit" — le bénéfice concret, au plus près de l'usage.
3. "Preuve" — la confiance, l'usage dans le temps, sans inventer de chiffre.

Réponds avec ce JSON exactement :
{
  "campaigns": [
    { "angle": "Manifeste", "kicker": "1-2 MOTS EN MAJUSCULES", "headline": "max 52 caractères", "sub": "max 90 caractères", "cta": "2-3 mots", "layout": 0 },
    { "angle": "Produit",  "kicker": "...", "headline": "...", "sub": "...", "cta": "...", "layout": 1 },
    { "angle": "Preuve",   "kicker": "...", "headline": "...", "sub": "...", "cta": "...", "layout": 2 }
  ]
}

Contraintes strictes :
- headline ≤ 52 caractères, sub ≤ 90, cta ≤ 22, kicker ≤ 18 ;
- les trois headlines ne commencent pas par le même mot ;
- aucun emoji, aucun #hashtag, aucun point d'exclamation ;
- layout vaut 0, 1 ou 2 et doit différer entre les trois angles.`;

  return { system: SYSTEM_CAMPAIGN, user };
}

const SYSTEM_EDIT = `Tu pilotes un éditeur de créa publicitaire. On te donne l'état courant et une
instruction en langage naturel. Tu renvoies uniquement les champs à modifier, jamais tout l'objet.
Tu ne modifies que ce que l'instruction demande. Tu écris en français.`;

function editPrompt(dna, creative, instruction) {
  const user = `État courant du créa :
titre = ${JSON.stringify(creative.headline)}
sur-titre = ${JSON.stringify(creative.kicker)}
bouton = ${JSON.stringify(creative.cta)}
échelle du titre = ${creative.scale}
disposition = ${creative.layout} (0 éditorial, 1 aplat, 2 collage)
bouton affiché = ${creative.showCta}
palette = ${JSON.stringify(dna.palette)}

Instruction de l'utilisateur : ${JSON.stringify(instruction)}

Réponds avec ce JSON :
{ "patch": { ... }, "note": "ce que tu as fait, max 60 caractères, en français" }

Champs autorisés dans patch (uniquement ceux à changer) :
- "headline" (≤ 52 caractères), "kicker" (≤ 18, majuscules), "cta" (≤ 22)
- "scale" (nombre entre 0.5 et 1.7)
- "layout" (0, 1 ou 2)
- "showCta" (booléen)
- "palette": { "bg" | "ink" | "primary" | "secondary" | "accent" } en hexadécimal

Si l'instruction est une demande de contenu ("parle de la nouvelle collection"), réécris le titre et
le sous-titre en conséquence. Si elle est ambiguë, applique l'interprétation la plus plausible et dis-le
dans "note".`;

  return { system: SYSTEM_EDIT, user };
}

function imagePrompt(dna, creative) {
  return `Photographie publicitaire de marque, sans aucun texte ni logo ni typographie.
Sujet : ${dna.offer}.
Ambiance et ton : ${(dna.tone || []).join(', ')}.
Palette imposée : dominante ${dna.palette.primary}, accents ${dna.palette.secondary} et ${dna.palette.accent}, fond ${dna.palette.bg}.
Style : éditorial, lumière naturelle latérale, matière réelle, profondeur de champ courte, grain fin.
Composition : sujet décentré, large zone calme et peu contrastée pour recevoir du texte.
Interdit : texte, lettres, watermark, logo, visage identifiable, collage, illustration vectorielle.`;
}

module.exports = { dnaPrompt, campaignsPrompt, editPrompt, imagePrompt };
