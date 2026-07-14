import { describe, it, expect } from 'vitest'

describe('Project setup', () => {
  it('should have a working test environment', () => {
    expect(1 + 1).toBe(2)
  })

  it('should support TypeScript', () => {
    const greeting: string = 'Wind Blade Inspection'
    expect(greeting).toContain('Wind')
  })
})
