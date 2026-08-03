import { describe, expect, test } from 'vitest'
import {
	EntityModelType,
	type ActionEntityModel,
	type EntityOwner,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { getEntityRowHeaderDisplay } from '../EntityRowHeaderDisplay.js'

function feedback(props: Partial<FeedbackEntityModel>): SomeEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: 'test',
		definitionId: 'def',
		connectionId: 'conn',
		options: {},
		upgradeIndex: undefined,
		...props,
	}
}

function action(props: Partial<ActionEntityModel>): SomeEntityModel {
	return {
		type: EntityModelType.Action,
		id: 'test',
		definitionId: 'def',
		connectionId: 'conn',
		options: {},
		upgradeIndex: undefined,
		...props,
	}
}

describe('getEntityRowHeaderDisplay', () => {
	test('collapsed named local variable shows the variable name and previews its value', () => {
		const result = getEntityRowHeaderDisplay(feedback({ variableName: 'foo' }), null, 'conn: Def', true, 'local')

		expect(result).toEqual({ headline: '$(local:foo) ', localVariableValueName: 'foo' })
	})

	test('collapsed named local variable includes the headline text after the name', () => {
		const result = getEntityRowHeaderDisplay(
			feedback({ variableName: 'foo', headline: 'My note' }),
			null,
			'conn: Def',
			true,
			'local'
		)

		expect(result).toEqual({ headline: '$(local:foo) My note', localVariableValueName: 'foo' })
	})

	test('respects a non-default local variable prefix', () => {
		const result = getEntityRowHeaderDisplay(feedback({ variableName: 'foo' }), null, 'conn: Def', true, 'page')

		expect(result).toEqual({ headline: '$(page:foo) ', localVariableValueName: 'foo' })
	})

	test('collapsed local variable without a name is labelled Unnamed and has no value to preview', () => {
		const result = getEntityRowHeaderDisplay(feedback({ headline: 'My note' }), null, 'conn: Def', true, 'local')

		expect(result).toEqual({ headline: 'Unnamed: My note', localVariableValueName: null })
	})

	test('expanded local variable falls back to the definition name and previews nothing', () => {
		const result = getEntityRowHeaderDisplay(feedback({ variableName: 'foo' }), null, 'conn: Def', false, 'local')

		expect(result).toEqual({ headline: 'conn: Def', localVariableValueName: null })
	})

	test('nested (owned) local variable is not treated as a top-level local variable', () => {
		const ownerId: EntityOwner = { parentId: 'parent', childGroup: 'group' }
		const result = getEntityRowHeaderDisplay(feedback({ variableName: 'foo' }), ownerId, 'conn: Def', true, 'local')

		expect(result).toEqual({ headline: 'conn: Def', localVariableValueName: null })
	})

	test('regular feedback (no local variable prefix) shows headline or definition name and no value', () => {
		expect(getEntityRowHeaderDisplay(feedback({ variableName: 'foo' }), null, 'conn: Def', true, null)).toEqual({
			headline: 'conn: Def',
			localVariableValueName: null,
		})

		expect(getEntityRowHeaderDisplay(feedback({ headline: 'My feedback' }), null, 'conn: Def', true, null)).toEqual({
			headline: 'My feedback',
			localVariableValueName: null,
		})
	})

	test('actions never show a local variable value preview', () => {
		const result = getEntityRowHeaderDisplay(action({ headline: 'Do thing' }), null, 'conn: Def', true, 'local')

		expect(result).toEqual({ headline: 'Do thing', localVariableValueName: null })
	})
})
