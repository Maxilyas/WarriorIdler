# Warrior Idler — Refonte v0.18 (contrat de design)

> Document de référence pour la refonte « tout d'un coup » décidée après le retour
> d'expérience. Cible : **jeu sur mobile**. Toutes les décisions ci-dessous sont
> validées par le joueur sauf mention « (reco Claude — à confirmer) ».
> On garde le combat **idle** comme socle, le **manuel** vient le dynamiser.

---

## 0. Principes directeurs

- **Plus lent, plus profond.** Le starter doit durer **≥ 1 h** avant le palier 25, avec
  les mécaniques introduites **progressivement** (révélation par jalons d'action, pas par compteur).
- **Le stuff fait le travail**, pas le niveau. Sans équipement on plafonne vite.
- **Chaque menace ennemie = un contre dans ton kit.** L'arsenal défensif (résistances par
  type, réduction, esquive, barrière, ténacité, régén, + nouvelle stat **Purge**) doit
  enfin servir, car les ennemis acquièrent de vrais sorts typés et télégraphiés.
- **Mix mur dur + ralentissement souple** : on bloque quand on est clairement sous-équipé,
  mais la progression reste possible, juste lente.

---

## 1. Biomes (refonte du cœur de farm)

Remplace le `stage`/`bestStage` global unique par **7 biomes = les 7 types de dégâts**,
chacun avec **sa propre progression de paliers**. Le joueur **choisit le biome actif** via
des icônes. `bestStage` global = **max sur tous les biomes** (sert au déblocage donjons/raids).

