import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ControlLocationOption } from '@companion-app/shared/ControlLocation.js'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { SomePresetActionEntry, SomePresetConditionEntry } from '@companion-module/host'
import {
	convertPresetActionEntries,
	convertPresetConditionEntries,
	type PresetEntryConversionContext,
} from '../../../lib/Instance/Connection/Thread/PresetInternalEntities.js'
import { ConvertLayeredPresetFeedbacksToEntities } from '../../../lib/Instance/Connection/Thread/PresetsLayered.js'
import {
	convertActionsDelay,
	convertPresetFeedbacksToEntities,
} from '../../../lib/Instance/Connection/Thread/PresetUtils.js'

// Deterministic nanoid
let nanoidCounter = 0
vi.mock('nanoid', () => ({
	nanoid: vi.fn(() => `mock-id-${++nanoidCounter}`),
}))

const SELF_LOCATION = exprVal(ControlLocationOption.default)

describe('PresetInternalEntities', () => {
	const logger = { warn: vi.fn() }
	const ctx: PresetEntryConversionContext = {
		logger,
		connectionId: 'conn01',
		connectionUpgradeIndex: 5,
		allowInternalEntities: true,
	}

	beforeEach(() => {
		nanoidCounter = 0
		logger.warn.mockClear()
	})

	describe('flat internal actions', () => {
		it('translates internal:wait with a literal time to an expression', () => {
			const entities = convertPresetActionEntries(
				[{ actionId: 'internal:wait', options: { time: 100 } } as SomePresetActionEntry],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({
				type: EntityModelType.Action,
				connectionId: 'internal',
				definitionId: 'wait',
				options: { time: exprExpr('100') },
				upgradeIndex: undefined,
			})
		})

		it('translates internal:wait with an expression wrapper', () => {
			const entities = convertPresetActionEntries(
				[{ actionId: 'internal:wait', options: { time: { value: '$(foo) * 2', isExpression: true } } } as any],
				ctx
			)

			expect(entities[0].options).toEqual({ time: exprExpr('$(foo) * 2') })
		})

		it('translates internal:customLog, passing option values through', () => {
			const entities = convertPresetActionEntries(
				[
					{ actionId: 'internal:customLog', options: { message: 'hello' }, headline: 'Log it' },
					{ actionId: 'internal:customLog', options: { message: { value: '`v=${$(foo)}`', isExpression: true } } },
				] as any[],
				ctx
			)

			expect(entities).toHaveLength(2)
			expect(entities[0]).toMatchObject({
				definitionId: 'custom_log',
				connectionId: 'internal',
				options: { message: exprVal('hello') },
				headline: 'Log it',
			})
			expect(entities[1].options).toEqual({ message: { value: '`v=${$(foo)}`', isExpression: true } })
		})

		it('translates internal:abortButton, remapping keys and injecting the self location', () => {
			const entities = convertPresetActionEntries(
				[{ actionId: 'internal:abortButton', options: { skipReleaseActions: true } } as any],
				ctx
			)

			expect(entities[0]).toMatchObject({
				definitionId: 'panic_bank',
				connectionId: 'internal',
				options: {
					unlatch: exprVal(true),
					location: SELF_LOCATION,
				},
			})
		})

		it('defaults internal:abortButton skipReleaseActions when absent', () => {
			const entities = convertPresetActionEntries([{ actionId: 'internal:abortButton', options: {} } as any], ctx)

			expect(entities[0].options).toEqual({ unlatch: exprVal(false), location: SELF_LOCATION })
			expect(logger.warn).not.toHaveBeenCalled()
		})

		it('rejects an expression wrapper on a non-expression option with a warning', () => {
			const entities = convertPresetActionEntries(
				[
					{
						actionId: 'internal:abortButton',
						options: { skipReleaseActions: { value: '1 > 0', isExpression: true } },
					} as any,
				],
				ctx
			)

			expect(entities[0].options.unlatch).toEqual(exprVal(false))
			expect(logger.warn).toHaveBeenCalledTimes(1)
		})

		it('translates internal:localVariableSet, injecting the self location', () => {
			const entities = convertPresetActionEntries(
				[{ actionId: 'internal:localVariableSet', options: { name: 'myvar', value: '42' } } as any],
				ctx
			)

			expect(entities[0]).toMatchObject({
				definitionId: 'local_variable_set_value',
				connectionId: 'internal',
				options: {
					name: exprVal('myvar'),
					value: exprVal('42'),
					location: SELF_LOCATION,
				},
			})
		})

		it('maps unknown option keys 1:1 for forward compatibility', () => {
			const entities = convertPresetActionEntries(
				[{ actionId: 'internal:wait', options: { time: 100, futureOption: 'abc' } } as any],
				ctx
			)

			expect(entities[0].options.futureOption).toEqual(exprVal('abc'))
		})
	})

	describe('delay handling', () => {
		it('expands delay on internal and module entries into wait actions', () => {
			const entities = convertPresetActionEntries(
				[
					{ actionId: 'mod_action', options: { a: 1 }, delay: 250 },
					{ actionId: 'internal:customLog', options: { message: 'x' }, delay: 500 },
				] as any[],
				ctx
			)

			expect(entities).toHaveLength(4)
			expect(entities[0]).toMatchObject({
				definitionId: 'wait',
				connectionId: 'internal',
				options: { time: exprExpr('250') },
			})
			expect(entities[1]).toMatchObject({
				definitionId: 'mod_action',
				connectionId: 'conn01',
				options: { a: exprVal(1) },
				upgradeIndex: 5,
			})
			expect(entities[2]).toMatchObject({ definitionId: 'wait', options: { time: exprExpr('500') } })
			expect(entities[3]).toMatchObject({ definitionId: 'custom_log' })
		})

		it('dispatches internal entries via convertActionsDelay with relative delays', () => {
			const entities = convertActionsDelay([{ actionId: 'internal:wait', options: { time: 10 } } as any], true, ctx)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({ definitionId: 'wait', connectionId: 'internal' })
		})
	})

	describe('building blocks', () => {
		it('translates internal:actionGroup with defaults', () => {
			const entities = convertPresetActionEntries([{ actionId: 'internal:actionGroup', options: {} } as any], ctx)

			expect(entities[0]).toMatchObject({
				definitionId: 'action_group',
				connectionId: 'internal',
				options: { execution_mode: exprVal('inherit') },
				children: { default: [] },
			})
		})

		it('warns and uses the default for an expression executionMode', () => {
			const entities = convertPresetActionEntries(
				[{ actionId: 'internal:actionGroup', options: { executionMode: { value: 'x', isExpression: true } } } as any],
				ctx
			)

			expect(entities[0].options.execution_mode).toEqual(exprVal('inherit'))
			expect(logger.warn).toHaveBeenCalledTimes(1)
		})

		it('translates mixed children of internal:actionGroup, including nested groups and delays', () => {
			const entities = convertPresetActionEntries(
				[
					{
						actionId: 'internal:actionGroup',
						options: { executionMode: 'sequential' },
						children: {
							default: [
								{ actionId: 'mod_action', options: { a: 1 }, delay: 100 },
								{
									actionId: 'internal:actionGroup',
									options: {},
									children: { default: [{ actionId: 'internal:wait', options: { time: 5 } }] },
								},
							],
						},
					},
				] as any[],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0].options.execution_mode).toEqual(exprVal('sequential'))

			const children = entities[0].children?.default ?? []
			expect(children).toHaveLength(3)
			// delay on the module child becomes a wait inside the group
			expect(children[0]).toMatchObject({ definitionId: 'wait', connectionId: 'internal' })
			expect(children[1]).toMatchObject({ definitionId: 'mod_action', connectionId: 'conn01', upgradeIndex: 5 })
			expect(children[2]).toMatchObject({ definitionId: 'action_group', connectionId: 'internal' })
			expect(children[2].children?.default?.[0]).toMatchObject({ definitionId: 'wait' })
		})

		it('translates internal:logicIf, remapping child slots and always emitting else_actions', () => {
			const entities = convertPresetActionEntries(
				[
					{
						actionId: 'internal:logicIf',
						options: {},
						children: {
							condition: [
								{ feedbackId: 'mod_fb', options: { x: 1 }, isInverted: true },
								{ feedbackId: 'internal:checkExpression', options: { expression: '1 > 0' } },
							],
							actions: [{ actionId: 'internal:customLog', options: { message: 'then' } }],
						},
					},
				] as any[],
				ctx
			)

			const entity = entities[0]
			expect(entity).toMatchObject({ definitionId: 'logic_if', connectionId: 'internal', options: {} })
			expect(Object.keys(entity.children ?? {}).sort()).toEqual(['actions', 'condition', 'else_actions'])
			expect(entity.children?.else_actions).toEqual([])

			const conditions = (entity.children?.condition ?? []) as FeedbackEntityModel[]
			expect(conditions).toHaveLength(2)
			expect(conditions[0]).toMatchObject({
				type: EntityModelType.Feedback,
				definitionId: 'mod_fb',
				connectionId: 'conn01',
				isInverted: exprVal(true),
				upgradeIndex: 5,
			})
			// condition feedbacks never carry a style
			expect('style' in conditions[0]).toBe(false)
			expect(conditions[1]).toMatchObject({
				definitionId: 'check_expression',
				connectionId: 'internal',
				options: { expression: exprExpr('1 > 0') },
				isInverted: exprVal(false),
				upgradeIndex: undefined,
			})

			expect(entity.children?.actions?.[0]).toMatchObject({ definitionId: 'custom_log' })
		})

		it('translates internal:logicWhile', () => {
			const entities = convertPresetActionEntries(
				[
					{
						actionId: 'internal:logicWhile',
						options: {},
						children: {
							condition: [{ feedbackId: 'internal:buttonPushed', options: {} }],
							actions: [{ actionId: 'internal:wait', options: { time: 1 } }],
						},
					},
				] as any[],
				ctx
			)

			const entity = entities[0]
			expect(entity).toMatchObject({ definitionId: 'logic_while', connectionId: 'internal' })
			expect(Object.keys(entity.children ?? {}).sort()).toEqual(['actions', 'condition'])
			expect(entity.children?.condition?.[0]).toMatchObject({
				definitionId: 'bank_pushed',
				options: { latch_compatability: exprVal(false), location: SELF_LOCATION },
			})
		})

		it('translates a nested internal:logicOperator as a condition', () => {
			const conditions = convertPresetConditionEntries(
				[
					{
						feedbackId: 'internal:logicOperator',
						options: { operation: 'or' },
						children: { default: [{ feedbackId: 'internal:checkExpression', options: { expression: '2 > 1' } }] },
						isInverted: true,
					},
				] as SomePresetConditionEntry[],
				ctx,
				0
			)

			expect(conditions).toHaveLength(1)
			expect(conditions[0]).toMatchObject({
				definitionId: 'logic_operator',
				connectionId: 'internal',
				options: { operation: exprVal('or') },
				isInverted: exprVal(true),
			})
			expect('style' in conditions[0]).toBe(false)
			expect('styleOverrides' in conditions[0]).toBe(false)
			expect(conditions[0].children?.default?.[0]).toMatchObject({ definitionId: 'check_expression' })
		})
	})

	describe('simple preset feedbacks', () => {
		it('translates flat internal feedbacks, attaching the style', () => {
			const style = { bgcolor: 16711680 }
			const entities = convertPresetFeedbacksToEntities(
				[
					{ feedbackId: 'internal:buttonPushed', options: { treatSteppedAsPressed: true }, style, isInverted: true },
					{ feedbackId: 'internal:buttonCurrentStep', options: { step: 2 }, style },
				] as any[],
				ctx
			)

			expect(entities).toHaveLength(2)
			expect(entities[0]).toMatchObject({
				definitionId: 'bank_pushed',
				connectionId: 'internal',
				options: { latch_compatability: exprVal(true), location: SELF_LOCATION },
				isInverted: exprVal(true),
				upgradeIndex: undefined,
			})
			expect((entities[0] as any).style).toEqual(style)
			expect(entities[1]).toMatchObject({
				definitionId: 'bank_current_step',
				options: { step: exprVal(2), location: SELF_LOCATION },
				isInverted: exprVal(false),
			})
		})

		it('translates internal:checkExpression', () => {
			const entities = convertPresetFeedbacksToEntities(
				[{ feedbackId: 'internal:checkExpression', options: { expression: '$(foo) > 1' }, style: {} }] as any[],
				ctx
			)

			expect(entities[0]).toMatchObject({
				definitionId: 'check_expression',
				options: { expression: exprExpr('$(foo) > 1') },
			})
		})

		it('translates a top-level internal:logicOperator with a style', () => {
			const style = { color: 255 }
			const entities = convertPresetFeedbacksToEntities(
				[
					{
						feedbackId: 'internal:logicOperator',
						options: {},
						children: { default: [{ feedbackId: 'mod_fb', options: {} }] },
						style,
					},
				] as any[],
				ctx
			)

			expect(entities[0]).toMatchObject({
				definitionId: 'logic_operator',
				options: { operation: exprVal('and') },
			})
			expect((entities[0] as any).style).toEqual(style)
			expect(entities[0].children?.default?.[0]).toMatchObject({ definitionId: 'mod_fb', connectionId: 'conn01' })
		})

		it('still converts module feedbacks unchanged', () => {
			const entities = convertPresetFeedbacksToEntities(
				[{ feedbackId: 'mod_fb', options: { x: 1 }, style: { bgcolor: 2 }, isInverted: false }] as any[],
				ctx
			)

			expect(entities[0]).toMatchObject({
				definitionId: 'mod_fb',
				connectionId: 'conn01',
				options: { x: exprVal(1) },
				upgradeIndex: 5,
			})
			expect((entities[0] as any).style).toEqual({ bgcolor: 2 })
		})
	})

	describe('layered preset feedbacks', () => {
		const override = {
			elementId: 'el1',
			elementProperty: 'color',
			override: { value: 255, isExpression: false },
		}

		it('translates an internal feedback with style overrides', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					{
						feedbackId: 'internal:logicOperator',
						options: { operation: 'xor' },
						children: { default: [{ feedbackId: 'internal:checkExpression', options: { expression: '1 > 0' } }] },
						styleOverrides: [override],
					},
				] as any[],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({
				definitionId: 'logic_operator',
				connectionId: 'internal',
				options: { operation: exprVal('xor') },
			})
			expect(entities[0].styleOverrides).toHaveLength(1)
			expect(entities[0].styleOverrides?.[0]).toMatchObject({
				elementId: 'el1',
				elementProperty: 'color',
				override: { value: 255, isExpression: false },
			})
		})

		it('skips an internal feedback with no valid style overrides', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[{ feedbackId: 'internal:logicOperator', options: {}, children: { default: [] }, styleOverrides: [] }] as any[],
				ctx
			)

			expect(entities).toHaveLength(0)
		})

		it('still converts module feedbacks unchanged', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[{ feedbackId: 'mod_fb', options: { x: 1 }, styleOverrides: [override] }] as any[],
				ctx
			)

			expect(entities[0]).toMatchObject({
				definitionId: 'mod_fb',
				connectionId: 'conn01',
				options: { x: exprVal(1) },
				upgradeIndex: 5,
			})
		})

		it('keeps expression wrappers in module feedback options', () => {
			const entities = ConvertLayeredPresetFeedbacksToEntities(
				[
					{
						feedbackId: 'mod_fb',
						options: { x: { value: '$(foo) + 1', isExpression: true } },
						styleOverrides: [override],
					},
				] as any[],
				ctx
			)

			expect(entities[0].options).toEqual({ x: { value: '$(foo) + 1', isExpression: true } })
		})
	})

	describe('unknown internal ids', () => {
		it('skips an unknown internal action, keeping its siblings', () => {
			const entities = convertPresetActionEntries(
				[
					{ actionId: 'internal:doesNotExist', options: {} },
					{ actionId: 'internal:customLog', options: { message: 'x' } },
				] as any[],
				ctx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({ definitionId: 'custom_log' })
			expect(logger.warn).toHaveBeenCalledTimes(1)
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('internal:doesNotExist'))
		})

		it('skips an unknown internal feedback inside building-block children', () => {
			const entities = convertPresetActionEntries(
				[
					{
						actionId: 'internal:logicIf',
						options: {},
						children: {
							condition: [
								{ feedbackId: 'internal:doesNotExist', options: {} },
								{ feedbackId: 'internal:checkExpression', options: { expression: '1 > 0' } },
							],
							actions: [],
						},
					},
				] as any[],
				ctx
			)

			expect(entities[0].children?.condition).toHaveLength(1)
			expect(logger.warn).toHaveBeenCalledTimes(1)
		})

		it('skips an unknown internal feedback at the top level of a preset', () => {
			const entities = convertPresetFeedbacksToEntities(
				[{ feedbackId: 'internal:doesNotExist', options: {}, style: {} }] as any[],
				ctx
			)

			expect(entities).toHaveLength(0)
			expect(logger.warn).toHaveBeenCalledTimes(1)
		})
	})

	describe('legacy modules (allowInternalEntities: false)', () => {
		const legacyCtx: PresetEntryConversionContext = { ...ctx, allowInternalEntities: false }

		it('does not translate internal action ids, leaving them as module entities', () => {
			const entities = convertActionsDelay(
				[{ actionId: 'internal:wait', options: { time: 100 } } as any],
				true,
				legacyCtx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({
				definitionId: 'internal:wait',
				connectionId: 'conn01',
				upgradeIndex: 5,
			})
			expect(logger.warn).not.toHaveBeenCalled()
		})

		it('does not translate internal feedback ids, leaving them as module entities', () => {
			const entities = convertPresetFeedbacksToEntities(
				[{ feedbackId: 'internal:checkExpression', options: { expression: '1 > 0' }, style: {} }] as any[],
				legacyCtx
			)

			expect(entities).toHaveLength(1)
			expect(entities[0]).toMatchObject({
				definitionId: 'internal:checkExpression',
				connectionId: 'conn01',
				options: { expression: exprVal('1 > 0') },
				upgradeIndex: 5,
			})
			expect(logger.warn).not.toHaveBeenCalled()
		})
	})

	describe('depth guard', () => {
		function makeNestedGroups(levels: number): any {
			const entry: any = { actionId: 'internal:actionGroup', options: {}, children: { default: [] } }
			if (levels > 1) entry.children.default.push(makeNestedGroups(levels - 1))
			return entry
		}

		function measureDepth(entity: ActionEntityModel | undefined): number {
			if (!entity) return 0
			return 1 + measureDepth(entity.children?.default?.[0] as ActionEntityModel | undefined)
		}

		it('keeps nesting up to 10 levels', () => {
			const entities = convertPresetActionEntries([makeNestedGroups(10)], ctx)

			expect(measureDepth(entities[0])).toBe(10)
			expect(logger.warn).not.toHaveBeenCalled()
		})

		it('drops entries nested too deeply, with a warning', () => {
			const entities = convertPresetActionEntries([makeNestedGroups(11)], ctx)

			expect(measureDepth(entities[0])).toBe(10)
			expect(logger.warn).toHaveBeenCalledTimes(1)
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nested too deeply'))
		})
	})
})
