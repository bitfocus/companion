import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
	EntityModelType,
	type ActionEntityModel,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExportControlv6, ExportTriggerContentv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { ExpressionVariableModel } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import {
	fixupEntitiesRecursive,
	fixupExpressionVariableControl,
	fixupLayeredButtonControl,
	fixupPageVariables,
	fixupPresetReferenceControl,
	fixupTriggerControl,
	type InstanceAppliedRemappings,
} from '../../lib/ImportExport/ImportFixup.js'
import type { InternalController } from '../../lib/Internal/Controller.js'
import type { Logger } from '../../lib/Log/Controller.js'
import { VisitorReferencesUpdater } from '../../lib/Resources/Visitors/ReferencesUpdater.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * The fixup helpers depend on a VisitorReferencesUpdater, which calls
 * `InternalController.visitReferences` to fix up references inside `internal`
 * connection entities. None of the ImportFixup logic under test lives there, so
 * a no-op mock is sufficient. Variable-reference ($(label:var)) and connectionId
 * remapping on the entity itself are handled by the generic visitor, not by the
 * internal module, so they are still exercised with this mock.
 */
function mockInternalModule(): InternalController {
	return {
		visitReferences: vi.fn(),
	} as unknown as InternalController
}

function mockLogger(): Logger {
	return {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	} as unknown as Logger
}

function makeAction(overrides: Partial<ActionEntityModel> = {}): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: 'action-1',
		definitionId: 'some-action',
		connectionId: 'conn-old',
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
		connectionId: 'conn-old',
		options: {},
		upgradeIndex: undefined,
		...overrides,
	}
}

/** A common remap: conn-old -> conn-new, label OldLabel -> NewLabel, plus the internal entries */
function standardMap(): InstanceAppliedRemappings {
	return {
		'conn-old': { id: 'conn-new', label: 'NewLabel', lastUpgradeIndex: 3, oldLabel: 'OldLabel' },
		internal: { id: 'internal', label: 'internal' },
	}
}

// ── fixupEntitiesRecursive ──────────────────────────────────────────────────────

describe('fixupEntitiesRecursive', () => {
	test('remaps connectionId and upgradeIndex from the instance map', () => {
		const result = fixupEntitiesRecursive(standardMap(), [makeAction({ connectionId: 'conn-old', upgradeIndex: 0 })])

		expect(result).toHaveLength(1)
		expect(result[0].connectionId).toBe('conn-new')
		expect(result[0].upgradeIndex).toBe(3)
	})

	test('sets upgradeIndex to undefined when the instance has no lastUpgradeIndex (e.g. internal)', () => {
		const result = fixupEntitiesRecursive(standardMap(), [makeAction({ connectionId: 'internal', upgradeIndex: 7 })])

		expect(result[0].connectionId).toBe('internal')
		expect(result[0].upgradeIndex).toBeUndefined()
	})

	test('drops entities whose connection is not present in the map', () => {
		const result = fixupEntitiesRecursive(standardMap(), [
			makeAction({ id: 'keep', connectionId: 'conn-old' }),
			makeAction({ id: 'drop', connectionId: 'totally-unknown' }),
		])

		expect(result.map((e) => e.id)).toEqual(['keep'])
	})

	test('skips falsy entries in the input array', () => {
		const result = fixupEntitiesRecursive(standardMap(), [
			null as unknown as SomeEntityModel,
			makeAction({ id: 'keep' }),
			undefined as unknown as SomeEntityModel,
		])

		expect(result.map((e) => e.id)).toEqual(['keep'])
	})

	test('keeps entities mapped to the _ignore placeholder connection', () => {
		// #importInstances maps ignored connections to a literal '_ignore' id rather than dropping them
		const map: InstanceAppliedRemappings = {
			'conn-old': { id: '_ignore', label: 'Ignore' },
		}
		const result = fixupEntitiesRecursive(map, [makeAction({ connectionId: 'conn-old' })])

		expect(result).toHaveLength(1)
		expect(result[0].connectionId).toBe('_ignore')
	})

	test('recurses into children of internal entities, remapping each child', () => {
		const entity = makeAction({
			connectionId: 'internal',
			children: {
				default: [makeAction({ id: 'child', connectionId: 'conn-old' })],
			},
		})

		const result = fixupEntitiesRecursive(standardMap(), [entity])

		expect(result[0].children?.default).toHaveLength(1)
		expect(result[0].children?.default?.[0].connectionId).toBe('conn-new')
		expect(result[0].children?.default?.[0].upgradeIndex).toBe(3)
	})

	test('drops children whose connection is unknown', () => {
		const entity = makeAction({
			connectionId: 'internal',
			children: {
				default: [
					makeAction({ id: 'keep', connectionId: 'conn-old' }),
					makeAction({ id: 'drop', connectionId: 'unknown' }),
				],
			},
		})

		const result = fixupEntitiesRecursive(standardMap(), [entity])

		expect(result[0].children?.default?.map((e) => e.id)).toEqual(['keep'])
	})

	test('skips undefined child groups', () => {
		const entity = makeAction({
			connectionId: 'internal',
			children: {
				default: [makeAction({ connectionId: 'conn-old' })],
				empty: undefined,
			},
		})

		const result = fixupEntitiesRecursive(standardMap(), [entity])

		expect(Object.keys(result[0].children ?? {})).toEqual(['default'])
	})

	test('non-internal entities never carry children through (children forced undefined)', () => {
		// Only `internal` entities may have children; a stray children prop on an external
		// entity is intentionally discarded.
		const entity = makeAction({
			connectionId: 'conn-old',
			children: { default: [makeAction({ connectionId: 'conn-old' })] },
		})

		const result = fixupEntitiesRecursive(standardMap(), [entity])

		expect(result[0].children).toBeUndefined()
	})

	test('legacy bitfocus-companion entities are remapped to the internal connection id', () => {
		// #importInstances maps the legacy 'bitfocus-companion' id to 'internal'. These entities
		// predate the children feature by years, so child recursion (keyed on the original
		// 'internal' id) intentionally does not apply to them.
		const map: InstanceAppliedRemappings = {
			'bitfocus-companion': { id: 'internal', label: 'internal' },
		}
		const entity = makeAction({ connectionId: 'bitfocus-companion' })

		const result = fixupEntitiesRecursive(map, [entity])

		expect(result[0].connectionId).toBe('internal')
	})

	test('does not mutate the input entities', () => {
		const entity = makeAction({ connectionId: 'conn-old', upgradeIndex: 0 })
		const snapshot = structuredClone(entity)

		fixupEntitiesRecursive(standardMap(), [entity])

		expect(entity).toEqual(snapshot)
	})
})

