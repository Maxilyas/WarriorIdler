# Glossaire — Warrior Idler

Vocabulaire du jeu, des mécaniques et des ressources. Les **formules chiffrées** vivent dans
les [docs système](systemes/) ; ici on définit les **termes**. Le nom entre `code` est le
champ/constante correspondant dans la source.

## Progression & monde

| Terme | Définition |
|---|---|
| **Vague** (`stage`) | L'unité de progression = **un combat contre un ennemi**. La battre débloque la suivante ; `bestStage` = record. Affichée « Chapitre C · Vague V/10 » (`chapitreLabel`). *(Ex-« Palier » : nom encore présent dans certaines variables/docs archivées.)* |
| **Chapitre** | Bloc de **10 vagues** (`CHAPITRE_SIZE = 10`), fermé par un **Mur** (vague 10). Le jeu est câblé pour **15 Chapitres** : au-delà, l'ilvl du loot **plafonne** (`ILVL_CAP_BASE`), seule la difficulté continue de monter. L'économie or/XP est calée sur le **farm** du Chapitre courant. |
| **Prologue & gate de raid** | **Chapitres 1-5** = Prologue **libre** (sans raid). **Chapitres 6-15** se débloquent par **tier de raid** : Raid **T1 → Chapitre 6**, T2 → 7, …, **T10 → Chapitre 15** (`raidGateForStage`). |
| **Mur / Gardien** | Boss-verrou en **fin de Chapitre** (toutes les 10 vagues). Le franchir ouvre la suite ; les murs des Chapitres **5-14** exigent le **tier de raid** correspondant (T(c−4)). |
| **Escalier des vagues** | Dans un Chapitre, la difficulté **repart bas** et **monte** vague après vague jusqu'au Mur (`enemies.ts` / `staircaseBlend`). |
| **ilvl** (item level) | Niveau d'objet : pilote le **budget de stats**. Calé sur la vague de farm (loot), borné par un **cap** (`ILVL_CAP_BASE` / `ILVL_CAP_ENDGAME`). |
| **Retard de gear** (`lag`) | Décalage volontaire entre ton ilvl et le contenu : garde le TTK tendu (`lagAt`, `frontierIlvl`). |
| **Biome** | L'une des 7 zones = les 7 types de dégâts. Chaque biome a **sa** progression de vagues ; la zone active tourne ~toutes les heures. |
| **Cache** | Coffre/butin dont la **courbe de rareté** suit la rareté débloquée du compte (rampe puis plateau). |
| **Abîme Primordial** | Le raid capstone d'endgame (drop le premier set, défi ultime). |
| **TTK** (time-to-kill) | Temps pour tuer un ennemi calé. Le design vise un TTK **constant** à stuff calé (invariance v0.30). |
| **EHP** | PV effectifs (PV × mitigation). Mesure de survie face aux mécaniques (Nova, Enrage…). |

## Stuff & build

| Terme | Définition |
|---|---|
| **Rareté** | 16 paliers (les 8 de WoW + 8 au-delà → Mythique … Transcendant). Plus la rareté monte : plus d'affixes, plus de budget, plus rare au drop. |
| **Affixe** | Ligne de stat secondaire sur un objet (`stat` / `dmgType` / `resist`). Nombre **fixe par rareté**. |
| **Effet unique** | Capacité nommée portée par un objet (Artefact+), scalée par **rang × rareté × ilvl**. Catalogue dans `uniques.ts`, collection dans le **Grimoire**. |
| **Stat rare** | Stats puissantes à faible taux d'apparition (Vol de vie, Surpuissance, Multifrappe, Récupération). Indice 💎. |
| **Maîtrise (de classe)** | Effet passif lié à la **stat primaire** (Force → DR + riposte, Agi → débordement crit, Int → surcharge). Voir `maitrise.ts` / `stats.ts`. |
| **Keystone** | Nœud d'arbre qui **change une règle** (conversion de stat/type, DoT, exécution…). |
| **Capstone** | Nœud d'identité de classe, toujours-actif, gaté derrière les ultimes d'archétype (refonte v0.42). |
| **Gemme de condition** | Gemme qui déclenche un **comportement** de combat (rythme/seuil/riposte/serment), pas une stat plate (`condGems.ts`). |
| **Set** | Pièces nommées dont le port groupé donne des bonus 2/4/6 pièces (`sets.ts`). |

## Méta & live-ops

| Terme | Définition |
|---|---|
| **Conseil des Maîtrises** | Progression de **compte** time-gatée : 3 contrats par semaine réelle → Points de Maîtrise (`maitrise.ts`). |
| **Prestige / Éveil Primordial** | Reset dur (rend paliers, niveau, stuff sauf 1 Relique) contre des **Échos**, investis dans la **Constellation** (méta-arbre). |
| **Constellation** | Méta-arbre du prestige, séparé de l'arbre de talents, conservé à travers les Éveils. |
| **Relique** | Le seul objet conservé lors d'un Éveil. |
| **Invasion (event)** | Event hebdo : un élément envahit → points d'invasion (= kills) → aura **exclusive** (`event.ts`). |
| **Premiers Pas** | Chaîne de quêtes d'onboarding (`tutorial.ts`). |
| **Inbox ✉** | Boîte de réception des gains à encaisser (cadeaux, hors-ligne, event) via `pushInbox`. |
| **Portrait** | Avatar procédural SVG (palette + emblème), rendu par `LevelBadge` — purement cosmétique. |

## Ressources

| Icône | Nom | Champ | Source → usage |
|---|---|---|---|
| 💰 | **Or** | `gold` | Farm → Marché, améliorations, coffres. **Farm only** (pas en donjon/raid). |
| ♦ | **Éclats d'arcane** | `essence` | Recyclage d'objets → craft de base, reforge. |
| 💠 | **Noyau primordial** | `noyau` | Boss → ascension de rareté, chance d'unique. |
| 🌌 | **Poussière d'étoile** | `poussiere` | Rare → craft sommital, cosmétiques premium. |
| ✨ | **Fragment d'éternité** | `fragments` | Raids → craft de très haut niveau, infusion d'unique. |
| 💫 | **Éclat cosmique** | `cosmic` | Raids (ultra-rare) → **invoquer un effet unique au choix**. |
| 🔑 | **Sceau de faille** | `sceaux` | Montée de palier → ouvrir les donjons. |
| 🔮 | **Orbe de raid** | `orbes` | Boss/donjons profonds → lancer un raid. |
| 🔹 | **Poussière de gemme** | `gemDust` | Broyage → acheter/tailler/fusionner les gemmes de condition. |
| 🧱 | **Lingot** | `lingots` | Foyer + fonte d'objets → procédés du Forgeron (Signatures hex). |
| 🜁 | **Fragment runique** | `runeFragments` | Effacer des runes → forger des runes. |
| ✶ | **Quintessence** | `quint` | Drop ultra-rare typé (biome) → joaillerie / lignes de gemme. |
| 💠 | **Échos primordiaux** | `echos` | Éveil (prestige) → Constellation. |
| 🔥 | **Chaleur** | `chaleur` | Mini-jeu de Frappe du Forgeron (ressource + série de Parfaits). |
| — | **Trempe** | `trempe` | Procédé lent du Forgeron (gain d'ilvl en temps réel). |
| — | **Points de Maîtrise** | `maitrisePoints` | Conseil des Maîtrises → petit arbre de bonus. |

> Note : 💠 désigne à la fois le **Noyau** (craft) et les **Échos** (prestige) selon le contexte —
> ce sont deux ressources distinctes.
