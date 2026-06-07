# Warrior Idler

Un idler textuel jouable au navigateur (web + mobile, PWA installable), centré sur la
gestion du stuff et des synergies d'équipement, avec les stats et raretés inspirées de
World of Warcraft — poussées bien au-delà (16 paliers de rareté).

## Lancer le projet

```bash
npm install
npm run dev      # serveur de dev sur http://localhost:5173
npm run build    # build de production (typecheck + bundle + PWA)
npm run preview  # prévisualiser le build
```

## Stack

- **React + TypeScript + Vite**
- **Tailwind CSS v4**
- **Zustand** pour l'état du jeu
- **vite-plugin-pwa** (installable, jouable hors-ligne)
- Sauvegarde automatique dans `localStorage`

## Ce qui est en place (v0.13)

Refonte « uniques & raids » (retours de test) :

- **Effets uniques qui scalent enfin** : leurs bonus montent désormais avec le **rang ET la rareté +
  l'iLvl** de la pièce porteuse (cf. `instanceMods`), au lieu de devenir négligeables sur du haut
  stuff. Un unique sur une pièce Transcendante pèse autant qu'une grosse ligne d'affixe.
- **+100 effets uniques** (132 au total) couvrant tous les rôles (dps/heal/tank/résistance/utilitaire),
  chacun avec une capacité active (rang 5).
- **📖 Grimoire** (onglet dédié) : codex de **tous** les uniques, regroupés par rôle, avec compteur de
  collection (X/132 découverts), bases au rang 1, résistances et capacité active. Les découvertes
  s'enregistrent au loot, à l'achat, au craft, aux coffres et aux raids.
