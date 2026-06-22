# DESIGN v0.25 — Marché time-gaté, Conseil des Maîtrises & Catalyseur

> Suite des retours joueur de juin 2026. Décisions déjà actées en discussion :
> vider le Marché de sa puissance (pas le supprimer), inventaire infini,
> progression de compte **time-gatée** à bonus **minimes**, et remplacer la
> spécialisation ◈ Transmutateur de l'Alchimiste (les conversions de ressources
> contredisent la suppression du Comptoir d'échange).

---

## 1. Le Marché vidé de sa puissance

**Problème.** Les améliorations de combat (`power`, `attackSpeed`, `vitality`,
`regen`) étaient « pas chères + grosses différences » : multiplicatives avec
tout le reste, trivialement achetables, impossibles à équilibrer.

**Décision.**
- **Supprimées** : Puissance, Vivacité, Vitalité, Régénération — et Sacoches
  (l'inventaire devient illimité, voir §2).
- **Conservées** (l'éco a besoin de puits) : Cupidité, Pilleur, Chance,
  Récupérateur, Érudition, Sagesse innée, et **Forge stellaire** — l'unique
  source de puissance restante : puits **sommital** infini, cher, gaté par la
  Poussière d'étoile (🌌 = Observatoire palier 50).
- **Migration** : les niveaux achetés dans les améliorations supprimées sont
  **remboursés à 100 %** (or + éclats, recalculés depuis les formules de coût).
  La perte de puissance est assumée (même logique que le nerf d'Harmonie) ;
  le Conseil des Maîtrises (§3) prend le relais de la progression de compte.

## 2. Inventaire infini

`invMax` passe de `80 + 10/niv de Sacoches` à **illimité** (borne technique
100 000). Le tri se fait par l'**auto-recyclage** déjà en place (seuil de
rareté + protection des uniques) et les outils de masse (vendre/recycler sous
un seuil). Aucun cap d'UI : la liste est déjà filtrée/triée.

## 3. 🏛️ Le Conseil des Maîtrises (progression time-gatée)

Le cœur du chantier : une progression de compte **hebdomadaire**, aux bonus
**minimes**, qui récompense de *jouer le contenu* — pas de payer.

### Contrats hebdomadaires
- La semaine est **réelle** (fenêtres d'epoch UTC de 7 jours, déterministes).
- **3 contrats fixes** par semaine :

| Contrat | Objectif | Récompense |
|---|---|---|
| 🏰 Expéditionnaire | Terminer **5 donjons** | +1 Point de Maîtrise |
| ☠️ Pourfendeur | Vaincre **3 raids** | +1 Point de Maîtrise |
| ⚔️ Conquérant | Gagner **15 paliers** de farm | +1 Point de Maîtrise |

- Progression **automatique** (compteurs branchés sur le jeu) ; le point est
  crédité tout seul au seuil (log 🏛️). Au changement de semaine : remise à
  zéro des contrats, les Points acquis restent.
- Cadence max : **3 Points/semaine**. Avant le palier 50 (raids verrouillés),
  cap pratique à 2/semaine — acceptable, l'early game a d'autres moteurs.

### Arbre de Maîtrise (bonus minimes par design)
1 Point = 1 rang. **56 points** pour tout maxer ≈ **19 semaines pleines**.

| Nœud | Par rang | Rangs | Max |
|---|---|---|---|
| ⚔️ Frappe maîtrisée | +0,4 % dégâts | 10 | **+4 %** |
| ❤️ Vigueur | +0,5 % PV | 10 | **+5 %** |
| ⚡ Célérité | +0,3 % vitesse d'attaque | 8 | +2,4 % |
| 💰 Fortune | +1 % or | 10 | +10 % |
| 📚 Savoir | +1 % XP | 10 | +10 % |
| 🍀 Flair | +0,5 % chance de butin | 8 | +4 % |

Les bonus s'appliquent **partout** (farm/donjon/raid), via les mêmes canaux
que les ex-améliorations (multiplicateurs globaux). Le total combat (~+11 %
réparti) est de l'ordre de la Maîtrise des Zones : sensible sur une année,
jamais décisif.

**UI** : sous-onglet **🏛️ Conseil** du Marché — contrats avec barres de
progression + compte à rebours hebdo, puis l'arbre (6 lignes, bouton +1 rang).

### Hors périmètre de ce lot (lot suivant)
**🔥 Trempe lente** : déposer un objet à la forge ; il gagne +1 petit palier
d'iLvl par 24 h réelles (max ~5). Remplaçant « temps réel » de l'amélioration
d'objet supprimée. Spécifié, non implémenté ici (interactions stockage/équipé
à trancher).

## 4. ◈ Transmutateur → ◈ Catalyseur (Alchimiste)

**Problème.** La spé Transmutateur débloquait des conversions de ressources —
le principe même qu'on a supprimé avec le Comptoir (« chaque donjon est LA
source de sa ressource »).

**Décision.** La spécialisation (même nœud, l'acquis des saves est conservé)
devient **◈ Catalyseur**, recentrée sur l'identité quintessence de
l'Alchimiste, en miroir du ◈ Distillateur (recyclage) :

> **◈ Catalyseur** : les améliorations à la **Quintessence coûtent −25 %**, et
> le recyclage d'un objet renforcé rembourse **100 %** des Quintessences
> investies (au lieu de 75 %).

Supprimés avec elle : `CONVERSIONS`, l'action `convertResource`, la section
« Transmutation de ressources » du Laboratoire. Les Quintessences redeviennent
un pur drop de biome (+ Condensation), jamais achetables.

## 5. Knobs

| Knob | Valeur | Fichier |
|---|---|---|
| Points/contrat · contrats/sem | 1 · 3 | `maitrise.ts` |
| Objectifs hebdo | 5 donjons / 3 raids / 15 paliers | `maitrise.ts` |
| Bonus par rang | tableau §3 | `maitrise.ts` |
| Refund migration | 100 % or + éclats | `store.ts` (migration) |
| Catalyseur | −25 % coût quint · refund 100 % | `metiers.ts` / `items.ts` |
