import { describe, it, expect, beforeEach } from 'vitest'
import { g, reset } from './_helpers'

describe('liveopsSlice', () => {
  beforeEach(() => reset())

  it('buyUpgrade monte un niveau d\'amélioration (ressources suffisantes), no-op si inconnu', () => {
    reset({ gold: 1e9, essence: 1e9, poussiere: 1e9 })
    g().buyUpgrade('goldGain')
    expect(g().upgrades.goldGain).toBe(1)
    expect(g().gold).toBeLessThan(1e9)
    g().buyUpgrade('upgrade_inexistant')
    expect(g().upgrades.upgrade_inexistant).toBeUndefined()
  })

  it('buyUpgrade est un no-op si l\'or est insuffisant', () => {
    reset({ gold: 0, essence: 0, poussiere: 0 })
    g().buyUpgrade('goldGain')
    expect(g().upgrades.goldGain ?? 0).toBe(0)
  })

  it('refreshShop régénère l\'échoppe contre de l\'or', () => {
    reset({ gold: 1e9, bestStage: 10 })
    g().refreshShop()
    expect(g().shopStock.length).toBeGreaterThan(0)
    expect(g().gold).toBeLessThan(1e9)
  })

  it('markInboxSeen marque tous les messages comme lus', () => {
    expect(g().inbox.some((m) => !m.seen)).toBe(true) // freshSave : message de bienvenue non lu
    g().markInboxSeen()
    expect(g().inbox.every((m) => m.seen)).toBe(true)
  })

  it('claimInbox crédite la récompense et marque réclamé', () => {
    const msg = { id: 'm1', kind: 'cadeau', icon: '🎁', title: 'Test', reward: { gold: 500 }, seen: false, createdAt: Date.now(), claimed: false }
    reset({ inbox: [msg as never], gold: 0 })
    g().claimInbox('m1')
    expect(g().gold).toBe(500)
    expect(g().inbox.find((m) => m.id === 'm1')?.claimed).toBe(true)
    // 2e claim → no-op (déjà réclamé)
    g().claimInbox('m1')
    expect(g().gold).toBe(500)
  })
})