// ── fixupTriggerControl ─────────────────────────────────────────────────────────

describe('fixupTriggerControl', () => {
	let internalModule: InternalController
	beforeEach(() => {
		internalModule = mockInternalModule()
	})

	function makeTrigger(overrides: Partial<ExportTriggerContentv6> = {}): ExportTriggerContentv6 {
		return {
			type: 'trigger',
			options: { name: 'My Trigger', enabled: true, sortOrder: 0 },
			actions: [],
			condition: [],
			events: [],
			localVariables: [],
			...overrides,
		}
	}

	test('produces a well-formed TriggerModel with all collections defaulting to empty arrays', () => {
		const result = fixupTriggerControl(internalModule, makeTrigger(), standardMap(), undefined)

		expect(result.type).toBe('trigger')
		expect(result.actions).toEqual([])
		expect(result.condition).toEqual([])
		expect(result.localVariables).toEqual([])
		expect(result.events).toEqual([])
	})

	test('clones options rather than aliasing the input', () => {
		const control = makeTrigger()
		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(result.options).toEqual(control.options)
		expect(result.options).not.toBe(control.options)
	})

	test('remaps connectionId on actions, condition and localVariables', () => {
		const control = makeTrigger({
			actions: [makeAction({ id: 'a', connectionId: 'conn-old' })],
			condition: [makeFeedback({ id: 'c', connectionId: 'conn-old' })],
			localVariables: [makeFeedback({ id: 'lv', connectionId: 'conn-old' })],
		})

		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(result.actions[0].connectionId).toBe('conn-new')
		expect(result.condition[0].connectionId).toBe('conn-new')
		expect(result.localVariables[0].connectionId).toBe('conn-new')
	})

	test('rewrites connection label references inside action option strings', () => {
		const control = makeTrigger({
			actions: [makeAction({ connectionId: 'conn-old', options: { msg: exprVal('value is $(OldLabel:foo)') } })],
		})

		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect((result.actions[0].options.msg as any).value).toBe('value is $(NewLabel:foo)')
	})

	test('does not rewrite labels when the label is unchanged', () => {
		const map: InstanceAppliedRemappings = {
			'conn-old': { id: 'conn-old', label: 'SameLabel', oldLabel: 'SameLabel' },
		}
		const control = makeTrigger({
			actions: [makeAction({ connectionId: 'conn-old', options: { msg: exprVal('$(SameLabel:foo)') } })],
		})

		const result = fixupTriggerControl(internalModule, control, map, undefined)

		expect((result.actions[0].options.msg as any).value).toBe('$(SameLabel:foo)')
	})

	test('rewrites the watched variable label on variable_changed events', () => {
		const control = makeTrigger({
			events: [{ id: 'e1', type: 'variable_changed', enabled: true, options: { variableId: 'OldLabel:foo' } }],
		})

		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(result.events[0].options.variableId).toBe('NewLabel:foo')
	})

	test('rewrites label references inside generic event option strings', () => {
		const control = makeTrigger({
			events: [{ id: 'e1', type: 'custom', enabled: true, options: { text: 'hello $(OldLabel:bar)' } }],
		})

		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(result.events[0].options.text).toBe('hello $(NewLabel:bar)')
	})

	test('clones events so the input control is never mutated by the visitor', () => {
		// Regression: events used to be aliased (not cloned), so the visitor mutated the caller's data.
		const control = makeTrigger({
			events: [{ id: 'e1', type: 'variable_changed', enabled: true, options: { variableId: 'OldLabel:foo' } }],
		})

		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(result.events).not.toBe(control.events)
		expect(control.events[0].options.variableId).toBe('OldLabel:foo')
	})

	test('handles a trigger with no events by returning an empty array', () => {
		const control = makeTrigger()
		delete control.events

		const result = fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(result.events).toEqual([])
	})

	test('does not mutate the input action options', () => {
		const control = makeTrigger({
			actions: [makeAction({ connectionId: 'conn-old', options: { msg: exprVal('$(OldLabel:foo)') } })],
		})
		const snapshot = structuredClone(control.actions)

		fixupTriggerControl(internalModule, control, standardMap(), undefined)

		expect(control.actions).toEqual(snapshot)
	})
})