### Déblocage (ÉQUITABLE — validé)
Principe : **aucun build ne doit être avantagé par l'ordre de déblocage.** Les éléments d'un
même « niveau de rareté » se débloquent **ensemble**, sur un jalon **neutre**, pour qu'on puisse
aller direct sur l'élément qui colle à son build.
- **Physique** : débloqué au départ (biome d'apprentissage, dégâts physiques purs).
- **Feu + Froid + Foudre + Nature** (4 communs) : débloqués **ENSEMBLE** au palier **20 en Physique**
  (jalon neutre que tout le monde traverse).
- **Arcane + Ombre** (2 rares) : débloqués **ENSEMBLE** au **meilleur palier tous biomes ≥ 50**.

### Ennemis par biome
- Physique = **physique pur** (apprentissage : on découvre l'équipement sans pression élémentaire).
- Tous les autres = **physique + leur élément** (toujours un mix, jamais mono-élément pour l'instant),
  avec **une technique signature télégraphiée** qui enseigne un contre précis :

| Biome | Élément | Technique signature | Contre principal |
|---|---|---|---|
| Physique | physique | Saignement (DoT) + Charge (burst télégraphié) | régén / Purge ; barrière / esquive |
| Feu | feu | Brûlure (DoT) | résist feu + **Purge** + régén |
| Froid | froid | Gel (contrôle / ralentissement) | **ténacité** + résist froid |
| Foudre | foudre | Décharge (burst télégraphié) | **barrière** / esquive + résist foudre |
| Nature | nature | Poison (DoT empilable) | **Purge** + régén + résist nature |
| Arcane | arcane | Malédiction (debuff : −stats) | **Purge** + résist arcane |
| Ombre | ombre | Drain de vie + saignement | burst (DPS) + résist ombre |

### Utilité de loot différenciée par biome
- Le butin d'un biome est **orienté vers son élément** : armes qui roulent des **dégâts de ce type**,
  armures qui roulent la **résistance de ce type** (réutilise `forceDmgType` / `biasResist` déjà
  présents dans `items.ts`). → Farmer Feu t'équipe en dégâts de feu **et** résist feu : utile pour
  pousser le biome Feu et pour résister aux menaces de feu ailleurs.
- (reco Claude) Option ultérieure : chaque biome favorise aussi un petit cluster de stats signature.

### Télégraphe
- Les techniques fortes (burst/nova, gros DoT) affichent une **barre de télégraphe** qui se remplit
  avant le coup → fenêtre de réaction visible. Jouable en manuel (bouclier juste avant, burst pendant
  une fenêtre de régén ennemie). En idle pur, c'est un stat-check : ton stuff encaisse ou non.

---

## 2. Nouvelle stat défensive : **Purge** (anti-altération)

- Réduit la **durée et l'intensité des DoT et debuffs** ennemis (saignement, poison, brûlure, peste, malédiction).
- Pendant longtemps inutile (biome Physique), devient cruciale dès qu'on sort vers Feu/Nature/Arcane.
- Plomberie : ajouter `purge` à `SecondaryStat`, `SECONDARY_STATS`, `SECONDARY_META`, `STAT_WEIGHTS`,
  `DerivedStats` (`purge: 0..1`), `describeStats`, et le câblage dans la résolution des DoT/debuffs ennemis.

---

## 3. Système d'`EnemyAbility` (sorts ennemis télégraphiés)

Miroir du kit héros. Sur `Enemy` : `abilities?: EnemyAbility[]`.

```
EnemyAbility = {
  kind: 'dot' | 'burst' | 'cc' | 'debuff' | 'drain' | 'shield' | 'regen'
  element: DamageType
  cooldown: number
  magnitude: number
  telegraph?: number   // secondes de préavis (barre visible)
  duration?: number    // DoT/CC/debuff
}
```
- Résolution dans `partyCombatStep` / `partyCombatStepMulti` (cooldowns ennemis, comme les actives héros).
- DoT/debuff atténués par **Purge** + résistance du type.
- Burst : grosse frappe télégraphiée, atténuée par **barrière**/esquive/réduction.
- CC : pose un `stun`/ralentissement, réduit par **ténacité**.
- UI combat : icône d'élément + pictos de techniques + barre de télégraphe.

---

## 4. Personnage & sorts

- **Fiche de sort détaillée** : type de dégât (icône), **cooldown réel** (réduit par Récupération),
  **valeur théorique = 1 seul chiffre** (`magnitude × abilityPower(scaleStat)`). Le type + la stat de
  scaling suffisent à comprendre comment l'augmenter.
- **Cast manuel par sort, par perso** : chaque créneau a un toggle **auto / manuel**. En manuel,
  l'auto-cast est coupé pour ce sort et un **bouton** apparaît. **Cast strict** (si CD pas prêt, rien —
  pas de file d'attente). 5 boutons max (= `POWER_SLOTS`).

---

## 5. Arbre de talents

- **Topologie en étoile** : hub central par constellation, **nombre d'axes variable** (2 pour les petites,
  4-5 pour les grosses) rayonnant vers des thèmes/archétypes différents. Fini les couloirs verticaux.
- Moteur déjà compatible : `requires` est un tableau + `canAllocate` exige « ≥ 1 prérequis alloué » → vrais carrefours.
- **Fiches détaillées** : effet chiffré complet par rang (keystone, conversions, DoT %…).
- **Gates « X points dans la constellation »** pour les keystones/capstones (reco Claude : oui, ça crée
  un vrai engagement d'identité et empêche le cherry-pick de capstones via passerelles).
- **Rendu** : étoile **jolie mais lisible sur mobile** — grille radiale avec liens, zoom/pan, sections navigables.

---

## 6. Stuff / équipement — UX mobile

- **Diff direct** (reco Claude) : **bottom-sheet compact** au tap d'un objet → candidat vs équipé,
  **delta par stat** (vert/rouge). Pour anneaux/bijoux : affiche **les deux** équipés + le candidat,
  choix du slot à remplacer. Pattern natif mobile.
- **Filtres par stat** + **profils sauvegardés** (reco Claude : **surlignage/scoring d'abord**, pas
  d'auto-équipement aveugle ; bouton optionnel « équiper le meilleur de ce profil pour ce slot » plus tard).
  Un profil = set de stats prioritaires ; les objets sont notés/surlignés selon le profil actif. Persisté.
- **iLvl vs rareté (les deux leviers)** :
  1. **Resserrer la courbe `statMult`** des raretés (top ~×7-8 au lieu de ×20.6) → la rareté n'écrase plus l'iLvl.
  2. **Plancher d'iLvl par rareté** au drop (une haute rareté ne tombe pas à un iLvl ridicule).
  3. Donner plus de poids à l'iLvl dans le budget de stats.

---

## 7. Raretés — couleurs + effets visuels

- **Réétaler les teintes** pour casser les paires illisibles (céleste/cosmique, artefact/éternel,
  épique/abyssal, légendaire/primordial).
- **Effets visuels par paliers hauts** (validé) : à partir de Céleste (t11), bordure/halo/animation
  distincte par rareté, pas seulement une teinte de plus. Toujours afficher nom + tier.

---

## 8. Forge / craft — recalibrage complet

Nouvelles règles d'entrée des ressources rares :
- **Noyaux 💠** : requis **dès Rare (t4)**.
- **Poussière 🌌** : requise **dès Légendaire (t6)**.
- **Fragments ✨** : requis **dès Mythique (t9)**.
- **Éclat cosmique 💫** : requis **dès Cosmique (t13)**.
- **Tout monte fort** (les raids cracheront beaucoup). `ascendCost` suit la même logique.
- **Reset des stocks** au patch (on ne se base pas sur l'avance actuelle du joueur).
- Coût **scale rareté (dominant) ET iLvl** (forger un iLvl 300 coûte plus qu'un iLvl 50 de même rareté).
- Éclat cosmique = **monnaie apex** : crafting cosmique+ **et** invocation d'effet unique au choix.
- **Éclats d'arcane = GROS puits** : ressource abondante (recyclage de masse + achat en or) → coût en
  éclats bien plus élevé que le nombre de matériaux rares (Rare ≈ 7 800 éclats à iLvl 30, ~×10 l'ancien).

### Table de coûts de création proposée (par tier de rareté ; iLvl applique un multiplicateur)
| Rareté (t) | Noyaux 💠 | Poussière 🌌 | Fragments ✨ | Cosmique 💫 |
|---|---|---|---|---|
| Rare (4) | 10 | — | — | — |
| Épique (5) | 50 | — | — | — |
| Légendaire (6) | 200 | 10 | — | — |
| Artefact (7) | 600 | 30 | — | — |
| Patrimoine (8) | 1 500 | 80 | — | — |
| Mythique (9) | 3 500 | 200 | 5 | — |
| Ascendant (10) | 7 000 | 450 | 15 | — |
| Céleste (11) | 13 000 | 900 | 40 | — |
| Éternel (12) | 24 000 | 1 700 | 90 | — |
| Cosmique (13) | 42 000 | 3 000 | 180 | 5 |
| Abyssal (14) | 70 000 | 5 000 | 320 | 20 |
| Primordial (15) | 115 000 | 8 000 | 550 | 50 |
| Transcendant (16) | 180 000 | 13 000 | 900 | 120 |

(Chiffres illustratifs — ancrés sur tes exemples rare=10 / épique=50 / légendaire=200. À affiner au test.)

---

## 9. Donjons (par ressource)

- **Coffres mono-ressource** : un donjon ne donne QUE sa ressource (en gros tas), **zéro stuff** —
  sauf le donjon **Butin** (Cache du Pilleur) qui, lui, donne du stuff.
- **Rentabilité** : le donjon doit être **la voie la plus rentable** pour SA ressource. On **garde une
  trace chiffrée (ressource/minute)** pour calibrer et éviter les exploits (farm bas niveau plus rentable, etc.).
- **Noyaux** : retirés des boss/élites de farm → la **Forge du Noyau** redevient la source.
- **Sceaux vs Orbes séparés** :
  - **Donjon Sceaux : entrée GRATUITE** → on farme les sceaux.
  - **Donjon Orbes : coûte 10 sceaux** à l'entrée → on dépense ses sceaux pour farmer les orbes.
  - (Le « trop de sceaux » ressenti venait surtout du peu de tiers parcourus ; cette boucle leur donne un débouché.)
- **Donjon Butin — rampe de rareté fine par niveau** : Niv 1 = {Médiocre, Commun, Inhabituel} à des taux
  donnés ; chaque niveau **élargit la fenêtre** et **décale vers le rare** (réutilise `rollBoxRarity(min,max,jackpot,decay)`).
- **Ressources rares (Poussière, etc.) — montée fine** : Niv 1 = **N garanti + X% d'avoir +1 à +2** ;
  chaque niveau monte le socle garanti **et** les chances de bonus.

---

## 10. Raids

- **forge / reliquaire / citadelle / nexus** débloqués **au MÊME palier** (50), récompenses différentes
  (pas de paliers d'accès échelonnés). **Abysse** = raid de **fin** (à revoir plus tard).
- **Butin T1 = un cran au-dessus du meilleur farm** du moment (l'iLvl T1 doit coller au palier d'accès,
  pas sauter à +130). On fait les raids **pour les objets ET les ressources**.
- **Plus de tiers, montée linéaire** : adoucir le pas des premiers tiers, lever le plafond.
- (À réfléchir) un **raid dédié à la ressource rare** (éclat cosmique).

---

## 11. Marché

- Refresh sur **timer réel de 1 h** (horodaté, recalculé au chargement comme la progression hors-ligne),
  **avec compte à rebours** affiché (« prochaine rotation dans 42 min »). Bouton de refresh manuel payant conservé.

---

## Ordre de construction (build order)

1. **Fondations data** : stat Purge, courbe `statMult` resserrée + plancher iLvl, table de forge, timer marché.
2. **Biomes** : modèle de progression par biome + sélecteur + migration des saves.
3. **EnemyAbility + télégraphes** : sorts ennemis, résolution combat, Purge câblée, UI combat.
4. **Starter pacing** : courbes (dégâts/HP/XP), révélation UI par jalons, mur+ralentissement.
5. **Donjons** : coffres mono-ressource, sceaux/orbes, rampes, retrait noyaux farm, trace ressource/min.
6. **Raids** : même palier d'accès, iLvl T1 recalé, tiers, (raid ressource).
7. **Sorts manuels** : toggle auto/manuel par sort, boutons, fiche détaillée chiffrée.
8. **Talents** : topologie en étoile, gates, fiches détaillées, rendu radial mobile.
9. **Stuff UX** : diff bottom-sheet, anneaux/bijoux, filtres + profils.
10. **Raretés visuelles** : palette réétalée + effets paliers hauts.
11. **Équilibrage & polish** : passe finale sur les chiffres avec la trace ressource/min.
