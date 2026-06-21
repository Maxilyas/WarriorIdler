# Modèles 3D de l'avatar (v0.43.3)

L'avatar 3D ([Avatar3D.tsx](../../src/components/Avatar3D.tsx)) charge un **corps rigé** + des **pièces
attachées aux os** selon l'équipement réel. Modèles en **GLB** (glTF binaire), source **KayKit
Adventurers / Fantasy Weapons** (CC0 — domaine public, aucune attribution requise).

## Fichiers présents (commités)

| Fichier | Rôle |
|---|---|
| `base.glb` | Corps rigé (KayKit **Knight**). Meshes nommés (`Knight_Helmet`, `Knight_Cape`…) → montrés/cachés selon l'équipement. |
| `animations.glb` | Rig partagé + 15 animations (`Idle_A`, `Hit_A`…). Appliquées au Knight via os homonymes. |
| `wpn_*.glb` | Armes : sword, sword2h, axe, dagger, staff, wand, bow. Attachées à l'os **`handslot.r`**. |
| `shield_*.glb` | Boucliers round / square. Attachés à **`handslot.l`**. |

Le **pack brut** (`public/models/KayKit_*`) est **gitignoré** (on ne commite que les `.glb` extraits) ;
idéalement à déplacer hors de `public/` (dossier `3d-source/`) pour ne pas alourdir les builds.

## Os d'attache du squelette KayKit (23 os)

`head` (casque) · `handslot.r` / `handslot.l` (armes/bouclier) · `hand.r/.l`, `wrist.r/.l`,
`upperarm/lowerarm`, `chest`, `spine`, `hips`, `root`, `upperleg/lowerleg/foot/toes`…

## Ajouter un asset

1. **Inspecter** un `.glb` (os/meshes/animations) :
   ```
   npm run glb public/models/base.glb
   ```
2. **Convertir** un `.gltf` (+bin+textures) en `.glb` autonome :
   ```
   npm run gltf2glb <chemin/asset.gltf> <nomDeSortie>   # → public/models/<nomDeSortie>.glb
   ```

## Limite connue (KayKit free)

Le **Knight** est un corps **déjà entièrement armuré** (un seul mesh de corps) : on ne peut donc faire
varier par slot que le **casque**, la **cape**, l'**arme** et le **bouclier**. Le torse/jambes/etc. ne
sont pas des pièces séparées dans ce pack gratuit. Pour du per-slot complet, il faudra un pack
**modulaire** (parties d'armure séparées) ou des pièces sur mesure — étape ultérieure.
