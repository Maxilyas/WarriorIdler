# Étude — Persistance des sauvegardes sur GitHub Pages

> **Statut : étude stratégique/technique (non implémentée).** Ce document compile une analyse de
> faisabilité ; il ne décrit pas un système existant. Le code fait foi : voir
> [`docs/systemes/10-etat-store-et-sauvegarde.md`](systemes/10-etat-store-et-sauvegarde.md) pour la
> sauvegarde **réelle** d'aujourd'hui.
>
> **Question d'origine :** est-il possible d'avoir une base de données persistante pour les
> sauvegardes des utilisateurs, permettant de charger une ou plusieurs sauvegardes, **sachant que le
> déploiement se fait uniquement sur GitHub Pages** ?

## Table des matières

1. [État des lieux : la save aujourd'hui](#1-état-des-lieux--la-save-aujourdhui)
2. [La contrainte clé : GitHub Pages = statique pur](#2-la-contrainte-clé--github-pages--statique-pur)
3. [Les trois paliers d'options](#3-les-trois-paliers-doptions)
4. [Palier 1 — Export / Import fichier (détaillé)](#4-palier-1--export--import-fichier-détaillé)
5. [Palier 2 — Multi-slot IndexedDB (détaillé)](#5-palier-2--multi-slot-indexeddb-détaillé)
6. [Palier 1 vs Palier 2 : complémentaires](#6-palier-1-vs-palier-2--complémentaires)
7. [Palier 3 — BaaS / cloud-save (approfondi)](#7-palier-3--baas--cloud-save-approfondi)
   - [7.1 Comptes + isolation des données](#71-comptes--isolation-des-données)
   - [7.2 Risques approfondis](#72-risques-approfondis)
   - [7.3 Avantages concrets](#73-avantages-concrets)
   - [7.4 Verdict techno (Supabase vs Firebase vs alternatives)](#74-verdict-techno-supabase-vs-firebase-vs-alternatives)
8. [Synthèse & recommandation priorisée](#8-synthèse--recommandation-priorisée)

---

## 1. État des lieux : la save aujourd'hui

Constats tirés du code ([`save.ts`](../src/game/save.ts), [`store.ts`](../src/game/store.ts),
[`App.tsx`](../src/App.tsx), [`vite.config.ts`](../vite.config.ts)) :

- **Un seul emplacement, une seule clé.** Tout l'état persistant est sérialisé en **un gros objet
  JSON** (`SaveData`, ~160 champs) écrit sous **une clé unique** `localStorage` :
  `warrior-idler-save-v030c` ([save.ts:35](../src/game/save.ts#L35)). Il n'existe **aucune notion de
  slot** : une partie = un navigateur = une save.
- **Écriture maîtrisée.** `persist` (synchrone, actions joueur), `persistThrottled` (chemin chaud
  5 Hz, coalescé à 1 écriture / 2 s) et `flushSave` (mise en veille / `pagehide`,
  [App.tsx:140](../src/App.tsx#L140)).
- **Lecture + migration robustes.** `loadSave` → `JSON.parse` → `sanitize`, une longue chaîne de
  migrations **versionnées** (`metiersV`, reroutage de stats, refontes). Le format est **autonome et
  entièrement sérialisable**.
- **Amorçage synchrone.** Le store se construit **une seule fois** :
  `useGame = create((set,get) => { const save = loadSave(); … })`
  ([store.ts:421](../src/game/store.ts#L421)). Le **crédit hors-ligne** + rattrapage des automates
  est calculé **dans cette init synchrone** à partir de `save.lastSeen`
  ([store.ts:427-459](../src/game/store.ts#L427)), avec une variante « retour au premier plan »
  `resumeAway` adossée à un `awaySince` **global de module**
  ([worldSlice.ts:125](../src/game/worldSlice.ts#L125)).
- **Multi-perso ≠ multi-save.** Le multi-personnage existe déjà *dans* une save (`characters[]`,
  inventaire/ressources communs). Ce n'est **pas** du multi-slot.
- **Contrainte de taille.** `INV_BASE = 5000` ([storeHelpers.ts:66](../src/game/storeHelpers.ts#L66))
  borne l'inventaire pour tenir dans le quota `localStorage` (~5-10 Mo).
- **Pas d'export/import.** Une save est **prisonnière du navigateur** : vider le cache = tout perdre,
  zéro multi-device.
- **Déploiement.** Front statique pur (`vite build` + PWA `vite-plugin-pwa`, `autoUpdate`,
  `base: '/WarriorIdler/'`), servi par GitHub Pages. **Aucun backend.**
- **Nature du jeu.** Idler **solo**, pas de leaderboard ni de PvP → **tricher ne pénalise que le
  tricheur**. Ce fait pèse lourd dans la reco.

---

## 2. La contrainte clé : GitHub Pages = statique pur

GitHub Pages ne sert que des fichiers. **Conséquences dures :**

1. **Pas de code serveur à toi.** Aucun endpoint, aucune base de données *hébergée par toi*.
2. **Pas de secret.** Tout ce qui est livré est public. **Aucune clé d'API ne peut être cachée.**
3. **Donc : le client n'est pas digne de confiance.** Sans serveur que tu contrôles, **l'anti-triche
   est structurellement impossible** à garantir (acceptable ici : jeu solo).

**Ce qui reste possible malgré ça :**

- Toute la **persistance côté client** (localStorage, IndexedDB, fichiers).
- Appeler depuis le navigateur des **services tiers (BaaS)** qui hébergent une vraie base + une vraie
  auth (Firebase, Supabase…). Le « backend » est le tiers, pas Pages → **100 % compatible** avec un
  hébergement statique.
- Une éventuelle **couche serverless** hébergée *ailleurs* (Cloudflare/Netlify/Vercel) si un jour il
  faut cacher une clé ou valider côté serveur (= approche hybride).

---

## 3. Les trois paliers d'options

| Palier | Idée | Tiers ? | Multi-device | Multi-slot | Anti-perte réel | Coût | Effort |
|---|---|---|---|---|---|---|---|
| **1** | Export / Import fichier | Non | Manuel | Via fichiers | ✅ (fichier externe) | 0 | Faible |
| **2** | Multi-slot IndexedDB | Non | ❌ | ✅ natif | ❌ (reste local) | 0 | Moyen |
| **3** | BaaS / cloud-save | Oui | ✅ auto | ✅ | ✅ | free tier | Élevé |

Les paliers 1 et 2 sont **100 % client** ; le palier 3 délègue base + identité à un tiers. Les trois
sont compatibles GitHub Pages. **Seul le palier 3 offre le multi-device automatique.**

---

## 4. Palier 1 — Export / Import fichier (détaillé)

### 4.1 En quoi ça consiste & intégration

- **Export** : la brique existe à 90 % — `buildSaveData(state)`
  ([save.ts:940](../src/game/save.ts#L940)) produit déjà le `SaveData` voulu (champs persistés
  explicites, transitoires exclus). Aujourd'hui **privé** → l'exposer via `exportSave(state): string`
  (idéalement avec en-tête : version de schéma + horodatage + checksum). UI : bouton →
  téléchargement `Blob`/`<a download>` avec **repli copie presse-papier**.
- **Import** : `<input type=file>` + `FileReader` (ou texte collé) → `JSON.parse` → **réinjecter dans
  la chaîne `sanitize` existante** → remplacer l'état + persister.
- **Subtilité** : un **mapping implicite `SaveData → GameState`** vit dans l'init du store. Le plus
  robuste pour importer à chaud : **écrire le `SaveData` dans `localStorage` puis
  `window.location.reload()`** → l'init standard refait tout proprement (globals, crédit offline).
- **PWA** : aucun impact (le SW cache l'app, pas les données).

### 4.2 Avantages

- **Anti-perte (le manque n°1 actuel)** : vider le cache = perte totale aujourd'hui ; un fichier est
  une copie hors-navigateur, immune à l'éviction de stockage.
- **Sauvegarde avant action irréversible** (Éveil/prestige, reset, gros recyclage).
- **Multi-device manuel** via le Drive/mail/USB **du joueur**, sans tiers.
- **Portabilité / RGPD gratuite** : l'export **est** la portabilité ; **zéro PII**.
- **Coût nul, zéro dépendance, pérennité maximale** (API navigateur stables et anciennes).
- **Aucune surface d'attaque ajoutée** (fichier local).
- **Support & debug** : envoyer/charger une save de repro (utile vu la culture sims du projet).
- **Partage** entre joueurs.
- **Indépendant du cap `INV_BASE`** : un fichier n'est pas borné par le quota localStorage.
- **Fondation cloud** : `exportSave`/`importSave` **sont** les fonctions sérialiser/hydrater du
  palier 3. Travail non jeté.

### 4.3 Inconvénients / limites / pièges

- **Manuel donc oubliable** ; pas de backup automatique.
- **Pas de sync auto** ni multi-device transparent (palier 3).
- **UX étrangère au grand public mobile** (gestion de fichiers iOS/Android).
- **Triche triviale** (fichier éditable) — sans importance solo, mais un joueur peut **casser sa
  propre partie** : `sanitize` protège la **structure**, pas les **valeurs**.
- **Robustesse import** : fichier tronqué → `JSON.parse` lève → import **défensif** obligatoire (ne
  jamais écraser la save courante avant validation réussie).
- **Compatibilité de version asymétrique** : vieille save → `sanitize` migre (OK) ; save **plus
  récente** dans une app **plus ancienne** → champs récents **perdus**, pas de downgrade → estamper
  la version et avertir.
- **Edge case `lastSeen`** : le fichier contient `lastSeen`. Importé plus tard → crédit hors-ligne
  fortuit (windfall) → **remettre `lastSeen = Date.now()` à l'import**.
- **`onboarded`** : marquer la save importée `onboarded = true` (comme `migrateOldSave`).
- **Hoquet UI** : `JSON.stringify` d'une grosse save bloque brièvement le thread (ponctuel).
- **Mobile/PWA** : `download` capricieux sur iOS → prévoir **Web Share API** / copier-coller.

### 4.4 Effort & fichiers touchés

**Effort : faible.** `save.ts` (exposer `exportSave`/`importSave`), 1 composant UI (panneau
Options) + câblage `App.tsx`. **Aucune** modification des migrations ni du format. L'approche
« écrire + `reload()` » évite tout nouveau mapping à maintenir.

---

## 5. Palier 2 — Multi-slot IndexedDB (détaillé)

### 5.1 En quoi ça consiste & intégration

Remplacer **la clé unique** par un **registre de slots** (chaque slot = un `SaveData` complet) + un
**pointeur de slot actif**. Object store IndexedDB `saves` keyé par `slotId`. UI : gestionnaire
(lister, créer, **dupliquer**, renommer, supprimer, **changer**, aperçu niveau/`bestStage`).

**Le défi structurant : IndexedDB est asynchrone, l'amorçage est synchrone.** L'init lit `loadSave()`
synchronement et calcule **immédiatement** le crédit hors-ligne ; IDB n'a **aucune API synchrone**.
Deux stratégies :

- **(a) Hybride (miroir localStorage du slot actif)** : pointeur + copie miroir du slot actif en
  localStorage (boot synchrone inchangé), IDB durable pour tous les slots. Refacto minimal. **Mais**
  le slot actif reste borné par localStorage → **soulagement `INV_BASE` partiel**.
- **(b) Boot asynchrone (full-IDB)** : écran de chargement → lecture IDB → hydratation (crédit
  offline déplacé **après** le load). **Supprime** le quota localStorage (vrai relâchement de
  `INV_BASE`) mais **refacto plus lourd**.

**`persist`/`flushSave`** : le throttle reste, mais `writeSave` cible IDB (async). **Piège majeur :
durabilité à la fermeture** — aujourd'hui `flushSave` sur `pagehide` est **synchrone** (localStorage,
fiable) ; une écriture **IDB sur unload peut être abandonnée** → argument fort pour l'hybride (a)
(filet synchrone localStorage du slot actif).

**`sanitize`/migrations** : inchangées, appliquées **par slot**. La save unique existante migre →
**slot 0**. La migration porte sur la **couche de stockage**, pas le format. **`SaveData` inchangé**,
aligné 1:1 avec la future colonne `slot` du cloud.

### 5.2 Avantages

- **Multi-slot natif** : répond directement à « charger une ou plusieurs sauvegardes » (parties
  parallèles, runs d'expérimentation).
- **Quota IDB ≫ localStorage** → **relâche `INV_BASE`** *si boot full-IDB (b)* (cap relevable, moins
  d'auto-recyclage forcé).
- **Robustesse grosses saves**.
- **Duplication de slot = backup local instantané** avant prestige/reset.
- **Changer de partie sans perdre l'autre**.
- **Local pur** : coût 0, zéro tiers, zéro PII/RGPD, pérennité (IDB universel).
- **Fondation cloud** : modèle de slots **mappe 1:1** sur `(user_id, slot, data)`.

### 5.3 Inconvénients / limites / pièges

- **Ne résout NI le multi-device NI l'anti-perte hors-device** (IDB est local au navigateur).
- **Pas plus résistant à l'éviction que localStorage** : IDB **et** localStorage sont évincibles
  (pression disque, ITP Safari ~7 j sans interaction hors site installé). IDB est plus **gros**, pas
  plus **sûr** → **le palier 1 reste indispensable** pour l'anti-perte réel ; envisager
  `navigator.storage.persist()` (non garanti).
- **Complexité asynchrone** (boot async ou miroir hybride) : coût principal.
- **Durabilité unload** : écritures IDB async potentiellement perdues → filet localStorage ou perte
  acceptée < fenêtre throttle (partiellement rattrapée par `lastSeen`, **pas** pour l'inventaire).
- **Crédit hors-ligne au changement de slot** : la logique vit **uniquement dans l'init synchrone**
  ([store.ts:427-459](../src/game/store.ts#L427)). Charger un slot → soit **`reload()`** (simple,
  réutilise l'init), soit **factoriser** un `hydrate(save)` partagé. **Risque de double-crédit** si
  les deux chemins coexistent.
- **Windfall sur slot dormant** : `lastSeen` figé → réactiver = gros crédit offline → plafonner ou
  **`lastSeen = now` au switch**.
- **Globals de module à réinitialiser au switch** : `awaySince`, `invMax`, `refreshGlobals` (dérivés
  d'`upgrades/maitrise/constellation/achievements`) sont au niveau module → reset obligatoire (le
  `reload()` l'évite).
- **Soulagement `INV_BASE` partiel en hybride (a)**.
- **Dégradation gracieuse** : IDB indisponible (mode privé) → repli localStorage mono-slot.
- **Tests** : le socle Vitest teste localStorage → ajouter `fake-indexeddb` ou une abstraction.
- **Migration de la couche de stockage** : localStorage existant → slot IDB 0, idempotent + repli.

### 5.4 Effort & fichiers touchés

**Effort : moyen.** `save.ts` (abstraction stockage, registre de slots, async, migration, repli),
`store.ts` (boot sync↔async, `switchSlot`/`createSlot`/`deleteSlot`, reset globals au switch),
`App.tsx` (chargement éventuel + filet flush), nouveau composant gestionnaire de slots, infra de
test. **PWA, format `SaveData` et migrations inchangés.**

---

## 6. Palier 1 vs Palier 2 : complémentaires

Ils répondent à des besoins **différents** et **se renforcent** :

- **Palier 1** = durabilité, portabilité, **anti-perte réel**, transfert manuel, fondation cloud.
- **Palier 2** = confort de parties multiples + relâchement du quota — mais **toujours local**, donc
  **toujours exposé à l'éviction**.

**Point clé** : le palier 2 **a besoin** du palier 1 comme filet (IDB n'est pas à l'abri de
l'effacement) ; et le palier 1 **construit la plomberie** (sérialiser/hydrater) que les paliers 2 et
3 réutilisent. **Aucun des deux ne donne le multi-device automatique** (réservé au palier 3).

**Ordre conseillé** : **palier 1 d'abord** (petit, anti-perte immédiat, plomberie réutilisable), puis
**palier 2** (réutilise `hydrate`), puis palier 3 si besoin.

---

## 7. Palier 3 — BaaS / cloud-save (approfondi)

> Le « backend » est un **tiers** (Supabase/Firebase) appelé depuis le front statique — **compatible
> GitHub Pages**. Apporte la seule capacité que le client pur ne peut offrir : **synchro multi-device
> automatique** (+ télémétrie). Le coût réel n'est pas le stockage (blob JSON trivial) mais
> **l'auth (UX + RGPD)** et surtout **la résolution de conflits** liée à `lastSeen`/offline.

### 7.1 Comptes + isolation des données

**Oui, isolation possible — la garantie est *côté serveur*, pas côté front.** Le navigateur *présente*
un jeton signé ; il ne peut pas le forger.

**Deux clés à ne pas confondre (modèle Supabase) :**

- **Clé publique (`anon`)** : livrée dans le front, **ce n'est pas un secret** (identifie le projet).
  Seule, elle ne donne accès à rien que les règles n'autorisent.
- **Clé `service_role`** : bypass total → **jamais** dans le front (n'existe que côté serveur).

**Flux d'identité :**

1. L'utilisateur s'authentifie → le BaaS émet un **JWT signé avec un secret que seul lui détient**
   (`sub = uuid`, rôle, expiration).
2. Chaque requête porte : clé `anon` **+** `Bearer <JWT>`.
3. La base **vérifie la signature** puis expose `auth.uid()` = `sub` vérifié. Le client **ne peut pas
   mentir** sur son `uid`.

**Table + règles (RLS) :**

```
saves(
  user_id  uuid    -- défaut auth.uid()
  slot     int
  data     jsonb   -- le blob SaveData tel quel
  version  int     -- compteur monotone (anti-conflit)
  updated_at timestamptz
  PRIMARY KEY (user_id, slot)
)
```

RLS **activée** : lecture/écriture autorisées **seulement si `auth.uid() = user_id`** (`using` +
`with check`). **Garantie d'isolation** : pour lire la ligne d'un autre, il faudrait un JWT valide où
`sub = uid(autrui)` → impossible sans ses identifiants ou le secret de signature. La clé `anon`
publique ne donne **aucun** accès aux `saves`. **Enforcement cryptographique, serveur-side,
indépendant du front public.**

**Firebase = même principe** : `firebaseConfig` public, ID token (JWT) avec `uid`, **Security Rules**
(`allow read, write: if request.auth.uid == uid`) évaluées serveur.

**Méthodes d'auth & UX :**

| Méthode | Friction | Portabilité | Note UX |
|---|---|---|---|
| **Anonyme (upgradable)** | **Nulle** | Liée au localStorage — **perdue si cache vidé tant que non liée** | Cloud-save silencieux au lancement ; **pas un vrai backup** avant liaison |
| **Magic link / OTP email** | Faible | Bonne, sans mot de passe | Oblige à **quitter le jeu** pour le mail ; dépend de la délivrabilité |
| **OAuth Google** | Très faible (mobile) | Bonne | 1 tap ; **rebute les soucieux de vie privée** |
| **OAuth GitHub** | Faible | Bonne | Parfait public dev, étrange public « joueurs » |
| **Email + mot de passe** | Moyenne-forte | Bonne | Le plus lourd → **à éviter** |

**Reco UX :** **anonyme par défaut**, puis bouton *« Sécuriser/synchroniser »* qui **lie** un
magic-link ou un OAuth au **même `uid`** (save conservée, devient récupérable + multi-device).

### 7.2 Risques approfondis

| Risque | Gravité | Probabilité | Mitigation |
|---|---|---|---|
| **RLS/règles mal configurées** (base ouverte au monde) | **Critique** | **Moyenne** (faille n°1) | RLS activée + *deny by default* ; tester chaque politique ; jamais de `service_role` au front |
| **Falsification du contenu de sa propre save** | Faible (solo) → **Critique si leaderboard** | **Certaine** | Inévitable sans serveur. **Assumé solo.** Leaderboard → validation/recalcul serveur (Edge Functions) |
| **Abus du free tier** (comptes/lignes en masse) | Moyenne | Moyenne | Cap lignes/user, rate-limit signup, captcha, purge anonymes inactifs |
| **Coûts qui dérapent** (Firebase Blaze, facturation **par opération**) | **Élevée** (Blaze) / Faible (Supabase) | Moyenne si écriture mal câblée | **Ne jamais brancher le cloud sur `persistThrottled` (5 Hz).** Sync sur événements grossiers (veille, intervalle de minutes) ; alertes budget ; préférer Supabase (capacitaire) |
| **Conflits sync `lastSeen`/offline** | **Élevée** (perte de progrès) | **Élevée** en multi-device | Compteur **`version` monotone** + `updated_at` + concurrence optimiste ; conflit → **choix utilisateur** (résumé cloud vs local) ; **plier le crédit offline dans le blob AVANT push** |
| **RGPD / suppression de compte** (email = PII) | Moyenne | Certaine si emails collectés | Politique de confidentialité, parcours « supprimer compte+données », région **EU**, l'anonyme évite la PII, l'export = portabilité |
| **Perte de données fournisseur** | Élevée si copie unique | Faible | **Local reste la copie de référence** (cloud = miroir) + export périodique |
| **Panne du tiers** | Faible **si offline-first** | Moyenne (Supabase free **met en pause** après inactivité) | **Offline-first** : le jeu tourne sur le store local, sync best-effort, jamais bloquant |
| **Lock-in** | Moyenne | — | Firebase propriétaire ; **Supabase = Postgres+JWT standard, OSS, auto-hébergeable** ; donnée = blob JSON → lock-in faible côté données |

**Synthèse menace front-public-sans-secret** : avec des règles correctes, l'attaquant **ne peut ni
lire ni écrire les données d'autrui** ; il peut créer des comptes (abus de volume, mitigeable) et
falsifier **sa propre** save (sans importance solo). Le vrai danger = **mauvaise config RLS** et
**écriture trop fréquente** (coût).

### 7.3 Avantages concrets

- **Multi-device automatique** — la seule chose que le client pur ne sait pas faire.
- **Anti-perte / reprise après sinistre** (cache vidé, appareil perdu, réinstallation).
- **Identité = socle de features futures** : saisons/events liés au joueur, leaderboards (*exigent une
  validation serveur*), cadeaux/codes, support à distance.
- **Télémétrie de progression** — atout sous-estimé **pour ce projet** : des données réelles
  anonymisées **nourriraient le calibrage** (sims `ttk`/`eco`/`mur`/`weights`) avec du réel.

### 7.4 Verdict techno (Supabase vs Firebase vs alternatives)

| Critère (idler solo, blob JSON, hébergé statique) | **Supabase** | **Firebase** | PocketBase/self-host | Cloudflare Workers+D1 |
|---|---|---|---|---|
| Modèle blob `jsonb` | ✅ parfait | ✅ (doc) | ✅ | ✅ |
| Auth (anonyme + magic link + OAuth) | ✅ complet | ✅ (anonyme le + simple) | ✅ basique | à coder |
| Risque facture-surprise | **Faible** (capacitaire) | **Élevé** (Blaze, par opération) | nul (VPS fixe) | faible |
| Lock-in | **Faible** (Postgres/OSS) | Élevé (propriétaire) | nul | moyen |
| RGPD / région EU | ✅ | ✅ | ✅ | ✅ |
| Compatible « statique pur » | ✅ | ✅ | ❌ (héberger un binaire) | ⚠️ (= backend à maintenir) |
| Effort | Moyen | Moyen | Moyen-élevé (ops) | Élevé |
| Réserve | Projet free **en pause** après inactivité | Câblage écriture à blinder | Pas statique pur | Backend déguisé |

**Reco : Supabase.** Modèle `jsonb` taillé pour le blob, **pas de facture-surprise**, **faible
lock-in** (Postgres/JWT/OSS, auto-hébergeable), région EU, menu d'auth complet. **Firebase** seulement
si on veut sa simplicité d'auth anonyme **et** qu'on throttle durement les écritures.
PocketBase/Cloudflare sortent du « statique pur ».

**Quand l'adopter :** **pas maintenant.** D'abord paliers 1 + 2 (prérequis : le cloud synchronise le
**même** modèle de slots ; l'export sert déjà de filet/portabilité). Adopter le BaaS **quand** un
déclencheur est réel : multi-device demandé, télémétrie voulue, events liés au joueur.

**Approche progressive :**

- **Phase 0** — slots locaux (IDB) + export/import. *(socle)*
- **Phase 1** — Supabase **auth anonyme** : miroir cloud **silencieux** du slot actif, **offline-first**,
  sync **grossière** (jamais sur le tick), compteur `version`.
- **Phase 2** — bouton **« lier un compte »** (magic link / OAuth) sur le **même `uid`** → récupération
  + multi-device réels.
- **Phase 3** *(seulement si compétitif)* — validation serveur (Edge Functions) pour leaderboards.

**Honnêteté bénéfice/complexité** : pour un idler **solo**, le rapport est **moyen** tant qu'il n'y a
ni multi-device demandé, ni télémétrie, ni events liés au compte — la complexité (auth UX, RGPD,
conflits offline) dépasse alors le gain face à « IDB + export/import ». Il devient **clairement
favorable** dès qu'un de ces déclencheurs apparaît.

---

## 8. Synthèse & recommandation priorisée

**Réponse à la question :** **oui**, une persistance fiable et même un vrai cloud multi-device/multi-slot
sont possibles sur GitHub Pages — non pas avec une base hébergée *par toi*, mais via la **persistance
client** (slots/fichiers) et/ou un **BaaS tiers** appelé depuis le front. Le format de save actuel
(blob JSON autonome + `sanitize` idempotent) s'y prête idéalement.

**Priorisation par effort croissant et valeur réelle :**

1. **Palier 1 — Export/Import (à faire en priorité).** Effort minime, comble le manque anti-perte n°1
   (vidage de cache = perte totale aujourd'hui), multi-device manuel immédiat, **plomberie réutilisée**
   par les paliers 2 et 3. Ne touche ni au format ni aux migrations.
2. **Palier 2 — Multi-slot IndexedDB.** Répond directement à « plusieurs sauvegardes », relâche
   `INV_BASE` (si boot full-IDB), reste 100 % offline/gratuit/pérenne. Réutilise l'`hydrate` du
   palier 1.
3. **Palier 3 — Supabase (seulement si besoin réel).** Auth anonyme upgradable, `jsonb` par slot,
   **offline-first**, **gestion de conflits `lastSeen`** dès le départ. Adopter quand le multi-device
   automatique (ou la télémétrie) devient un objectif explicite — pas avant.
4. **À écarter** : Gist API (UX token), couche serverless/anti-triche tant qu'il n'y a pas de
   classement compétitif.

**Ligne directrice :** **paliers 1 puis 2** couvrent ~90 % du besoin réel (sauvegarde durable +
plusieurs parties + transfert) pour un coût marginal et **sans dépendance externe**. Ne franchir le
**palier 3** que pour la **synchronisation automatique entre appareils** — le seul besoin que le
client pur ne peut pas satisfaire.

| | Anti-perte réel | Multi-slot | Multi-device auto | Coût | Effort | Dépendance |
|---|---|---|---|---|---|---|
| **Palier 1** | ✅ (fichier) | via fichiers | ❌ | 0 | Faible | Aucune |
| **Palier 2** | ❌ (local) | ✅ natif | ❌ | 0 | Moyen | Aucune |
| **Palier 3** | ✅ (cloud) | ✅ | ✅ | free tier | Élevé | BaaS tiers |

*Document d'étude — à confronter au code (qui fait foi) avant toute implémentation.*
