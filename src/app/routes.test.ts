import { describe, expect, it } from 'vitest'
import { YOU_SECTIONS, isYouSection, routes } from '@/app/routes'

describe('routes', () => {
  it('has a page for your plan under You, listed first', () => {
    expect(isYouSection('plan')).toBe(true)
    expect(routes.youSection('plan')).toBe('/you/plan')
    expect(YOU_SECTIONS[0]).toBe('plan')
  })

  it('knows the other sections and nothing else', () => {
    for (const section of ['money', 'reminders', 'notifications', 'linked', 'conversations']) {
      expect(isYouSection(section)).toBe(true)
    }
    expect(isYouSection('settings')).toBe(false)
    expect(routes.youSection()).toBe('/you/:section')
  })
})
