import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset, mkItem } from './_helpers'
import { sellValue } from '../../src/game/items'
import { RARITIES } from '../../src/game/rarities'
import { makeCharacter } from '../../src/game/character'

describe('stuffSlice', () => {
  beforeEach(() => reset())

  it('equip déplace un objet du sac vers l\'emplacement, unequip le rend', () => {
    const w = mkItem({ type: 'armePrincipale', ilvl: 100, rarity: 'rare' })
    reset({ inventory: [w] })
    g().equip(w.id)
    const ac = g().characters[g().activeChar]
    expect(ac.equipment.armePrincipale?.id).toBe(w.id)
    expect(g().inventory.find((i) => i.id === w.id)).toBeUndefined()
    g().unequip('armePrincipale')
    expect(g().characters[g().activeChar].equipment.armePrincipale).toBeUndefined()
    expect(g().inventory.find((i) => i.id === w.id)?.id).toBe(w.id)
  })

  it('sell retire l\'objet et crédite sellValue ; no-op si verrouillé', () => {
    const it = mkItem({ type: 'tete', ilvl: 80, rarity: 'rare' })
    reset({ inventory: [it], gold: 0 })
    const gain = sellValue(it)
    g().sell(it.id)
    expect(g().gold).toBe(gain)
    expect(g().inventory).toHaveLength(0)
    // verrouillé → protégé
    const locked = mkItem({ type: 'tete', ilvl: 80, rarity: 'rare' })
    locked.locked = true
    reset({ inventory: [locked], gold: 0 })
    g().sell(locked.id)
    expect(g().gold).toBe(0)
    expect(g().inventory).toHaveLength(1)
  })

  it('recycle retire l\'objet et crédite des éclats (essence)', () => {
    const it = mkItem({ type: 'mains', ilvl: 90, rarity: 'epique' })
    reset({ inventory: [it], essence: 0 })
    g().recycle(it.id)
    expect(g().essence).toBeGreaterThan(0)
    expect(g().inventory).toHaveLength(0)
  })

  it('toggleLock bascule le verrou d\'un objet', () => {
    const it = mkItem({ type: 'pieds', ilvl: 50, rarity: 'rare' })
    reset({ inventory: [it] })
    expect(g().inventory[0].locked).toBeFalsy()
    g().toggleLock(it.id)
    expect(g().inventory[0].locked).toBe(true)
    g().toggleLock(it.id)
    expect(g().inventory[0].locked).toBe(false)
  })

  it('sellAllBelow vend les raretés sous le seuil, garde le reste', () => {
    const commun = mkItem({ type: 'tete', ilvl: 50, rarity: 'commun' })
    const epique = mkItem({ type: 'mains', ilvl: 50, rarity: 'epique' })
    reset({ inventory: [commun, epique], gold: 0 })
    g().sellAllBelow(RARITIES['epique'].tier) // vend tout ce qui est SOUS épique
    const ids = g().inventory.map((i) => i.id)
    expect(ids).toContain(epique.id)
    expect(ids).not.toContain(commun.id)
    expect(g().gold).toBeGreaterThan(0)
  })

  // Tri manuel : la case « seulement l'inutile » (uselessOnly) restreint le recyclage de masse au butin
  // qui n'améliore ni le DPS ni la survie d'aucun héros recruté — cumulé au seuil de rareté.
  it('recycleAllBelow(tier, uselessOnly) épargne les objets utiles (héros nu → tout est un upgrade)', () => {
    const inv = [
      mkItem({ type: 'torse', ilvl: 50, rarity: 'rare' }),
      mkItem({ type: 'mains', ilvl: 50, rarity: 'rare' }),
      mkItem({ type: 'pieds', ilvl: 50, rarity: 'rare' }),
    ]
    // Héros NU : chaque objet remplit un emplacement vide → améliore → utile → ÉPARGNÉ par le filtre.
    reset({ characters: [makeCharacter('H', 50, 'force')], inventory: inv, essence: 0 })
    g().recycleAllBelow(16, true)
    expect(g().inventory).toHaveLength(inv.length) // rien recyclé : tout est utile
    expect(g().essence).toBe(0)
    // Sans le filtre : tout ce qui est sous Transcendant (16) part normalement.
    reset({ characters: [makeCharacter('H', 50, 'force')], inventory: inv, essence: 0 })
    g().recycleAllBelow(16, false)
    expect(g().inventory).toHaveLength(0)
    expect(g().essence).toBeGreaterThan(0)
  })
})
