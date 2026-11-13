import { describe, expect, it, vi } from 'vitest'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import type { InternalController } from '../../../lib/Internal/Controller.js'
import { VisitorReferencesCollector } from '../../../lib/Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdater } from '../../../lib/Resources/Visitors/ReferencesUpdater.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function mockInternalModule() {
	return {
		visitReferences: vi.fn(),
		checkFeedbacksById: vi.fn(),
	}
}

function asInternal(mock: ReturnType<typeof mockInternalModule>): InternalController {
	return mock as unknown as InternalController
}

function makeCollector(internalModule = mockInternalModule()) {
	const collector = new VisitorReferencesCollector(
		asInternal(internalModule),
		undefined,
		undefined,
		undefined,
		undefined
	)
	return { collector, internalModule }
}

function makeUpdater(
	labelRemap: Record<string, string> | undefined,
	idRemap: Record<string, string> | undefined,
	internalModule = mockInternalModule()
) {
	const updater = new VisitorReferencesUpdater(asInternal(internalModule), labelRemap, idRemap, undefined)
	return { updater, internalModule }
}

function makeAction(overrides: Partial<ActionEntityModel> = {}): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: 'action-1',
		definitionId: 'some-action',
		connectionId: 'conn-1',
		options: {},
		upgradeIndex: undefined,
		...overrides,
	}
}

function makeFeedback(overrides: Partial<FeedbackEntityModel> = {}): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: 'feedback-1',
		definitionId: 'some-feedback',
		connectionId: 'conn-1',
		options: {},
		upgradeIndex: undefined,
		...overrides,
	}
}

function makeInstance(id: string): ControlEntityInstance {
	return { id, visitReferences: vi.fn() } as unknown as ControlEntityInstance
}

function elements(...els: any[]): SomeButtonGraphicsElement[] {
	return els as SomeButtonGraphicsElement[]
}

// ─── visitEntityInstances ───────────────────────────────────────────────────

describe('VisitorReferencesBase – visitEntityInstances', () => {
	it('passes the instances to the internal module, with no models', () => {
		const { collector, internalModule } = makeCollector()
		const instances = [makeInstance('a'), makeInstance('b')]

		collector.visitEntityInstances(instances)

		expect(internalModule.visitReferences).toHaveBeenCalledTimes(1)
		expect(internalModule.visitReferences).toHaveBeenCalledWith(collector['visitor'], [], instances)
	})

	it('asks each instance to visit itself, without recursing', () => {
		const { collector } = makeCollector()
		const instances = [makeInstance('a'), makeInstance('b')]

		collector.visitEntityInstances(instances)

		for (const instance of instances) {
			expect(instance.visitReferences).toHaveBeenCalledTimes(1)
			expect(instance.visitReferences).toHaveBeenCalledWith(collector['visitor'])
		}
	})

	it('handles an empty list', () => {
		const { collector, internalModule } = makeCollector()

		expect(collector.visitEntityInstances([])).toBe(collector)
		expect(internalModule.visitReferences).toHaveBeenCalledWith(collector['visitor'], [], [])
	})
})

// ─── visitEntityModels ──────────────────────────────────────────────────────

