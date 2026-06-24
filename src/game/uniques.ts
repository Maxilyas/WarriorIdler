import type { UniqueEffect, UniqueInstance, StatBlock, StatKey, DamageType, RarityId } from './types'
import { RARITIES } from './rarities'

/**
 * Catalogue des effets uniques — couvre TOUS les rôles (dps / heal / tank / resist / utility).
 * Chaque effet a des `mods` (et parfois des `resistMods`) de base, et un texte d'actif (`active`)
 * débloqué au rang actif.
 *
 * IMPORTANT (équilibrage) : les `mods` sont des VALEURS DE BASE. Leur magnitude effective monte
 * avec le RANG **et avec la rareté + l'iLvl de l'objet porteur** (cf. `instanceMods`) — un unique
 * sur une pièce Transcendante de haut iLvl pèse autant qu'une grosse ligne d'affixe, là où avant
 * il devenait négligeable. Les `resistMods` (en %) ne montent qu'avec le rang (cap dur en aval).
 *
 * Les effets apparaissent dès la rareté Épique (tier 5) ; ils peuvent aussi être INSÉRÉS sur un
 * objet via des essences (recyclage d'uniques) ou INVOQUÉS au choix via un Éclat cosmique (raid).
 *
 * Ajouter une capacité = ajouter une entrée ici. Rien d'autre à changer (le grimoire la liste seul).
 */
