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
  { id: 'flux_vital', name: 'Flux vital', role: 'heal', description: 'La vie circule à travers vous.', mods: { regen: 60, intelligence: 30 }, active: 'Un soin différé suit chaque attaque.' },
  { id: 'sang_eternel', name: 'Sang éternel', role: 'heal', description: 'Vos blessures se referment seules.', mods: { volDeVie: 40, regen: 30 }, active: 'Un bouclier de sang se reforme hors combat.' },
  { id: 'benediction_solaire', name: 'Bénédiction solaire', role: 'heal', description: 'Une lumière apaisante vous entoure.', mods: { intelligence: 50, maitrise: 30, regen: 25 }, active: 'Soigne le groupe à chaque sort lancé.' },
  { id: 'communion', name: 'Communion', role: 'heal', description: 'Votre esprit nourrit le groupe.', mods: { intelligence: 60, regen: 40 }, active: 'Soigne tout le groupe sur la durée.' },
  { id: 'renaissance', name: 'Renaissance', role: 'heal', description: 'Vous renaissez de vos cendres.', mods: { regen: 50, endurance: 60 }, active: 'Survit une fois à la mort par combat.' },

  // ================= TANK (historiques) =================
  { id: 'colosse', name: 'Carrure de colosse', role: 'tank', description: 'Votre stature impose le respect.', mods: { endurance: 80, maitrise: 25 }, active: 'Renvoie une partie des dégâts subis.' },
  { id: 'gardien_eternel', name: 'Gardien éternel', role: 'tank', description: 'Une volonté inépuisable.', mods: { endurance: 60, reductionDegats: 50 }, active: 'Un bouclier se régénère hors combat.' },
  { id: 'mur_dacier', name: 'Mur d\'acier', role: 'tank', description: 'Immobile face à la tempête.', mods: { reductionDegats: 70, barriere: 200 }, active: 'Devient brièvement insensible aux coups.' },
  { id: 'peau_de_dragon', name: 'Peau de dragon', role: 'tank', description: 'Des écailles ancestrales vous couvrent.', mods: { endurance: 100, esquive: 30 }, active: 'Reflète les attaques esquivées.' },
  { id: 'rempart_vivant', name: 'Rempart vivant', role: 'tank', description: 'Vous attirez et encaissez tout.', mods: { endurance: 70, barriere: 300 }, active: 'Provoque toute la salle.' },

  // ================= RESIST (historiques) =================
  { id: 'coeur_de_braise', name: 'Cœur de braise', role: 'resist', description: 'Le feu ne vous atteint plus.', mods: { endurance: 40 }, resistMods: { feu: 0.18 }, active: 'Immole les attaquants au contact.' },
  { id: 'armure_de_givre', name: 'Armure de givre', role: 'resist', description: 'Le froid glisse sur vous.', mods: { endurance: 40 }, resistMods: { froid: 0.18 }, active: 'Ralentit les ennemis proches.' },
  { id: 'mise_a_la_terre', name: 'Mise à la terre', role: 'resist', description: 'La foudre vous contourne.', mods: { endurance: 40 }, resistMods: { foudre: 0.18 }, active: 'Décharge la foudre accumulée.' },
  { id: 'voile_antimagie', name: 'Voile antimagie', role: 'resist', description: 'L\'arcane se dissipe à votre contact.', mods: { reductionDegats: 30 }, resistMods: { arcane: 0.18 }, active: 'Dissipe un sort ennemi périodiquement.' },
  { id: 'lumiere_purificatrice', name: 'Lumière purificatrice', role: 'resist', description: 'Les ombres vous fuient.', mods: { reductionDegats: 30 }, resistMods: { ombre: 0.18 }, active: 'Purge les altérations d\'ombre.' },
  { id: 'symbiose_naturelle', name: 'Symbiose naturelle', role: 'resist', description: 'La nature vous épargne.', mods: { regen: 40 }, resistMods: { nature: 0.18 }, active: 'Régénère en restant immobile.' },
  { id: 'egide_prismatique', name: 'Égide prismatique', role: 'resist', description: 'Toutes les énergies s\'atténuent.', mods: { endurance: 50 }, resistMods: { feu: 0.08, froid: 0.08, foudre: 0.08, arcane: 0.08, ombre: 0.08, nature: 0.08, physique: 0.08 }, active: 'Convertit les dégâts subis en bouclier.' },

  // ================= UTILITY (historiques) =================
  { id: 'esprit_vif', name: 'Esprit vif', role: 'utility', description: 'Vos réflexes dépassent l\'ennemi.', mods: { hate: 60, esquive: 30 }, active: 'Esquive garantie après un coup encaissé.' },
  { id: 'fortune', name: 'Fortune du voyageur', role: 'utility', description: 'La chance vous sourit.', mods: { maitrise: 50, regen: 30 }, active: 'Améliore le butin des combats.' },
  { id: 'equilibre_parfait', name: 'Équilibre parfait', role: 'utility', description: 'Ni trop offensif, ni trop prudent.', mods: { maitrise: 70 }, active: 'Adapte vos stats au combat.' },
  { id: 'source_intarissable', name: 'Source intarissable', role: 'utility', description: 'Une vitalité qui ne tarit jamais.', mods: { regen: 80, maitrise: 30 }, active: 'Régénère fortement hors combat.' },

  // ================================================================
  //                100 NOUVEAUX EFFETS UNIQUES
  // ================================================================

  // ---------------- DPS (38) ----------------
  { id: 'u_fracas_sismique', name: 'Fracas sismique', role: 'dps', description: 'Chaque pas fissure la terre.', mods: { force: 80, maitrise: 40 }, active: 'Onde de choc à chaque palier de rage atteint.' },
  { id: 'u_morsure_du_loup', name: 'Morsure du loup', role: 'dps', description: 'Vous traquez la moindre faille.', mods: { critique: 55, agilite: 40 }, active: 'Les crits sur une cible saignante les achèvent.' },
  { id: 'u_cendre_ardente', name: 'Cendre ardente', role: 'dps', description: 'Vos coups laissent des braises.', mods: { maitrise: 55, degatsCrit: 35 }, active: 'Pose un brasier qui ronge l\'ennemi.' },
  { id: 'u_eclair_jumeau', name: 'Éclair jumeau', role: 'dps', description: 'La foudre frappe deux fois.', mods: { hate: 45, multifrappe: 18 }, active: 'Vos frappes se dédoublent par éclairs.' },
  { id: 'u_croc_venimeux', name: 'Croc venimeux', role: 'dps', description: 'Un venin paralyse vos proies.', mods: { agilite: 55, penetration: 35 }, active: 'Le venin empile et ignore l\'armure.' },
  { id: 'u_main_du_bourreau', name: 'Main du bourreau', role: 'dps', description: 'Vous achevez sans pitié.', mods: { degatsCrit: 80, force: 25 }, active: 'Dégâts massifs sous 25% de vie ennemie.' },
  { id: 'u_furie_sanguine', name: 'Furie sanguine', role: 'dps', description: 'Le sang versé décuple votre rage.', mods: { force: 60, volDeVie: 25 }, active: 'Chaque kill octroie un palier de furie.' },
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
  { id: 'u_souffle_dragon', name: 'Souffle de dragon', role: 'dps', description: 'Vous crachez la ruine.', mods: { maitrise: 70, intelligence: 25 }, active: 'Un cône de flammes balaie les rangs.' },
  { id: 'u_lame_du_neant', name: 'Lame du néant', role: 'dps', description: 'L\'arme tranche la réalité.', mods: { penetration: 70, degatsCrit: 25 }, active: 'Ignore une part des résistances et de l\'armure.' },
  { id: 'u_frenesie_carmin', name: 'Frénésie carmin', role: 'dps', description: 'Le rouge vous obsède.', mods: { critique: 50, hate: 40 }, active: 'Chaque crit accélère la cadence.' },
  { id: 'u_jugement_solaire', name: 'Jugement solaire', role: 'dps', description: 'La lumière brûle les impies.', mods: { intelligence: 45, maitrise: 45 }, active: 'Une colonne de lumière s\'abat périodiquement.' },
  { id: 'u_lame_spectrale', name: 'Lame spectrale', role: 'dps', description: 'Une arme qui n\'existe qu\'à demi.', mods: { agilite: 50, penetration: 40 }, active: 'Les frappes traversent les boucliers.' },
  { id: 'u_poigne_du_titan', name: 'Poigne du titan', role: 'dps', description: 'Vous broyez tout ce que vous saisissez.', mods: { force: 90 }, active: 'Saisit et écrase une cible pour de gros dégâts.' },
  { id: 'u_pluie_de_fleches', name: 'Pluie de flèches', role: 'dps', description: 'Le ciel s\'assombrit de traits.', mods: { agilite: 60, critique: 30 }, active: 'Une volée frappe toute la salle.' },
  { id: 'u_resonance_arcanique', name: 'Résonance arcanique', role: 'dps', description: 'La magie résonne et se démultiplie.', mods: { intelligence: 70, degatsCrit: 30 }, active: 'Les sorts résonnent et se relancent.' },
  { id: 'u_croissant_funeste', name: 'Croissant funeste', role: 'dps', description: 'La faux du moissonneur.', mods: { degatsCrit: 60, agilite: 35 }, active: 'Fauche en arc les ennemis affaiblis.' },
  { id: 'u_marque_du_predateur', name: 'Marque du prédateur', role: 'dps', description: 'Vous marquez votre proie.', mods: { critique: 65, penetration: 25 }, active: 'La cible marquée subit des crits majorés.' },
  { id: 'u_tempete_d_acier', name: 'Tempête d\'acier', role: 'dps', description: 'Un déluge de lames.', mods: { hate: 60, force: 35 }, active: 'Vitesse fortement accrue en infériorité numérique.' },
  { id: 'u_flux_destructeur', name: 'Flux destructeur', role: 'dps', description: 'Une énergie qui ne demande qu\'à exploser.', mods: { surpuissance: 15, maitrise: 35 }, active: 'Accumule une charge qui détone.' },
  { id: 'u_dent_de_requin', name: 'Dent de requin', role: 'dps', description: 'L\'odeur du sang vous rend fou.', mods: { volDeVie: 30, critique: 40 }, active: 'Vol de vie majoré sur les cibles blessées.' },
  { id: 'u_eclat_du_chaos', name: 'Éclat du chaos', role: 'dps', description: 'Vos dégâts varient sauvagement.', mods: { degatsCrit: 55, surpuissance: 9 }, active: 'Coups chaotiques : faibles… ou dévastateurs.' },
  { id: 'u_lame_de_l_aube', name: 'Lame de l\'aube', role: 'dps', description: 'Forgée dans la première lumière.', mods: { force: 50, intelligence: 40 }, active: 'Frappe consacrée à l\'ouverture du combat.' },
  { id: 'u_morsure_de_l_hiver', name: 'Morsure de l\'hiver', role: 'dps', description: 'Un froid qui fige le cœur.', mods: { maitrise: 50, critique: 35 }, active: 'Gèle brièvement les ennemis frappés.' },
  { id: 'u_fureur_naine', name: 'Fureur naine', role: 'dps', description: 'La rage des forges souterraines.', mods: { force: 70, penetration: 25 }, active: 'Une charge qui fracasse l\'armure.' },
  { id: 'u_vol_du_faucon', name: 'Vol du faucon', role: 'dps', description: 'Insaisissable et létal.', mods: { agilite: 75, hate: 20 }, active: 'Esquive offensive : riposte garantie.' },
  { id: 'u_anneau_de_feu', name: 'Anneau de feu', role: 'dps', description: 'Un cercle de flammes vous suit.', mods: { maitrise: 65, endurance: 25 }, active: 'Embrase les ennemis qui s\'approchent.' },
  { id: 'u_canon_arcanique', name: 'Canon arcanique', role: 'dps', description: 'La puissance brute condensée.', mods: { intelligence: 80 }, active: 'Une déflagration arcanique périodique.' },
  { id: 'u_griffe_du_demon', name: 'Griffe du démon', role: 'dps', description: 'Un pacte de pure violence.', mods: { force: 45, agilite: 45, volDeVie: 20 }, active: 'Lacère et draine la vitalité ennemie.' },

  // ---------------- TANK (20) ----------------
  { id: 'u_bastion_imperial', name: 'Bastion impérial', role: 'tank', description: 'Une forteresse à vous seul.', mods: { endurance: 90, reductionDegats: 30 }, active: 'Érige un mur qui absorbe les coups.' },
  { id: 'u_carapace_ancestrale', name: 'Carapace ancestrale', role: 'tank', description: 'Une coquille gravée par les âges.', mods: { reductionDegats: 60, barriere: 250 }, active: 'Durcit la carapace après chaque coup encaissé.' },
  { id: 'u_volonte_de_fer', name: 'Volonté de fer', role: 'tank', description: 'Rien ne vous fait plier.', mods: { endurance: 70, maitrise: 35 }, active: 'Ignore le prochain coup fatal une fois.' },
  { id: 'u_montagne_vivante', name: 'Montagne vivante', role: 'tank', description: 'Inébranlable comme le roc.', mods: { endurance: 120 }, active: 'Plus vous êtes immobile, plus vous résistez.' },
  { id: 'u_serment_du_gardien', name: 'Serment du gardien', role: 'tank', description: 'Vous protégez les vôtres.', mods: { endurance: 60, reductionDegats: 45, maitrise: 20 }, active: 'Redirige une part des dégâts du groupe sur vous.' },
  { id: 'u_aegis_runique', name: 'Aegis runique', role: 'tank', description: 'Un bouclier de runes scellées.', mods: { barriere: 400, endurance: 40 }, active: 'Le bouclier renvoie l\'énergie absorbée.' },
  { id: 'u_chair_de_pierre', name: 'Chair de pierre', role: 'tank', description: 'Votre peau se mue en granit.', mods: { reductionDegats: 80 }, active: 'Pétrification temporaire : quasi-invulnérable.' },
  { id: 'u_coeur_de_montagne', name: 'Cœur de montagne', role: 'tank', description: 'Un cœur lourd comme un mont.', mods: { endurance: 85, esquive: 25 }, active: 'Convertit une part des PV en bouclier.' },
  { id: 'u_garde_du_crepuscule', name: 'Garde du crépuscule', role: 'tank', description: 'Sentinelle entre deux mondes.', mods: { endurance: 65, reductionDegats: 40 }, active: 'Provoque et encaisse une salve entière.' },
  { id: 'u_titan_eveille', name: 'Titan éveillé', role: 'tank', description: 'Un colosse qui se redresse.', mods: { endurance: 100, maitrise: 20 }, active: 'Grandit à chaque coup subi (plus de PV).' },
  { id: 'u_ancre_abyssale', name: 'Ancre abyssale', role: 'tank', description: 'Rien ne peut vous déplacer.', mods: { endurance: 75, reductionDegats: 35 }, active: 'Immunité aux contrôles et au repli forcé.' },
  { id: 'u_bouclier_solaire', name: 'Bouclier solaire', role: 'tank', description: 'Un disque de lumière vous protège.', mods: { barriere: 300, regen: 30 }, active: 'Le bouclier soigne quand il se brise.' },
  { id: 'u_peau_d_ecorce', name: 'Peau d\'écorce', role: 'tank', description: 'L\'écorce ancestrale vous recouvre.', mods: { endurance: 70, reductionDegats: 30, regen: 20 }, active: 'Régénère tant que vous restez en garde.' },
  { id: 'u_rempart_d_os', name: 'Rempart d\'os', role: 'tank', description: 'Un mur fait des ennemis tombés.', mods: { endurance: 80, barriere: 200 }, active: 'Chaque kill érige un fragment de mur d\'os.' },
  { id: 'u_egide_du_juge', name: 'Égide du juge', role: 'tank', description: 'Le bouclier de la sentence.', mods: { reductionDegats: 55, endurance: 45 }, active: 'Renvoie les coups esquivés à l\'agresseur.' },
  { id: 'u_forme_de_golem', name: 'Forme de golem', role: 'tank', description: 'Un automate de pierre et de mana.', mods: { endurance: 90, barriere: 150 }, active: 'Se reconstruit lentement hors combat.' },
  { id: 'u_serment_inviolable', name: 'Serment inviolable', role: 'tank', description: 'Une promesse que rien ne brise.', mods: { reductionDegats: 50, maitrise: 30 }, active: 'Réduit fortement les dégâts du premier boss.' },
  { id: 'u_carcasse_runique', name: 'Carcasse runique', role: 'tank', description: 'Une armure vivante de runes.', mods: { endurance: 60, barriere: 280, reductionDegats: 20 }, active: 'Les runes scintillent et bloquent un coup.' },
  { id: 'u_geant_des_glaces', name: 'Géant des glaces', role: 'tank', description: 'Une masse de glace impassible.', mods: { endurance: 95, esquive: 20 }, active: 'Gèle les attaquants au contact.' },
  { id: 'u_sentinelle_eternelle', name: 'Sentinelle éternelle', role: 'tank', description: 'La garde qui ne dort jamais.', mods: { endurance: 70, reductionDegats: 35, regen: 25 }, active: 'Veille : régénère et provoque en continu.' },

  // ---------------- HEAL (14) ----------------
  { id: 'u_calice_de_vie', name: 'Calice de vie', role: 'heal', description: 'Une coupe qui ne se vide jamais.', mods: { regen: 70, intelligence: 35 }, active: 'Déverse un flot de soins sur le plus blessé.' },
  { id: 'u_larme_de_seraphin', name: 'Larme de séraphin', role: 'heal', description: 'Une larme d\'ange cristallisée.', mods: { intelligence: 55, regen: 45 }, active: 'Ressuscite un allié tombé une fois.' },
  { id: 'u_sang_de_phenix', name: 'Sang de phénix', role: 'heal', description: 'La chaleur du renouveau.', mods: { regen: 55, endurance: 50 }, active: 'Une renaissance ardente après la mort.' },
  { id: 'u_chant_de_guerison', name: 'Chant de guérison', role: 'heal', description: 'Votre voix apaise les plaies.', mods: { intelligence: 65, maitrise: 30 }, active: 'Un chant soigne tout le groupe sur la durée.' },
  { id: 'u_rosee_sylvestre', name: 'Rosée sylvestre', role: 'heal', description: 'La rosée du matin guérit tout.', mods: { regen: 60, volDeVie: 20 }, active: 'Régénération accélérée sous les soins.' },
  { id: 'u_pacte_vital', name: 'Pacte vital', role: 'heal', description: 'Vos vies sont liées.', mods: { regen: 50, endurance: 55 }, active: 'Partage les soins reçus avec le groupe.' },
  { id: 'u_aura_curative', name: 'Aura curative', role: 'heal', description: 'Une lumière douce vous nimbe.', mods: { intelligence: 50, regen: 50 }, active: 'Soigne passivement les alliés proches.' },
  { id: 'u_eau_benie', name: 'Eau bénie', role: 'heal', description: 'Une source sanctifiée.', mods: { regen: 65, intelligence: 30 }, active: 'Purge une altération et soigne d\'un coup.' },
  { id: 'u_souffle_de_vie', name: 'Souffle de vie', role: 'heal', description: 'Un dernier souffle ranime.', mods: { regen: 45, endurance: 45, maitrise: 20 }, active: 'Empêche un allié de tomber sous 1 PV.' },
  { id: 'u_main_du_guerisseur', name: 'Main du guérisseur', role: 'heal', description: 'Un simple contact suffit.', mods: { intelligence: 60, regen: 40 }, active: 'Soin instantané sur la cible la plus basse.' },
  { id: 'u_fontaine_eternelle', name: 'Fontaine éternelle', role: 'heal', description: 'Une eau qui jaillit sans fin.', mods: { regen: 90 }, active: 'Une zone de soins persistante autour de vous.' },
  { id: 'u_benediction_lunaire', name: 'Bénédiction lunaire', role: 'heal', description: 'La lune veille sur vos blessés.', mods: { intelligence: 45, regen: 45, esquive: 20 }, active: 'Soins majorés la nuit du combat.' },
  { id: 'u_serment_du_clerc', name: 'Serment du clerc', role: 'heal', description: 'Dévoué corps et âme.', mods: { regen: 55, maitrise: 35 }, active: 'Convertit une part de vos dégâts en soins de groupe.' },
  { id: 'u_lien_d_ame', name: 'Lien d\'âme', role: 'heal', description: 'Deux âmes, un seul destin.', mods: { regen: 50, intelligence: 35, endurance: 25 }, active: 'Répartit les dégâts létaux sur le groupe.' },

  // ---------------- RESIST (14) ----------------
  { id: 'u_manteau_de_lave', name: 'Manteau de lave', role: 'resist', description: 'La lave vous sert d\'armure.', mods: { endurance: 45 }, resistMods: { feu: 0.22 }, active: 'Renvoie une vague de feu aux attaquants.' },
  { id: 'u_carapace_glaciaire', name: 'Carapace glaciaire', role: 'resist', description: 'Un blindage de glace éternelle.', mods: { reductionDegats: 35 }, resistMods: { froid: 0.22 }, active: 'Gèle les assaillants qui vous touchent.' },
  { id: 'u_paratonnerre', name: 'Paratonnerre', role: 'resist', description: 'La foudre vous ignore.', mods: { endurance: 40, hate: 20 }, resistMods: { foudre: 0.22 }, active: 'Stocke la foudre puis la décharge.' },
  { id: 'u_sceau_antimagie', name: 'Sceau antimagie', role: 'resist', description: 'Un sceau qui dévore les sorts.', mods: { reductionDegats: 40 }, resistMods: { arcane: 0.22 }, active: 'Absorbe un sort pour vous renforcer.' },
  { id: 'u_voile_d_ombre', name: 'Voile d\'ombre', role: 'resist', description: 'Les ténèbres vous épousent.', mods: { esquive: 30, endurance: 25 }, resistMods: { ombre: 0.22 }, active: 'Se fond dans l\'ombre pour éviter un coup.' },
  { id: 'u_ecorce_du_monde', name: 'Écorce du monde', role: 'resist', description: 'La nature vous protège des siens.', mods: { regen: 45 }, resistMods: { nature: 0.22 }, active: 'Régénère à chaque dégât de nature subi.' },
  { id: 'u_plastron_de_diamant', name: 'Plastron de diamant', role: 'resist', description: 'Le diamant ne cède pas.', mods: { reductionDegats: 45 }, resistMods: { physique: 0.20 }, active: 'Réfracte une part des coups physiques.' },
  { id: 'u_aura_du_pyromancien', name: 'Aura du pyromancien', role: 'resist', description: 'Né dans les flammes.', mods: { maitrise: 35 }, resistMods: { feu: 0.16, foudre: 0.10 }, active: 'Convertit le feu subi en vitesse d\'attaque.' },
  { id: 'u_givre_protecteur', name: 'Givre protecteur', role: 'resist', description: 'Un halo de froid bienveillant.', mods: { regen: 30, endurance: 25 }, resistMods: { froid: 0.16, nature: 0.10 }, active: 'Ralentit le temps de recharge ennemi.' },
  { id: 'u_prisme_arcanique', name: 'Prisme arcanique', role: 'resist', description: 'La magie se brise en arc-en-ciel.', mods: { intelligence: 30 }, resistMods: { arcane: 0.16, ombre: 0.10 }, active: 'Renvoie une part des sorts à l\'envoyeur.' },
  { id: 'u_totem_tellurique', name: 'Totem tellurique', role: 'resist', description: 'Ancré aux forces de la terre.', mods: { endurance: 50 }, resistMods: { foudre: 0.14, nature: 0.14 }, active: 'Plante un totem qui absorbe les éléments.' },
  { id: 'u_masque_funeste', name: 'Masque funeste', role: 'resist', description: 'Un masque qui boit l\'ombre.', mods: { volDeVie: 20, endurance: 25 }, resistMods: { ombre: 0.16, feu: 0.10 }, active: 'Vole la vie des sorts d\'ombre subis.' },
  { id: 'u_egide_du_neant', name: 'Égide du néant', role: 'resist', description: 'Le vide annule tout.', mods: { reductionDegats: 30 }, resistMods: { arcane: 0.12, ombre: 0.12, feu: 0.08 }, active: 'Crée une zone qui atténue toute magie.' },
  { id: 'u_armure_du_monde', name: 'Armure du monde', role: 'resist', description: 'Toutes les énergies vous épargnent.', mods: { endurance: 60 }, resistMods: { feu: 0.10, froid: 0.10, foudre: 0.10, arcane: 0.10, ombre: 0.10, nature: 0.10, physique: 0.10 }, active: 'Transforme les dégâts élémentaires en bouclier.' },

  // ---------------- UTILITY (14) ----------------
  { id: 'u_pas_de_l_ombre', name: 'Pas de l\'ombre', role: 'utility', description: 'Vous glissez entre les coups.', mods: { esquive: 45, agilite: 30 }, active: 'Téléportation courte qui esquive un coup.' },
  { id: 'u_chance_du_pillard', name: 'Chance du pillard', role: 'utility', description: 'Le butin vous trouve.', mods: { maitrise: 40, regen: 25 }, active: 'Améliore nettement la qualité du butin.' },
  { id: 'u_horloge_brisee', name: 'Horloge brisée', role: 'utility', description: 'Le temps joue pour vous.', mods: { recuperation: 18, hate: 30 }, active: 'Réduit fortement les temps de recharge.' },
  { id: 'u_souffle_du_vent', name: 'Souffle du vent', role: 'utility', description: 'Léger comme la brise.', mods: { hate: 50, esquive: 25 }, active: 'Vitesse accrue après une esquive.' },
  { id: 'u_oeil_omniscient', name: 'Œil omniscient', role: 'utility', description: 'Rien ne vous échappe.', mods: { critique: 35, maitrise: 35 }, active: 'Révèle et exploite les faiblesses ennemies.' },
  { id: 'u_pacte_du_marchand', name: 'Pacte du marchand', role: 'utility', description: 'Tout a un prix… avantageux.', mods: { maitrise: 50, regen: 20 }, active: 'Convertit l\'excédent de soins en or.' },
  { id: 'u_boussole_astrale', name: 'Boussole astrale', role: 'utility', description: 'Les astres vous guident.', mods: { maitrise: 45, hate: 25 }, active: 'Oriente vos coups vers la cible idéale.' },
  { id: 'u_grimoire_vivant', name: 'Grimoire vivant', role: 'utility', description: 'Un livre qui pense pour vous.', mods: { intelligence: 45, recuperation: 12 }, active: 'Relance automatiquement votre dernier sort.' },
  { id: 'u_fil_du_destin', name: 'Fil du destin', role: 'utility', description: 'Vous tissez votre sort.', mods: { maitrise: 55 }, active: 'Une seconde chance sur un coup raté.' },
  { id: 'u_talisman_du_voyageur', name: 'Talisman du voyageur', role: 'utility', description: 'La route vous est clémente.', mods: { regen: 40, esquive: 25, maitrise: 15 }, active: 'Régénère plus vite hors combat.' },
  { id: 'u_sablier_d_argent', name: 'Sablier d\'argent', role: 'utility', description: 'Le sable s\'écoule à votre rythme.', mods: { recuperation: 16, regen: 30 }, active: 'Ralentit l\'enrage des boss.' },
  { id: 'u_clef_des_songes', name: 'Clef des songes', role: 'utility', description: 'Ouvre des portes invisibles.', mods: { maitrise: 40, critique: 25 }, active: 'Améliore les récompenses de donjon et raid.' },
  { id: 'u_plume_de_phenix', name: 'Plume de phénix', role: 'utility', description: 'Une plume porte-bonheur.', mods: { regen: 35, maitrise: 30, hate: 15 }, active: 'Évite la mort une fois par combat.' },
  { id: 'u_dé_pipé', name: 'Dé pipé', role: 'utility', description: 'Le hasard vous obéit.', mods: { critique: 40, maitrise: 25 }, active: 'Force un résultat favorable périodiquement.' },
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

/**
 * Tire (ou non) un effet unique selon la rareté. Naît au rang 1.
 * Les objets Épique (tier 5) et au-dessus peuvent en porter un.
 */
export function rollUnique(rarityTier: number): UniqueInstance | undefined {
  if (rarityTier < 5) return undefined
  // v0.32.2 : pente relevée (0.1 → 0.14/cran) + GARANTI au sommet (Céleste t11 ~98 %, Éternel+ = 100 %)
  // — l'unique est LE pic d'euphorie ARPG : une très haute rareté doit quasi toujours en porter un.
  const chance = Math.min(1, (rarityTier - 4) * 0.14)
  if (Math.random() > chance) return undefined
  const def = UNIQUE_EFFECTS[Math.floor(Math.random() * UNIQUE_EFFECTS.length)]
  return { id: def.id, rank: 1 }
}

/** Tire un effet unique au hasard (rang 1) — pour le craft sommital (infusion). */
export function randomUniqueInstance(): UniqueInstance {
  const def = UNIQUE_EFFECTS[Math.floor(Math.random() * UNIQUE_EFFECTS.length)]
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
