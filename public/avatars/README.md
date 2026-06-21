# Illustrations d'avatar — spec de génération (v0.43.1)

L'avatar en pied du héros est **UNE illustration réaliste par `classe × palier`**, choisie par
`lookTier` (palier d'allure agrégé de l'équipement). Le détail par-pièce reste dans la grille des 16
slots — ces images sont la **pièce maîtresse esthétique**, pas un inventaire visuel.

> ⚠️ Ces images ne sont PAS générées par l'assistant (ses outils ne produisent pas d'art raster).
> Produis-les via un modèle d'image (Midjourney / SDXL / Flux…) ou un·e artiste, avec ce spec.

## Où déposer + comment activer

1. Enregistre l'image en `public/avatars/<classId>/<tier>.webp`.
2. Ajoute la clé `'<classId>-<tier>'` au set **`AVATAR_ART`** dans
   [`src/game/wardrobe.ts`](../../src/game/wardrobe.ts).
3. Tant qu'un combo n'y est pas, le jeu affiche le **placeholder procédural** pour ce combo — donc on
   peut livrer l'art **incrémentalement, sans jamais rien casser**.

- **`classId`** (10) : `guerrier` `paladin` `dk` · `chasseur` `chaman` · `voleur` `druide` ·
  `mage` `pretre` `demoniste`
