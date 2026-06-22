# 09 — Méta & live-ops

> Source : [`achievements.ts`](../../src/game/achievements.ts), [`daily.ts`](../../src/game/daily.ts),
> [`event.ts`](../../src/game/event.ts), [`inbox.ts`](../../src/game/inbox.ts),
> [`tutorial.ts`](../../src/game/tutorial.ts), [`avatar.ts`](../../src/game/avatar.ts).
> UI : [`AchievementsPanel.tsx`](../../src/components/AchievementsPanel.tsx),
> [`LevelBadge.tsx`](../../src/components/LevelBadge.tsx), [`AvatarEditor.tsx`](../../src/components/AvatarEditor.tsx),
> [`WelcomeScreen.tsx`](../../src/components/WelcomeScreen.tsx). Pilotage : timers dans [`App.tsx`](../../src/App.tsx).

## Rôle

La couche **hors-combat** : rétention (quotidien, event), guidage (tutoriel, inbox), complétion
(hauts faits, codex) et personnalisation cosmétique (portraits). Toutes les fenêtres temporelles
sont calées sur l'**epoch UTC** → déterministes **sans serveur**.

## Hauts faits ([`achievements.ts`](../../src/game/achievements.ts))

Objectifs débloqués **en jouant**. Récompense : un **titre** (par héros) + un **petit bonus
permanent** dans les mêmes catégories que le Conseil des Maîtrises (frappe/vigueur/celerite/fortune/
savoir/flair) — **1 rang de haut fait = 1 rang de Maîtrise**, réutilise les coefficients de
`computeGlobalMods` (pas de monnaie, pas de stats brutes). Catégories `AchvCategory` : progression,
stuff, collection, metiers, combat, **legende** (étage endgame v0.32 : palier 800, Abîme t14,
prestige ×10… → titres + parures **zéro puissance**). Évalué périodiquement (`checkAchievements`,
toutes les 4 s) sur un instantané léger `AchvCtx` (aucun import du store).

## Quotidien ([`daily.ts`](../../src/game/daily.ts))

3 « Contrats du jour » + « Connexion ». Philosophie idle : complétable **en jouant** (pas de corvée),
catch-up **sans FOMO** (rater un jour ne punit pas), canalise vers les boucles existantes. Récompense
en monnaies **rares** (✨🌌💠) pour ne **pas** toucher l'éco or/éclats (TTK-invariante). Reset
quotidien via epoch (`rollDailyIfNeeded`, vérifié toutes les 60 s).

## Event ([`event.ts`](../../src/game/event.ts))

**Invasion élémentaire** : une semaine = un élément envahit (rotation déterministe). Le joueur
accumule des « points d'invasion » (= `totalKills` depuis le début de l'event → **aucun hook
combat**) et réclame des paliers. Le capstone débloque une **aura élémentaire exclusive** (zéro
puissance, cosmétique). `rollEventIfNeeded` (toutes les 60 s).

## Inbox ([`inbox.ts`](../../src/game/inbox.ts))

Boîte de réception ✉ : réceptacle des **gains à collecter** (cadeaux, gains hors-ligne, récompenses
d'event → un clic pour encaisser), séparé du guidage et du combat. Pensé pour grandir : daily/event y
déposent un message via `pushInbox` (store) ; le joueur réclame depuis l'icône ✉ flottante.

## Tutoriel ([`tutorial.ts`](../../src/game/tutorial.ts))

Chaîne de quêtes « Premiers Pas » : chaque étape introduit **un** système (combat → équiper → Marché
→ Forge → Talents → Donjon), se **complète depuis l'état de jeu observable** (pas de tracking lourd),
et donne une récompense modérée qui sert à l'étape suivante. La porte d'**onboarding** (`onboarded`)
suspend le tick de combat tant que le joueur n'a pas lancé l'aventure (`WelcomeScreen`).

## Portraits ([`avatar.ts`](../../src/game/avatar.ts))

Avatar **100 % procédural SVG** (sans asset) : le joueur choisit une **palette** (`AVATAR_PALETTES`,
dégradé de fond) et un **emblème** (`AVATAR_EMBLEMS`, symbole central) par héros ; le défaut dérive de
la classe. Rendu par `LevelBadge` (médaillon de niveau). Personnalisation = `Character.avatar`.
Certaines palettes/emblèmes premium se débloquent contre de la **Poussière d'étoile** (`cosmetics`).

> ℹ️ À ne pas confondre avec la feature « avatar qui montre l'équipement » (v0.43), **entièrement
> retirée du repo** (commit 6d1423e). Les portraits décrits ici sont le système cosmétique **conservé**.

## Interactions

- Les bonus de hauts faits/Conseil/améliorations se cumulent dans `computeGlobalMods` → [08 Métiers & craft](08-metiers-et-craft.md).
- Les gains hors-ligne arrivent par l'inbox → [03 Progression & monde](03-progression-et-monde.md).
- Contrats hebdo (Conseil des Maîtrises) → [02 Stats & maîtrises](02-stats-et-maitrises.md).
- État persisté (achievements, daily, event, inbox, tut, cosmetics) → [10 État & sauvegarde](10-etat-store-et-sauvegarde.md).

## Dette / provisoire

- L'event ne couvre qu'**une** Invasion (premier de la boucle live-ops) : conçu pour grandir.
- Les auras/parures d'event/légende sont **cosmétiques** (zéro puissance, à préserver tel quel pour ne
  pas casser l'invariance TTK).
