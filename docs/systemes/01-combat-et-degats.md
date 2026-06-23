# 01 — Combat & dégâts

> Source : [`combat.ts`](../../src/game/combat.ts), [`damage.ts`](../../src/game/damage.ts),
> [`resist.ts`](../../src/game/resist.ts), moteur dans [`combatEngine.ts`](../../src/game/combatEngine.ts), orchestration dans [`store.ts`](../../src/game/store.ts)
> (`tick`, `tickHeroStatuses`, `tickEnemyAbilities`). UI : [`CombatPanel.tsx`](../../src/components/CombatPanel.tsx).

## Rôle

Le moteur de combat **idle** : l'équipe auto-attaque selon la Hâte, lance ses capacités au
cooldown, subit les frappes ennemies (typées + télégraphes), applique DoT/HoT, gère mort/repli.
Les **7 types de dégâts** et le système de **résistances relatives** en sont la colonne vertébrale.

## Les 7 types de dégâts

`physique, feu, froid, foudre, arcane, ombre, nature` (`DAMAGE_TYPES`, `DAMAGE_TYPE_LIST`).

- **Profil de dégâts** (`DamageProfile`) = `{ profile, bonus, mainType }` :
  - `profile` = répartition (somme 1) ; `bonus` = bonus multiplicatif par type.
