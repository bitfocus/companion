import { describe, expect, test } from 'vitest'
import {
	EntityModelType,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { EntityListActionContext, LocalVariablesStore, type GetLocalVariableOptions } from '../LocalVariablesStore.js'

const GRID_CONTROL = 'bank:1'
const PAGE_CONTROL = 'page:1'

/** Call getOptions with sensible defaults (grid feedback, internal parser) and return just the values. */
function valuesFor(store: LocalVariablesStore, opts: Partial<GetLocalVariableOptions> = {}) {
	return store
		.getOptions({
			entityType: EntityModelType.Feedback,
			internalParser: true,
			isLocatedInGrid: true,
			actionContext: EntityListActionContext.NotActions,
			...opts,
		})
		.map((c) => c.value)
}

function valueFeedback(overrides: Partial<FeedbackEntityModel> = {}): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: 'e1',
		connectionId: 'internal',
		definitionId: 'x',
		options: {},
		upgradeIndex: undefined,
		variableName: 'foo',
		...overrides,
	}
}

describe('this:surface_id gating', () => {
	const store = new LocalVariablesStore(GRID_CONTROL)

	test('offered for actions', () => {
		expect(valuesFor(store, { entityType: EntityModelType.Action })).toContain('this:surface_id')
	})

	test('offered for feedbacks inside an actions list', () => {
		expect(valuesFor(store, { actionContext: EntityListActionContext.Actions })).toContain('this:surface_id')
	})

	test('NOT offered for feedbacks outside an actions list', () => {
		expect(valuesFor(store, { actionContext: EntityListActionContext.NotActions })).not.toContain('this:surface_id')
	})

	test('NOT offered when the field is not internal-parser', () => {
		expect(valuesFor(store, { actionContext: EntityListActionContext.Actions, internalParser: false })).not.toContain(
			'this:surface_id'
		)
	})

	test('NOT offered off the grid (e.g. a trigger), even for an action', () => {
		expect(valuesFor(store, { entityType: EntityModelType.Action, isLocatedInGrid: false })).not.toContain(
			'this:surface_id'
		)
	})
})

describe('this:delta gating', () => {
	const store = new LocalVariablesStore(GRID_CONTROL)

	test('offered for actions in a rotary action set', () => {
		expect(
			valuesFor(store, { entityType: EntityModelType.Action, actionContext: EntityListActionContext.RotaryActions })
		).toContain('this:delta')
	})

	test('offered for feedbacks nested under a rotary action', () => {
		expect(valuesFor(store, { actionContext: EntityListActionContext.RotaryActions })).toContain('this:delta')
	})

	test('NOT offered for actions outside a rotary set (e.g. press/release)', () => {
		const values = valuesFor(store, {
			entityType: EntityModelType.Action,
			actionContext: EntityListActionContext.Actions,
		})
		expect(values).not.toContain('this:delta')
		// surface_id is still offered for non-rotary actions
		expect(values).toContain('this:surface_id')
	})

	test('NOT offered when the field is not internal-parser', () => {
		expect(
			valuesFor(store, {
				entityType: EntityModelType.Action,
				actionContext: EntityListActionContext.RotaryActions,
				internalParser: false,
			})
		).not.toContain('this:delta')
	})
})

describe('fixed variable sets', () => {
	test('a grid control offers the location variables', () => {
		const values = valuesFor(new LocalVariablesStore(GRID_CONTROL))
		expect(values).toEqual(expect.arrayContaining(['this:page', 'this:row', 'this:column', 'this:location']))
		// surface_id is gated separately and off by default
		expect(values).not.toContain('this:surface_id')
	})

	test('a page control offers only the page variables', () => {
		const values = valuesFor(new LocalVariablesStore(PAGE_CONTROL), { isLocatedInGrid: false })
		expect(values).toEqual(expect.arrayContaining(['this:page', 'this:page_name']))
		expect(values).not.toContain('this:row')
		expect(values).not.toContain('this:surface_id')
	})

	test('an off-grid, non-page control offers no fixed variables', () => {
		expect(valuesFor(new LocalVariablesStore(GRID_CONTROL), { isLocatedInGrid: false })).toHaveLength(0)
	})
})

describe('local variables from the control entities', () => {
	test('exposes value-feedbacks with a variableName as local:*', () => {
		const store = new LocalVariablesStore(GRID_CONTROL)
		store.setEntities([valueFeedback({ id: 'a', variableName: 'foo' })])
		expect(valuesFor(store)).toContain('local:foo')
	})

	test('skips disabled, unnamed and non-feedback entities', () => {
		const store = new LocalVariablesStore(GRID_CONTROL)
		store.setEntities([
			valueFeedback({ id: 'a', variableName: 'named' }),
			valueFeedback({ id: 'b', variableName: undefined }),
			valueFeedback({ id: 'c', variableName: 'hidden', disabled: true }),
			{
				type: EntityModelType.Action,
				id: 'd',
				connectionId: 'internal',
				definitionId: 'x',
				options: {},
				upgradeIndex: undefined,
			} satisfies SomeEntityModel,
		])

		const localValues = valuesFor(store).filter((v) => String(v).startsWith('local:'))
		expect(localValues).toEqual(['local:named'])
	})

	test('uses the headline as the label, falling back to the variable name', () => {
		const store = new LocalVariablesStore(GRID_CONTROL)
		store.setEntities([
			valueFeedback({ id: 'a', variableName: 'foo', headline: 'My Foo' }),
			valueFeedback({ id: 'b', variableName: 'bar', headline: undefined }),
		])

		const options = store.getOptions({
			entityType: EntityModelType.Feedback,
			internalParser: true,
			isLocatedInGrid: true,
			actionContext: EntityListActionContext.NotActions,
		})
		expect(options.find((o) => o.value === 'local:foo')?.label).toBe('My Foo')
		expect(options.find((o) => o.value === 'local:bar')?.label).toBe('bar')
	})

	test('a page control exposes its own entities under the page namespace', () => {
		const store = new LocalVariablesStore(PAGE_CONTROL)
		store.setEntities([valueFeedback({ id: 'a', variableName: 'foo' })])
		expect(valuesFor(store, { isLocatedInGrid: false })).toContain('page:foo')
	})
})

describe('page variables', () => {
	test("exposes the page's variables under the page namespace", () => {
		const store = new LocalVariablesStore(GRID_CONTROL)
		store.setPageVariables([valueFeedback({ id: 'p', variableName: 'bar' })])
		expect(valuesFor(store)).toContain('page:bar')
	})
})