export const UNIQUE_EFFECTS: UniqueEffect[] = [
  // ================= DPS (historiques) =================
  { id: 'soif_de_sang', name: 'Soif de sang', role: 'dps', description: 'Vos coups critiques vous régénèrent.', mods: { critique: 40, volDeVie: 20 }, active: 'Frénésie : un crit déclenche un gain de vitesse d\'attaque.' },
  { id: 'lame_tempete', name: 'Lame-tempête', role: 'dps', description: 'Vos frappes s\'enchaînent en rafale.', mods: { hate: 50, force: 35 }, active: '15% de chance de frapper deux fois.' },
  { id: 'precision_mortelle', name: 'Précision mortelle', role: 'dps', description: 'Vous visez les points vitaux.', mods: { critique: 60, degatsCrit: 50 }, active: 'Les crits exécutent les ennemis affaiblis.' },
  { id: 'rage_du_berserker', name: 'Rage du berserker', role: 'dps', description: 'Plus vous êtes blessé, plus vous frappez fort.', mods: { force: 70, critique: 25 }, active: 'Dégâts fortement accrus sous 50% de vie.' },
  { id: 'fureur_des_arcanes', name: 'Fureur des arcanes', role: 'dps', description: 'La magie afflue dans vos veines.', mods: { intelligence: 60, hate: 25, degatsCrit: 30 }, active: 'Vos sorts rebondissent sur une cible proche.' },
  { id: 'danse_des_ombres', name: 'Danse des ombres', role: 'dps', description: 'Vous esquivez en frappant.', mods: { agilite: 60, hate: 20 }, active: 'Empile des charges de célérité en esquivant.' },
  { id: 'perce_armure', name: 'Perce-armure', role: 'dps', description: 'Rien ne vous résiste.', mods: { penetration: 60, force: 30 }, active: 'Ignore totalement l\'armure sur les crits.' },
  { id: 'maitre_des_elements', name: 'Maître des éléments', role: 'dps', description: 'Les éléments vous obéissent.', mods: { maitrise: 60, intelligence: 30 }, active: 'Alterne feu/givre/foudre pour des combos.' },
  { id: 'echo_du_vide', name: 'Écho du vide', role: 'dps', description: 'Le néant amplifie vos coups.', mods: { maitrise: 80 }, active: 'Chaque kill propage une explosion de vide.' },
  { id: 'colere_titanesque', name: 'Colère titanesque', role: 'dps', description: 'Chaque coup ébranle le monde.', mods: { force: 50, degatsCrit: 70 }, active: 'Les coups génèrent une onde de choc.' },
  { id: 'frappe_fantome', name: 'Frappe fantôme', role: 'dps', description: 'Vos lames traversent les défenses.', mods: { agilite: 45, penetration: 45 }, active: 'Les frappes ignorent une part des résistances.' },

  // ================= HEAL (historiques) =================
  { id: 'flux_vital', name: 'Flux vital', role: 'heal', description: 'La vie circule à travers vous.', mods: { intelligence: 90 }, active: 'Un soin différé suit chaque attaque.' },
  { id: 'sang_eternel', name: 'Sang éternel', role: 'heal', description: 'Vos blessures se referment seules.', mods: { volDeVie: 40, intelligence: 30 }, active: 'Un bouclier de sang se reforme hors combat.' },
  { id: 'benediction_solaire', name: 'Bénédiction solaire', role: 'heal', description: 'Une lumière apaisante vous entoure.', mods: { intelligence: 75, maitrise: 30 }, active: 'Soigne le groupe à chaque sort lancé.' },
  { id: 'communion', name: 'Communion', role: 'heal', description: 'Votre esprit nourrit le groupe.', mods: { intelligence: 100 }, active: 'Soigne tout le groupe sur la durée.' },
  { id: 'renaissance', name: 'Renaissance', role: 'heal', description: 'Vous renaissez de vos cendres.', mods: { intelligence: 50, endurance: 60 }, active: 'Survit une fois à la mort par combat.' },

  // ================= TANK (historiques) =================
  { id: 'colosse', name: 'Carrure de colosse', role: 'tank', description: 'Votre stature impose le respect.', mods: { endurance: 80, maitrise: 25 }, active: 'Renvoie une partie des dégâts subis.' },
  { id: 'gardien_eternel', name: 'Gardien éternel', role: 'tank', description: 'Une volonté inépuisable.', mods: { endurance: 60, reductionDegats: 50 }, active: 'Un bouclier se régénère hors combat.' },
  { id: 'mur_dacier', name: 'Mur d\'acier', role: 'tank', description: 'Immobile face à la tempête.', mods: { reductionDegats: 70, barriere: 200 }, active: 'Devient brièvement insensible aux coups.' },
  { id: 'peau_de_dragon', name: 'Peau de dragon', role: 'tank', description: 'Des écailles ancestrales vous couvrent.', mods: { endurance: 100, reductionDegats: 30 }, active: 'Reflète les attaques esquivées.' },
  { id: 'rempart_vivant', name: 'Rempart vivant', role: 'tank', description: 'Vous attirez et encaissez tout.', mods: { endurance: 70, barriere: 300 }, active: 'Provoque toute la salle.' },

  // ================= RESIST (historiques) =================
  { id: 'coeur_de_braise', name: 'Cœur de braise', role: 'resist', description: 'Le feu ne vous atteint plus.', mods: { endurance: 40 }, resistMods: { feu: 0.18 }, active: 'Immole les attaquants au contact.' },
  { id: 'armure_de_givre', name: 'Armure de givre', role: 'resist', description: 'Le froid glisse sur vous.', mods: { endurance: 40 }, resistMods: { froid: 0.18 }, active: 'Ralentit les ennemis proches.' },
  { id: 'mise_a_la_terre', name: 'Mise à la terre', role: 'resist', description: 'La foudre vous contourne.', mods: { endurance: 40 }, resistMods: { foudre: 0.18 }, active: 'Décharge la foudre accumulée.' },
  { id: 'voile_antimagie', name: 'Voile antimagie', role: 'resist', description: 'L\'arcane se dissipe à votre contact.', mods: { reductionDegats: 30 }, resistMods: { arcane: 0.18 }, active: 'Dissipe un sort ennemi périodiquement.' },
  { id: 'lumiere_purificatrice', name: 'Lumière purificatrice', role: 'resist', description: 'Les ombres vous fuient.', mods: { reductionDegats: 30 }, resistMods: { ombre: 0.18 }, active: 'Purge les altérations d\'ombre.' },
  { id: 'symbiose_naturelle', name: 'Symbiose naturelle', role: 'resist', description: 'La nature vous épargne.', mods: { intelligence: 40 }, resistMods: { nature: 0.18 }, active: 'Régénère en restant immobile.' },
  { id: 'egide_prismatique', name: 'Égide prismatique', role: 'resist', description: 'Toutes les énergies s\'atténuent.', mods: { endurance: 50 }, resistMods: { feu: 0.08, froid: 0.08, foudre: 0.08, arcane: 0.08, ombre: 0.08, nature: 0.08, physique: 0.08 }, active: 'Convertit les dégâts subis en bouclier.' },

  // ================= UTILITY (historiques) =================
  { id: 'esprit_vif', name: 'Esprit vif', role: 'utility', description: 'Vos réflexes dépassent l\'ennemi.', mods: { hate: 60, reductionDegats: 30 }, active: 'Esquive garantie après un coup encaissé.' },
  { id: 'fortune', name: 'Fortune du voyageur', role: 'utility', description: 'La chance vous sourit.', mods: { maitrise: 50, intelligence: 30 }, active: 'Améliore le butin des combats.' },
  { id: 'equilibre_parfait', name: 'Équilibre parfait', role: 'utility', description: 'Ni trop offensif, ni trop prudent.', mods: { maitrise: 70 }, active: 'Adapte vos stats au combat.' },
  { id: 'source_intarissable', name: 'Source intarissable', role: 'utility', description: 'Une vitalité qui ne tarit jamais.', mods: { intelligence: 80, maitrise: 30 }, active: 'Régénère fortement hors combat.' },

  // ================================================================
  //                100 NOUVEAUX EFFETS UNIQUES
  // ================================================================

  // ---------------- DPS (38) ----------------
  { id: 'u_fracas_sismique', name: 'Fracas sismique', role: 'dps', description: 'Chaque pas fissure la terre.', mods: { force: 80, maitrise: 40 }, active: 'Onde de choc à chaque cran de rage atteint.' },
  { id: 'u_morsure_du_loup', name: 'Morsure du loup', role: 'dps', description: 'Vous traquez la moindre faille.', mods: { critique: 55, agilite: 40 }, active: 'Les crits sur une cible saignante les achèvent.' },
  { id: 'u_cendre_ardente', name: 'Cendre ardente', role: 'dps', description: 'Vos coups laissent des braises.', mods: { maitrise: 55, degatsCrit: 35 }, active: 'Pose un brasier qui ronge l\'ennemi.' },
  { id: 'u_eclair_jumeau', name: 'Éclair jumeau', role: 'dps', description: 'La foudre frappe deux fois.', mods: { hate: 45, multifrappe: 18 }, active: 'Vos frappes se dédoublent par éclairs.' },
  { id: 'u_croc_venimeux', name: 'Croc venimeux', role: 'dps', description: 'Un venin paralyse vos proies.', mods: { agilite: 55, penetration: 35 }, active: 'Le venin empile et ignore l\'armure.' },
  { id: 'u_main_du_bourreau', name: 'Main du bourreau', role: 'dps', description: 'Vous achevez sans pitié : FINISSEURS [finisseur] amplifiés.', mods: { degatsCrit: 80, force: 25 }, tagMods: [{ tag: 'finisseur', mult: 0.25 }], active: 'Dégâts massifs sous 25% de vie ennemie.' },
  { id: 'u_furie_sanguine', name: 'Furie sanguine', role: 'dps', description: 'Le sang versé décuple votre rage.', mods: { force: 60, volDeVie: 25 }, active: 'Chaque kill octroie un cran de furie.' },
  { id: 'u_oeil_du_cyclone', name: 'Œil du cyclone', role: 'dps', description: 'Vous êtes le centre de la tempête.', mods: { hate: 70, critique: 20 }, active: 'Tourbillon qui touche tous les ennemis proches.' },
  { id: 'u_lame_runique', name: 'Lame runique', role: 'dps', description: 'Des runes gravées guident l\'acier.', mods: { intelligence: 50, maitrise: 45 }, active: 'Les runes s\'embrasent à pleine charge.' },
  { id: 'u_traque_silencieuse', name: 'Traque silencieuse', role: 'dps', description: 'Nul ne vous entend venir.', mods: { agilite: 70, critique: 25 }, active: 'Premier coup hors combat toujours critique.' },
  { id: 'u_marteau_du_jugement', name: 'Marteau du jugement', role: 'dps', description: 'Votre verdict est sans appel.', mods: { force: 65, penetration: 30 }, active: 'Une frappe de jugement périodique.' },
  { id: 'u_givre_lacerant', name: 'Givre lacérant', role: 'dps', description: 'Le froid tranche jusqu\'à l\'os.', mods: { critique: 45, maitrise: 40 }, active: 'Les ennemis gelés subissent un surcroît de crits.' },
  { id: 'u_appel_du_vide', name: 'Appel du vide', role: 'dps', description: 'Le néant dévore la lumière.', mods: { intelligence: 55, surpuissance: 12 }, active: 'Une singularité implose à chaque kill.' },
  { id: 'u_danse_de_lames', name: 'Danse de lames', role: 'dps', description: 'Mille coups en un souffle.', mods: { hate: 55, multifrappe: 15 }, active: 'Enchaîne des frappes en éventail.' },
  { id: 'u_brasier_interieur', name: 'Brasier intérieur', role: 'dps', description: 'Une fournaise gronde en vous.', mods: { maitrise: 60, hate: 25 }, active: 'Surchauffe : vitesse accrue, puis explosion.' },
  { id: 'u_serres_aquilines', name: 'Serres aquilines', role: 'dps', description: 'Vous fondez du ciel sur vos proies.', mods: { agilite: 65, degatsCrit: 35 }, active: 'Piqué : un crit garanti à l\'ouverture.' },
  { id: 'u_rune_de_carnage', name: 'Rune de carnage', role: 'dps', description: 'Une soif de destruction pure.', mods: { force: 55, surpuissance: 10 }, active: 'Les dégâts augmentent à chaque seconde de combat.' },
  { id: 'u_souffle_dragon', name: 'Souffle de dragon', role: 'dps', description: 'Vous crachez la ruine : sorts de [feu] de [zone] amplifiés.', mods: { maitrise: 70, intelligence: 25 }, tagMods: [{ tag: 'feu', mult: 0.20 }, { tag: 'zone', mult: 0.15 }], active: 'Un cône de flammes balaie les rangs.' },
  { id: 'u_lame_du_neant', name: 'Lame du néant', role: 'dps', description: 'L\'arme tranche la réalité.', mods: { penetration: 70, degatsCrit: 25 }, active: 'Ignore une part des résistances et de l\'armure.' },
  { id: 'u_frenesie_carmin', name: 'Frénésie carmin', role: 'dps', description: 'Le rouge vous obsède.', mods: { critique: 50, hate: 40 }, active: 'Chaque crit accélère la cadence.' },
  { id: 'u_jugement_solaire', name: 'Jugement solaire', role: 'dps', description: 'La lumière brûle les impies.', mods: { intelligence: 45, maitrise: 45 }, active: 'Une colonne de lumière s\'abat périodiquement.' },
  { id: 'u_lame_spectrale', name: 'Lame spectrale', role: 'dps', description: 'Une arme qui n\'existe qu\'à demi.', mods: { agilite: 50, penetration: 40 }, active: 'Les frappes traversent les boucliers.' },
  { id: 'u_poigne_du_titan', name: 'Poigne du titan', role: 'dps', description: 'Vous broyez tout ce que vous saisissez.', mods: { force: 90 }, active: 'Saisit et écrase une cible pour de gros dégâts.' },
  { id: 'u_pluie_de_fleches', name: 'Pluie de flèches', role: 'dps', description: 'Le ciel s\'assombrit de traits : sorts de [zone] amplifiés.', mods: { agilite: 60, critique: 30 }, tagMods: [{ tag: 'zone', mult: 0.25 }], active: 'Une volée frappe toute la salle.' },
  { id: 'u_resonance_arcanique', name: 'Résonance arcanique', role: 'dps', description: 'La magie résonne et se démultiplie.', mods: { intelligence: 70, degatsCrit: 30 }, active: 'Les sorts résonnent et se relancent.' },
  { id: 'u_croissant_funeste', name: 'Croissant funeste', role: 'dps', description: 'La faux du moissonneur.', mods: { degatsCrit: 60, agilite: 35 }, active: 'Fauche en arc les ennemis affaiblis.' },
  { id: 'u_marque_du_predateur', name: 'Marque du prédateur', role: 'dps', description: 'Vous marquez votre proie.', mods: { critique: 65, penetration: 25 }, active: 'La cible marquée subit des crits majorés.' },
  { id: 'u_tempete_d_acier', name: 'Tempête d\'acier', role: 'dps', description: 'Un déluge de lames.', mods: { hate: 60, force: 35 }, active: 'Vitesse fortement accrue en infériorité numérique.' },
  { id: 'u_flux_destructeur', name: 'Flux destructeur', role: 'dps', description: 'Une énergie qui ne demande qu\'à exploser.', mods: { surpuissance: 15, maitrise: 35 }, active: 'Accumule une charge qui détone.' },
  { id: 'u_dent_de_requin', name: 'Dent de requin', role: 'dps', description: 'L\'odeur du sang vous rend fou.', mods: { volDeVie: 30, critique: 40 }, active: 'Vol de vie majoré sur les cibles blessées.' },
  { id: 'u_eclat_du_chaos', name: 'Éclat du chaos', role: 'dps', description: 'Vos dégâts varient sauvagement.', mods: { degatsCrit: 55, surpuissance: 9 }, active: 'Coups chaotiques : faibles… ou dévastateurs.' },
  { id: 'u_lame_de_l_aube', name: 'Lame de l\'aube', role: 'dps', description: 'Forgée dans la première lumière.', mods: { force: 50, intelligence: 40 }, active: 'Frappe consacrée à l\'ouverture du combat.' },
  { id: 'u_morsure_de_l_hiver', name: 'Morsure de l\'hiver', role: 'dps', description: 'Un froid qui fige le cœur : sorts de [froid] amplifiés.', mods: { maitrise: 50, critique: 35 }, tagMods: [{ tag: 'froid', mult: 0.25 }], active: 'Gèle brièvement les ennemis frappés.' },
  { id: 'u_fureur_naine', name: 'Fureur naine', role: 'dps', description: 'La rage des forges souterraines.', mods: { force: 70, penetration: 25 }, active: 'Une charge qui fracasse l\'armure.' },
  { id: 'u_vol_du_faucon', name: 'Vol du faucon', role: 'dps', description: 'Insaisissable et létal.', mods: { agilite: 75, hate: 20 }, active: 'Esquive offensive : riposte garantie.' },
  { id: 'u_anneau_de_feu', name: 'Anneau de feu', role: 'dps', description: 'Un cercle de flammes vous suit : sorts de [feu] amplifiés.', mods: { maitrise: 65, endurance: 25 }, tagMods: [{ tag: 'feu', mult: 0.25 }], active: 'Embrase les ennemis qui s\'approchent.' },
  { id: 'u_canon_arcanique', name: 'Canon arcanique', role: 'dps', description: 'La puissance brute condensée : sorts d\'[arcane] amplifiés.', mods: { intelligence: 80 }, tagMods: [{ tag: 'arcane', mult: 0.25 }], active: 'Une déflagration arcanique périodique.' },
  { id: 'u_griffe_du_demon', name: 'Griffe du démon', role: 'dps', description: 'Un pacte de pure violence.', mods: { force: 45, agilite: 45, volDeVie: 20 }, active: 'Lacère et draine la vitalité ennemie.' },

  // ---------------- TANK (20) ----------------
  { id: 'u_bastion_imperial', name: 'Bastion impérial', role: 'tank', description: 'Une forteresse à vous seul.', mods: { endurance: 90, reductionDegats: 30 }, active: 'Érige un mur qui absorbe les coups.' },
  { id: 'u_carapace_ancestrale', name: 'Carapace ancestrale', role: 'tank', description: 'Une coquille gravée par les âges.', mods: { reductionDegats: 60, barriere: 250 }, active: 'Durcit la carapace après chaque coup encaissé.' },
  { id: 'u_volonte_de_fer', name: 'Volonté de fer', role: 'tank', description: 'Rien ne vous fait plier.', mods: { endurance: 70, maitrise: 35 }, active: 'Ignore le prochain coup fatal une fois.' },
  { id: 'u_montagne_vivante', name: 'Montagne vivante', role: 'tank', description: 'Inébranlable comme le roc.', mods: { endurance: 120 }, active: 'Plus vous êtes immobile, plus vous résistez.' },
  { id: 'u_serment_du_gardien', name: 'Serment du gardien', role: 'tank', description: 'Vous protégez les vôtres.', mods: { endurance: 60, reductionDegats: 45, maitrise: 20 }, active: 'Redirige une part des dégâts du groupe sur vous.' },
  { id: 'u_aegis_runique', name: 'Aegis runique', role: 'tank', description: 'Un bouclier de runes scellées.', mods: { barriere: 400, endurance: 40 }, active: 'Le bouclier renvoie l\'énergie absorbée.' },
  { id: 'u_chair_de_pierre', name: 'Chair de pierre', role: 'tank', description: 'Votre peau se mue en granit.', mods: { reductionDegats: 80 }, active: 'Pétrification temporaire : quasi-invulnérable.' },
  { id: 'u_coeur_de_montagne', name: 'Cœur de montagne', role: 'tank', description: 'Un cœur lourd comme un mont.', mods: { endurance: 85, reductionDegats: 25 }, active: 'Convertit une part des PV en bouclier.' },
  { id: 'u_garde_du_crepuscule', name: 'Garde du crépuscule', role: 'tank', description: 'Sentinelle entre deux mondes.', mods: { endurance: 65, reductionDegats: 40 }, active: 'Provoque et encaisse une salve entière.' },
  { id: 'u_titan_eveille', name: 'Titan éveillé', role: 'tank', description: 'Un colosse qui se redresse.', mods: { endurance: 100, maitrise: 20 }, active: 'Grandit à chaque coup subi (plus de PV).' },
  { id: 'u_ancre_abyssale', name: 'Ancre abyssale', role: 'tank', description: 'Rien ne peut vous déplacer.', mods: { endurance: 75, reductionDegats: 35 }, active: 'Immunité aux contrôles et au repli forcé.' },
  { id: 'u_bouclier_solaire', name: 'Bouclier solaire', role: 'tank', description: 'Un disque de lumière vous protège.', mods: { barriere: 300, endurance: 30 }, active: 'Le bouclier soigne quand il se brise.' },
  { id: 'u_peau_d_ecorce', name: 'Peau d\'écorce', role: 'tank', description: 'L\'écorce ancestrale vous recouvre.', mods: { endurance: 90, reductionDegats: 30 }, active: 'Régénère tant que vous restez en garde.' },
  { id: 'u_rempart_d_os', name: 'Rempart d\'os', role: 'tank', description: 'Un mur fait des ennemis tombés.', mods: { endurance: 80, barriere: 200 }, active: 'Chaque kill érige un fragment de mur d\'os.' },
  { id: 'u_egide_du_juge', name: 'Égide du juge', role: 'tank', description: 'Le bouclier de la sentence.', mods: { reductionDegats: 55, endurance: 45 }, active: 'Renvoie les coups esquivés à l\'agresseur.' },
  { id: 'u_forme_de_golem', name: 'Forme de golem', role: 'tank', description: 'Un automate de pierre et de mana.', mods: { endurance: 90, barriere: 150 }, active: 'Se reconstruit lentement hors combat.' },
  { id: 'u_serment_inviolable', name: 'Serment inviolable', role: 'tank', description: 'Une promesse que rien ne brise.', mods: { reductionDegats: 50, maitrise: 30 }, active: 'Réduit fortement les dégâts du premier boss.' },
  { id: 'u_carcasse_runique', name: 'Carcasse runique', role: 'tank', description: 'Une armure vivante de runes.', mods: { endurance: 60, barriere: 280, reductionDegats: 20 }, active: 'Les runes scintillent et bloquent un coup.' },
  { id: 'u_geant_des_glaces', name: 'Géant des glaces', role: 'tank', description: 'Une masse de glace impassible.', mods: { endurance: 95, reductionDegats: 20 }, active: 'Gèle les attaquants au contact.' },
  { id: 'u_sentinelle_eternelle', name: 'Sentinelle éternelle', role: 'tank', description: 'La garde qui ne dort jamais.', mods: { endurance: 95, reductionDegats: 35 }, active: 'Veille : régénère et provoque en continu.' },

  // ---------------- HEAL (14) ----------------
  { id: 'u_calice_de_vie', name: 'Calice de vie', role: 'heal', description: 'Une coupe qui ne se vide jamais.', mods: { intelligence: 105 }, active: 'Déverse un flot de soins sur le plus blessé.' },
  { id: 'u_larme_de_seraphin', name: 'Larme de séraphin', role: 'heal', description: 'Une larme d\'ange cristallisée.', mods: { intelligence: 100 }, active: 'Ressuscite un allié tombé une fois.' },
  { id: 'u_sang_de_phenix', name: 'Sang de phénix', role: 'heal', description: 'La chaleur du renouveau.', mods: { intelligence: 55, endurance: 50 }, active: 'Une renaissance ardente après la mort.' },
  { id: 'u_chant_de_guerison', name: 'Chant de guérison', role: 'heal', description: 'Votre voix apaise les plaies.', mods: { intelligence: 65, maitrise: 30 }, active: 'Un chant soigne tout le groupe sur la durée.' },
  { id: 'u_rosee_sylvestre', name: 'Rosée sylvestre', role: 'heal', description: 'La rosée du matin guérit tout.', mods: { intelligence: 60, volDeVie: 20 }, active: 'Régénération accélérée sous les soins.' },
  { id: 'u_pacte_vital', name: 'Pacte vital', role: 'heal', description: 'Vos vies sont liées.', mods: { intelligence: 50, endurance: 55 }, active: 'Partage les soins reçus avec le groupe.' },
  { id: 'u_aura_curative', name: 'Aura curative', role: 'heal', description: 'Une lumière douce vous nimbe.', mods: { intelligence: 100 }, active: 'Soigne passivement les alliés proches.' },
  { id: 'u_eau_benie', name: 'Eau bénie', role: 'heal', description: 'Une source sanctifiée.', mods: { intelligence: 95 }, active: 'Purge une altération et soigne d\'un coup.' },
  { id: 'u_souffle_de_vie', name: 'Souffle de vie', role: 'heal', description: 'Un dernier souffle ranime.', mods: { intelligence: 45, endurance: 45, maitrise: 20 }, active: 'Empêche un allié de tomber sous 1 PV.' },
  { id: 'u_main_du_guerisseur', name: 'Main du guérisseur', role: 'heal', description: 'Un simple contact suffit.', mods: { intelligence: 100 }, active: 'Soin instantané sur la cible la plus basse.' },
  { id: 'u_fontaine_eternelle', name: 'Fontaine éternelle', role: 'heal', description: 'Une eau qui jaillit sans fin.', mods: { intelligence: 90 }, active: 'Une zone de soins persistante autour de vous.' },
  { id: 'u_benediction_lunaire', name: 'Bénédiction lunaire', role: 'heal', description: 'La lune veille sur vos blessés.', mods: { intelligence: 90, reductionDegats: 20 }, active: 'Soins majorés la nuit du combat.' },
  { id: 'u_serment_du_clerc', name: 'Serment du clerc', role: 'heal', description: 'Dévoué corps et âme.', mods: { intelligence: 55, maitrise: 35 }, active: 'Convertit une part de vos dégâts en soins de groupe.' },
  { id: 'u_lien_d_ame', name: 'Lien d\'âme', role: 'heal', description: 'Deux âmes, un seul destin.', mods: { intelligence: 85, endurance: 25 }, active: 'Répartit les dégâts létaux sur le groupe.' },

  // ---------------- RESIST (14) ----------------
  { id: 'u_manteau_de_lave', name: 'Manteau de lave', role: 'resist', description: 'La lave vous sert d\'armure.', mods: { endurance: 45 }, resistMods: { feu: 0.22 }, active: 'Renvoie une vague de feu aux attaquants.' },
  { id: 'u_carapace_glaciaire', name: 'Carapace glaciaire', role: 'resist', description: 'Un blindage de glace éternelle.', mods: { reductionDegats: 35 }, resistMods: { froid: 0.22 }, active: 'Gèle les assaillants qui vous touchent.' },
  { id: 'u_paratonnerre', name: 'Paratonnerre', role: 'resist', description: 'La foudre vous ignore.', mods: { endurance: 40, hate: 20 }, resistMods: { foudre: 0.22 }, active: 'Stocke la foudre puis la décharge.' },
  { id: 'u_sceau_antimagie', name: 'Sceau antimagie', role: 'resist', description: 'Un sceau qui dévore les sorts.', mods: { reductionDegats: 40 }, resistMods: { arcane: 0.22 }, active: 'Absorbe un sort pour vous renforcer.' },
  { id: 'u_voile_d_ombre', name: 'Voile d\'ombre', role: 'resist', description: 'Les ténèbres vous épousent.', mods: { reductionDegats: 30, endurance: 25 }, resistMods: { ombre: 0.22 }, active: 'Se fond dans l\'ombre pour éviter un coup.' },
  { id: 'u_ecorce_du_monde', name: 'Écorce du monde', role: 'resist', description: 'La nature vous protège des siens.', mods: { intelligence: 45 }, resistMods: { nature: 0.22 }, active: 'Régénère à chaque dégât de nature subi.' },
  { id: 'u_plastron_de_diamant', name: 'Plastron de diamant', role: 'resist', description: 'Le diamant ne cède pas.', mods: { reductionDegats: 45 }, resistMods: { physique: 0.20 }, active: 'Réfracte une part des coups physiques.' },
  { id: 'u_aura_du_pyromancien', name: 'Aura du pyromancien', role: 'resist', description: 'Né dans les flammes.', mods: { maitrise: 35 }, resistMods: { feu: 0.16, foudre: 0.10 }, active: 'Convertit le feu subi en vitesse d\'attaque.' },
  { id: 'u_givre_protecteur', name: 'Givre protecteur', role: 'resist', description: 'Un halo de froid bienveillant.', mods: { intelligence: 30, endurance: 25 }, resistMods: { froid: 0.16, nature: 0.10 }, active: 'Ralentit le temps de recharge ennemi.' },
  { id: 'u_prisme_arcanique', name: 'Prisme arcanique', role: 'resist', description: 'La magie se brise en arc-en-ciel.', mods: { intelligence: 30 }, resistMods: { arcane: 0.16, ombre: 0.10 }, active: 'Renvoie une part des sorts à l\'envoyeur.' },
  { id: 'u_totem_tellurique', name: 'Totem tellurique', role: 'resist', description: 'Ancré aux forces de la terre.', mods: { endurance: 50 }, resistMods: { foudre: 0.14, nature: 0.14 }, active: 'Plante un totem qui absorbe les éléments.' },
  { id: 'u_masque_funeste', name: 'Masque funeste', role: 'resist', description: 'Un masque qui boit l\'ombre.', mods: { volDeVie: 20, endurance: 25 }, resistMods: { ombre: 0.16, feu: 0.10 }, active: 'Vole la vie des sorts d\'ombre subis.' },
  { id: 'u_egide_du_neant', name: 'Égide du néant', role: 'resist', description: 'Le vide annule tout.', mods: { reductionDegats: 30 }, resistMods: { arcane: 0.12, ombre: 0.12, feu: 0.08 }, active: 'Crée une zone qui atténue toute magie.' },
  { id: 'u_armure_du_monde', name: 'Armure du monde', role: 'resist', description: 'Toutes les énergies vous épargnent.', mods: { endurance: 60 }, resistMods: { feu: 0.10, froid: 0.10, foudre: 0.10, arcane: 0.10, ombre: 0.10, nature: 0.10, physique: 0.10 }, active: 'Transforme les dégâts élémentaires en bouclier.' },

  // ---------------- UTILITY (14) ----------------
  { id: 'u_pas_de_l_ombre', name: 'Pas de l\'ombre', role: 'utility', description: 'Vous glissez entre les coups.', mods: { reductionDegats: 45, agilite: 30 }, active: 'Téléportation courte qui esquive un coup.' },
  { id: 'u_chance_du_pillard', name: 'Chance du pillard', role: 'utility', description: 'Le butin vous trouve.', mods: { maitrise: 40, intelligence: 25 }, active: 'Améliore nettement la qualité du butin.' },
  { id: 'u_horloge_brisee', name: 'Horloge brisée', role: 'utility', description: 'Le temps joue pour vous.', mods: { recuperation: 18, hate: 30 }, active: 'Réduit fortement les temps de recharge.' },
  { id: 'u_souffle_du_vent', name: 'Souffle du vent', role: 'utility', description: 'Léger comme la brise.', mods: { hate: 50, reductionDegats: 25 }, active: 'Vitesse accrue après une esquive.' },
  { id: 'u_oeil_omniscient', name: 'Œil omniscient', role: 'utility', description: 'Rien ne vous échappe.', mods: { critique: 35, maitrise: 35 }, active: 'Révèle et exploite les faiblesses ennemies.' },
  { id: 'u_pacte_du_marchand', name: 'Pacte du marchand', role: 'utility', description: 'Tout a un prix… avantageux.', mods: { maitrise: 50, intelligence: 20 }, active: 'Convertit l\'excédent de soins en or.' },
  { id: 'u_boussole_astrale', name: 'Boussole astrale', role: 'utility', description: 'Les astres vous guident.', mods: { maitrise: 45, hate: 25 }, active: 'Oriente vos coups vers la cible idéale.' },
  { id: 'u_grimoire_vivant', name: 'Grimoire vivant', role: 'utility', description: 'Un livre qui pense pour vous.', mods: { intelligence: 45, recuperation: 12 }, active: 'Relance automatiquement votre dernier sort.' },
  { id: 'u_fil_du_destin', name: 'Fil du destin', role: 'utility', description: 'Vous tissez votre sort.', mods: { maitrise: 55 }, active: 'Une seconde chance sur un coup raté.' },
  { id: 'u_talisman_du_voyageur', name: 'Talisman du voyageur', role: 'utility', description: 'La route vous est clémente.', mods: { intelligence: 40, reductionDegats: 25, maitrise: 15 }, active: 'Régénère plus vite hors combat.' },
  { id: 'u_sablier_d_argent', name: 'Sablier d\'argent', role: 'utility', description: 'Le sable s\'écoule à votre rythme.', mods: { recuperation: 16, intelligence: 30 }, active: 'Ralentit l\'enrage des boss.' },
  { id: 'u_clef_des_songes', name: 'Clef des songes', role: 'utility', description: 'Ouvre des portes invisibles.', mods: { maitrise: 40, critique: 25 }, active: 'Améliore les récompenses de donjon et raid.' },
  { id: 'u_plume_de_phenix', name: 'Plume de phénix', role: 'utility', description: 'Une plume porte-bonheur.', mods: { intelligence: 35, maitrise: 30, hate: 15 }, active: 'Évite la mort une fois par combat.' },
  { id: 'u_dé_pipé', name: 'Dé pipé', role: 'utility', description: 'Le hasard vous obéit.', mods: { critique: 40, maitrise: 25 }, active: 'Force un résultat favorable périodiquement.' },

  // ================= TAGS — uniques qui DÉFINISSENT un build en amplifiant un tag de sort =================
  // Le bonus s'applique au tagMult des sorts portant ce tag (dégâts) ET au soin pour [soin]. Monte au rang.
  { id: 'u_coeur_guerisseur', name: 'Cœur du guérisseur', role: 'heal', description: 'La vie déborde de tes mains : tes SOINS sont amplifiés (+30% au rang 1).', mods: { intelligence: 40 }, tagMods: [{ tag: 'soin', mult: 0.30 }], active: 'Tes soins critiques débordent en bouclier.' },
  { id: 'u_fleau_persistant', name: 'Fléau persistant', role: 'dps', description: 'Tes afflictions rongent sans répit : dégâts SUR LA DURÉE [dot] +30% (rang 1).', mods: { alteration: 40 }, tagMods: [{ tag: 'dot', mult: 0.30 }], active: 'Tes DoT se propagent à un ennemi proche.' },
  { id: 'u_lame_precise', name: 'Lame de précision', role: 'dps', description: 'Chaque frappe vise le point vital : sorts à FRAPPE DIRECTE [direct] +25% (rang 1).', mods: { critique: 30 }, tagMods: [{ tag: 'direct', mult: 0.25 }], active: 'Les frappes directes ont une chance de doubler.' },
  { id: 'u_onde_devastatrice', name: 'Onde dévastatrice', role: 'dps', description: 'Ton souffle balaie tout : sorts de ZONE [zone] +28% (rang 1).', mods: { maitrise: 30 }, tagMods: [{ tag: 'zone', mult: 0.28 }], active: 'Tes sorts de zone étourdissent brièvement.' },
  { id: 'u_ame_de_braise', name: 'Âme de braise', role: 'dps', description: 'Le brasier t\'habite : sorts de [feu] +25% (rang 1).', mods: { intelligence: 30 }, tagMods: [{ tag: 'feu', mult: 0.25 }], active: 'Tes sorts de feu embrasent la cible.' },
  { id: 'u_coeur_de_glace', name: 'Cœur de glace', role: 'dps', description: 'Le froid absolu : sorts de [froid] +25% (rang 1).', mods: { intelligence: 30 }, tagMods: [{ tag: 'froid', mult: 0.25 }], active: 'Tes sorts de froid ralentissent davantage.' },
  { id: 'u_fureur_orageuse', name: 'Fureur orageuse', role: 'dps', description: 'L\'orage gronde en toi : sorts de [foudre] +25% (rang 1).', mods: { intelligence: 30 }, tagMods: [{ tag: 'foudre', mult: 0.25 }], active: 'Tes sorts de foudre rebondissent.' },
  { id: 'u_esprit_arcanique', name: 'Esprit arcanique', role: 'dps', description: 'La trame magique t\'obéit : sorts d\'[arcane] +25% (rang 1).', mods: { intelligence: 30 }, tagMods: [{ tag: 'arcane', mult: 0.25 }], active: 'Tes sorts arcaniques perforent la résistance.' },
  { id: 'u_etreinte_ombre', name: 'Étreinte d\'ombre', role: 'dps', description: 'Les ténèbres te nourrissent : sorts d\'[ombre] +25% (rang 1).', mods: { intelligence: 30 }, tagMods: [{ tag: 'ombre', mult: 0.25 }], active: 'Tes sorts d\'ombre volent la vie.' },
  { id: 'u_croissance_sauvage', name: 'Croissance sauvage', role: 'dps', description: 'La nature se déchaîne : sorts de [nature] +25% (rang 1).', mods: { intelligence: 30 }, tagMods: [{ tag: 'nature', mult: 0.25 }], active: 'Tes sorts de nature empoisonnent.' },
  { id: 'u_coup_de_grace', name: 'Coup de grâce', role: 'dps', description: 'L\'achèvement parfait : FINISSEURS [finisseur] +35% (rang 1).', mods: { critique: 25, degatsCrit: 30 }, tagMods: [{ tag: 'finisseur', mult: 0.35 }], active: 'Tes finisseurs exécutent les ennemis affaiblis.' },
  { id: 'u_apotheose', name: 'Apothéose', role: 'dps', description: 'Ton ultime devient cataclysme : ULTIMES [ultime] +45% (rang 1).', mods: { maitrise: 30 }, tagMods: [{ tag: 'ultime', mult: 0.45 }], active: 'Tes ultimes réduisent leurs propres recharges.' },

  // ================================================================
  //   UNIQUES PAR TAG/ASPECT/CLASSE — un build autour de CHAQUE tag/aspect/classe
  //   Hybrides multi-tag (chaque tag plus modeste) + combos tag×secondaire + signatures de classe.
  // ================================================================

  // ---------------- A. HYBRIDES ÉLÉMENT × STYLE (30) ----------------
  { id: 'u3_lente_agonie', name: 'Lente agonie', role: 'dps', description: 'Le feu couve : [feu] +18% · [dot] +18%.', mods: { intelligence: 35, alteration: 30 }, tagMods: [{ tag: 'feu', mult: 0.18 }, { tag: 'dot', mult: 0.18 }], active: 'Tes brûlures se propagent en mourant.' },
  { id: 'u3_meteore_vif', name: 'Météore vif', role: 'dps', description: 'Une comète ardente : [feu] +20% · [direct] +15%.', mods: { intelligence: 40, critique: 25 }, tagMods: [{ tag: 'feu', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Tes frappes de feu peuvent crit deux fois.' },
  { id: 'u3_nova_ardente', name: 'Nova ardente', role: 'dps', description: 'Le brasier explose : [feu] +18% · [zone] +18%.', mods: { intelligence: 35, maitrise: 30 }, tagMods: [{ tag: 'feu', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Une déflagration de feu autour de toi.' },
  { id: 'u3_engelure', name: 'Engelure', role: 'dps', description: 'Le froid paralyse : [froid] +18% · [controle] +20%.', mods: { intelligence: 38, resilience: 25 }, tagMods: [{ tag: 'froid', mult: 0.18 }, { tag: 'controle', mult: 0.20 }], active: 'Tes gels durent plus longtemps.' },
  { id: 'u3_eclat_glacial', name: 'Éclat glacial', role: 'dps', description: 'Un pic de glace net : [froid] +20% · [direct] +15%.', mods: { intelligence: 40, critique: 25 }, tagMods: [{ tag: 'froid', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Tes éclats de givre transpercent.' },
  { id: 'u3_blizzard', name: 'Blizzard', role: 'dps', description: 'La tempête blanche : [froid] +18% · [zone] +18%.', mods: { intelligence: 35, maitrise: 30 }, tagMods: [{ tag: 'froid', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Une bourrasque gèle tout le pack.' },
  { id: 'u3_chaine_foudroyante', name: 'Chaîne foudroyante', role: 'dps', description: 'L\'arc saute de cible en cible : [foudre] +18% · [zone] +18%.', mods: { intelligence: 35, hate: 25 }, tagMods: [{ tag: 'foudre', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Tes éclairs rebondissent une fois de plus.' },
  { id: 'u3_fulguration', name: 'Fulguration', role: 'dps', description: 'L\'éclair unique et net : [foudre] +20% · [direct] +15%.', mods: { intelligence: 40, critique: 25 }, tagMods: [{ tag: 'foudre', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Ta foudre directe étourdit au crit.' },
  { id: 'u3_orage_rampant', name: 'Orage rampant', role: 'dps', description: 'Une charge statique persistante : [foudre] +18% · [dot] +18%.', mods: { intelligence: 35, alteration: 28 }, tagMods: [{ tag: 'foudre', mult: 0.18 }, { tag: 'dot', mult: 0.18 }], active: 'La foudre statique ronge la cible.' },
  { id: 'u3_trait_arcanique', name: 'Trait arcanique', role: 'dps', description: 'Le projectile parfait : [arcane] +20% · [direct] +15%.', mods: { intelligence: 42, critique: 22 }, tagMods: [{ tag: 'arcane', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Tes traits arcaniques perforent la résist.' },
  { id: 'u3_orbe_du_chaos', name: 'Orbe du chaos', role: 'dps', description: 'Une sphère instable : [arcane] +18% · [zone] +18%.', mods: { intelligence: 38, maitrise: 28 }, tagMods: [{ tag: 'arcane', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'L\'orbe explose en pluie d\'éclats.' },
  { id: 'u3_distorsion', name: 'Distorsion', role: 'dps', description: 'L\'espace se tord : [arcane] +18% · [controle] +18%.', mods: { intelligence: 40, resilience: 20 }, tagMods: [{ tag: 'arcane', mult: 0.18 }, { tag: 'controle', mult: 0.18 }], active: 'Tes sorts ralentissent le temps ennemi.' },
  { id: 'u3_singularite', name: 'Singularité', role: 'dps', description: 'Tout converge vers l\'apex : [arcane] +18% · [ultime] +25%.', mods: { intelligence: 40, maitrise: 25 }, tagMods: [{ tag: 'arcane', mult: 0.18 }, { tag: 'ultime', mult: 0.25 }], active: 'Ton ultime arcanique implose deux fois.' },
  { id: 'u3_putrefaction', name: 'Putréfaction', role: 'dps', description: 'L\'ombre ronge les chairs : [ombre] +18% · [dot] +20%.', mods: { intelligence: 35, alteration: 35 }, tagMods: [{ tag: 'ombre', mult: 0.18 }, { tag: 'dot', mult: 0.20 }], active: 'Tes DoT d\'ombre s\'aggravent dans le temps.' },
  { id: 'u3_lame_d_ombre', name: 'Lame d\'ombre', role: 'dps', description: 'Une dague de néant : [ombre] +20% · [direct] +15%.', mods: { agilite: 45, critique: 25 }, tagMods: [{ tag: 'ombre', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Tes frappes d\'ombre ignorent l\'armure.' },
  { id: 'u3_assassin_nocturne', name: 'Assassin nocturne', role: 'dps', description: 'Frapper depuis les ténèbres : [ombre] +18% · [furtif] +25%.', mods: { agilite: 50, critique: 25 }, tagMods: [{ tag: 'ombre', mult: 0.18 }, { tag: 'furtif', mult: 0.25 }], active: 'Ton ouverture furtive est toujours critique.' },
  { id: 'u3_ronce_venimeuse', name: 'Ronce venimeuse', role: 'dps', description: 'La nature empoisonne : [nature] +18% · [dot] +20%.', mods: { alteration: 40, agilite: 25 }, tagMods: [{ tag: 'nature', mult: 0.18 }, { tag: 'dot', mult: 0.20 }], active: 'Tes poisons empilent un cran de plus.' },
  { id: 'u3_ronces_eparses', name: 'Ronces éparses', role: 'dps', description: 'La forêt envahit tout : [nature] +18% · [zone] +18%.', mods: { intelligence: 35, maitrise: 28 }, tagMods: [{ tag: 'nature', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Des lianes jaillissent sous le pack.' },
  { id: 'u3_floraison_curative', name: 'Floraison curative', role: 'heal', description: 'La vie verdoie : [soin] +20% · [nature] +15%.', mods: { intelligence: 40 }, tagMods: [{ tag: 'soin', mult: 0.20 }, { tag: 'nature', mult: 0.15 }], active: 'Tes soins laissent une fleur qui re-soigne.' },
  { id: 'u3_taillade_brutale', name: 'Taillade brutale', role: 'dps', description: 'L\'acier pur : [physique] +20% · [direct] +15%.', mods: { force: 50, critique: 25 }, tagMods: [{ tag: 'physique', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Tes frappes physiques saignent.' },
  { id: 'u3_execution_brutale', name: 'Exécution brutale', role: 'dps', description: 'Le coup final : [physique] +18% · [finisseur] +22%.', mods: { force: 45, degatsCrit: 35 }, tagMods: [{ tag: 'physique', mult: 0.18 }, { tag: 'finisseur', mult: 0.22 }], active: 'Tes finisseurs physiques achèvent les blessés.' },
  { id: 'u3_balayage', name: 'Balayage', role: 'dps', description: 'Un arc d\'acier : [physique] +18% · [zone] +18%.', mods: { force: 45, maitrise: 25 }, tagMods: [{ tag: 'physique', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Tes coups balaient les ennemis proches.' },
  { id: 'u3_supernova', name: 'Supernova', role: 'dps', description: 'Le feu ultime : [feu] +18% · [ultime] +25%.', mods: { intelligence: 38, maitrise: 25 }, tagMods: [{ tag: 'feu', mult: 0.18 }, { tag: 'ultime', mult: 0.25 }], active: 'Ton ultime de feu laisse un cratère ardent.' },
  { id: 'u3_gel_eternel', name: 'Gel éternel', role: 'dps', description: 'Un froid qui dure : [froid] +18% · [dot] +18%.', mods: { intelligence: 35, alteration: 28 }, tagMods: [{ tag: 'froid', mult: 0.18 }, { tag: 'dot', mult: 0.18 }], active: 'Le givre persistant entaille la cible.' },
  { id: 'u3_tonnerre_paralysant', name: 'Tonnerre paralysant', role: 'dps', description: 'La foudre cloue sur place : [foudre] +18% · [controle] +18%.', mods: { intelligence: 38, resilience: 20 }, tagMods: [{ tag: 'foudre', mult: 0.18 }, { tag: 'controle', mult: 0.18 }], active: 'Tes éclairs paralysent brièvement.' },
  { id: 'u3_moisson_d_ombre', name: 'Moisson d\'ombre', role: 'dps', description: 'La faux du néant : [ombre] +18% · [finisseur] +22%.', mods: { agilite: 40, degatsCrit: 35 }, tagMods: [{ tag: 'ombre', mult: 0.18 }, { tag: 'finisseur', mult: 0.22 }], active: 'Tes finisseurs d\'ombre soignent au kill.' },
  { id: 'u3_enracinement', name: 'Enracinement', role: 'dps', description: 'La nature entrave : [nature] +18% · [controle] +18%.', mods: { intelligence: 38, resilience: 20 }, tagMods: [{ tag: 'nature', mult: 0.18 }, { tag: 'controle', mult: 0.18 }], active: 'Des racines immobilisent la cible.' },
  { id: 'u3_pluie_arcanique', name: 'Pluie arcanique', role: 'dps', description: 'Des éclats tombent du ciel : [arcane] +18% · [dot] +18%.', mods: { intelligence: 38, alteration: 28 }, tagMods: [{ tag: 'arcane', mult: 0.18 }, { tag: 'dot', mult: 0.18 }], active: 'Une averse arcanique ronge la zone.' },
  { id: 'u3_deflagration_finale', name: 'Déflagration finale', role: 'dps', description: 'La foudre apocalyptique : [foudre] +18% · [ultime] +25%.', mods: { intelligence: 38, maitrise: 25 }, tagMods: [{ tag: 'foudre', mult: 0.18 }, { tag: 'ultime', mult: 0.25 }], active: 'Ton ultime de foudre frappe deux fois.' },
  { id: 'u3_voile_funebre', name: 'Voile funèbre', role: 'dps', description: 'L\'ombre engloutit la salle : [ombre] +18% · [zone] +18%.', mods: { intelligence: 38, maitrise: 25 }, tagMods: [{ tag: 'ombre', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Un voile d\'ombre dévore le pack.' },

  // ---------------- B. STYLE × CIBLE / RESSOURCE (20) ----------------
  { id: 'u3_tueur_solitaire', name: 'Tueur solitaire', role: 'dps', description: 'Une cible, une mise à mort : [direct] +18% · [mono] +20%.', mods: { critique: 45, degatsCrit: 30 }, tagMods: [{ tag: 'direct', mult: 0.18 }, { tag: 'mono', mult: 0.20 }], active: 'Dégâts majorés contre une cible isolée.' },
  { id: 'u3_fureur_des_foules', name: 'Fureur des foules', role: 'dps', description: 'Plus ils sont, plus tu frappes : [direct] +15% · [zone] +22%.', mods: { maitrise: 40, hate: 25 }, tagMods: [{ tag: 'direct', mult: 0.15 }, { tag: 'zone', mult: 0.22 }], active: 'Vitesse accrue face à plusieurs ennemis.' },
  { id: 'u3_peste_galopante', name: 'Peste galopante', role: 'dps', description: 'Le fléau se répand : [dot] +18% · [zone] +20%.', mods: { alteration: 45, intelligence: 25 }, tagMods: [{ tag: 'dot', mult: 0.18 }, { tag: 'zone', mult: 0.20 }], active: 'Tes DoT se propagent au pack.' },
  { id: 'u3_supplice_cible', name: 'Supplice ciblé', role: 'dps', description: 'Une agonie concentrée : [dot] +20% · [mono] +18%.', mods: { alteration: 45, critique: 25 }, tagMods: [{ tag: 'dot', mult: 0.20 }, { tag: 'mono', mult: 0.18 }], active: 'Tes DoT mono-cible s\'aggravent.' },
  { id: 'u3_estocade', name: 'Estocade', role: 'dps', description: 'Le coup de grâce ciblé : [finisseur] +22% · [mono] +18%.', mods: { degatsCrit: 45, critique: 25 }, tagMods: [{ tag: 'finisseur', mult: 0.22 }, { tag: 'mono', mult: 0.18 }], active: 'Finisseur dévastateur sur cible isolée.' },
  { id: 'u3_carnage_final', name: 'Carnage final', role: 'dps', description: 'Achever en masse : [finisseur] +18% · [direct] +18%.', mods: { degatsCrit: 40, force: 30 }, tagMods: [{ tag: 'finisseur', mult: 0.18 }, { tag: 'direct', mult: 0.18 }], active: 'Tes finisseurs frappent fort et net.' },
  { id: 'u3_flux_intarissable', name: 'Flux intarissable', role: 'dps', description: 'La ressource coule : [generateur] +25% · [direct] +15%.', mods: { hate: 45, critique: 20 }, tagMods: [{ tag: 'generateur', mult: 0.25 }, { tag: 'direct', mult: 0.15 }], active: 'Tes générateurs produisent plus de ressource.' },
  { id: 'u3_cadence_infernale', name: 'Cadence infernale', role: 'dps', description: 'Le rythme effréné : [generateur] +22% · [mono] +15%.', mods: { hate: 55 }, tagMods: [{ tag: 'generateur', mult: 0.22 }, { tag: 'mono', mult: 0.15 }], active: 'Tes générateurs réduisent les recharges.' },
  { id: 'u3_apocalypse', name: 'Apocalypse', role: 'dps', description: 'La fin du monde : [ultime] +28% · [zone] +18%.', mods: { maitrise: 40, degatsBoss: 30 }, tagMods: [{ tag: 'ultime', mult: 0.28 }, { tag: 'zone', mult: 0.18 }], active: 'Ton ultime couvre toute la salle.' },
  { id: 'u3_sentence_supreme', name: 'Sentence suprême', role: 'dps', description: 'Le jugement ultime : [ultime] +30% · [mono] +15%.', mods: { maitrise: 35, degatsBoss: 35 }, tagMods: [{ tag: 'ultime', mult: 0.30 }, { tag: 'mono', mult: 0.15 }], active: 'Ton ultime mono-cible exécute les boss affaiblis.' },
  { id: 'u3_emprise_totale', name: 'Emprise totale', role: 'dps', description: 'Maîtriser la foule : [controle] +22% · [zone] +18%.', mods: { intelligence: 35, resilience: 25 }, tagMods: [{ tag: 'controle', mult: 0.22 }, { tag: 'zone', mult: 0.18 }], active: 'Tes contrôles de zone durent plus.' },
  { id: 'u3_ombre_fugace', name: 'Ombre fugace', role: 'dps', description: 'Frapper et disparaître : [furtif] +25% · [direct] +15%.', mods: { agilite: 55, critique: 25 }, tagMods: [{ tag: 'furtif', mult: 0.25 }, { tag: 'direct', mult: 0.15 }], active: 'Ouverture furtive surpuissante.' },
  { id: 'u3_duelliste', name: 'Duelliste', role: 'dps', description: 'En tête-à-tête, nul ne te bat : [mono] +28%.', mods: { critique: 40, degatsCrit: 35 }, tagMods: [{ tag: 'mono', mult: 0.28 }], active: 'Dégâts fortement majorés contre une seule cible.' },
  { id: 'u3_deferlante', name: 'Déferlante', role: 'dps', description: 'Submerger le nombre : [zone] +30%.', mods: { maitrise: 45, hate: 20 }, tagMods: [{ tag: 'zone', mult: 0.30 }], active: 'Tes sorts de zone touchent plus loin.' },
  { id: 'u3_fleau_ambulant', name: 'Fléau ambulant', role: 'dps', description: 'La maladie incarnée : [dot] +32%.', mods: { alteration: 55 }, tagMods: [{ tag: 'dot', mult: 0.32 }], active: 'Tes altérations durent une éternité.' },
  { id: 'u3_perforateur', name: 'Perforateur', role: 'dps', description: 'Chaque frappe transperce : [direct] +30%.', mods: { critique: 40, penetration: 30 }, tagMods: [{ tag: 'direct', mult: 0.30 }], active: 'Tes frappes directes ignorent une part de l\'armure.' },
  { id: 'u3_bourreau_des_masses', name: 'Bourreau des masses', role: 'dps', description: 'Exécuter en série : [finisseur] +25% · [zone] +18%.', mods: { degatsCrit: 40, maitrise: 25 }, tagMods: [{ tag: 'finisseur', mult: 0.25 }, { tag: 'zone', mult: 0.18 }], active: 'Finisseur qui touche plusieurs cibles.' },
  { id: 'u3_geyser_de_mana', name: 'Geyser de mana', role: 'dps', description: 'La ressource jaillit : [generateur] +28%.', mods: { hate: 50, intelligence: 20 }, tagMods: [{ tag: 'generateur', mult: 0.28 }], active: 'Génération de ressource fortement accrue.' },
  { id: 'u3_maitre_du_gel', name: 'Maître du gel', role: 'dps', description: 'Tout se fige : [controle] +30%.', mods: { intelligence: 35, resilience: 30 }, tagMods: [{ tag: 'controle', mult: 0.30 }], active: 'Tes contrôles durent nettement plus longtemps.' },
  { id: 'u3_assassinat', name: 'Assassinat', role: 'dps', description: 'L\'art de tuer sans bruit : [furtif] +35%.', mods: { agilite: 55, degatsCrit: 25 }, tagMods: [{ tag: 'furtif', mult: 0.35 }], active: 'Ton premier coup hors combat est mortel.' },

  // ---------------- C. SOIN HYBRIDES & SECONDAIRES (14) ----------------
  { id: 'u3_gardien_de_vie', name: 'Gardien de vie', role: 'heal', description: 'Soigner et protéger : [soin] +22%.', mods: { intelligence: 35, barriere: 200 }, tagMods: [{ tag: 'soin', mult: 0.22 }], active: 'Tes soins posent un bouclier résiduel.' },
  { id: 'u3_pretre_des_ombres', name: 'Prêtre des ombres', role: 'heal', description: 'Châtier pour guérir : [soin] +18% · [ombre] +18%.', mods: { intelligence: 40 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'ombre', mult: 0.18 }], active: 'Tes dégâts d\'ombre soignent le groupe (Atonement).' },
  { id: 'u3_chant_collectif', name: 'Chant collectif', role: 'heal', description: 'Soigner la foule : [soin] +18% · [zone] +18%.', mods: { intelligence: 40 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Tes soins de groupe rayonnent plus loin.' },
  { id: 'u3_germe_de_vie', name: 'Germe de vie', role: 'heal', description: 'La régénération lente : [soin] +18% · [dot] +18%.', mods: { intelligence: 35, alteration: 25 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'dot', mult: 0.18 }], active: 'Tes HoT tiquent plus vite.' },
  { id: 'u3_calice_eternel', name: 'Calice éternel', role: 'heal', description: 'Une source de vie pure : [soin] +35%.', mods: { intelligence: 50 }, tagMods: [{ tag: 'soin', mult: 0.35 }], active: 'Un flot de soins sur le plus blessé.' },
  { id: 'u3_vampire_sacre', name: 'Vampire sacré', role: 'heal', description: 'Voler la vie pour la donner : [soin] +20%.', mods: { volDeVie: 35, intelligence: 25 }, tagMods: [{ tag: 'soin', mult: 0.20 }], active: 'Ton vol de vie déborde en soin de groupe.' },
  { id: 'u3_ame_resiliente', name: 'Âme résiliente', role: 'heal', description: 'Soigner sous la pression : [soin] +20%.', mods: { intelligence: 35, resilience: 35 }, tagMods: [{ tag: 'soin', mult: 0.20 }], active: 'Tes soins purifient une altération.' },
  { id: 'u3_lumiere_eclatante', name: 'Lumière éclatante', role: 'heal', description: 'Soigner en frappant : [soin] +18% · [direct] +15%.', mods: { intelligence: 40 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'direct', mult: 0.15 }], active: 'Tes frappes de lumière soignent l\'allié blessé.' },
  { id: 'u3_renouveau_estival', name: 'Renouveau estival', role: 'heal', description: 'La nature guérit tout : [soin] +20% · [nature] +18%.', mods: { intelligence: 42 }, tagMods: [{ tag: 'soin', mult: 0.20 }, { tag: 'nature', mult: 0.18 }], active: 'Une vague de vie restaure le groupe.' },
  { id: 'u3_celerite_curative', name: 'Célérité curative', role: 'heal', description: 'Soigner vite et souvent : [soin] +20%.', mods: { intelligence: 35, recuperation: 14 }, tagMods: [{ tag: 'soin', mult: 0.20 }], active: 'Tes sorts de soin ont une recharge réduite.' },
  { id: 'u3_intercession', name: 'Intercession', role: 'heal', description: 'Le sacrifice du clerc : [soin] +25%.', mods: { intelligence: 40, endurance: 40 }, tagMods: [{ tag: 'soin', mult: 0.25 }], active: 'Empêche un allié de tomber une fois.' },
  { id: 'u3_marais_curatif', name: 'Marais curatif', role: 'heal', description: 'Poison qui guérit les tiens : [soin] +18% · [dot] +18%.', mods: { intelligence: 35, alteration: 30 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'dot', mult: 0.18 }], active: 'Tes DoT soignent le groupe (Symbiose).' },
  { id: 'u3_aube_radieuse', name: 'Aube radieuse', role: 'heal', description: 'La première lumière : [soin] +22% · [feu] +15%.', mods: { intelligence: 42 }, tagMods: [{ tag: 'soin', mult: 0.22 }, { tag: 'feu', mult: 0.15 }], active: 'Tes soins brûlent les morts-vivants.' },
  { id: 'u3_voeu_eternel', name: 'Vœu éternel', role: 'heal', description: 'Lier les destins : [soin] +20%.', mods: { intelligence: 38, barriere: 150 }, tagMods: [{ tag: 'soin', mult: 0.20 }], active: 'Répartit un coup létal sur le groupe.' },

  // ---------------- D. TAG × SECONDAIRE — synergies (34) ----------------
  { id: 'u3_venin_concentre', name: 'Venin concentré', role: 'dps', description: 'L\'altération décuplée : [dot] +25%.', mods: { alteration: 60 }, tagMods: [{ tag: 'dot', mult: 0.25 }], active: 'Tes DoT profitent doublement de l\'Altération.' },
  { id: 'u3_oeil_assassin', name: 'Œil de l\'assassin', role: 'dps', description: 'Le crit chirurgical : [direct] +22%.', mods: { critique: 55, degatsCrit: 30 }, tagMods: [{ tag: 'direct', mult: 0.22 }], active: 'Tes frappes directes critent plus fort.' },
  { id: 'u3_brise_garde', name: 'Brise-garde', role: 'dps', description: 'Percer les défenses de zone : [zone] +25%.', mods: { penetration: 55, maitrise: 20 }, tagMods: [{ tag: 'zone', mult: 0.25 }], active: 'Tes sorts de zone ignorent une part de l\'armure.' },
  { id: 'u3_bourreau_imperial', name: 'Bourreau impérial', role: 'dps', description: 'Le finisseur parfait : [finisseur] +25%.', mods: { degatsCrit: 60, critique: 25 }, tagMods: [{ tag: 'finisseur', mult: 0.25 }], active: 'Tes finisseurs critent toujours sur cible affaiblie.' },
  { id: 'u3_fin_du_monde', name: 'Fin du monde', role: 'dps', description: 'L\'ultime anti-boss : [ultime] +30%.', mods: { degatsBoss: 50, maitrise: 25 }, tagMods: [{ tag: 'ultime', mult: 0.30 }], active: 'Tes ultimes frappent encore plus fort les boss.' },
  { id: 'u3_brasier_perforant', name: 'Brasier perforant', role: 'dps', description: 'Le feu qui perce : [feu] +22%.', mods: { intelligence: 40, penetration: 35 }, tagMods: [{ tag: 'feu', mult: 0.22 }], active: 'Tes sorts de feu ignorent la résist feu.' },
  { id: 'u3_givre_implacable', name: 'Givre implacable', role: 'dps', description: 'Le froid qui transperce : [froid] +22%.', mods: { intelligence: 40, penetration: 35 }, tagMods: [{ tag: 'froid', mult: 0.22 }], active: 'Tes sorts de froid percent la résistance.' },
  { id: 'u3_orage_rapide', name: 'Orage rapide', role: 'dps', description: 'La foudre fébrile : [foudre] +22%.', mods: { intelligence: 40, hate: 35 }, tagMods: [{ tag: 'foudre', mult: 0.22 }], active: 'Tes sorts de foudre accélèrent ta cadence.' },
  { id: 'u3_savoir_interdit', name: 'Savoir interdit', role: 'dps', description: 'L\'arcane perforant : [arcane] +22%.', mods: { intelligence: 50, penetration: 30 }, tagMods: [{ tag: 'arcane', mult: 0.22 }], active: 'Tes sorts arcaniques percent les résistances.' },
  { id: 'u3_soif_d_ombre', name: 'Soif d\'ombre', role: 'dps', description: 'L\'ombre vampirique : [ombre] +22%.', mods: { intelligence: 35, volDeVie: 30 }, tagMods: [{ tag: 'ombre', mult: 0.22 }], active: 'Tes sorts d\'ombre te soignent.' },
  { id: 'u3_corruption_virulente', name: 'Corruption virulente', role: 'dps', description: 'La nature toxique : [nature] +22%.', mods: { alteration: 50, intelligence: 20 }, tagMods: [{ tag: 'nature', mult: 0.22 }], active: 'Tes sorts de nature appliquent un poison.' },
  { id: 'u3_titan_brutal', name: 'Titan brutal', role: 'dps', description: 'La force physique brute : [physique] +25%.', mods: { force: 70 }, tagMods: [{ tag: 'physique', mult: 0.25 }], active: 'Tes attaques physiques fracassent l\'armure.' },
  { id: 'u3_emprise_de_fer', name: 'Emprise de fer', role: 'dps', description: 'Contrôler sans faillir : [controle] +25%.', mods: { resilience: 45, intelligence: 20 }, tagMods: [{ tag: 'controle', mult: 0.25 }], active: 'Tes contrôles résistent à la diminution.' },
  { id: 'u3_couteau_dans_l_ombre', name: 'Couteau dans l\'ombre', role: 'dps', description: 'L\'ouverture mortelle : [furtif] +25%.', mods: { critique: 45, degatsCrit: 30 }, tagMods: [{ tag: 'furtif', mult: 0.25 }], active: 'Tes ouvertures furtives critent toujours.' },
  { id: 'u3_chasseur_de_titans', name: 'Chasseur de titans', role: 'dps', description: 'Spécialiste des géants : [mono] +22%.', mods: { degatsBoss: 45, critique: 25 }, tagMods: [{ tag: 'mono', mult: 0.22 }], active: 'Dégâts majorés contre boss et élites.' },
  { id: 'u3_maree_ardente', name: 'Marée ardente', role: 'dps', description: 'Le feu en nappe : [feu] +20% · alimente l\'Altération.', mods: { intelligence: 35, alteration: 35 }, tagMods: [{ tag: 'feu', mult: 0.20 }], active: 'Tes brûlures de feu s\'intensifient.' },
  { id: 'u3_eclat_critique', name: 'Éclat critique', role: 'dps', description: 'La zone qui pulvérise : [zone] +20%.', mods: { critique: 45, maitrise: 25 }, tagMods: [{ tag: 'zone', mult: 0.20 }], active: 'Tes sorts de zone peuvent crit.' },
  { id: 'u3_rage_persistante', name: 'Rage persistante', role: 'dps', description: 'La furie qui dure : [dot] +20%.', mods: { alteration: 40, force: 30 }, tagMods: [{ tag: 'dot', mult: 0.20 }], active: 'Tes saignements physiques empilent.' },
  { id: 'u3_precision_glaciale', name: 'Visée parfaite', role: 'dps', description: 'L\'auto-attaque infaillible : [direct] +20% · Précision (zéro raté sur les boss).', mods: { precision: 60, agilite: 25 }, tagMods: [{ tag: 'direct', mult: 0.20 }], active: 'Tes auto-attaques ne ratent jamais.' },
  { id: 'u3_surcharge_ultime', name: 'Surcharge ultime', role: 'dps', description: 'L\'apogée surpuissante : [ultime] +28%.', mods: { surpuissance: 12, maitrise: 25 }, tagMods: [{ tag: 'ultime', mult: 0.28 }], active: 'Ton ultime applique un buff de dégâts global.' },
  { id: 'u3_torrent_de_mana', name: 'Torrent de mana', role: 'dps', description: 'Le caster déchaîné : [arcane] +20% · [generateur] +18%.', mods: { intelligence: 45, hate: 20 }, tagMods: [{ tag: 'arcane', mult: 0.20 }, { tag: 'generateur', mult: 0.18 }], active: 'Tes générateurs arcaniques rendent du temps de recharge.' },
  { id: 'u3_brulure_critique', name: 'Brûlure critique', role: 'dps', description: 'Le DoT qui crit : [dot] +20%.', mods: { critique: 40, alteration: 30 }, tagMods: [{ tag: 'dot', mult: 0.20 }], active: 'Tes altérations peuvent infliger des crits.' },
  { id: 'u3_marteau_des_boss', name: 'Marteau des boss', role: 'dps', description: 'Le tueur de raid : [mono] +20%.', mods: { degatsBoss: 50, force: 25 }, tagMods: [{ tag: 'mono', mult: 0.20 }], active: 'Dégâts mono-cible massifs contre les boss.' },
  { id: 'u3_essaim_vorace', name: 'Essaim vorace', role: 'dps', description: 'La nuée qui dévore : [zone] +20% · [dot] +15%.', mods: { alteration: 35, maitrise: 25 }, tagMods: [{ tag: 'zone', mult: 0.20 }, { tag: 'dot', mult: 0.15 }], active: 'Un essaim ronge tout le pack.' },
  { id: 'u3_main_leste', name: 'Main leste', role: 'dps', description: 'Le générateur véloce : [generateur] +20%.', mods: { hate: 45, agilite: 25 }, tagMods: [{ tag: 'generateur', mult: 0.20 }], active: 'Tes générateurs frappent plus vite.' },
  { id: 'u3_jugement_dernier', name: 'Jugement dernier', role: 'dps', description: 'La sentence de zone : [finisseur] +20% · [zone] +15%.', mods: { degatsCrit: 40, maitrise: 20 }, tagMods: [{ tag: 'finisseur', mult: 0.20 }, { tag: 'zone', mult: 0.15 }], active: 'Tes finisseurs irradient autour de la cible.' },
  { id: 'u3_givre_du_neant', name: 'Givre du néant', role: 'dps', description: 'Froid et ombre mêlés : [froid] +16% · [ombre] +16%.', mods: { intelligence: 42 }, tagMods: [{ tag: 'froid', mult: 0.16 }, { tag: 'ombre', mult: 0.16 }], active: 'Tes sorts mêlent gel et ténèbres.' },
  { id: 'u3_orage_de_braises', name: 'Orage de braises', role: 'dps', description: 'Feu et foudre conjugués : [feu] +16% · [foudre] +16%.', mods: { intelligence: 42 }, tagMods: [{ tag: 'feu', mult: 0.16 }, { tag: 'foudre', mult: 0.16 }], active: 'Tes sorts crépitent de feu et d\'éclairs.' },
  { id: 'u3_sceau_des_arcanes', name: 'Sceau des arcanes', role: 'dps', description: 'Arcane et nature liés : [arcane] +16% · [nature] +16%.', mods: { intelligence: 42 }, tagMods: [{ tag: 'arcane', mult: 0.16 }, { tag: 'nature', mult: 0.16 }], active: 'Tes sorts unissent magie et vie.' },
  { id: 'u3_predateur_supreme', name: 'Prédateur suprême', role: 'dps', description: 'Furtivité et exécution : [furtif] +18% · [finisseur] +18%.', mods: { agilite: 45, degatsCrit: 30 }, tagMods: [{ tag: 'furtif', mult: 0.18 }, { tag: 'finisseur', mult: 0.18 }], active: 'Tes finisseurs depuis l\'ombre achèvent.' },
  { id: 'u3_geolier', name: 'Geôlier', role: 'dps', description: 'Contrôle et achèvement : [controle] +18% · [finisseur] +18%.', mods: { resilience: 30, degatsCrit: 30 }, tagMods: [{ tag: 'controle', mult: 0.18 }, { tag: 'finisseur', mult: 0.18 }], active: 'Tes finisseurs sur cible contrôlée critent.' },
  { id: 'u3_grele_arcanique', name: 'Grêle arcanique', role: 'dps', description: 'Arcane direct et de zone : [arcane] +16% · [zone] +16% · [direct] +12%.', mods: { intelligence: 45 }, tagMods: [{ tag: 'arcane', mult: 0.16 }, { tag: 'zone', mult: 0.16 }, { tag: 'direct', mult: 0.12 }], active: 'Une grêle d\'éclats arcaniques.' },
  { id: 'u3_pyroclasme', name: 'Pyroclasme', role: 'dps', description: 'Feu direct, de zone et persistant : [feu] +16% · [zone] +12% · [dot] +12%.', mods: { intelligence: 45 }, tagMods: [{ tag: 'feu', mult: 0.16 }, { tag: 'zone', mult: 0.12 }, { tag: 'dot', mult: 0.12 }], active: 'Une éruption qui couvre et brûle.' },
  { id: 'u3_triade_elementaire', name: 'Triade élémentaire', role: 'dps', description: 'Maître des trois écoles : [feu] +12% · [froid] +12% · [foudre] +12%.', mods: { intelligence: 50, maitrise: 20 }, tagMods: [{ tag: 'feu', mult: 0.12 }, { tag: 'froid', mult: 0.12 }, { tag: 'foudre', mult: 0.12 }], active: 'Tes sorts alternent les trois éléments.' },

  // ---------------- E. SIGNATURES DE CLASSE (34) ----------------
  { id: 'u3_lame_venimeuse', name: 'Lame vénéneuse', role: 'dps', description: 'VOLEUR Assassin : le venin règne. [dot] +22%.', mods: { alteration: 45, agilite: 30 }, tagMods: [{ tag: 'dot', mult: 0.22 }], active: 'Tes poisons empilent un cran de plus et critent.' },
  { id: 'u3_roi_des_combos', name: 'Roi des combos', role: 'dps', description: 'VOLEUR Ombrelame : finisseurs déchaînés. [finisseur] +22% · [generateur] +15%.', mods: { agilite: 40, degatsCrit: 30 }, tagMods: [{ tag: 'finisseur', mult: 0.22 }, { tag: 'generateur', mult: 0.15 }], active: 'Tes finisseurs rendent des points de combo.' },
  { id: 'u3_incandescence', name: 'Incandescence', role: 'dps', description: 'MAGE Pyromancien : le brasier. [feu] +25%.', mods: { intelligence: 50, critique: 25 }, tagMods: [{ tag: 'feu', mult: 0.25 }], active: 'Tes crits de feu posent un Embrasement renforcé.' },
  { id: 'u3_zero_absolu', name: 'Zéro absolu', role: 'dps', description: 'MAGE Cryomancien : le gel total. [froid] +22% · [controle] +15%.', mods: { intelligence: 48, resilience: 20 }, tagMods: [{ tag: 'froid', mult: 0.22 }, { tag: 'controle', mult: 0.15 }], active: 'Tes ennemis gelés explosent de givre (Fracas).' },
  { id: 'u3_charges_instables', name: 'Charges instables', role: 'dps', description: 'MAGE Arcaniste : la surcharge. [arcane] +22% · [generateur] +15%.', mods: { intelligence: 50 }, tagMods: [{ tag: 'arcane', mult: 0.22 }, { tag: 'generateur', mult: 0.15 }], active: 'À pleines Charges, tu entres en Surcharge.' },
  { id: 'u3_convergence', name: 'Convergence', role: 'dps', description: 'MAGE Convergence : les trois écoles. [feu] +12% · [froid] +12% · [arcane] +12%.', mods: { intelligence: 55 }, tagMods: [{ tag: 'feu', mult: 0.12 }, { tag: 'froid', mult: 0.12 }, { tag: 'arcane', mult: 0.12 }], active: '+dégâts par état élémentaire actif sur la cible.' },
  { id: 'u3_juggernaut', name: 'Cœur de Juggernaut', role: 'tank', description: 'GUERRIER Juggernaut : encaisser pour frapper. [physique] +18%.', mods: { force: 50, endurance: 60 }, tagMods: [{ tag: 'physique', mult: 0.18 }], active: 'Encaisser génère de la Rage (Vengeance).' },
  { id: 'u3_furie_guerriere', name: 'Furie guerrière', role: 'dps', description: 'GUERRIER Furie : la rage brute. [physique] +20% · [direct] +15%.', mods: { force: 55, hate: 30 }, tagMods: [{ tag: 'physique', mult: 0.20 }, { tag: 'direct', mult: 0.15 }], active: 'Tes crits prolongent ta Furie.' },
  { id: 'u3_meute_sauvage', name: 'Meute sauvage', role: 'dps', description: 'CHASSEUR Symbiose : le familier frappe. [mono] +15%.', mods: { agilite: 55, critique: 25 }, tagMods: [{ tag: 'mono', mult: 0.15 }], active: 'Ton familier inflige +50% de ton DPS d\'auto.' },
  { id: 'u3_fauconnier', name: 'Fauconnier', role: 'dps', description: 'CHASSEUR : la frappe aérienne. [direct] +20% · [furtif] +15%.', mods: { agilite: 60, degatsCrit: 25 }, tagMods: [{ tag: 'direct', mult: 0.20 }, { tag: 'furtif', mult: 0.15 }], active: 'Ton ouverture en piqué est dévastatrice.' },
  { id: 'u3_verbe_de_lumiere', name: 'Verbe de lumière', role: 'heal', description: 'PRÊTRE Lumière : le soin pur. [soin] +25%.', mods: { intelligence: 50 }, tagMods: [{ tag: 'soin', mult: 0.25 }], active: 'Tes soins peuvent crit et déborder.' },
  { id: 'u3_chuchotement_du_vide', name: 'Chuchotement du vide', role: 'dps', description: 'PRÊTRE Vide : l\'ombre dévorante. [ombre] +22% · [dot] +15%.', mods: { intelligence: 48, alteration: 25 }, tagMods: [{ tag: 'ombre', mult: 0.22 }, { tag: 'dot', mult: 0.15 }], active: 'Tes DoT d\'ombre te soignent.' },
  { id: 'u3_crepuscule', name: 'Crépuscule', role: 'heal', description: 'PRÊTRE Crépuscule : frapper pour soigner. [soin] +18% · [ombre] +18%.', mods: { intelligence: 48 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'ombre', mult: 0.18 }], active: 'Tes dégâts d\'ombre soignent le groupe.' },
  { id: 'u3_eclat_lunaire', name: 'Éclat lunaire', role: 'dps', description: 'DRUIDE Lunaire : l\'équilibre astral. [arcane] +18% · [nature] +18%.', mods: { intelligence: 48 }, tagMods: [{ tag: 'arcane', mult: 0.18 }, { tag: 'nature', mult: 0.18 }], active: 'Tu alternes Solaire et Lunaire pour +dégâts.' },
  { id: 'u3_floraison_eternelle', name: 'Floraison éternelle', role: 'heal', description: 'DRUIDE Floraison : les HoT en cascade. [soin] +20% · [nature] +15%.', mods: { intelligence: 45 }, tagMods: [{ tag: 'soin', mult: 0.20 }, { tag: 'nature', mult: 0.15 }], active: 'Tes HoT se propagent à un allié proche.' },
  { id: 'u3_forme_primale', name: 'Forme primale', role: 'dps', description: 'DRUIDE Métamorphe : la bête déchaînée. [physique] +18% · [dot] +15%.', mods: { agilite: 45, alteration: 25 }, tagMods: [{ tag: 'physique', mult: 0.18 }, { tag: 'dot', mult: 0.15 }], active: 'Tes formes alternent griffes et saignements.' },
  { id: 'u3_courroux_ancestral', name: 'Courroux ancestral', role: 'dps', description: 'CHAMAN Élémentaire : la foudre en chaîne. [foudre] +22% · [zone] +15%.', mods: { intelligence: 48 }, tagMods: [{ tag: 'foudre', mult: 0.22 }, { tag: 'zone', mult: 0.15 }], active: 'Tes éclairs rebondissent et se chargent.' },
  { id: 'u3_maree_vivifiante', name: 'Marée vivifiante', role: 'heal', description: 'CHAMAN Vague : le totem de soin. [soin] +20% · [foudre] +12%.', mods: { intelligence: 45 }, tagMods: [{ tag: 'soin', mult: 0.20 }, { tag: 'foudre', mult: 0.12 }], active: 'Tes soins posent un totem qui re-soigne.' },
  { id: 'u3_marteau_sacre', name: 'Marteau sacré', role: 'dps', description: 'PALADIN : le châtiment de lumière. [physique] +16% · [soin] +16%.', mods: { force: 40, intelligence: 30 }, tagMods: [{ tag: 'physique', mult: 0.16 }, { tag: 'soin', mult: 0.16 }], active: 'Tes frappes soignent l\'allié le plus blessé.' },
  { id: 'u3_bouclier_de_foi', name: 'Bouclier de foi', role: 'tank', description: 'PALADIN : la garde sacrée. [physique] +12%.', mods: { endurance: 60, barriere: 200 }, tagMods: [{ tag: 'physique', mult: 0.12 }], active: 'Encaisser génère un bouclier sacré.' },
  { id: 'u3_pacte_demoniaque', name: 'Pacte démoniaque', role: 'dps', description: 'DÉMONISTE : l\'affliction d\'ombre. [ombre] +20% · [dot] +18%.', mods: { intelligence: 45, alteration: 30 }, tagMods: [{ tag: 'ombre', mult: 0.20 }, { tag: 'dot', mult: 0.18 }], active: 'Tes afflictions invoquent un démon.' },
  { id: 'u3_legion_infernale', name: 'Légion infernale', role: 'dps', description: 'DÉMONISTE Légion : l\'invocation. [ombre] +18% · [zone] +15%.', mods: { intelligence: 45 }, tagMods: [{ tag: 'ombre', mult: 0.18 }, { tag: 'zone', mult: 0.15 }], active: 'Des démons combattent à tes côtés.' },
  { id: 'u3_givre_mortel', name: 'Givre mortel', role: 'dps', description: 'CHEVALIER DE LA MORT : le gel funeste. [froid] +18% · [ombre] +18%.', mods: { force: 40, intelligence: 25 }, tagMods: [{ tag: 'froid', mult: 0.18 }, { tag: 'ombre', mult: 0.18 }], active: 'Tes frappes glaciales drainent la vie.' },
  { id: 'u3_armee_des_morts', name: 'Armée des morts', role: 'dps', description: 'CHEVALIER DE LA MORT : la nécromancie. [ombre] +18% · [dot] +15%.', mods: { force: 40, alteration: 25 }, tagMods: [{ tag: 'ombre', mult: 0.18 }, { tag: 'dot', mult: 0.15 }], active: 'Tes maladies relèvent des goules.' },
  { id: 'u3_grace_du_naaru', name: 'Grâce du Naaru', role: 'heal', description: 'PRÊTRE saint : la lumière de zone. [soin] +18% · [zone] +18%.', mods: { intelligence: 48 }, tagMods: [{ tag: 'soin', mult: 0.18 }, { tag: 'zone', mult: 0.18 }], active: 'Tes soins de groupe sont prolongés.' },
  { id: 'u3_traque_du_chasseur', name: 'Traque du chasseur', role: 'dps', description: 'CHASSEUR : la marque mortelle. [mono] +18% · [direct] +15%.', mods: { agilite: 50, degatsBoss: 25 }, tagMods: [{ tag: 'mono', mult: 0.18 }, { tag: 'direct', mult: 0.15 }], active: 'Ta cible marquée subit des crits majorés.' },
  { id: 'u3_rage_du_titan', name: 'Rage du Titan', role: 'dps', description: 'GUERRIER : l\'ultime dévastateur. [physique] +16% · [ultime] +25%.', mods: { force: 50, degatsBoss: 25 }, tagMods: [{ tag: 'physique', mult: 0.16 }, { tag: 'ultime', mult: 0.25 }], active: 'Ton ultime guerrier ébranle le champ de bataille.' },
  { id: 'u3_danse_macabre', name: 'Danse macabre', role: 'dps', description: 'VOLEUR : l\'enchaînement furtif. [furtif] +18% · [direct] +18%.', mods: { agilite: 50, critique: 25 }, tagMods: [{ tag: 'furtif', mult: 0.18 }, { tag: 'direct', mult: 0.18 }], active: 'Chaque kill prolonge ta furtivité.' },
  { id: 'u3_tempete_de_givre', name: 'Tempête de givre', role: 'dps', description: 'MAGE Cryo : le contrôle de masse. [froid] +18% · [controle] +20%.', mods: { intelligence: 45, resilience: 20 }, tagMods: [{ tag: 'froid', mult: 0.18 }, { tag: 'controle', mult: 0.20 }], active: 'Ta Nova gèle tout le pack.' },
  { id: 'u3_brasier_purificateur', name: 'Brasier purificateur', role: 'heal', description: 'PALADIN sacré : feu qui soigne. [soin] +16% · [feu] +18%.', mods: { intelligence: 42 }, tagMods: [{ tag: 'soin', mult: 0.16 }, { tag: 'feu', mult: 0.18 }], active: 'Tes flammes sacrées soignent les alliés.' },
  { id: 'u3_seve_ancestrale', name: 'Sève ancestrale', role: 'heal', description: 'DRUIDE resto : la nature nourricière. [soin] +22% · [nature] +12%.', mods: { intelligence: 46 }, tagMods: [{ tag: 'soin', mult: 0.22 }, { tag: 'nature', mult: 0.12 }], active: 'Tes HoT se renforcent dans le temps.' },
  { id: 'u3_chasseur_d_ames', name: 'Chasseur d\'âmes', role: 'dps', description: 'DÉMONISTE : drain et destruction. [ombre] +20%.', mods: { intelligence: 42, volDeVie: 30 }, tagMods: [{ tag: 'ombre', mult: 0.20 }], active: 'Tes sorts d\'ombre dévorent l\'âme et te soignent.' },
  { id: 'u3_aegis_du_protecteur', name: 'Aegis du protecteur', role: 'tank', description: 'PALADIN/GUERRIER : la garde inébranlable. [physique] +12%.', mods: { endurance: 70, reductionDegats: 35 }, tagMods: [{ tag: 'physique', mult: 0.12 }], active: 'Tu rediriges les coups du groupe sur toi.' },
  { id: 'u3_avatar_elementaire', name: 'Avatar élémentaire', role: 'dps', description: 'CHAMAN : l\'incarnation des éléments. [foudre] +14% · [feu] +14% · [froid] +14%.', mods: { intelligence: 50 }, tagMods: [{ tag: 'foudre', mult: 0.14 }, { tag: 'feu', mult: 0.14 }, { tag: 'froid', mult: 0.14 }], active: 'Tu canalises les trois fureurs élémentaires.' },

  // ---------------- F. DÉFENSIF / UTILITY / TAG (24) ----------------
  { id: 'u3_titan_de_pierre', name: 'Titan de pierre', role: 'tank', description: 'L\'inamovible.', mods: { endurance: 130 }, active: 'Plus tu encaisses, plus tu gagnes de PV max.' },
  { id: 'u3_muraille_vivante', name: 'Muraille vivante', role: 'tank', description: 'Le rempart absolu.', mods: { reductionDegats: 70, barriere: 350 }, active: 'Un mur d\'énergie absorbe les salves.' },
  { id: 'u3_garde_resilient', name: 'Garde résilient', role: 'tank', description: 'Insensible aux entraves.', mods: { endurance: 70, resilience: 50 }, active: 'Immunité aux contrôles brièvement.' },
  { id: 'u3_coeur_de_braise_v', name: 'Cœur ardent', role: 'tank', description: 'La fournaise protectrice.', mods: { endurance: 80, reductionDegats: 30 }, resistMods: { feu: 0.14 }, active: 'Renvoie une vague de feu en encaissant.' },
  { id: 'u3_peau_d_obsidienne', name: 'Peau d\'obsidienne', role: 'tank', description: 'Le verre volcanique indestructible.', mods: { reductionDegats: 65, endurance: 50 }, active: 'Réfléchit une part des coups physiques.' },
  { id: 'u3_sanctuaire_mobile', name: 'Sanctuaire mobile', role: 'tank', description: 'Un havre où que tu ailles.', mods: { barriere: 300, resilience: 30 }, active: 'Crée une zone qui réduit les dégâts de groupe.' },
  { id: 'u3_resistance_totale', name: 'Résistance totale', role: 'resist', description: 'Toutes les énergies glissent.', mods: { endurance: 55 }, resistMods: { feu: 0.12, froid: 0.12, foudre: 0.12, arcane: 0.12, ombre: 0.12, nature: 0.12, physique: 0.12 }, active: 'Convertit un surplus de résist en bouclier.' },
  { id: 'u3_ame_purifiee', name: 'Âme purifiée', role: 'resist', description: 'Les altérations te fuient.', mods: { resilience: 55, endurance: 30 }, active: 'Purge périodiquement une altération.' },
  { id: 'u3_carapace_du_dragon', name: 'Carapace du dragon', role: 'resist', description: 'Écailles forgées au feu.', mods: { reductionDegats: 40 }, resistMods: { feu: 0.20, foudre: 0.12 }, active: 'Le feu subi devient de la puissance.' },
  { id: 'u3_linceul_spectral', name: 'Linceul spectral', role: 'resist', description: 'L\'ombre te protège des sorts.', mods: { reductionDegats: 35 }, resistMods: { ombre: 0.20, arcane: 0.12 }, active: 'Absorbe un sort pour te soigner.' },
  { id: 'u3_vampire_sanguinaire', name: 'Vampire sanguinaire', role: 'utility', description: 'Vivre du sang versé.', mods: { volDeVie: 45, critique: 30 }, active: 'Vol de vie majoré sous 50% des PV.' },
  { id: 'u3_horloger', name: 'Horloger du destin', role: 'utility', description: 'Tu plies le temps.', mods: { recuperation: 22, hate: 25 }, active: 'Tes recharges fondent à chaque kill.' },
  { id: 'u3_chance_insolente', name: 'Chance insolente', role: 'utility', description: 'La fortune te colle à la peau.', mods: { critique: 50, maitrise: 30 }, active: 'Améliore nettement la rareté du butin.' },
  { id: 'u3_double_frappe', name: 'Double frappe', role: 'utility', description: 'Tes coups s\'enchaînent.', mods: { multifrappe: 25, hate: 25 }, active: 'Chance accrue de frapper une seconde fois.' },
  { id: 'u3_surpuissance_pure', name: 'Surpuissance pure', role: 'utility', description: 'Une énergie brute et universelle.', mods: { surpuissance: 20 }, active: 'Tous tes dégâts augmentent globalement.' },
  { id: 'u3_oeil_du_juge', name: 'Œil du juge', role: 'utility', description: 'Nulle faiblesse ne t\'échappe.', mods: { penetration: 55, precision: 35 }, active: 'Ignore une part des défenses et de l\'esquive.' },
  { id: 'u3_celerite_supreme', name: 'Célérité suprême', role: 'utility', description: 'La vitesse incarnée.', mods: { hate: 70 }, active: 'Vitesse d\'attaque et d\'incantation accrue.' },
  { id: 'u3_bastion_resilient', name: 'Bastion résilient', role: 'tank', description: 'Inébranlable sous le contrôle.', mods: { endurance: 60, resilience: 40, reductionDegats: 20 }, active: 'Résiste aux étourdissements prolongés.' },
  { id: 'u3_fortune_du_raid', name: 'Fortune du raid', role: 'utility', description: 'Le tueur de colosses.', mods: { degatsBoss: 55, critique: 25 }, active: 'Dégâts fortement majorés contre boss et élites.' },
  { id: 'u3_pourfendeur', name: 'Pourfendeur de boss', role: 'dps', description: 'Spécialiste anti-raid : [mono] +18%.', mods: { degatsBoss: 50, force: 30 }, tagMods: [{ tag: 'mono', mult: 0.18 }], active: 'Tes coups mono-cible ignorent une part de l\'armure des boss.' },
  { id: 'u3_egide_elementaire', name: 'Égide élémentaire', role: 'resist', description: 'Bouclier contre les écoles.', mods: { reductionDegats: 30 }, resistMods: { feu: 0.10, froid: 0.10, foudre: 0.10 }, active: 'Réduit les dégâts élémentaires subis.' },
  { id: 'u3_voile_de_mana', name: 'Voile de mana', role: 'resist', description: 'La magie te contourne.', mods: { reductionDegats: 30 }, resistMods: { arcane: 0.16, ombre: 0.16 }, active: 'Absorbe une part des dégâts de sorts.' },
  { id: 'u3_renouveau_du_phenix', name: 'Renouveau du phénix', role: 'utility', description: 'Renaître de ses cendres.', mods: { endurance: 50, intelligence: 30 }, tagMods: [{ tag: 'feu', mult: 0.15 }], active: 'Évite la mort une fois en explosant de feu.' },
  { id: 'u3_metronome_parfait', name: 'Métronome parfait', role: 'utility', description: 'Le tempo absolu.', mods: { hate: 40, recuperation: 14 }, tagMods: [{ tag: 'generateur', mult: 0.15 }], active: 'Tes générateurs n\'ont presque plus de recharge.' },
]

export const UNIQUE_MAX_RANK = 10
export const UNIQUE_ACTIVE_RANK = 5 // rang qui débloque la partie active
const RANK_GROWTH = 0.35 // +35% des mods de base par rang

// --- Scaling par rareté + iLvl de l'objet porteur ---------------------------------
// Un unique sur une pièce Épique de référence vaut ~`UNIQUE_POWER` × ses mods de base ;
// il grandit ensuite proportionnellement à `iLvl × statMult` (comme une ligne d'affixe),
// de sorte qu'un unique sur du très haut stuff pèse de nouveau lourd.
const UNIQUE_REF_ILVL = 100
const UNIQUE_POWER = 0.5
const REF_STATMULT = RARITIES.epique.statMult

/** Échelle d'item (rareté + iLvl). Sans contexte d'objet → échelle de référence (Épique iLvl 100). */
function itemScaleOf(item?: { rarity: RarityId; ilvl: number }): number {
  if (!item) return UNIQUE_POWER
  const sm = RARITIES[item.rarity]?.statMult ?? REF_STATMULT
  const ilvl = Math.max(1, item.ilvl)
  return (ilvl / UNIQUE_REF_ILVL) * (sm / REF_STATMULT) * UNIQUE_POWER
}

const BY_ID = new Map(UNIQUE_EFFECTS.map((u) => [u.id, u]))
export function getUnique(id: string): UniqueEffect | undefined {
  return BY_ID.get(id)
}

/** Liste des rôles, dans l'ordre d'affichage du grimoire. */
export const UNIQUE_ROLES = ['dps', 'heal', 'tank', 'resist', 'utility'] as const

export function uniqueActiveText(id: string): string | undefined {
  return BY_ID.get(id)?.active
}

/* ================================================================== */
/* ACTIFS CÂBLÉS — taxonomie d'archetypes bornés                        */
/* Couverture TOTALE : chaque unique reçoit un archetype déduit de son  */
/* texte d'accroche (`active`) + son rôle. Magnitude = base au rang     */
/* actif × croissance par rang. Knobs = `ACTIVE_MAG` (caps par effet).  */
/* Déclenché en combat par combatEngine via `aggregateUniqueActives`.   */
/* ================================================================== */

export type UniqueActiveKind =
  | 'sursis' | 'epines' | 'bouclierCoup' | 'bouclierDepart' | 'degatsBouclier'
  | 'ralentir' | 'doubleFrappe' | 'execution' | 'berserk' | 'rampe'
  | 'penResist' | 'soinHot' | 'soinGroupe' | 'cdrKill' | 'butin'

/** +15% de magnitude par rang AU-DESSUS du rang actif (rang 10 ≈ +75%). */
const ACTIVE_RANK_GROWTH = 0.15

/** KNOBS — magnitude de BASE (au rang actif) de chaque archetype. Conservateur par défaut
 *  (anti-power-creep) : chaque effet est borné (cap, CD interne, ou 1×/combat). À calibrer aux sims. */
const ACTIVE_MAG: Record<UniqueActiveKind, number> = {
  sursis: 0.25,        // relevé à 25% PV, 1×/combat
  epines: 0.12,        // % des dégâts subis renvoyés
  bouclierCoup: 0.10,  // % PV en bouclier sur gros coup (CD 10 s)
  bouclierDepart: 0.10,// % PV en bouclier d'ouverture
  degatsBouclier: 0.10,// % des dégâts subis → bouclier
  ralentir: 0.08,      // -% dégâts de l'ennemi au contact
  doubleFrappe: 0.10,  // chance de frapper 2× (espérance de dégâts)
  execution: 0.25,     // +% dégâts vs ennemi < 25% PV
  berserk: 0.20,       // +% dégâts quand SOI < 50% PV
  rampe: 0.15,         // +% dégâts au fil du combat (cap)
  penResist: 0.08,     // ignore +% résist/armure (approx. flat)
  soinHot: 0.012,      // % PV/s (soi)
  soinGroupe: 0.008,   // % PV/s (groupe)
  cdrKill: 1.0,        // s de recharge en moins par kill
  butin: 0.15,         // +% qualité de butin
}

/** Déduit l'archetype d'actif d'un effet, depuis le texte d'accroche + le rôle (couverture totale). */
function deriveActiveKind(def: UniqueEffect): UniqueActiveKind {
  const t = (def.active ?? '').toLowerCase()
  const has = (re: RegExp) => re.test(t)
  if (has(/survi|à la mort|évite la mort|empêche.*(tomber|1 pv)|ranime|renaissance|renaît|ressuscite|relève|sous 1 pv/)) return 'sursis'
  if (has(/butin|récompense|rareté du butin|qualité du butin|donjon et raid/)) return 'butin'
  if (has(/renvoie|reflèt|réflé|reflé|épines|immole|au contact|réfract|onde de choc|explos/)) return 'epines'
  if (has(/bouclier/) && has(/hors combat|départ|se reforme|reconstruit|reconstitue/)) return 'bouclierDepart'
  if (has(/converti.*bouclier|dégâts.*bouclier|en bouclier|absorbe.*bouclier/)) return 'degatsBouclier'
  if (has(/bouclier/)) return 'bouclierCoup'
  if (has(/gèle|gel\b|ralenti|givre|étourd|paralys|insensible|invuln|pétrif|immunité|fige/)) return 'ralentir'
  if (has(/deux fois|dédoubl|double|seconde fois|rafale/)) return 'doubleFrappe'
  if (has(/exécut|achèv|affaibli|sous 25|vie ennemie|finisseur|fauche|jugement/)) return 'execution'
  if (has(/sous 50%|blessé|dos au mur|furie|rage|cran de/)) return 'berserk'
  if (has(/ignore.*(résist|armure)|perfor|transperce|traverse|perce/)) return 'penResist'
  if (has(/recharge|cooldown|relance/)) return 'cdrKill'
  if (has(/groupe/) && has(/soin|soigne|guéri/)) return 'soinGroupe'
  if (has(/soin|soigne|régén|guéri|vol de vie|draine|vie/)) return 'soinHot'
  if (has(/seconde|charge|accumule|monte|surchauffe|momentum|kill|onde/)) return 'rampe'
  switch (def.role) { // repli par rôle (couverture totale)
    case 'heal': return 'soinHot'
    case 'tank': return 'bouclierCoup'
    case 'resist': return 'degatsBouclier'
    case 'utility': return 'cdrKill'
    default: return 'rampe'
  }
}

const ACTIVE_KIND = new Map<string, UniqueActiveKind>(UNIQUE_EFFECTS.map((u) => [u.id, deriveActiveKind(u)]))
export function uniqueActiveKind(id: string): UniqueActiveKind | undefined { return ACTIVE_KIND.get(id) }

/** Magnitude effective d'un archetype à un rang donné (0 sous le rang actif). */
export function activeMagAt(kind: UniqueActiveKind, rank: number): number {
  if (rank < UNIQUE_ACTIVE_RANK) return 0
  return ACTIVE_MAG[kind] * (1 + (rank - UNIQUE_ACTIVE_RANK) * ACTIVE_RANK_GROWTH)
}

const ACTIVE_DESC: Record<UniqueActiveKind, (m: number) => string> = {
  sursis: (m) => `survit 1×/combat à un coup fatal (relevé à ${Math.round(m * 100)}% PV)`,
  epines: (m) => `renvoie ${Math.round(m * 100)}% des dégâts subis à l'attaquant`,
  bouclierCoup: (m) => `gros coup encaissé → bouclier de ${Math.round(m * 100)}% PV (récup. 10 s)`,
  bouclierDepart: (m) => `bouclier de départ de ${Math.round(m * 100)}% PV à chaque combat`,
  degatsBouclier: (m) => `${Math.round(m * 100)}% des dégâts subis reversés en bouclier`,
  ralentir: (m) => `-${Math.round(m * 100)}% de dégâts de l'ennemi au contact`,
  doubleFrappe: (m) => `+${Math.round(m * 100)}% de chance de frapper deux fois`,
  execution: (m) => `+${Math.round(m * 100)}% de dégâts aux ennemis sous 25% PV`,
  berserk: (m) => `+${Math.round(m * 100)}% de dégâts sous 50% de tes PV`,
  rampe: (m) => `+${Math.round(m * 100)}% de dégâts au fil du combat (montée ~20 s)`,
  penResist: (m) => `ignore ${Math.round(m * 100)}% de résistance/armure en plus`,
  soinHot: (m) => `te soigne ${(m * 100).toFixed(1)}% de tes PV / s`,
  soinGroupe: (m) => `soigne le groupe de ${(m * 100).toFixed(1)}% PV / s`,
  cdrKill: (m) => `chaque kill réduit tes recharges de ${m.toFixed(1)} s`,
  butin: (m) => `+${Math.round(m * 100)}% de qualité de butin`,
}

/** Effet MÉCANIQUE chiffré d'un actif à un rang donné (null sous le rang actif). */
export function describeActiveEffect(id: string, rank: number): string | null {
  const kind = ACTIVE_KIND.get(id)
  if (!kind || rank < UNIQUE_ACTIVE_RANK) return null
  return ACTIVE_DESC[kind](activeMagAt(kind, rank))
}

/** Effets d'actifs agrégés au niveau ÉQUIPE (meilleure magnitude par archetype). */
export interface UniqueActiveMods {
  sursis?: number; epines?: number; bouclierCoup?: number; bouclierDepart?: number
  degatsBouclier?: number; ralentir?: number; doubleFrappe?: number; execution?: number
  berserk?: number; rampe?: number; penResist?: number; soinHot?: number; soinGroupe?: number
  cdrKill?: number; butin?: number
}

/** Agrège les actifs des uniques équipés (rang ≥ actif) sur toute l'équipe — meilleure magnitude
 *  par effet (comme les gemmes : meilleure instance portée). Pur, réutilisé par les sims. */
export function aggregateUniqueActives(characters: { equipment: Record<string, { unique?: UniqueInstance } | undefined> }[]): UniqueActiveMods {
  const out: UniqueActiveMods = {}
  for (const c of characters) {
    for (const slot in c.equipment) {
      const u = c.equipment[slot]?.unique
      if (!u || u.rank < UNIQUE_ACTIVE_RANK) continue
      const kind = ACTIVE_KIND.get(u.id)
      if (!kind) continue
      const field = kind as keyof UniqueActiveMods
      const mag = activeMagAt(kind, u.rank)
      if ((out[field] ?? 0) < mag) out[field] = mag
    }
  }
  return out
}

export function isUniqueActive(rank: number): boolean {
  return rank >= UNIQUE_ACTIVE_RANK
}

/** Mods de BASE d'un effet à un rang donné (sans scaling d'objet) — pour le grimoire/aperçu. */
export function uniqueModsAtRank(id: string, rank: number): StatBlock {
  const def = BY_ID.get(id)
  if (!def?.mods) return {}
  const scale = 1 + (rank - 1) * RANK_GROWTH
  const out: StatBlock = {}
  for (const k in def.mods) {
    const key = k as StatKey
    out[key] = Math.round((def.mods[key] ?? 0) * scale)
  }
  return out
}

/** Résistances effectives d'un effet à un rang donné (ne montent qu'avec le rang). */
export function uniqueResistAtRank(id: string, rank: number): Partial<Record<DamageType, number>> {
  const def = BY_ID.get(id)
  if (!def?.resistMods) return {}
  const scale = 1 + (rank - 1) * RANK_GROWTH
  const out: Partial<Record<DamageType, number>> = {}
  for (const t in def.resistMods) {
    const type = t as DamageType
    out[type] = (def.resistMods[type] ?? 0) * scale
  }
  return out
}

/**
 * Mods EFFECTIFS d'une instance d'unique, montés par le rang ET par la rareté/iLvl de l'objet.
 * Passe l'objet porteur pour le vrai scaling ; sans objet, échelle de référence.
 */
export function instanceMods(inst: UniqueInstance, item?: { rarity: RarityId; ilvl: number }): StatBlock {
  const def = BY_ID.get(inst.id)
  if (!def?.mods) return {}
  const rankScale = 1 + (inst.rank - 1) * RANK_GROWTH
  const itemScale = itemScaleOf(item)
  const out: StatBlock = {}
  for (const k in def.mods) {
    const key = k as StatKey
    out[key] = Math.round((def.mods[key] ?? 0) * rankScale * itemScale)
  }
  return out
}

/** Résistances d'une instance d'unique (raccourci) — indépendantes de l'objet. */
export function instanceResist(inst: UniqueInstance): Partial<Record<DamageType, number>> {
  return uniqueResistAtRank(inst.id, inst.rank)
}

/** Bonus de TAG d'un effet à un rang donné (tag → fraction de bonus ; monte au rang seul). */
export function uniqueTagModsAtRank(id: string, rank: number): Record<string, number> {
  const def = BY_ID.get(id)
  if (!def?.tagMods) return {}
  const scale = 1 + (rank - 1) * RANK_GROWTH
  const out: Record<string, number> = {}
  for (const tm of def.tagMods) out[tm.tag] = (out[tm.tag] ?? 0) + tm.mult * scale
  return out
}

/** Bonus de TAG d'une instance d'unique (raccourci). */
export function instanceTagMods(inst: UniqueInstance): Record<string, number> {
  return uniqueTagModsAtRank(inst.id, inst.rank)
}

/**
 * Uniques TAGGÉS (signatures de conversion : `tagMods`, ex. [feu]/[zone]/[finisseur]).
 * Jugés trop puissants pour le farm : ils ne tombent QUE en donjon (traîne infime) et en raid
 * (la vraie source). Les uniques « simples » (stats/résist/actif, sans tag) tombent partout comme avant.
 */
export type UniqueSource = 'farm' | 'dungeon' | 'raid'
const isTaggedUnique = (u: UniqueEffect): boolean => !!u.tagMods && u.tagMods.length > 0
export const PLAIN_UNIQUES = UNIQUE_EFFECTS.filter((u) => !isTaggedUnique(u))
export const TAGGED_UNIQUES = UNIQUE_EFFECTS.filter(isTaggedUnique)
/** KNOB — fraction des uniques tirés issus du pool TAGGÉ, par source. farm=0 (jamais),
 *  donjon = très peu, raid = source principale. À ajuster pour durcir/assouplir. */
export const TAGGED_DROP_RATE: Record<UniqueSource, number> = {
  farm: 0,
  dungeon: 0.05,
  raid: 0.30,
}

/**
 * Tire (ou non) un effet unique selon la rareté. Naît au rang 1.
 * Les objets Épique (tier 5) et au-dessus peuvent en porter un.
 * `source` pilote l'éligibilité des uniques TAGGÉS (cf. TAGGED_DROP_RATE).
 */
export function rollUnique(rarityTier: number, source: UniqueSource = 'farm'): UniqueInstance | undefined {
  if (rarityTier < 5) return undefined
  // pente 0.14/cran + GARANTI au sommet (Céleste t11 ~98 %, Éternel+ = 100 %)
  // — l'unique est LE pic d'euphorie ARPG : une très haute rareté doit quasi toujours en porter un.
  const chance = Math.min(1, (rarityTier - 4) * 0.14)
  if (Math.random() > chance) return undefined
  const taggedRate = TAGGED_DROP_RATE[source] ?? 0
  const pool = taggedRate > 0 && TAGGED_UNIQUES.length && Math.random() < taggedRate
    ? TAGGED_UNIQUES
    : PLAIN_UNIQUES
  const def = pool[Math.floor(Math.random() * pool.length)]
  return { id: def.id, rank: 1 }
}

/** Tire un effet unique au hasard (rang 1) — pour le craft sommital (infusion / garantie de coffre).
 *  Par défaut, pool SIMPLE uniquement : les taggés ne s'obtiennent que par drop donjon/raid ou au CHOIX
 *  (Éclat cosmique). `allowTagged` rouvre tout le catalogue si besoin. */
export function randomUniqueInstance(opts?: { allowTagged?: boolean }): UniqueInstance {
  const pool = opts?.allowTagged ? UNIQUE_EFFECTS : PLAIN_UNIQUES
  const def = pool[Math.floor(Math.random() * pool.length)]
  return { id: def.id, rank: 1 }
}

/** Tire un effet unique PAS ENCORE découvert (Coffre du Collectionneur) ; Grimoire complet → aléatoire. */
export function undiscoveredUnique(codex: string[]): UniqueInstance {
  const pool = UNIQUE_EFFECTS.filter((u) => !codex.includes(u.id))
  const def = pool.length ? pool[Math.floor(Math.random() * pool.length)] : UNIQUE_EFFECTS[Math.floor(Math.random() * UNIQUE_EFFECTS.length)]
  return { id: def.id, rank: 1 }
}

/** Essences gagnées en recyclant un objet portant cet unique. */
export function essenceGain(rarityTier: number, rank: number): number {
  return Math.max(1, Math.floor(rarityTier / 2) + Math.floor(rank / 2))
}

/** Coût pour monter un effet du rang actuel au suivant. */
export function upgradeCost(rank: number): { essences: number; eclats: number } {
  return { essences: rank, eclats: 40 * rank }
}

/** Coût pour INSÉRER (poser) un effet sur un objet via des essences. */
export function insertCost(): { essences: number; eclats: number } {
  return { essences: 8, eclats: 500 }
}