- **Refonte complète des raids** — fini le raid générique « résistance X » :
  - **5 raids distincts** avec identité, lore et **butin ciblé par catégorie** : ⚒️ **Forge des Titans**
    (armes), 💍 **Reliquaire Englouti** (anneaux/bijoux/colliers), 🏰 **Citadelle Éternelle** (armures),
    🌈 **Nexus Prismatique** (accessoires de résistance), 🕳️ **Abîme Primordial** (tout — le défi ultime).
  - **Tiers montés indépendamment** par raid (battre le tier T débloque T+1 de CE raid). Les **quatre
    premiers raids sont accessibles dès le palier 50** : tu choisis librement la catégorie de butin à
    farmer. Seul l'**Abîme Primordial** reste un capstone (palier 150 + avoir vaincu le Nexus). La
    difficulté et les récompenses restent **escaladées par raid** (un raid « haut de gamme » est tout
    aussi dur et généreux qu'avant, même pris tôt).
  - **Extrêmement difficiles** : chaque raid est un **check de stuff** via des mécaniques signature —
    Enrage mortel (timer de DPS), Nova cataclysmique (EHP), Forteresse (pénétration), Sangsue (burst),
    Déferlante (EHP de groupe), Prisme instable (résistances larges), Acharnement. Le panneau affiche
    le **DPS et les PV recommandés** vs ton équipe (✓/✗).
  - **Rareté du butin en éventail** : plus un plancher fixe « écrasé » sur une seule rareté, mais un
    tirage **du plancher garanti au plafond atteignable** ; plus le **tier monte**, plus les **très
    hautes raretés** (jusqu'à Transcendant) deviennent probables. La fourchette est affichée sur la carte.
  - **Ressource ultra-rare** : l'**Éclat cosmique 💫** (exclusif aux raids) sert à **invoquer un effet
    unique au choix** sur un objet (atelier) — un puissant levier de theorycraft.

### Précédemment (v0.12)

Itération suite aux retours de test :

- **Mana retiré** (jugé trop « boîte noire ») : les capacités se lancent au cooldown, l'INT reste
  la stat des sorts ; la **Récupération** (stat rare) réduit les cooldowns.
- **Stats RARES** : le **Vol de vie** est désormais ~2 % d'apparition, et 3 nouvelles stats très
  rares et puissantes — **Surpuissance** (+dégâts), **Multifrappe** (frappe ×2), **Récupération**
  (−cooldown). Un **indice 💎** signale les objets portant une stat rare.
- **Combat classique linéarisé** : plus de résistances par type aléatoires (qui rendaient la
  difficulté non-monotone) → **résistance globale croissante** (contrée par la Pénétration) +
  **traits déterministes** (Blindé, Féroce, Massif…) et **élites** (◆) au butin supérieur.
- **Grand arbre étendu** : ~30 nœuds par spécialisation + **5 archétypes-classes** qui changent le
  gameplay (Templier, Élémentaliste, Faucheur, Duelliste, Colosse), atteignables par des passerelles
  depuis les specs → vrais **builds hybrides**. Nouveaux keystones (conversion Endurance→stat,
  épines, multifrappe, bonus haut-PV…).
- **10 coffres mystères** avec **distribution de rareté** (plus de raretés fixes) + **jackpot**
  (petite chance de bien mieux) + ciblage (armes, défense), de 500 or au **Coffre du Néant (10M)**.
- **Raids dès le palier 50** (au lieu de 100).
- **Inventaire filtrable par affinité** (FOR / AGI / INT).
- **Économie end-game** : 2ᵉ/3ᵉ perso très tardifs et **très chers** (10M / 100M or + Poussière),
  prix d'échoppe fortement relevés.

### Précédemment (v0.11)

Refonte « choix & synergies » — chaque système devient une suite de décisions :

- **Itémisation tranchée** : nombre d'affixes **fixe** par objet (2→6 selon la rareté, plus 0→10),
  pool **élargi** groupé par rôle (offensif : crit, dégâts crit, hâte, maîtrise, pénétration ;
  défensif : réduction, esquive, bouclier, **résistances par type** ; soutien : régén, mana,
  polyvalence) et **Vol de vie rare**. La rareté donne plus de lignes + des valeurs plus hautes ;
  c'est le **craft** qui choisit *quelles* stats — vrai arbitrage offense ↔ survie.
- **Résistances de héros** : des affixes/talents/uniques de **résistance par type** réduisent les
  dégâts subis ; chaque ennemi **frappe avec un type** (les résistances comptent enfin).
- **Mana & stats primaires différenciées** : INT → **mana** + sorts, FOR → mêlée, AGI → vitesse/
  furtivité. Les capacités **coûtent du mana** et **scalent sur leur stat**.
- **Grand arbre de talents en constellations** (Cœur · Berserker · Rôdeur · Arcaniste · Bastion ·
  Oracle · Métamorphe) : un seul arbre connecté par **passerelles**, **mix de rôles** libre, nœuds
  passifs + **keystones** (conversion de stat « Force compte comme Agi », conversion de type, DoT,
  HoT, exécution, berserker). **Les capacités se débloquent UNIQUEMENT via l'arbre.**
- **Verrou de palier** : choisis un palier débloqué et **farme-le** (cadenas) sans avancer.
- **Donjons par type** (7, un par élément) montés **indépendamment**, au butin **ciblé**
  (dégâts ET résistance de leur élément).
- **Économie retendue** : recyclage/vente **plus rémunérateurs** sur le rare, forge/ascension
  haut de gamme exigeant **Fragments d'éternité** et **Poussière d'étoile** (matériau rare),
  coffres **plus chers + rareté plancher garantie**, recrutement **bien plus cher**, amélioration
  marché **sommitale infinie** (Forge stellaire, or + Poussière).
- **Effets uniques** dès l'**Épique**, **grand catalogue** par rôle (dps/heal/tank/résistance/
  utilitaire) avec résistances, et **insertion ciblée** d'un effet via les essences.
- **Progression hors-ligne** : gains accumulés pendant l'absence + écran « Bon retour ».

### Précédemment (v0.10)

- **Marchand** (onglet dédié) — donne enfin un sens à l'or :
  - **🎁 Coffres mystères** (3 paliers) : pari → objets aléatoires, révélés via l'animation de coffre.
  - **🛒 Échoppe** : stock tournant d'objets à acheter (renouvelé à chaque boss + rafraîchissement payant).
  - **🔄 Comptoir d'échange** : or → Éclats d'arcane / Sceaux de faille / Orbes de raid.
  - **⬆️ Améliorations permanentes** (coûts croissants, puits d'or quasi infini) : Économie (or, butin,
    rareté, éclats), Progression (XP, points de talent), Combat (puissance, vitesse, PV, régén),
    Confort (taille d'inventaire) + **recrutement anticipé** de personnage.

### Précédemment (v0.9)

- **Itémisation profonde** : **Endurance garantie sur chaque pièce** (la survie scale) + une
  **orientation offensive/défensive** par objet (arbitrage dégâts ↔ survie : glass-cannon, bruiser
  ou tank selon les pièces). Les **drops ciblent un membre d'équipe au hasard** (tous les builds
  nourris) et un craft **« Transmuter l'affinité »** (FOR/AGI/INT) adapte n'importe quel objet.
- **Maîtrise par archétype** : Force → dégâts + réduction subie (bruiser) ; Agilité → dégâts
  critiques accrus ; Intelligence → dégâts bruts. La stat primaire oriente le style.
- **Arbre de talents** (par personnage, data-driven) : 3 constellations **Bastion/Tueur/Soigneur**,
  nœuds de stats + nœuds de capacité + capstones, prérequis, **1 point/niveau**, respec.
  Source des capacités avancées et **moteur des choix de build** (les stats deviennent
  stratégiques : on investit dans ce que son build veut).

### Précédemment (v0.8)

- **Raids** : débloqués au palier 100, lancés avec une **Orbe de raid** (lâchée par les boss et
  les donjons profonds). **Série de boss** à vaincre d'une traite ; chaque boss a de fortes
  résistances + **1-2 mécaniques** auto-résolues (**Nova** élémentaire, **Enrage**, **Drain**,
  **Adds**, **Carapace**). Échec = l'équipe se replie (Orbe perdue). Réussite → coffre d'élite +
  **Fragments d'éternité**. Réussir le raid N débloque N+1.
- **Craft sommital** : infuser un **Fragment d'éternité** sur un objet pour **ajouter un effet
  unique** (ou monter son rang) — au-delà du craft normal.

### Précédemment (v0.7)

- **Équipe de 3 personnages** : débloqués aux paliers (2ᵉ ~50, 3ᵉ ~150), **inventaire &
  ressources communs**, **équipement par personnage**. Sélecteur de roster (combat, fiche, stuff).
- **Combat d'équipe** : 3 barres de vie, **menace légère** (l'ennemi frappe la plus haute
  menace → vrai rôle de tank), DPS cumulé, **rôles émergents** (pas de tag imposé).
