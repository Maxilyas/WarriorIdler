import type { EquipSlotId, ItemType } from './types'

export interface EquipSlotMeta {
  id: EquipSlotId
  name: string
  /** Type d'objet accepté dans cet emplacement. */
  accepts: ItemType
}

/** Les 16 emplacements du personnage, dans l'ordre d'affichage du paper-doll. */
export const EQUIP_SLOTS: EquipSlotMeta[] = [
  { id: 'tete', name: 'Tête', accepts: 'tete' },
  { id: 'cou', name: 'Cou', accepts: 'cou' },
  { id: 'epaules', name: 'Épaules', accepts: 'epaules' },
  { id: 'cape', name: 'Cape', accepts: 'cape' },
  { id: 'torse', name: 'Torse', accepts: 'torse' },
  { id: 'poignets', name: 'Poignets', accepts: 'poignets' },
  { id: 'mains', name: 'Mains', accepts: 'mains' },
  { id: 'taille', name: 'Taille', accepts: 'taille' },
  { id: 'jambes', name: 'Jambes', accepts: 'jambes' },
  { id: 'pieds', name: 'Pieds', accepts: 'pieds' },
  { id: 'anneau1', name: 'Anneau I', accepts: 'anneau' },
  { id: 'anneau2', name: 'Anneau II', accepts: 'anneau' },
  { id: 'bijou1', name: 'Bijou I', accepts: 'bijou' },
  { id: 'bijou2', name: 'Bijou II', accepts: 'bijou' },
  { id: 'armePrincipale', name: 'Arme principale', accepts: 'armePrincipale' },
  { id: 'armeSecondaire', name: 'Arme secondaire', accepts: 'armeSecondaire' },
]

export interface ItemTypeMeta {
  id: ItemType
  name: string
  icon: string
  /** Poids de budget de stats du type (arme/torse > anneau). */
  weight: number
}

export const ITEM_TYPES: Record<ItemType, ItemTypeMeta> = {
  tete: { id: 'tete', name: 'Casque', icon: '🪖', weight: 1 },
  cou: { id: 'cou', name: 'Collier', icon: '📿', weight: 0.6 },
  epaules: { id: 'epaules', name: 'Épaulières', icon: '🎽', weight: 1 },
  cape: { id: 'cape', name: 'Cape', icon: '🧣', weight: 0.6 },
  torse: { id: 'torse', name: 'Plastron', icon: '🥋', weight: 1.4 },
  poignets: { id: 'poignets', name: 'Bracelets', icon: '⛓️', weight: 0.6 },
  mains: { id: 'mains', name: 'Gants', icon: '🧤', weight: 1 },
  taille: { id: 'taille', name: 'Ceinture', icon: '🪢', weight: 0.8 },
  jambes: { id: 'jambes', name: 'Jambières', icon: '👖', weight: 1.4 },
  pieds: { id: 'pieds', name: 'Bottes', icon: '🥾', weight: 1 },
  anneau: { id: 'anneau', name: 'Anneau', icon: '💍', weight: 0.6 },
  bijou: { id: 'bijou', name: 'Bijou', icon: '🔮', weight: 0.7 },
  armePrincipale: { id: 'armePrincipale', name: 'Arme', icon: '🗡️', weight: 2 },
  armeSecondaire: { id: 'armeSecondaire', name: 'Bouclier', icon: '🛡️', weight: 1.2 },
}

const SLOT_BY_ID = new Map(EQUIP_SLOTS.map((s) => [s.id, s]))

/** Emplacements qui acceptent un type d'objet donné (ex. anneau → [anneau1, anneau2]). */
export function equipSlotsForType(type: ItemType): EquipSlotMeta[] {
  return EQUIP_SLOTS.filter((s) => s.accepts === type)
}

export function slotAccepts(slot: EquipSlotId, type: ItemType): boolean {
  return SLOT_BY_ID.get(slot)?.accepts === type
}

export function slotName(slot: EquipSlotId): string {
  return SLOT_BY_ID.get(slot)?.name ?? slot
}
