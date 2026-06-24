# Warrior Idler

Un idler textuel jouable au navigateur (web + mobile, **PWA** installable), centré sur la **gestion
du stuff et des synergies d'équipement**, avec des stats et raretés inspirées de World of Warcraft —
poussées bien au-delà (16 paliers de rareté, 7 types de dégâts, arbres de talents façon Path of Exile).

> 📚 **Documentation complète** : [`docs/`](docs/) — [architecture](docs/ARCHITECTURE.md),
> [systèmes](docs/systemes/), [glossaire](docs/GLOSSAIRE.md), [vision](docs/DESIGN.md).

> 🏆 **Leaderboard des builds** : [classement & stats de la communauté](https://maxilyas.github.io/WarriorIdler/leaderboard.html)
> (tier max, DPS, survie, talents/sorts/gemmes populaires). Soumets le tien depuis le **Simulateur** en jeu →
> 🔗 Partager → 🚀 Soumettre — une [GitHub Action](.github/workflows/ingest-builds.yml) l'ajoute au catalogue.

## Lancer le projet

```bash
npm install
npm run dev      # serveur de dev sur http://localhost:5173
npm run build    # build de production (typecheck + bundle + PWA)
npm run preview  # prévisualiser le build
```

## Stack

- **React 18 + TypeScript + Vite 6**
- **Tailwind CSS v4**
- **Zustand** — un store unique tient tout l'état du jeu
- **vite-plugin-pwa** (installable, jouable hors-ligne)
- Sauvegarde automatique dans `localStorage` (aucun backend)

## Où trouver quoi

```
src/
  game/          logique de jeu (data + fonctions PURES) — 38 modules
    store.ts     le store Zustand : état + actions + boucle de combat + save/migration
    types.ts     vocabulaire de domaine
    ...          un module par système (combat, items, talents, raids, métiers…)
  components/    interface React (panneaux, écrans, modales)
  App.tsx        coquille : onglets, pilotage du tick, onboarding
scripts/         simulations & garde-fous headless (transpilent le vrai TS)  → scripts/README.md
docs/            documentation vivante                                        → docs/README ci-dessous
```

La **carte complète des modules** (un rôle par fichier) est dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation

| Document | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, flux de données, boucle de jeu, sauvegarde, carte des modules |
| [`docs/systemes/`](docs/systemes/) | Une page par système (combat, stuff, talents, raids, métiers, live-ops…) |
| [`docs/GLOSSAIRE.md`](docs/GLOSSAIRE.md) | Lexique : Palier, Chapitre, Mur, ilvl, ressources… |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Vision / pilier de design (vivant) |
| [`docs/archive/`](docs/archive/) | Snapshots de design historiques (v0.18 → v0.41, **non maintenus**) |

## Systèmes en place (haut niveau)

- **Combat idle** à 5 ticks/s : auto-attaques (Hâte), capacités auto-lancées, DoT/HoT, capacités
  ennemies télégraphiées, menace/aggro, mort/repli. → [docs/systemes/01](docs/systemes/01-combat-et-degats.md)
- **7 types de dégâts** + résistances relatives + triangle d'élément. → [01](docs/systemes/01-combat-et-degats.md)
- **Stats** à courbes soft-capées + **Maîtrises** d'archétype (Force/Agi/Int). → [02](docs/systemes/02-stats-et-maitrises.md)
- **Progression unifiée** (loi de puissance unique, TTK invariant), Chapitres/Vagues/Murs, biomes,
  hors-ligne, **prestige**. → [03](docs/systemes/03-progression-et-monde.md)
- **Stuff** : 16 raretés, 16 emplacements, budget exponentiel, craft (reforge/surilvl/ascension/
  création) avec gating anti-snowball, qualité unifiée. → [04](docs/systemes/04-stuff-et-loot.md)
- **Uniques** (~150, scaling rang × rareté × ilvl, codex), **sets**, **gemmes de condition**, **runes**
  (Temps/Règles/Pactes). → [05](docs/systemes/05-uniques-sets-gemmes.md)
- **Classes & talents** : arbre handcrafted façon PoE (adjacence, choix exclusifs, keystones),
  capacités, multi-classe natif. → [06](docs/systemes/06-classes-talents-pouvoirs.md)
- **Donjons** (par ressource) & **raids** (un boss, dix tiers, mécaniques = checks de stuff). → [07](docs/systemes/07-donjons-et-raids.md)
- **4 métiers** (Forgeron/Joaillier/Runiste/Alchimiste) + Marché. → [08](docs/systemes/08-metiers-et-craft.md)
- **Live-ops** : hauts faits, quotidien, event hebdo, inbox, tutoriel, portraits cosmétiques. → [09](docs/systemes/09-meta-et-live-ops.md)

## Équilibrage (scripts)

Le jeu est calibré par des **simulations headless** qui exécutent la vraie logique du jeu (`npm run
ttk`, `sim`, `survival`, `dungeon`, `mur`, `eco`, `weights`, `validate`…). Détails et quand les
relancer : [`scripts/README.md`](scripts/README.md).

> L'historique versionné (changelog v0.2 → v0.13 et au-delà) vit dans `git log` et dans
> [`docs/archive/`](docs/archive/). Ce README décrit l'**état courant**, pas l'historique.