// ── fixupExpressionVariableControl ──────────────────────────────────────────────

describe('fixupExpressionVariableControl', () => {
	let internalModule: InternalController
	beforeEach(() => {
		internalModule = mockInternalModule()
	})

	function makeExpressionVariable(overrides: Partial<ExpressionVariableModel> = {}): ExpressionVariableModel {
		return {
			type: 'expression-variable',
			options: { variableName: 'myVar', description: '', sortOrder: 0 },
			entity: null,
			localVariables: [],
			...overrides,
		}
	}

	test('clones options and defaults entity/localVariables', () => {
		const control = makeExpressionVariable()
		const result = fixupExpressionVariableControl(internalModule, control, standardMap(), {})

		expect(result.type).toBe('expression-variable')
		expect(result.options).toEqual(control.options)
		expect(result.options).not.toBe(control.options)
		expect(result.entity).toBeNull()
		expect(result.localVariables).toEqual([])
	})

	test('remaps the single entity (wrapped/unwrapped correctly)', () => {
		const control = makeExpressionVariable({
			entity: makeFeedback({ connectionId: 'conn-old', upgradeIndex: 0 }),
		})

		const result = fixupExpressionVariableControl(internalModule, control, standardMap(), {})

		expect(result.entity).not.toBeNull()
		expect(result.entity?.connectionId).toBe('conn-new')
		expect(result.entity?.upgradeIndex).toBe(3)
	})

	test('drops the entity if its connection is unknown', () => {
		const control = makeExpressionVariable({
			entity: makeFeedback({ connectionId: 'unknown-connection' }),
		})

		const result = fixupExpressionVariableControl(internalModule, control, standardMap(), {})

		// fixupEntitiesRecursive returns [] for the dropped entity, so [0] is undefined
		expect(result.entity).toBeUndefined()
	})

	test('remaps connectionId on local variables', () => {
		const control = makeExpressionVariable({
			localVariables: [makeFeedback({ connectionId: 'conn-old' })],
		})

		const result = fixupExpressionVariableControl(internalModule, control, standardMap(), {})

		expect(result.localVariables[0].connectionId).toBe('conn-new')
	})

	test('rewrites label references inside the entity options', () => {
		const control = makeExpressionVariable({
			entity: makeFeedback({ connectionId: 'conn-old', options: { src: exprVal('$(OldLabel:x)') } }),
		})

		const result = fixupExpressionVariableControl(internalModule, control, standardMap(), {})

		expect((result.entity?.options.src as any).value).toBe('$(NewLabel:x)')
	})
})

