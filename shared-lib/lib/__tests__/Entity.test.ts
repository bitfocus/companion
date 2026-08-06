import { describe, expect, test } from 'vitest'
import { canAddEntityToFeedbackList } from '../Entity.js'
import type { ClientEntityDefinition } from '../Model/EntityDefinitionModel.js'
import { FeedbackEntitySubType } from '../Model/EntityModel.js'

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
