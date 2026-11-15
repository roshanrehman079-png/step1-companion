import { describe, expect, it } from 'vitest'
import { catSvgInner, type CatMood, type Stage } from './catArt'
import expected from './catArt.fixture.json'

describe('cat art matches the design sheet', () => {
  it('every stage and mood is identical to the source drawing', () => {
    for (const [key, svg] of Object.entries(expected as Record<string, string>)) {
      const [mood, stage] = key.split('|') as [CatMood, Stage]
      expect(catSvgInner(mood, stage)).toBe(svg)
    }
  })
})