// ── fixupPageVariables ──────────────────────────────────────────────────────────

describe('fixupPageVariables', () => {
	let internalModule: InternalController
	beforeEach(() => {
		internalModule = mockInternalModule()
	})

	test('defaults to an empty list', () => {
		expect(fixupPageVariables(internalModule, undefined, standardMap(), {})).toEqual([])
		expect(fixupPageVariables(internalModule, [], standardMap(), {})).toEqual([])
	})

	test('remaps connectionId on page variables', () => {
		const result = fixupPageVariables(internalModule, [makeFeedback({ connectionId: 'conn-old' })], standardMap(), {})

		expect(result[0].connectionId).toBe('conn-new')
	})

	test('drops a page variable whose connection is unknown', () => {
		const result = fixupPageVariables(
			internalModule,
			[makeFeedback({ connectionId: 'unknown-connection' })],
			standardMap(),
			{}
		)

		expect(result).toEqual([])
	})

	test('rewrites label references inside page variable options', () => {
		const result = fixupPageVariables(
			internalModule,
			[makeFeedback({ connectionId: 'conn-old', options: { src: exprVal('$(OldLabel:x)') } })],
			standardMap(),
			{}
		)

		expect((result[0].options.src as any).value).toBe('$(NewLabel:x)')
	})

	test('does not mutate the input', () => {
		const input = [makeFeedback({ connectionId: 'conn-old' })]

		fixupPageVariables(internalModule, input, standardMap(), {})

		// original untouched (structuredClone inside)
		expect(input[0].connectionId).toBe('conn-old')
	})
})

// ── fixupLayeredButtonControl ───────────────────────────────────────────────────