- Construit par `computeDamageProfile(equipment, keystones)` à partir de **tout l'équipement** :
  - l'arme principale pose un poids de base (`WEAPON_BASE_WEIGHT = 1`) sur son type ;
  - chaque affixe `+% type` ajoute du **poids** (`AFFIX_PROFILE_SHARE = 0.7`) ET du **bonus**
    multiplicatif (`AFFIX_BONUS_SHARE = 0.5`) → empiler du Feu sur une arme Physique fait
    basculer le profil vers le Feu ;
  - keystones : `convertDamage` (déplace), `splashType`/`splashFromMain` (ajoutent sans retirer),
    `convertFromMain` (alchimiste, basé sur le type d'arme).
- **Soft cap du bonus par type** : `softCap(bonus, TYPE_BONUS_SOFT=0.4, TYPE_BONUS_HARD=0.8)`.
  Plein rendement à +40 %, asymptote +80 %. Empêche qu'empiler 16 lignes d'un type domine l'ilvl
  (régression mesurée par `npm run weights`, corrigée v0.22 puis v0.35).

### Triangle d'élément (v0.37)

`ELEMENT_COUNTER` : paires mutuelles `feu↔froid`, `foudre↔nature`, `arcane↔ombre`. Le **Physique
est neutre**. Un ennemi **résiste son propre élément** (`+ELEM_SELF_RESIST = 0.15`) et est
**vulnérable à l'opposé** (`−ELEM_VULN = 0.20`, résist < 0 = vrai bonus de dégâts).
`elementAffinityResist(element, base)` construit ça pour le **farm et les donjons** (les raids ont
leur propre check, voir [07](07-donjons-et-raids.md)). → matcher l'élément de ses sorts au contenu
devient payant, et le multi-classe est un levier (apporter le contre).

### Sorts vs auto-attaques (v0.37 « Piste C »)

- **Auto-attaques** : multiplicateur = `profileDamageMult(p)` (moyenne pondérée du profil).
- **Sorts** : `spellTypeMult(p, spellTypes)` = blend entre la moyenne du profil et le bonus du
  **propre type du sort**, contrôlé par **`SPELL_TYPE_MATCH = 0.7`** (1 = matching pur, 0 = ancien).
  Un sort multi-élément prend le **mieux stacké** de ses types (`spellElementTypes`). → recalibrable
  via `npm run ttk`.

## Résolution d'un coup — `rollHit(derived, profile, enemy, opts)`

Ordre exact :
1. **Esquive ennemie** : `effDodge = max(0, enemy.dodge − precision)` → coup `miss` possible (sauf `forceCrit`).
2. **Critique** : `crit = random < min(0.98, critChance + bonusCrit)` ; `critMult` si crit.
3. **Dégâts bruts** : `power × masteryMult × overpower × critMult × bonusMult`
   - `× bossDamageMult` si boss/élite ; `× execute.mult` si PV ennemi ≤ `execute.threshold`.
4. **Armure** (part Physique seulement) : `armorMitigation(armor', power) = armor'/(armor'+50+power)`
   avec `armor' = armor × (1−penetration) × (1−sunder)` (Brèche du Tambour de siège).
5. **Par type** : `typed = raw × frac × (1 + bonus[type])` ; Physique `× (1−armorMit)` ;
   résist ennemie `res` (amputée par la Pénétration si `res > 0` ; les vulnérabilités ignorent la pén).
6. `damage = max(1, round(Σ typed))` ; `heal = round(damage × leech)`.

## Dégâts subis — `incomingDps(...)`

1. **Multiplicateur d'exigence de type** d'abord : `resistMult(req, heroResist[type], reqReduction)`.
2. Puis **atténuation générique** bornée : `genericMitigation(derived, extra)`.

### Résistances relatives — `resist.ts` (modèle v0.24)

La résist du héros est en **POINTS, non plafonnés** ; elle n'atténue pas en % mais **annule la
punition** des attaques typées. Chaque attaque ennemie porte une exigence `req` :

```
M = 1 + RESIST_KMAX · min(1, déficit / RESIST_DSCALE)^RESIST_P     déficit = max(0, req − résist)
```

| Knob | Valeur | Effet |
|---|---|---|
| `RESIST_KMAX` | **5** | Punition max ×(1+5) = ×6 à déficit total. |
| `RESIST_P` | **1.35** | Forme de courbe ; <1.6 = les déficits moyens piquent tôt. |
| `RESIST_DSCALE` | **250** | Déficit (points) déclenchant la punition max. |

Gradation des exigences par contenu : **farm** `farmReq(stage)` (0 avant la vague 45, cap 60 → ×1.7),
**donjon** `dungeonReq(level)` (cap 120 → ×2.9), **raid** (req 100-430+ → ×2.5…×6, **obligatoire**).
`resistSurplus` (points au-delà des exigences) alimente l'archétype Égide.

### Atténuation générique — `genericMitigation`

`g = (1 − flatDr) × (1 − masteryDr) × extraMitigation`, **borné par `EFFECTIVE_DR_CAP = 0.8`**
(on encaisse toujours ≥ 20 %), puis `× damageTakenMult` (la « Surcharge » de l'Int peut faire
**dépasser 1** = glass cannon). L'**Esquive a été retirée** en v0.38 (repliée en Réduction).

## DPS théorique (affichage) — `theoreticalDps`

`power × masteryMult × overpower × avgCrit × attacksPerSecond × typeMult × (1+multistrike)`.
Ignore armure/résistances (c'est l'estimation affichée, pas le DPS réel en combat).

## Boucle de combat (`combatEngine.ts` + `store.ts`)

> Le **pas de combat pur** (`partyCombatStep`/`partyCombatStepMulti` + l'état transitoire :
> cooldowns, compteurs de gemmes, accumulateurs de runes/pactes…) vit dans
> [`combatEngine.ts`](../../src/game/combatEngine.ts). Le **store** orchestre (tick à 5 Hz,
> donjons/raids, loot, XP, log, sauvegarde) et l'appelle via `CombatMods`.

`tick(dt)` à 5 Hz résout un pas : auto-attaques (cadence = Hâte), capacités auto-lancées au
cooldown (avec demandes de **lancement manuel** en attente), `tickHeroStatuses` (DoT/HoT de
l'équipe, le Faucheur se soigne d'une fraction du DoT), `tickEnemyAbilities` (capacités ennemies
**télégraphiées**), application des dégâts, **menace/aggro** (l'ennemi frappe la plus haute menace
cumulée), mort d'un perso → continue avec les survivants, équipe à terre → **repli**, sinon butin +
XP + or. Les cooldowns, compteurs de gemmes et états d'archétypes sont **transitoires** (non persistés).

## Interactions

- Stats dérivées (`power`, `critChance`, `penetration`, `leech`…) → [02 Stats & maîtrises](02-stats-et-maitrises.md).
- Génération d'ennemis, `req`, techniques signature → [enemies.ts](../../src/game/enemies.ts) et [03 Progression](03-progression-et-monde.md).
- Capacités lancées en combat → [06 Classes, talents & pouvoirs](06-classes-talents-pouvoirs.md).
- Gemmes de condition (procs en combat) & runes de temps → [05 Uniques, sets & gemmes](05-uniques-sets-gemmes.md).

## Dette / provisoire

- La résist ennemie est **uniforme par type** : `spellResistMult` est donc une atténuation égale
  sur tous les éléments (contrée par la Pénétration). Affinité élémentaire mise à part.
- Équilibrage vérifié par `npm run sim` / `ttk` / `survival` / `weights` — à relancer après tout
  changement de scaling.