- **5 capacités équipables par perso** (`powers.ts`, data-driven) — **passives** (menace,
  réduction de dégâts, stats) + **actives auto-lancées** (soin, nuke, bouclier, buff) ;
  débloquées par niveau (l'arbre de talents reprendra ce rôle).
- Mort d'un perso → le combat continue avec les survivants ; équipe soignée entre combats ;
  équipe entière à terre → repli.

### Précédemment (v0.6)

- **Donjons** : séries de combats à enchaîner en **temps réel** ; réussir → **coffre animé
  cliquable** révélant le butin (loot de meilleure qualité + Éclats/Noyaux/or), échouer → repli
  (Sceau perdu). Ouverts par un **Sceau de faille** (gagné tous les 5 paliers ou **forgé** :
  3 Noyaux + 600 Éclats). Réussir le niveau N débloque N+1. Difficulté calée sur la courbe du
  farm + prime de donjon ; **thème élémentaire** à fortes résistances (le stuff doit s'adapter)
  + **modificateurs M+** (Colossal, Blindé, Enragé, Réfléchissant, Vampirique, Érudit, Avare,
  Polarisé = -65% à un côté).
- **Bouton Réinitialiser** (onglet Personnage) pour repartir d'une partie vierge.
- **Objets équipés cliquables** (les voir, les améliorer, les retirer) ; **seuil de rareté
  réglable** pour la vente/recyclage en masse.

### Précédemment (v0.5)

- **Atelier — créer un objet** : forge ciblée (type + affinité + élément d'arme + **rareté cible**
  plafonnée par ta progression), coût croissant en Éclats/Noyaux, iLvl lié à ton record de palier.
- **Effets uniques à rangs (I→X)** : les mods montent avec le rang, la **capacité active**
  (proc/sort) se débloque au **rang 5**. Affiché avec rang, mods scalés et état actif/verrouillé.
- **Upgrade d'unique via Essence d'effet** : recycler un unique donne des **Essences de cet effet** ;
  on les dépense (+ Éclats, coût croissant) pour monter son rang.

### Précédemment (v0.4)

- **Atelier — améliorer un objet** : **reforge** des affixes (avec **verrous** pour conserver
  les bons), **surillvl** (+iLvl, rescale les stats), **ascension de rareté** (cran supérieur :
  +1 affixe, rescale, chance d'unique). Coûts en Éclats / Noyaux.
- **Noyau primordial** (💠) : ressource rare **lâchée par les boss**, utilisée pour l'ascension.

### Précédemment (v0.3)

- **Types de dégâts (7)** : Physique/Feu/Froid/Foudre/Arcane/Ombre/Nature. L'arme définit
  ton **type de base**, des affixes « +% type » l'amplifient, et les **ennemis ont des
  résistances/vulnérabilités** → ton stuff a un impact direct sur qui tu bats. Affiché
  partout (DPS typé, profil de dégâts, résistances ennemies, détail d'objet).

### Précédemment (v0.2)

- **Combat idle à deux sens** : auto-attaque selon la Hâte, l'ennemi riposte,
  **barre de vie** + régénération + vol de vie, **boss tous les 10 paliers**,
  repli en cas de mort. XP + or + montée de niveau.
- **16 raretés** (les 8 de WoW + 8 au-delà : Mythique → Transcendant).
- **Modèle d'objet** : **type d'objet** (anneau, arme…) distinct des **16 emplacements**
  (Anneau I/II, Bijou I/II…). Stat primaire + affixes secondaires + **effet unique**.
- **Effets uniques** : registre extensible ([uniques.ts](src/game/uniques.ts)) — bonus de
  stats actifs + accroche sur les futures synergies sorts/talents/combos. Prêt pour des centaines.
- **Écran de stuff ergonomique** : paper-doll des 16 emplacements ; cliquer un emplacement
  **filtre** l'inventaire (liste compacte) ; **comparaison côte à côte** vs l'équipé avec deltas
  ▲/▼ et score ; choix explicite Anneau I/II & Bijou I/II.
- **Vendre (or)** vs **Recycler (Éclats d'arcane)** — valeurs affichées, base du craft futur.
- **Fiche de personnage** : chaque stat affiche son **effet chiffré** ; spécialisation expliquée
  (stat de combat active vs inactive).
- **UI responsive** : 3 colonnes sur desktop ; sur mobile, onglets + comparaison en feuille du bas.

## Architecture

```
src/
  game/
    types.ts      # types de domaine (Item, ItemType, EquipSlotId, UniqueEffect…)
    rarities.ts   # les 16 paliers + tirage pondéré
    slots.ts      # 16 emplacements + 14 types d'objets (icônes, poids, mapping)
    damage.ts     # 7 types de dégâts + calcul du profil de dégâts
    uniques.ts    # registre des effets uniques + tirage
    stats.ts      # méta des stats, stats totales/dérivées, effets chiffrés
    items.ts      # génération d'objets, score, vente/recyclage, stat-block
    enemies.ts    # génération d'ennemis par palier
    combat.ts     # coups, mitigation, DPS, dégâts subis
    store.ts      # état Zustand + boucle de jeu + sauvegarde + migration
  components/
    CombatPanel.tsx     # barres de vie, métriques, journal
    CharacterPanel.tsx  # identité, ressources, effets des stats, spécialisation
    StuffScreen.tsx     # paper-doll + liste filtrée + comparaison (+ feuille mobile)
    ItemRow.tsx         # ligne d'inventaire compacte
    ComparePanel.tsx    # comparaison côte à côte + effet unique + actions
    rarityStyle.ts      # styles (couleur, halo) par rareté
  useMediaQuery.ts      # bascule de disposition desktop/mobile (montage unique)
```

## Prochaines étapes (roadmap)

> Plan complet et décisions dans [docs/DESIGN.md](docs/DESIGN.md).
> Roadmap initiale **terminée** : ~~Types de dégâts~~ ✅ → ~~Craft~~ ✅ → ~~Donjons~~ ✅ →
> ~~Party~~ ✅ → ~~Raids~~ ✅ → ~~Talents~~ ✅.

Extensions futures :
- **Élargir l'arbre de talents** (vers des centaines de nœuds : affinités CaC/distance/conversion,
  keystones conditionnels « +X% si Crit > 50% ») + **rangs de capacités** via l'arbre.
- **Codex des uniques** + **capacités actives** réelles (procs/sorts rang 5+).
- **Bonus de sets**, **gemmes/sockets**.
- **Progression hors-ligne** et couche de **prestige**.
- **Équilibrage** global (courbes exponentielles donjon/raid, recrues, soft-caps).
