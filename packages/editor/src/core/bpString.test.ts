import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflate as zlibDeflate } from 'node:zlib'
import { promisify } from 'node:util'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadData } from './factorioData'
import { Blueprint } from './Blueprint'
import { encode, getBlueprintOrBookFromSource } from './bpString'

/**
 * Import and export are the whole of the mobile use case: a blueprint gets in
 * as a string and comes back out as one. A silent break here does not surface
 * until someone pastes a real factory in and gets the wrong thing back.
 */
const deflate = async (str: string): Promise<string> =>
    (await promisify(zlibDeflate)(Buffer.from(str, 'utf8'))).toString('base64')

describe('blueprint string round-trip', () => {
    beforeAll(() => {
        const data = readFileSync(
            join(__dirname, '../../../exporter/data/output/data.json'),
            'utf8'
        )
        loadData(data)
    })

    const buildBlueprint = (): Blueprint => {
        const bp = new Blueprint()
        bp.name = 'round-trip fixture'
        bp.createEntity({ name: 'transport-belt', position: { x: 0.5, y: 0.5 }, direction: 0 })
        bp.createEntity({ name: 'transport-belt', position: { x: 1.5, y: 0.5 }, direction: 0 })
        bp.createEntity({ name: 'fast-inserter', position: { x: 2.5, y: 0.5 }, direction: 4 })
        return bp
    }

    it('preserves entities through encode then decode', async () => {
        const original = buildBlueprint()
        const encoded = await encode(original)

        expect(typeof encoded).toBe('string')
        expect(encoded.startsWith('0')).toBe(true)

        const decoded = await getBlueprintOrBookFromSource(encoded)
        expect(decoded).toBeInstanceOf(Blueprint)

        const bp = decoded as Blueprint
        expect(bp.name).toBe('round-trip fixture')

        const names = (b: Blueprint) =>
            b.entities
                .valuesArray()
                .map(e => e.name)
                .sort()
        expect(names(bp)).toEqual(names(original))
    })

    it('preserves relative layout and directions', async () => {
        const original = buildBlueprint()
        const decoded = (await getBlueprintOrBookFromSource(await encode(original))) as Blueprint

        // Encoding re-centres a blueprint's coordinates, so absolute positions
        // legitimately shift. What must survive is the shape: each entity's
        // offset from the top-left corner of the blueprint, and its direction.
        const shapeOf = (b: Blueprint): string[] => {
            const entities = b.entities.valuesArray()
            const minX = Math.min(...entities.map(e => e.position.x))
            const minY = Math.min(...entities.map(e => e.position.y))
            return entities
                .map(e => `${e.name}@${e.position.x - minX},${e.position.y - minY}:${e.direction}`)
                .sort()
        }

        expect(shapeOf(decoded)).toEqual(shapeOf(original))
    })

    it('survives a second round-trip unchanged', async () => {
        const once = await encode(buildBlueprint())
        const twice = await encode((await getBlueprintOrBookFromSource(once)) as Blueprint)

        const entitiesOf = async (s: string) =>
            ((await getBlueprintOrBookFromSource(s)) as Blueprint).entities
                .valuesArray()
                .map(e => e.name)
                .sort()

        expect(await entitiesOf(twice)).toEqual(await entitiesOf(once))
    })

    it('migrates entity names renamed by Factorio 2.0', async () => {
        // Blueprints exported before 2.0 carry old names. decode() rewrites them
        // on the way in; without that pass the entity is unknown and the
        // blueprint fails to load. Built by hand because createEntity only
        // accepts names that still exist.
        const legacy = {
            blueprint: {
                item: 'blueprint',
                label: 'legacy names',
                version: 281479275151360,
                icons: [{ signal: { type: 'item', name: 'fast-inserter' }, index: 1 }],
                entities: [
                    {
                        entity_number: 1,
                        name: 'filter-inserter',
                        position: { x: 0.5, y: 0.5 },
                    },
                    {
                        entity_number: 2,
                        name: 'logistic-chest-storage',
                        position: { x: 1.5, y: 0.5 },
                    },
                ],
            },
        }
        const encoded = `0${await deflate(JSON.stringify(legacy))}`

        const bp = (await getBlueprintOrBookFromSource(encoded)) as Blueprint
        const names = bp.entities
            .valuesArray()
            .map(e => e.name)
            .sort()

        expect(names).toEqual(['fast-inserter', 'storage-chest'])
    })

    it('resolves a raw string source without any network access', async () => {
        // bpString short-circuits sources beginning with '0', which is the path
        // that works without a CORS proxy.
        const encoded = await encode(buildBlueprint())
        await expect(getBlueprintOrBookFromSource(encoded)).resolves.toBeInstanceOf(Blueprint)
    })
})