- **`tier`** (6) : `0`..`5` (palier d'allure, cf. table ci-dessous)

## Format

| | |
|---|---|
| Format | **WebP** (ou AVIF), qualité ~80 |
| Dimensions | **768 × 1152** (ratio 2:3, portrait) |
| Cadre | **plein pied**, tête-aux-pieds visible, personnage **centré**, même échelle pour TOUS les paliers d'une classe |
| Pose | **debout, héroïque, face caméra**, identique d'un palier à l'autre (seul l'équipement évolue) |
| Fond | sombre neutre **ou** transparent (une aura CSS est ajoutée derrière par le jeu) |
| Style | **réaliste semi-peint** (digital painting), éclairage de jante dramatique, cohérent entre toutes les images |
| Poids | viser < 150 Ko/image (lazy-load par image affichée) |

**Cohérence inter-paliers** : garde la MÊME identité de personnage, pose, cadrage et caméra pour les
6 paliers d'une classe (seul le stuff monte en gamme). Astuce : fixe un *seed* et réutilise le palier 0
comme image de référence pour générer 1→5.

## Échelle de paliers (le « ça monte »)

| Tier | Nom | Gamme d'équipement à représenter |
|---|---|---|
| 0 | Brut | équipement usé, basique, tissu élimé / cuir râpé / métal rouillé. Aventurier débutant. |
| 1 | Affûté | gear propre et fonctionnel, sans ornement. |
| 2 | Ouvragé | armure travaillée, gravures simples, première lueur d'enchantement. |
| 3 | Héroïque | armure élaborée ciselée, gemmes serties, glow subtil, cape. |
| 4 | Glorieux | set légendaire ornementé, effets d'énergie, tissu/métal nobles, présence imposante. |
| 5 | Mythique | divin/radiant, particules, aura puissante, matériaux impossibles, mise en scène dramatique. |

## Gabarit de prompt

```
full-body character portrait of {IDENTITÉ DE CLASSE}, wearing {GAMME DU PALIER},
standing heroic pose facing the viewer, centered, full body visible head to toe,
realistic semi-painted digital art, dramatic rim lighting, dark neutral background,
highly detailed, vertical 2:3 framing --ar 2:3
```

`{IDENTITÉ DE CLASSE}` (catégorie d'armure entre parenthèses) :

- **guerrier** *(plaque)* : a stoic scarred human warrior in heavy plate armor, greatsword
- **paladin** *(plaque)* : a holy knight in radiant plate, warhammer, golden light motifs
- **dk** *(plaque)* : a death knight in dark runed plate, frost/unholy glow, pale glowing eyes
- **chasseur** *(mailles)* : a ranger in studded leather and mail, longbow, quiver, rugged
- **chaman** *(mailles)* : a tribal shaman in mail and fetishes, totem, elemental motifs
- **voleur** *(cuir)* : a hooded assassin in dark leather, twin daggers, shadowy
- **druide** *(cuir)* : a nature druid in leather with antlers and leaf motifs, gnarled staff
- **mage** *(tissu)* : an elemental mage in flowing robes, arcane staff, glowing runes
- **pretre** *(tissu)* : a priest in holy robes, censer/staff, soft light, serene
- **demoniste** *(tissu)* : a warlock in dark robes, grimoire, fel-green fire, sinister

`{GAMME DU PALIER}` : reprendre la colonne de droite de la table des paliers.

> Option (plus tard) : variantes d'arme par type de dégâts (épée de feu, lame givrée…) — non requis
> pour la v0.43.1, le glow élémentaire est déjà ajouté en CSS par-dessus l'image.

---

## Modèle recommandé & prompts prêts à l'emploi

**Modèle : Midjourney v7 (ou v6.1), `--style raw`.** Meilleur rendu réaliste/peint « fantasy » sans
réglage, et surtout **une référence de style (`--sref`) qui verrouille un style identique sur tout le
roster** — c'est LA fonctionnalité clé pour 60 images cohérentes.
Alternatives : **Flux.1 [dev]** (via fal.ai / Replicate ou local) si tu veux de l'API/automatisation
ou un fond transparent natif ; **DALL·E 3 (ChatGPT)** pour du zéro-installation mais cohérence de
série plus faible.

### Méthode de cohérence (à faire UNE fois, puis répéter)
1. Génère 3-4 essais d'un perso « pivot » (ex. `guerrier` palier 3). Garde celui dont le **style** te
   plaît.
2. Récupère son code de style : `--sref <url-de-cette-image>` (ou `--sref random` pour figer un code).
   **Colle ce même `--sref` sur les 60 prompts** → style/palette uniformes.
3. Pour qu'une classe reste le MÊME personnage sur ses 6 paliers : garde le bloc `{SUBJECT}`
   identique, et ajoute une référence de personnage (`--cref <url>` sur v6 / omni-référence `--oref`
   sur v7) pointant sur le palier 3 de cette classe.
4. La pose/cadrage est tenue par le texte fixe du gabarit (« standing, facing viewer, head to toe,
   centered »).

### Gabarit maître (copier-coller, remplacer {SUBJECT} et {TIER})
```
full body character portrait of {SUBJECT}, {TIER}, standing heroic pose facing the viewer,
head to toe fully visible, centered symmetrical composition, realistic semi-painterly digital
painting, dramatic cinematic rim lighting, dark neutral charcoal studio background, highly detailed
character concept art --ar 2:3 --style raw --no text, watermark, logo,
multiple characters, cropped limbs
```

### {SUBJECT} (identité de classe, contient le type d'armure + l'arme)
- **guerrier** : a stoic battle-scarred human warrior in heavy plate armor, wielding a greatsword
- **paladin** : a noble human paladin in radiant plate armor with golden holy motifs, wielding a warhammer
- **dk** : a grim death knight in dark runed plate armor with pale glowing eyes, cold frost aura, wielding a runeblade
- **chasseur** : a rugged ranger in studded leather and light mail, holding a longbow with a quiver
- **chaman** : a tribal shaman in mail adorned with fetishes and totems, holding a totem staff, elemental motifs
- **voleur** : a hooded assassin in dark fitted leather, wielding twin daggers, shadowy
- **druide** : a nature druid in earthy leather with antlers and leaf motifs, holding a gnarled wooden staff
- **mage** : an elemental mage in flowing robes, holding an arcane staff with glowing runes
- **pretre** : a serene priest in layered holy robes, holding an ornate censer-staff, soft radiant light
- **demoniste** : a sinister warlock in dark robes, holding a glowing grimoire wreathed in fel-green flames

### {TIER} (qualité / grandeur de l'équipement)
- **0** : wearing worn, rusted, basic gear with minimal ornamentation, the look of a struggling beginner
- **1** : wearing clean, solid, functional gear, no ornamentation
- **2** : wearing finely crafted gear with simple engravings and a faint enchantment glow
- **3** : wearing elaborate ornate gear with set gemstones, a flowing cape and a subtle magical glow
- **4** : wearing a legendary ornate set radiating arcane energy, noble materials, commanding heroic presence
- **5** : clad in divine radiant god-tier gear with glowing runes, swirling magical particles and a powerful aura, epic and dramatic

### Exemples entièrement assemblés
`guerrier` **palier 0** :
```
full body character portrait of a stoic battle-scarred human warrior in heavy plate armor, wielding a
greatsword, wearing worn, rusted, basic gear with minimal ornamentation, the look of a struggling
beginner, standing heroic pose facing the viewer, head to toe fully visible, centered symmetrical
composition, realistic semi-painterly digital painting, dramatic cinematic rim lighting, dark neutral
charcoal studio background, highly detailed character concept art --ar 2:3 --style raw --no
text, watermark, logo, multiple characters, cropped limbs
```
`guerrier` **palier 5** :
```
full body character portrait of a stoic battle-scarred human warrior in heavy plate armor, wielding a
greatsword, clad in divine radiant god-tier gear with glowing runes, swirling magical particles and a
powerful aura, epic and dramatic, standing heroic pose facing the viewer, head to toe fully visible,
centered symmetrical composition, realistic semi-painterly digital painting, dramatic cinematic rim
lighting, dark neutral charcoal studio background, highly detailed character concept art --ar 2:3
--style raw --no text, watermark, logo, multiple characters, cropped limbs
```
(ajoute `--sref <code>` une fois que tu l'as choisi, sur TOUS les prompts.)

### Après génération (3 étapes)
1. **Recadrer/redimensionner** en 768×1152 (2:3).
2. **Convertir en WebP** ~q80, viser < 150 Ko (squoosh.app, `cwebp`, ou `sharp` déjà dans le repo).
3. Déposer en `public/avatars/<classe>/<palier>.webp` + ajouter `'<classe>-<palier>'` à `AVATAR_ART`
   ([wardrobe.ts](../../src/game/wardrobe.ts)).

> Fond : le « charcoal » sombre se fond dans l'UI (#0a0e16) et l'aura CSS passe derrière. Si tu
> préfères du transparent, passe les images dans un détoureur (remove.bg / Photoroom / `rembg`) après.

---

# Mode CALQUES (v0.43.2) — corps de base + pièces par palier

C'est l'approche « voir chaque pièce se poser ». Au lieu d'une illustration entière, on a **un corps de
base nu** + **un calque transparent par pièce**, empilés en jeu. Les calques s'extraient par
**différence** avec le corps de base → il faut donc générer chaque pièce en **habillant le MÊME corps**
(inpaint), pour garder pose / lumière / cadrage identiques.

**Règles d'or MJ pour que l'extraction soit propre :**
- Génère le corps de base UNE fois, puis travaille **dans l'Éditeur MJ sur cette image** (Vary Region /
  inpaint) — ne régénère pas un nouveau corps à chaque pièce.
- **Lumière neutre et uniforme**, **fond sombre uni**, **ratio 2:3**, pose figée. Plus c'est stable,
  plus le diff est net.
- `--style raw --v 8.1` (ou sélectionne la v8.1 dans tes réglages).

## 1. Corps de base (1 image) → `npm run avatar guerrier base ./corps.png`
```
full body portrait of a muscular bare-chested human warrior wearing only a simple cloth loincloth, barefoot, standing straight and symmetrical, facing the viewer, arms slightly away from the body, full body head to toe visible, neutral even studio lighting, plain dark charcoal background, realistic semi-painterly digital painting, character reference sheet, highly detailed --ar 2:3 --style raw --v 8.1 --no armor, weapon, helmet, cape, shield, text, watermark
```

## 2. Échelle de matériaux par palier — `{MAT}`
À insérer dans les prompts de pièces ci-dessous (un palier = une ligne).

| Palier | `{MAT}` |
|---|---|
| 0 · Brut | `worn rusted crude iron and patched leather, scratched, no ornament` |
| 1 · Affûté | `clean solid iron and hardened leather, simple and functional` |
| 2 · Ouvragé | `finely forged steel with simple engravings and a faint enchantment sheen` |
| 3 · Héroïque | `ornate engraved steel with inlaid gemstones and a subtle magical glow` |
| 4 · Glorieux | `legendary ornate silver-and-gold armor radiating arcane energy` |
| 5 · Mythique | `divine radiant god-tier armor with glowing runes and swirling magical particles` |

## 3. Pièces — inpaint sur le corps de base
Pour chaque pièce : ouvre le corps dans l'Éditeur, **masque la zone**, et tape la ligne en remplaçant
`{MAT}` par le palier voulu. Puis extrais le calque.

| Région | Prompt d'inpaint (remplace `{MAT}`) | Extraction |
|---|---|---|
| tete | `a {MAT} plate helmet covering the head, same pose and neutral lighting, plain dark background` | `npm run avatar-layer guerrier tete <tier> ./img.png` |
| epaules | `{MAT} plate pauldrons on both shoulders, same pose and lighting, plain dark background` | `… epaules <tier> …` |
| cape | `a {MAT} cape hanging from the shoulders down the back, same pose, plain dark background` | `… cape <tier> …` |
| torse | `a {MAT} plate chestplate on the torso, same pose and lighting, plain dark background` | `… torse <tier> …` |
| poignets | `{MAT} plate bracers on both forearms, same pose, plain dark background` | `… poignets <tier> …` |
| mains | `{MAT} plate gauntlets on both hands, same pose, plain dark background` | `… mains <tier> …` |
| jambes | `{MAT} plate legguards covering the legs, same pose, plain dark background` | `… jambes <tier> …` |
| pieds | `{MAT} armored plate sabatons on the feet, same pose, plain dark background` | `… pieds <tier> …` |
| arme | `the warrior gripping a {MAT} greatsword in the right hand, blade pointing down, same pose, plain dark background` | `… arme <tier> …` |
| bouclier | `the warrior holding a {MAT} plate shield in the left hand, same pose, plain dark background` | `… bouclier <tier> …` |

`<tier>` = 0..5. Ex. tête palier 0 :
```
a worn rusted crude iron plate helmet covering the head, same pose and neutral lighting, plain dark background
```
Torse palier 5 :
```
a divine radiant god-tier plate chestplate on the torso with glowing runes and swirling magical particles, same pose and lighting, plain dark background
```

## 4. Régler l'extraction
`npm run avatar-layer …` écrit `public/avatars/guerrier/<region>-<tier>.webp`. S'il **déborde**
(capture du fond/corps) → `THRESH=55 npm run avatar-layer …` ; s'il **troue** la pièce → baisse THRESH
(ex. 28). Puis équipe la pièce correspondante en jeu pour la voir se composer.

> **Conseil** : prouve d'abord le **palier 0** sur 3-4 pièces (tete/torse/epaules/arme). Si l'alignement
> et les bords tiennent, déroule les 6 paliers × 10 pièces. Sinon, on saura qu'il faut passer en 3D.