describe('fixupLayeredButtonControl', () => {
	let internalModule: InternalController
	let logger: Logger

	beforeEach(() => {
		internalModule = mockInternalModule()
		logger = mockLogger()
	})

	/** Build an updater the way #performPageImport does, derived from the instance map */
	function makeUpdater(map: InstanceAppliedRemappings): VisitorReferencesUpdater {
		const labelRemap: Record<string, string> = {}
		const idRemap: Record<string, string> = {}
		for (const [oldId, info] of Object.entries(map)) {
			if (info.oldLabel && info.label !== info.oldLabel) labelRemap[info.oldLabel] = info.label
			if (info.id && info.id !== oldId) idRemap[oldId] = info.id
		}
		return new VisitorReferencesUpdater(internalModule, labelRemap, idRemap, undefined)
	}

	function makeButton(overrides: Partial<ExportControlv6> = {}): ExportControlv6 {
		return {
			type: 'button-layered',
			options: { stepProgression: 'auto', rotaryActions: false, canModifyStyleInApis: false },
			style: { layers: [] },
			feedbacks: [],
			localVariables: [],
			steps: {},
			...overrides,
		}
	}

	test('produces a well-formed LayeredButtonModel', () => {
		const result = fixupLayeredButtonControl(logger, makeButton(), makeUpdater(standardMap()), standardMap())

		expect(result.type).toBe('button-layered')
		expect(result.feedbacks).toEqual([])
		expect(result.localVariables).toEqual([])
		expect(result.steps).toEqual({})
	})

	test('clones style and options', () => {
		const control = makeButton()
		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect(result.style).not.toBe(control.style)
		expect(result.options).not.toBe(control.options)
	})

	test('remaps connectionId on feedbacks and localVariables', () => {
		const control = makeButton({
			feedbacks: [makeFeedback({ connectionId: 'conn-old' })],
			localVariables: [makeFeedback({ id: 'lv', connectionId: 'conn-old' })],
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect(result.feedbacks[0].connectionId).toBe('conn-new')
		expect(result.localVariables[0].connectionId).toBe('conn-new')
	})

	test('remaps actions within step action_sets and initialises the default set shape', () => {
		const control = makeButton({
			steps: {
				'0': {
					options: {},
					action_sets: { down: [makeAction({ connectionId: 'conn-old' })] },
				},
			},
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		const sets = result.steps['0'].action_sets
		expect(sets.down).toHaveLength(1)
		expect(sets.down?.[0].connectionId).toBe('conn-new')
		expect(sets.up).toEqual([])
		expect(sets.rotate_left).toBeUndefined()
		expect(sets.rotate_right).toBeUndefined()
	})

	test('converts numeric (rotary) set ids from string keys back to numbers', () => {
		const control = makeButton({
			steps: {
				'0': {
					options: {},
					action_sets: { '1000': [makeAction({ connectionId: 'conn-old' })] },
				},
			},
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect(result.steps['0'].action_sets[1000]).toHaveLength(1)
		expect(result.steps['0'].action_sets[1000]?.[0].connectionId).toBe('conn-new')
	})

	test('skips and warns on invalid set ids', () => {
		const control = makeButton({
			steps: {
				'0': {
					options: {},
					action_sets: {
						down: [makeAction({ connectionId: 'conn-old' })],
						bogus: [makeAction({ id: 'bad', connectionId: 'conn-old' })],
					},
				},
			},
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect(result.steps['0'].action_sets.down).toHaveLength(1)
		expect((result.steps['0'].action_sets as any).bogus).toBeUndefined()
		expect(logger.warn).toHaveBeenCalledWith('Invalid set id: bogus')
	})

	test('clones step options', () => {
		const stepOptions = { runWhileHeld: [] }
		const control = makeButton({
			steps: { '0': { options: stepOptions, action_sets: { down: [] } } },
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect(result.steps['0'].options).toEqual(stepOptions)
		expect(result.steps['0'].options).not.toBe(stepOptions)
	})

	test('rewrites label references inside text draw element values', () => {
		const control = makeButton({
			style: {
				layers: [
					{
						id: 'l1',
						type: 'text',
						name: 'label',
						text: exprVal('$(OldLabel:title)'),
					},
				],
			},
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect((result.style.layers[0] as any).text.value).toBe('$(NewLabel:title)')
	})

	test('rewrites label references inside nested group draw elements', () => {
		const control = makeButton({
			style: {
				layers: [
					{
						id: 'g1',
						type: 'group',
						name: 'grp',
						children: [{ id: 'l1', type: 'text', name: 'label', text: exprVal('$(OldLabel:x)') }],
					},
				],
			},
		})

		const result = fixupLayeredButtonControl(logger, control, makeUpdater(standardMap()), standardMap())

		expect((result.style.layers[0] as any).children[0].text.value).toBe('$(NewLabel:x)')
	})
})

describe('fixupPresetReferenceControl', () => {
	const logger = { warn: vi.fn(), debug: vi.fn(), error: vi.fn() } as unknown as Logger

	function makeReferenceExport(overrides: Record<string, any> = {}): ExportControlv6 {
		return {
			type: 'preset-reference',
			options: { rotaryActions: false, stepProgression: 'auto', canModifyStyleInApis: false },
			style: { layers: [] },
			feedbacks: [],
			steps: {},
			localVariables: [],
			presetRef: {
				connectionId: 'old-conn',
				moduleId: 'mod1',
				presetId: 'p1',
				variableValues: { channel: 3 },
			},
			...overrides,
		}
	}

	function makeUpdater(connectionIdRemap: Record<string, string>) {
		const internalModule = { visitReferences: vi.fn() } as any
		return new VisitorReferencesUpdater(internalModule, {}, connectionIdRemap, undefined)
	}

	test('remaps the referenced connection id and keeps it a reference', () => {
		const control = makeReferenceExport()
		const instanceIdMap: InstanceAppliedRemappings = { 'old-conn': { id: 'new-conn', label: 'New' } }

		const result = fixupPresetReferenceControl(logger, control, makeUpdater({ 'old-conn': 'new-conn' }), instanceIdMap)

		expect(result.type).toBe('preset-reference')
		expect(result.presetRef).toEqual({
			connectionId: 'new-conn',
			moduleId: 'mod1',
			presetId: 'p1',
			variableValues: { channel: 3 },
		})
	})

	test('keeps the original connection id when there is no remap', () => {
		const control = makeReferenceExport()
		const instanceIdMap: InstanceAppliedRemappings = {}

		const result = fixupPresetReferenceControl(logger, control, makeUpdater({}), instanceIdMap)

		expect(result.presetRef.connectionId).toBe('old-conn')
		expect(result.presetRef.moduleId).toBe('mod1')
		expect(result.presetRef.variableValues).toEqual({ channel: 3 })
	})
})
