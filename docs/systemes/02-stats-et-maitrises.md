# 02 — Stats & maîtrises

> Source : [`stats.ts`](../../src/game/stats.ts), [`maitrise.ts`](../../src/game/maitrise.ts).
> Application des bonus de compte : `computeGlobalMods` dans [`upgrades.ts`](../../src/game/upgrades.ts).
> UI : [`CharacterPanel.tsx`](../../src/components/CharacterPanel.tsx). Refonte majeure : **v0.38**.

## Rôle

Transforme l'équipement en **stats totales** (`computeTotalStats`) puis en **stats dérivées de
combat** (`computeDerived`). Chaque secondaire a une **courbe à soft cap** (rendement décroissant,
jamais de mur sec). La **Maîtrise** a une identité différente par stat primaire dominante.

## Stats primaires

`force, agilite, intelligence, endurance`. La **plus haute des 3 offensives** détermine le build
(auto-attaque + archétype de Maîtrise). Puissance d'une stat : `statPower(v) = 10 + v·2`.

- **Hybride 2-stats** (v0.27) : la 2ᵉ offensive compte pour **`SECOND_STAT_SHARE = 0.2`** dans la
  puissance → le « winner-take-all » est adouci.
- **PV** : `hp = (100 + endurance·12) × (1 + shieldPct)`.
- Les capacités scalent sur **leur** stat (`forcePower`/`agiPower`/`intPower`), pas forcément la dominante.

## Stats secondaires — courbes (v0.38)

`softCap(value, soft, hard)` : pente 1 jusqu'à `soft`, puis dégressif vers l'asymptote `hard`.
`RATING_PER_PERCENT = 25`, `PER_PCT = 2500` (rating pour +100 %).

| Stat | Formule (rating → effet) | Soft → Hard |
|---|---|---|
| **Critique** | base 5 % + rating/10000 | 45 % → 70 % |
| **Dégâts crit** | ×1.5 + softCap(rating/700) | +400 % → +700 % (×5.5 → ×8.5) |
| **Hâte** | 1 + softCap(rating/5000) | +90 % → +140 % (aps max ~2.4) |
| **Pénétration** | rating/20000, **pas de base** | 70 % → 85 % |
| **Précision** | rating/10000 (100 rating/1 %) | 90 % → 99 % |
| **Altération** (DoT) | 1 + rating/4000, **linéaire** | — |
| **Dégâts boss** | 1 + rating/5000, **linéaire** | — |
| **Réduction** (+ Esquive dépréciée) | rating/5000 | 40 % → 60 % |
| **Barrière** | rating/2500 (PV effectifs) | +100 % → +160 % |
| **Résilience** (Tén+Purge fusionnées) | rating/2000, couvre CC **et** altérations | 85 % → 96 % |
| **Vol de vie** ⟡ | rating/20000 | 50 % → 72 % |
| **Surpuissance** ⟡ | 1 + softCap(rating/1500) | ×3 → ×5 |
| **Multifrappe** ⟡ | rating/1500 | 60 % → 85 % |
| **Récupération** ⟡ (CDR) | rating/1500 | 60 % → 82 % |

⟡ = **stat rare** (`RARE_STATS`, apparition très faible, indice 💎).

## Maîtrise — identité par archétype (v0.38)

La Maîtrise fait **autre chose** selon la stat primaire dominante (`masteryFrac = softCap(rating/2500, 0.8, 1.5)`) :

- **Force → bruiser** : `masteryDr` (réduction plate, rating/5000 → 25 %→40 %) **+ Riposte**
  (`riposteChance`, rating/3500 → 50 %→80 %) : être touché renvoie une **frappe complète**
  (scale avec les adds & raids).
- **Agilité → assassin** : petit `masteryMult` plat + **Débordement** : la chance de crit
  **au-dessus du cap** se reverse en `critMult`.
- **Intelligence → glass cannon** : gros `masteryMult` (rating/2500 → +100 %) **+ Surcharge** :
  `damageTakenMult` (rating/5000 → +30 %→60 % de dégâts **subis**).

## Stats dépréciées (v0.38) — toujours fonctionnelles

Plus **rollées ni listées**, mais comptées pour la rétro-compat (vieux objets/talents) :
- **Esquive** → comptée comme **Réduction**.
- **Ténacité + Purge** → comptées comme **Résilience**.
- **Régénération** → comptée comme **Intelligence** (`computeTotalStats` replie `regen` dans `int` :
  le soin scale sur l'Int, donc les uniques/talents de soin restent pertinents sans réécriture).

## Esquive ennemie & hit cap

`ENEMY_DODGE = { elite 10 %, boss 15 %, raidboss 20 % }` (source unique, importée par
enemies/dungeons/raids). La **Précision** l'annule **sur les auto-attaques uniquement** (les sorts
touchent toujours). Hit cap exact : `precisionRatingToCancel(dodge) = dodge × 10000` →
**1000 / 1500 / 2000** rating pour 0 raté contre élite / boss / boss de raid.

## Conseil des Maîtrises — progression de compte (v0.25)

Remplace la puissance **achetable** : **time-gatée**, 3 contrats par **semaine réelle** (fenêtres
d'epoch UTC déterministes, sans serveur).

- **Contrats** (`CONTRACTS`) : 🏰 5 donjons · ☠️ 3 raids · ⚔️ 15 vagues de farm. Crédités
  automatiquement **en jouant** (compteurs `ConseilState`, reset hebdo via `conseilFresh`, mais
  les **Points acquis restent**).
- Contrat rempli = **+1 Point de Maîtrise**, dépensé dans `MAITRISE_NODES` (frappe/vigueur/celerite/
  fortune/savoir/flair) — bonus **volontairement minimes** (~+11 % de combat réparti, tout maxé
  ≈ 19 semaines : `MAITRISE_TOTAL_POINTS`). Sensible sur une année, **jamais décisif**.

> ⚠️ Couplage : les **effets chiffrés** des nœuds vivent dans `computeGlobalMods` (`upgrades.ts`),
> couplés par id. Ajouter un nœud = brancher `maitrise.ts` **et** `upgrades.ts`.

## Interactions

- `DerivedStats` alimente tout [01 Combat & dégâts](01-combat-et-degats.md).
- Les bonus de compte (Conseil + hauts faits + améliorations) se cumulent dans `computeGlobalMods`
  → voir [08 Métiers & craft](08-metiers-et-craft.md) et [09 Méta & live-ops](09-meta-et-live-ops.md).

## Dette / provisoire

- Beaucoup de descriptions de stats sur la fiche sont calculées à la volée (`describeStats`) — bien
  à jour. Les stats dépréciées restent dans `StatKey` pour la migration ; ne pas les générer au loot.