describe('VisitorReferencesBase – visitEntityModels', () => {
	it('passes the flattened models to the internal module, with no instances', () => {
		const { collector, internalModule } = makeCollector()
		const child = makeAction({ id: 'child', connectionId: 'conn-2' })
		const parent = makeAction({ id: 'parent', connectionId: 'internal', children: { default: [child] } })
		const sibling = makeFeedback({ id: 'sibling' })

		collector.visitEntityModels([parent, sibling])

		expect(internalModule.visitReferences).toHaveBeenCalledTimes(1)
		expect(internalModule.visitReferences).toHaveBeenCalledWith(collector['visitor'], [parent, child, sibling], [])
	})

	it('recurses through nested internal children and every child group', () => {
		const { collector } = makeCollector()
		const grandchild = makeAction({ id: 'gc', connectionId: 'conn-gc' })
		const childA = makeAction({ id: 'a', connectionId: 'internal', children: { inner: [grandchild] } })
		const childB = makeAction({ id: 'b', connectionId: 'conn-b' })
		const parent = makeAction({
			id: 'parent',
			connectionId: 'internal',
			children: { first: [childA], second: [childB], empty: undefined },
		})

		collector.visitEntityModels([parent])

		expect(collector['visitor'].connectionIds).toEqual(new Set(['internal', 'conn-gc', 'conn-b']))
	})

	it('does not recurse into children of a non-internal entity', () => {
		const { collector, internalModule } = makeCollector()
		const child = makeAction({ id: 'child', connectionId: 'conn-child' })
		const parent = makeAction({ id: 'parent', connectionId: 'conn-parent', children: { default: [child] } })

		collector.visitEntityModels([parent])

		expect(internalModule.visitReferences).toHaveBeenCalledWith(collector['visitor'], [parent], [])
		expect(collector['visitor'].connectionIds).toEqual(new Set(['conn-parent']))
	})

	it('collects connection ids and variables from options', () => {
		const { collector } = makeCollector()

		collector.visitEntityModels([
			makeAction({
				connectionId: 'conn-1',
				options: { wrapped: exprVal('text $(a:one)'), expr: exprExpr('$(b:two) + 1'), num: exprVal(5) },
			}),
		])

		const visitor = collector['visitor']
		expect(visitor.connectionIds).toEqual(new Set(['conn-1']))
		expect(visitor.variables).toEqual(new Set(['a:one', 'b:two']))
	})

	it('rewrites legacy unwrapped options', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const options: Record<string, any> = { plain: 'text $(old:x)', num: 5 }

		updater.visitEntityModels([makeAction({ options })])

		expect(options).toEqual({ plain: 'text $(new:x)', num: 5 })
	})

	it('collects variables from feedback style overrides', () => {
		const { collector } = makeCollector()

		collector.visitEntityModels([
			makeFeedback({
				styleOverrides: [
					{ overrideId: 'o1', elementId: 'e1', elementProperty: 'text', override: exprExpr('$(a:style)') },
				],
			}),
		])

		expect(collector['visitor'].variables).toEqual(new Set(['a:style']))
	})

	it('rewrites models in place and reports changed feedbacks', () => {
		const { updater, internalModule } = makeUpdater({ old: 'new' }, { 'conn-old': 'conn-new' })
		const child = makeFeedback({
			id: 'fb-child',
			connectionId: 'conn-old',
			options: { text: exprVal('$(old:x)') },
			styleOverrides: [{ overrideId: 'o1', elementId: 'e1', elementProperty: 'text', override: exprExpr('$(old:y)') }],
		})
		const parent = makeAction({
			id: 'parent',
			connectionId: 'internal',
			options: { plain: exprVal('$(old:z)') },
			children: { default: [child] },
		})

		updater.visitEntityModels([parent]).recheckChangedFeedbacks()

		expect(parent.options.plain).toEqual(exprVal('$(new:z)'))
		expect(child.connectionId).toBe('conn-new')
		expect(child.options.text).toEqual(exprVal('$(new:x)'))
		expect(child.styleOverrides?.[0].override).toEqual(exprExpr('$(new:y)'))
		expect(updater.hasChanges()).toBe(true)
		expect(internalModule.checkFeedbacksById).toHaveBeenCalledWith('parent', 'fb-child')
	})

	it('handles an empty list', () => {
		const { updater, internalModule } = makeUpdater({ old: 'new' }, undefined)

		expect(updater.visitEntityModels([]).hasChanges()).toBe(false)
		expect(internalModule.visitReferences).toHaveBeenCalledWith(updater['visitor'], [], [])
	})
})

// ─── visitExpressionOrValue ─────────────────────────────────────────────────

describe('VisitorReferencesBase – visitExpressionOrValue', () => {
	it('always visits an expression', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const value = exprExpr('$(old:x)')

		updater.visitExpressionOrValue(value, false)

		expect(value.value).toBe('$(new:x)')
	})

	it('skips a plain string by default', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const value = exprVal('$(old:x)')

		updater.visitExpressionOrValue(value)

		expect(value.value).toBe('$(old:x)')
		expect(updater.hasChanges()).toBe(false)
	})

	it('visits a plain string when asked to', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const value = exprVal('$(old:x)')

		updater.visitExpressionOrValue(value, true)

		expect(value.value).toBe('$(new:x)')
	})

	it('ignores a plain non-string value even when asked to visit plain values', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const value = exprVal(5)

		updater.visitExpressionOrValue(value, true)

		expect(value).toEqual(exprVal(5))
		expect(updater.hasChanges()).toBe(false)
	})
})

// ─── visitDrawElements ──────────────────────────────────────────────────────

