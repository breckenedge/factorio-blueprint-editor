import { describe, expect, it } from 'vitest'
import { History } from './History'

/**
 * History backs undo/redo. Nothing else in the codebase guards it, and the
 * touch toolbar drives undo/redo directly, so these cover the sequences that
 * are easy to break: ordering, the redo branch being dropped after a new
 * action, and transaction nesting.
 */
describe('History', () => {
    const setup = () => {
        const history = new History()
        const target = { value: 0 }
        const set = (v: number, text = `set ${v}`) =>
            history.updateValue(target, 'value', v, text).commit()
        return { history, target, set }
    }

    it('applies a value on commit', () => {
        const { target, set } = setup()
        set(1)
        expect(target.value).toBe(1)
    })

    it('undoes and redoes a single action', () => {
        const { history, target, set } = setup()
        set(1)

        expect(history.undo()).toBe(true)
        expect(target.value).toBe(0)

        expect(history.redo()).toBe(true)
        expect(target.value).toBe(1)
    })

    it('unwinds several actions in reverse order', () => {
        const { history, target, set } = setup()
        set(1)
        set(2)
        set(3)
        expect(target.value).toBe(3)

        history.undo()
        expect(target.value).toBe(2)
        history.undo()
        expect(target.value).toBe(1)
        history.undo()
        expect(target.value).toBe(0)
    })

    it('reports false when there is nothing left to undo or redo', () => {
        const { history, set } = setup()
        expect(history.undo()).toBe(false)

        set(1)
        expect(history.undo()).toBe(true)
        expect(history.undo()).toBe(false)

        expect(history.redo()).toBe(true)
        expect(history.redo()).toBe(false)
    })

    it('discards the redo branch once a new action is committed', () => {
        const { history, target, set } = setup()
        set(1)
        set(2)
        history.undo()
        expect(target.value).toBe(1)

        set(99)
        expect(history.redo()).toBe(false)
        expect(target.value).toBe(99)
    })

    it('treats a nested transaction as one undo step', () => {
        const { history, target } = setup()
        const other = { value: 0 }

        history.startTransaction('both')
        history.updateValue(target, 'value', 1, 'a').commit()
        history.updateValue(other, 'value', 1, 'b').commit()
        history.commitTransaction()

        expect(target.value).toBe(1)
        expect(other.value).toBe(1)

        expect(history.undo()).toBe(true)
        expect(target.value).toBe(0)
        expect(other.value).toBe(0)
        expect(history.undo()).toBe(false)
    })

    it('drops all entries on reset', () => {
        const { history, set } = setup()
        set(1)
        history.reset()
        expect(history.undo()).toBe(false)
        expect(history.redo()).toBe(false)
    })

    it('tracks values held in a Map', () => {
        const history = new History()
        const map = new Map<string, number>()

        history.updateMap(map, 'a', 1, 'set a').commit()
        expect(map.get('a')).toBe(1)

        history.undo()
        expect(map.has('a')).toBe(false)

        history.redo()
        expect(map.get('a')).toBe(1)
    })
})
