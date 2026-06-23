import { describe, it, expect, beforeEach } from 'vitest'
import {
  partyCombatStep, crescendoBonus, crescendoAdd, crescendoReset, tresorerieShield, clearCooldowns,
} from '../src/game/combatEngine'
import { makeCharacter, charMaxHp } from '../src/game/character'
import { makeEnemy } from '../src/game/enemies'
import { generateItem } from '../src/game/items'
import type { Enemy } from '../src/game/types'

beforeEach(() => { crescendoReset(); clearCooldowns() })

describe('crescendo (compteur de kills)', () => {
  it('part de 0, croît par kill (+1%/kill), plafonne au cap, et se réinitialise', () => {
    expect(crescendoBonus(0.5)).toBe(0)
    crescendoAdd(10)
    expect(crescendoBonus(0.5)).toBeCloseTo(0.1, 5)
    crescendoAdd(100) // total 110 → 1.10, capé à 0.5
    expect(crescendoBonus(0.5)).toBe(0.5)
    crescendoReset()
    expect(crescendoBonus(0.5)).toBe(0)
  })

  it('sans cap, le bonus est nul (knob désactivé)', () => {
    crescendoAdd(50)
    expect(crescendoBonus()).toBe(0)
  })
})

describe('tresorerieShield', () => {
  it('accumule un bouclier d\'absorption plafonné, ignore les héros morts', () => {
    const c = makeCharacter('T', 30, 'force')
    c.absorb = 0
    const cap = 0.1
    tresorerieShield([c], cap)
    expect(c.absorb!).toBeGreaterThan(0)
    expect(c.absorb!).toBeLessThanOrEqual(cap * charMaxHp(c) + 1e-6)
    const dead = makeCharacter('D', 30, 'force')
    dead.hp = 0
    dead.absorb = 0
    tresorerieShield([dead], cap)
    expect(dead.absorb).toBe(0) // mort → pas de bouclier
  })
})

describe('partyCombatStep', () => {
  function gearedHero() {
    const c = makeCharacter('Héros', 50, 'force')
    c.equipment.armePrincipale = generateItem({ type: 'armePrincipale', ilvl: 120, rarity: 'rare' })
    c.hp = charMaxHp(c)
    return c
  }

  it('retourne un résultat bien formé sans muter les entrées', () => {
    const hero = gearedHero()
    const enemy = makeEnemy(1)
    const hpBefore = enemy.hp
    const heroHpBefore = hero.hp
    const r = partyCombatStep([hero], enemy, 0.2)
    expect(r).toHaveProperty('chars')
    expect(r).toHaveProperty('enemy')
    expect(typeof r.anyAlive).toBe('boolean')
    expect(typeof r.totalDealt).toBe('number')
    expect(r.totalDealt).toBeGreaterThanOrEqual(0)
    // Immutabilité : les objets passés en entrée ne sont pas modifiés en place.
    expect(enemy.hp).toBe(hpBefore)
    expect(hero.hp).toBe(heroHpBefore)
  })

  it('inflige des dégâts cumulés à un ennemi qui survit (totalDealt > 0)', () => {
    const hero = gearedHero()
    // PV gonflés artificiellement → l'ennemi survit aux pas, donc les dégâts s'ACCUMULENT
    // (sur un coup fatal, l'excédent part en overkill et totalDealt peut être nul — cf. moteur).
    const tank: Enemy = { ...makeEnemy(1), hp: 1e9 }
    let chars = [hero]
    let enemy = tank
    let dealt = 0
    for (let i = 0; i < 60; i++) {
      const r = partyCombatStep(chars, enemy, 0.2)
      chars = r.chars
      enemy = r.enemy
      dealt += r.totalDealt
    }
    expect(dealt).toBeGreaterThan(0)
    expect(enemy.hp).toBeLessThan(tank.hp)
  })

  it('un héros équipé finit par tuer un ennemi de palier 1', () => {
    const hero = gearedHero()
    let enemy: Enemy = makeEnemy(1)
    const hpStart = enemy.hp
    let chars = [hero]
    let killed = false
    for (let i = 0; i < 600; i++) {
      const r = partyCombatStep(chars, enemy, 0.2)
      chars = r.chars
      enemy = r.enemy
      if (enemy.hp <= 0) { killed = true; break }
      if (!r.anyAlive) break
    }
    expect(enemy.hp).toBeLessThan(hpStart)
    expect(killed).toBe(true)
  })
})
