import { describe, expect, test } from 'vitest'
import { canAddEntityToFeedbackList } from '../Entity.js'
import type { ClientEntityDefinition } from '../Model/EntityDefinitionModel.js'
import { EntityModelType, FeedbackEntitySubType, SomeEntityModelSchema } from '../Model/EntityModel.js'

function feedbackDefinition(
	feedbackType: FeedbackEntitySubType | null,
	extra: Partial<ClientEntityDefinition> = {}
): ClientEntityDefinition {
	return { feedbackType, ...extra } as ClientEntityDefinition
}

describe('canAddEntityToFeedbackList', () => {
	describe('StyleOverride list (layered button feedbacks)', () => {
		test.each([FeedbackEntitySubType.Boolean, FeedbackEntitySubType.Advanced, FeedbackEntitySubType.Value])(
			'allows %s feedbacks',
			(feedbackType) => {
				expect(canAddEntityToFeedbackList(FeedbackEntitySubType.StyleOverride, feedbackDefinition(feedbackType))).toBe(
					true
				)
			}
		)

		test('rejects feedbacks with no feedbackType', () => {
			expect(canAddEntityToFeedbackList(FeedbackEntitySubType.StyleOverride, feedbackDefinition(null))).toBe(false)
		})

		test.each([FeedbackEntitySubType.Boolean, FeedbackEntitySubType.Advanced, FeedbackEntitySubType.Value])(
			'rejects %s feedbacks that opt out via feedbackStyleOverridesUnsupported',
			(feedbackType) => {
				expect(
					canAddEntityToFeedbackList(
						FeedbackEntitySubType.StyleOverride,
						feedbackDefinition(feedbackType, { feedbackStyleOverridesUnsupported: true })
					)
				).toBe(false)
			}
		)
	})

	describe('Value list (local variable feedbacks)', () => {
		test('allows Value and Boolean feedbacks', () => {
			expect(
				canAddEntityToFeedbackList(FeedbackEntitySubType.Value, feedbackDefinition(FeedbackEntitySubType.Value))
			).toBe(true)
			expect(
				canAddEntityToFeedbackList(FeedbackEntitySubType.Value, feedbackDefinition(FeedbackEntitySubType.Boolean))
			).toBe(true)
		})

		test('still allows a Value feedback that opts out of style overrides (flag only affects the style list)', () => {
			// e.g. internal 'user_value' - blocked from style overrides but still valid as a local variable
			expect(
				canAddEntityToFeedbackList(
					FeedbackEntitySubType.Value,
					feedbackDefinition(FeedbackEntitySubType.Value, { feedbackStyleOverridesUnsupported: true })
				)
			).toBe(true)
		})

		test('rejects Advanced feedbacks', () => {
			expect(
				canAddEntityToFeedbackList(FeedbackEntitySubType.Value, feedbackDefinition(FeedbackEntitySubType.Advanced))
			).toBe(false)
		})
	})

	describe('Boolean list', () => {
		test('allows only Boolean feedbacks', () => {
			expect(
				canAddEntityToFeedbackList(FeedbackEntitySubType.Boolean, feedbackDefinition(FeedbackEntitySubType.Boolean))
			).toBe(true)
			expect(
				canAddEntityToFeedbackList(FeedbackEntitySubType.Boolean, feedbackDefinition(FeedbackEntitySubType.Value))
			).toBe(false)
		})
	})

	describe('null list', () => {
		test('allows everything except Value feedbacks', () => {
			expect(canAddEntityToFeedbackList(null, feedbackDefinition(FeedbackEntitySubType.Boolean))).toBe(true)
			expect(canAddEntityToFeedbackList(null, feedbackDefinition(FeedbackEntitySubType.Advanced))).toBe(true)
			expect(canAddEntityToFeedbackList(null, feedbackDefinition(FeedbackEntitySubType.Value))).toBe(false)
		})
	})
})

describe('SomeEntityModelSchema', () => {
	const action = { type: 'action', id: 'a1', definitionId: 'send', connectionId: 'conn1' }

	test('fills in defaults for an action saved without its optional fields', () => {
		// As stored: an undefined upgradeIndex is dropped by JSON
		expect(SomeEntityModelSchema.parse(action)).toEqual({ ...action, options: {} })
	})

	test('keeps the fields of a feedback', () => {
		const feedback = {
			type: 'feedback',
			id: 'f1',
			definitionId: 'state',
			connectionId: 'conn1',
			options: { mode: { isExpression: false, value: 'on' } },
			upgradeIndex: 2,
			isInverted: { isExpression: false, value: true },
			variableName: 'state',
			styleOverrides: [
				{ overrideId: 'o1', elementId: 'e1', elementProperty: 'color', override: { isExpression: false, value: 1 } },
			],
		}

		expect(SomeEntityModelSchema.parse(feedback)).toEqual(feedback)
	})

	test('parses children recursively', () => {
		const parent = {
			...action,
			connectionId: 'internal',
			children: { default: [{ ...action, id: 'child', children: { inner: [{ ...action, id: 'grandchild' }] } }] },
		}

		const result = SomeEntityModelSchema.parse(parent)

		expect(result.children?.default?.[0].children?.inner?.[0]).toEqual({ ...action, id: 'grandchild', options: {} })
	})

	test('rejects an entity of an unknown type, or missing its identity', () => {
		expect(SomeEntityModelSchema.safeParse({ ...action, type: 'thing' }).success).toBe(false)
		expect(SomeEntityModelSchema.safeParse({ ...action, definitionId: undefined }).success).toBe(false)
		expect(SomeEntityModelSchema.safeParse({ ...action, connectionId: 5 }).success).toBe(false)
	})

	test('rejects an invalid child', () => {
		const parent = { ...action, children: { default: [{ ...action, id: 7 }] } }

		expect(SomeEntityModelSchema.safeParse(parent).success).toBe(false)
	})

	test('action fields are not accepted on a feedback, and the reverse', () => {
		expect(SomeEntityModelSchema.parse({ ...action, variableName: 'x' })).not.toHaveProperty('variableName')
		expect(
			SomeEntityModelSchema.parse({ ...action, type: EntityModelType.Feedback, storeResult: {} })
		).not.toHaveProperty('storeResult')
	})
})
