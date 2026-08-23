import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import FD, { loadData } from './factorioData'
import { getSpriteData } from './spriteDataBuilder'

/**
 * getSpriteData is called for every entity of a blueprint before anything is drawn, so an
 * entity type without a sprite generator must degrade to a placeholder rather than throw and
 * take the whole render down with it.
 */
describe('placeholder graphics', () => {
    beforeAll(() => {
        loadData(readFileSync(join(__dirname, '../../../exporter/data/output/data.json'), 'utf8'))
    })

    const spritesFor = (name: string, dir = 0) =>
        getSpriteData({
            dir,
            name,
            position: { x: 0, y: 0 },
        } as Parameters<typeof getSpriteData>[0])

    const isPlaceholderBox = (data: { filename?: string }) =>
        data.filename === '__core__/graphics/white-square.png'

    it.each(['locomotive', 'cargo-wagon', 'fluid-wagon', 'artillery-wagon'])(
        'draws %s as a placeholder instead of throwing',
        name => {
            const sprites = spritesFor(name)
            expect(sprites.filter(isPlaceholderBox)).toHaveLength(2)
        }
    )

    it('sizes the placeholder box to the entity footprint', () => {
        const [border, fill] = spritesFor('locomotive').filter(isPlaceholderBox)

        // locomotive is 2x6 tiles, the fill is inset by the border width on each side
        expect(border.scaleX * border.width).toBe(2 * 32)
        expect(border.scaleY * border.height).toBe(6 * 32)
        expect(fill.scaleX * fill.width).toBe(2 * 32 - 4)
        expect(fill.scaleY * fill.height).toBe(6 * 32 - 4)
    })

    it('rotates the placeholder box with the entity direction', () => {
        expect(spritesFor('locomotive', 0)[0].rotAngle).toBe(0)
        expect(spritesFor('locomotive', 4)[0].rotAngle).toBe(90)
        // diagonals would make getEntitySize throw if the size were swapped per direction
        expect(spritesFor('locomotive', 6)[0].rotAngle).toBe(135)
    })

    it('puts the entity icon on top of the placeholder box', () => {
        const sprites = spritesFor('cargo-wagon')
        const icon = sprites[sprites.length - 1]

        expect(icon.filename).toBe(FD.entities['cargo-wagon'].icon)
    })

    it('still uses the real generator for an implemented entity', () => {
        expect(spritesFor('transport-belt').some(isPlaceholderBox)).toBe(false)
    })
})
