import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadData } from './factorioData'
import { Blueprint } from './Blueprint'

/**
 * PositionGrid answers "which entity is at this tile". updateHoverContainer()
 * calls getEntityAtPosition on every pointer move, and the selection rework
 * will call it on every tap, so a regression here breaks selection outright.
 */
describe('PositionGrid', () => {
    beforeAll(() => {
        loadData(readFileSync(join(__dirname, '../../../exporter/data/output/data.json'), 'utf8'))
    })

    const blueprintWith = (...entities: { name: string; x: number; y: number }[]): Blueprint => {
        const bp = new Blueprint()
        for (const e of entities) {
            bp.createEntity({ name: e.name, position: { x: e.x, y: e.y }, direction: 0 })
        }
        return bp
    }

    it('finds a one-tile entity at its own position', () => {
        const bp = blueprintWith({ name: 'transport-belt', x: 0.5, y: 0.5 })
        const found = bp.entityPositionGrid.getEntityAtPosition({ x: 0, y: 0 })

        expect(found).toBeDefined()
        expect(found.name).toBe('transport-belt')
    })

    it('returns undefined on an empty tile', () => {
        const bp = blueprintWith({ name: 'transport-belt', x: 0.5, y: 0.5 })
        expect(bp.entityPositionGrid.getEntityAtPosition({ x: 5, y: 5 })).toBeUndefined()
    })

    it('finds a multi-tile entity from every tile it covers', () => {
        // An assembling machine occupies 3x3, centred on its position.
        const bp = blueprintWith({ name: 'assembling-machine-1', x: 1.5, y: 1.5 })

        for (let x = 0; x <= 2; x++) {
            for (let y = 0; y <= 2; y++) {
                const found = bp.entityPositionGrid.getEntityAtPosition({ x, y })
                expect(found, `expected an entity at ${x},${y}`).toBeDefined()
                expect(found.name).toBe('assembling-machine-1')
            }
        }
    })

    it('does not report a multi-tile entity outside its footprint', () => {
        const bp = blueprintWith({ name: 'assembling-machine-1', x: 1.5, y: 1.5 })
        expect(bp.entityPositionGrid.getEntityAtPosition({ x: 3, y: 3 })).toBeUndefined()
    })

    it('distinguishes between adjacent entities', () => {
        const bp = blueprintWith(
            { name: 'transport-belt', x: 0.5, y: 0.5 },
            { name: 'fast-inserter', x: 1.5, y: 0.5 }
        )

        expect(bp.entityPositionGrid.getEntityAtPosition({ x: 0, y: 0 }).name).toBe(
            'transport-belt'
        )
        expect(bp.entityPositionGrid.getEntityAtPosition({ x: 1, y: 0 }).name).toBe('fast-inserter')
    })

    it('reports an area as unavailable once occupied', () => {
        const bp = blueprintWith({ name: 'assembling-machine-1', x: 1.5, y: 1.5 })
        const grid = bp.entityPositionGrid

        expect(grid.isAreaAvailable('transport-belt', { x: 1.5, y: 1.5 })).toBe(false)
        expect(grid.isAreaAvailable('transport-belt', { x: 10.5, y: 10.5 })).toBe(true)
    })
})