describe('VisitorReferencesBase – visitDrawElements', () => {
	it('visits expression and plain string properties', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const els = elements({
			id: 'text1',
			type: 'text',
			name: 'Text',
			text: exprVal('label $(old:a)'),
			color: exprExpr('$(old:b) ? 1 : 2'),
			size: exprVal(12),
		})

		updater.visitDrawElements(els)

		const el = els[0] as any
		expect(el.text).toEqual(exprVal('label $(new:a)'))
		expect(el.color).toEqual(exprExpr('$(new:b) ? 1 : 2'))
		expect(el.size).toEqual(exprVal(12))
	})

	it('skips the id, type and name properties', () => {
		const { collector } = makeCollector()

		collector.visitDrawElements(
			elements({ id: exprVal('$(a:id)'), type: exprVal('$(a:type)'), name: exprVal('$(a:name)') })
		)

		expect(collector['visitor'].variables.size).toBe(0)
	})

	it('ignores properties that are not an ExpressionOrValue', () => {
		const { collector } = makeCollector()

		collector.visitDrawElements(elements({ id: 'e', type: 'box', enabled: true, extra: null, raw: '$(a:raw)' }))

		expect(collector['visitor'].variables.size).toBe(0)
	})

	it('recurses into group children', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const inner = { id: 'inner', type: 'text', text: exprVal('$(old:deep)') }
		const els = elements({
			id: 'outer',
			type: 'group',
			children: [{ id: 'mid', type: 'group', children: [inner] }],
		})

		updater.visitDrawElements(els)

		expect(inner.text).toEqual(exprVal('$(new:deep)'))
	})

	it('remaps the connection id of a composite element', () => {
		const { updater } = makeUpdater(undefined, { 'conn-old': 'conn-new' })
		const els = elements({ id: 'comp', type: 'composite', connectionId: 'conn-old', elementId: 'x' })

		updater.visitDrawElements(els)

		expect((els[0] as any).connectionId).toBe('conn-new')
	})

	it('does not treat connectionId on other element types as a connection', () => {
		const { collector } = makeCollector()

		collector.visitDrawElements(elements({ id: 'b', type: 'box', connectionId: 'conn-1' }))

		expect(collector['visitor'].connectionIds.size).toBe(0)
	})
})

// ─── visitEvents ────────────────────────────────────────────────────────────

describe('VisitorReferencesBase – visitEvents', () => {
	function makeEvent(type: string, options: EventInstance['options']): EventInstance {
		return { id: `ev-${type}`, type, enabled: true, options }
	}

	it('visits every option as a string', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const event = makeEvent('interval', { a: '$(old:x)', b: 'plain', c: 5 })

		updater.visitEvents([event])

		expect(event.options).toEqual({ a: '$(new:x)', b: 'plain', c: 5 })
	})

	it('treats variableId of a variable_changed event as a variable name', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const event = makeEvent('variable_changed', { variableId: 'old:watched' })

		updater.visitEvents([event])

		expect(event.options.variableId).toBe('new:watched')
	})

	it('does not treat variableId of other events as a variable name', () => {
		const { updater } = makeUpdater({ old: 'new' }, undefined)
		const event = makeEvent('interval', { variableId: 'old:watched' })

		updater.visitEvents([event])

		expect(event.options.variableId).toBe('old:watched')
	})

	it('collects from every event', () => {
		const { collector } = makeCollector()

		collector.visitEvents([
			makeEvent('variable_changed', { variableId: 'a:one' }),
			makeEvent('interval', { text: '$(b:two)' }),
		])

		expect(collector['visitor'].variables).toEqual(new Set(['a:one', 'b:two']))
	})
})

// ─── VisitorReferencesUpdater results ───────────────────────────────────────

describe('VisitorReferencesUpdater – recheckChangedFeedbacks / hasChanges', () => {
	it('reports no changes and rechecks nothing when nothing matched', () => {
		const { updater, internalModule } = makeUpdater({ old: 'new' }, undefined)

		updater.visitEntityModels([makeFeedback({ options: { text: exprVal('$(other:x)') } })]).recheckChangedFeedbacks()

		expect(updater.hasChanges()).toBe(false)
		expect(internalModule.checkFeedbacksById).not.toHaveBeenCalled()
	})

	it('reports a change without rechecking when no entity was involved', () => {
		const { updater, internalModule } = makeUpdater({ old: 'new' }, undefined)

		updater.visitDrawElements(elements({ id: 't', type: 'text', text: exprVal('$(old:x)') })).recheckChangedFeedbacks()

		expect(updater.hasChanges()).toBe(true)
		expect(internalModule.checkFeedbacksById).not.toHaveBeenCalled()
	})

	it('accumulates across calls', () => {
		const { updater, internalModule } = makeUpdater({ old: 'new' }, undefined)

		updater
			.visitEntityModels([makeFeedback({ id: 'f1', options: { text: exprVal('$(old:x)') } })])
			.visitEntityModels([makeFeedback({ id: 'f2', options: { text: exprVal('$(old:y)') } })])
			.recheckChangedFeedbacks()

		expect(internalModule.checkFeedbacksById).toHaveBeenCalledWith('f1', 'f2')
	})

	it('chains every visit method', () => {
		const { updater } = makeUpdater(undefined, undefined)
		const entities: SomeEntityModel[] = []

		expect(
			updater
				.visitEntityInstances([])
				.visitEntityModels(entities)
				.visitExpressionOrValue(exprVal(''), false)
				.visitDrawElements([])
				.visitEvents([])
				.recheckChangedFeedbacks()
		).toBe(updater)
	})
})
