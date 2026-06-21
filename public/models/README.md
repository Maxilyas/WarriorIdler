# Modèles 3D de l'avatar (v0.43.3)

L'avatar 3D ([Avatar3D.tsx](../../src/components/Avatar3D.tsx)) affiche pour l'instant des **primitives**
(placeholder). Objectif : les remplacer par un **corps rigé** + des **pièces de gear** attachées aux os
selon l'équipement réel. Les modèles vivent ici, en **GLB** (glTF binaire).

## Quel pack télécharger (CC0, gratuit)

- **KayKit – Character Pack : Adventurers** — `kaylousberg.itch.io` (CC0). Personnages rigés + un set
  d'**équipement séparé** (casques, armes, boucliers) pensé pour être **attaché aux mains/tête**.
  → le meilleur pour notre besoin « une pièce par slot ».
- Alternative : **Quaternius – Ultimate Modular / RPG Characters** — `quaternius.com` (CC0), modulaire.

## Où poser les fichiers (pour la PREUVE)

1. Un **corps rigé** → `public/models/base.glb`
2. (optionnel) une **arme** → `public/models/weapon.glb`

Si le pack te donne du `.gltf`/`.fbx`/`.obj` au lieu de `.glb` : convertis en **GLB** (Blender →
*Export glTF 2.0 / .glb*, ou un convertisseur en ligne). Garde des fichiers légers (< 2-3 Mo).

## Étape suivante (moi)

Une fois `base.glb` déposé, **inspecte-le** pour que je câble les bons os/meshes :
```
npm run glb public/models/base.glb
```
Colle-moi la sortie (liste des os, meshes, animations) — je branche alors le chargement GLB
(`useGLTF`), l'animation idle, et l'attachement du gear aux os (casque → tête, arme → main), vérifié
en preview. Tant que `base.glb` est absent, l'avatar reste sur les primitives (aucun plantage).

> Licence : ces packs sont **CC0** (domaine public, aucune attribution requise) — idéal. Vérifie la
> licence de tout asset que tu ajoutes et garde une note ici si elle l'exige.
