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
