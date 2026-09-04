import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	type FeedbackEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonLayered } from '../../../../lib/Controls/ControlTypes/Button/Layered.js'
import type { NewSpecialExpressionValue } from '../../../../lib/Controls/Entities/SpecialExpressions.js'
import type { NewFeedbackValue } from '../../../../lib/Controls/Entities/Types.js'

const CONTROL_ID = 'ctrl1'
const CONNECTION_ID = 'conn01'
const STYLE_ELEMENT_CHANGED = 'layeredStyleElementChanged'
const DEFAULT_ELEMENT_IDS = ['canvas', 'box0', 'text0']

function boxElement(id: string, overrides: Record<string, unknown> = {}): SomeButtonGraphicsElement {
	// Minimal element; the drawer backfills any missing properties from the type defaults on load.
	return { id, name: id, usage: ButtonGraphicsElementUsage.Automatic, type: 'box', ...overrides } as any
}

function textElement(id: string, overrides: Record<string, unknown> = {}): SomeButtonGraphicsElement {
	return { id, name: id, usage: ButtonGraphicsElementUsage.Automatic, type: 'text', ...overrides } as any
}

function groupElement(id: string, children: SomeButtonGraphicsElement[]): SomeButtonGraphicsElement {
	return { id, name: id, usage: ButtonGraphicsElementUsage.Automatic, type: 'group', children } as any
}

function feedbackModel(id: string, overrides: Partial<FeedbackEntityModel> = {}): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id,
		connectionId: CONNECTION_ID,
		definitionId: 'def01',
		options: {},
		upgradeIndex: undefined,
		...overrides,
	}
}

/** A feedback carrying a style override that targets `elementId`. */
function feedbackWithOverride(id: string, elementId: string): FeedbackEntityModel {
	return feedbackModel(id, {
		styleOverrides: [
			{
				overrideId: `${id}-o`,
				elementId,
				elementProperty: 'color',
				override: { isExpression: false, value: 0xff0000 },
			},
		],
	})
}

function makeStorage(
	layers: SomeButtonGraphicsElement[],
	feedbacks: SomeEntityModel[] = [],
	localVariables: SomeEntityModel[] = []
): LayeredButtonModel {
	return {
		type: 'button-layered',
		options: { rotaryActions: false, stepProgression: 'auto', canModifyStyleInApis: false, notes: '' } as any,
		style: { layers },
		feedbacks,
		steps: {
			'0': {
				options: { runWhileHeld: [] },
				action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
			},
		},
		localVariables,
	}
}

function feedbackValues(values: Record<string, any>): Map<string, NewFeedbackValue> {
	const map = new Map<string, NewFeedbackValue>()
	for (const [entityId, value] of Object.entries(values)) {
		map.set(entityId, { entityId, controlId: '', value })
	}
	return map
}

function invertedValues(values: Record<string, boolean>): Map<string, NewSpecialExpressionValue<'isInverted'>> {
	const map = new Map<string, NewSpecialExpressionValue<'isInverted'>>()
	for (const [entityId, value] of Object.entries(values)) {
		map.set(entityId, { entityId, controlId: '', value })
	}
	return map
}

describe('ControlButtonLayered', () => {
	let deps: ControlDependencies
	let events: EventEmitter
	let dbSet: ReturnType<typeof vi.fn>

	beforeEach(() => {
		const definitions = Object.assign(new EventEmitter(), {
			getEntityDefinition: vi.fn(
				() => ({ entityType: EntityModelType.Feedback, feedbackType: FeedbackEntitySubType.Boolean }) as any
			),
		})

		const graphics = Object.assign(new EventEmitter(), {
			renderPixelBuffers: vi.fn(),
			getCachedRender: vi.fn(() => undefined),
		})

		events = new EventEmitter()
		dbSet = vi.fn()

		deps = {
			surfaces: {} as any,
			pageStore: { getLocationOfControlId: vi.fn(() => null) } as any,
			getPageVariableEntities: () => null,
			triggerEvents: null as any,
			expressionVariableNamesMap: null as any,
			internalModule: { entityUpgrade: vi.fn(() => undefined), visitReferences: vi.fn() } as any,
			instance: {
				definitions,
				processManager: {
					connectionEntityUpdate: vi.fn(async () => undefined),
					connectionEntityDelete: vi.fn(async () => undefined),
					connectionEntityLearnOptions: vi.fn(async () => undefined),
				} as any,
				getInstanceStatus: vi.fn(() => undefined),
			} as any,
			variableValues: {
				createVariablesAndExpressionParser: vi.fn(() => ({
					executeExpression: vi.fn(() => ({ ok: true, value: 1, variableIds: new Set<string>() })),
				})),
			} as any,
			userconfig: {} as any,
			graphics: graphics as any,
			actionRunner: {} as any,
			dbTable: { set: dbSet, delete: vi.fn() } as any,
			events: events as any,
			changeEvents: new EventEmitter() as any,
			renderClock: { subscribe: vi.fn(() => () => {}) } as any,
			controlsAccessor: {
				getControl: vi.fn(() => undefined),
				pressControl: vi.fn(() => false),
				rotateControl: vi.fn(() => false),
			},
		}
	})

	function createControl(storage: LayeredButtonModel | null): ControlButtonLayered {
		return new ControlButtonLayered(deps, CONTROL_ID, storage, false)
	}

	/** All `layeredStyleElementChanged` element ids emitted on `deps.events` since the spy was installed. */
	function emittedElementIds(spy: ReturnType<typeof vi.spyOn>): string[] {
		return spy.mock.calls
			.filter((call: any[]) => call[0] === STYLE_ELEMENT_CHANGED && call[1] === CONTROL_ID)
			.map((call: any[]) => call[2] as string)
	}

	describe('preset definition ids', () => {
		// A preset definition allocates deterministic ids so its content checksum is stable, and relies on
		// being cloned into fresh ids before it becomes live control data. Preset placement goes through
		// `importControl`, which constructs with isImport=true.
		const presetFeedback = {
			id: 'p1_0',
			type: EntityModelType.Feedback,
			connectionId: 'conn1',
			definitionId: 'fb1',
			options: {},
		} as any

		it('regenerates entity ids when a preset is placed', () => {
			const control = new ControlButtonLayered(deps, CONTROL_ID, makeStorage([], [presetFeedback]), true)

			const ids = control.toJSON().feedbacks.map((f) => f.id)
			expect(ids).toHaveLength(1)
			expect(ids[0]).not.toBe('p1_0')
		})

		it('keeps stored entity ids when loading from the database', () => {
			const control = new ControlButtonLayered(deps, CONTROL_ID, makeStorage([], [presetFeedback]), false)

			expect(control.toJSON().feedbacks.map((f) => f.id)).toEqual(['p1_0'])
		})
	})

	describe('construction & metadata', () => {
		it('reports its type and capability flags', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			expect(control.type).toBe('button-layered')
			expect(control.supportsActions).toBe(true)
			expect(control.supportsActionSets).toBe(true)
			expect(control.supportsLayeredStyle).toBe(true)
			expect(control.supportsEvents).toBe(false)
		})

		it('seeds the default elements (canvas/box/text) for a brand new control', () => {
			const control = createControl(null)

			expect(control.drawing.getAllElementIds()).toEqual(DEFAULT_ELEMENT_IDS)
		})

		it('persists a brand new control to the db on construction', () => {
			createControl(null)

			expect(dbSet).toHaveBeenCalledWith(CONTROL_ID, expect.objectContaining({ type: 'button-layered' }))
		})

		it('loads elements and feedbacks from storage', () => {
			const control = createControl(makeStorage([boxElement('box0'), textElement('txt0')], [feedbackModel('fb1')]))

			expect(control.drawing.getAllElementIds()).toEqual(['box0', 'txt0'])
			expect(control.toJSON().feedbacks.map((f) => f.id)).toEqual(['fb1'])
		})

		it('exposes the entity pool as its action-sets editor', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			expect(control.actionSets).toBe(control.entities)
		})
	})

	describe('toJSON / toRuntimeJSON', () => {
		it('round-trips the model shape', () => {
			const control = createControl(
				makeStorage([boxElement('box0')], [feedbackModel('fb1')], [feedbackModel('lv1', { variableName: 'v' })])
			)

			const json = control.toJSON()
			expect(json.type).toBe('button-layered')
			expect(json.style.layers.map((l) => l.id)).toEqual(['box0'])
			expect(json.feedbacks.map((f) => f.id)).toEqual(['fb1'])
			expect(json.localVariables.map((v) => v.id)).toEqual(['lv1'])
			expect(json.steps['0']).toBeDefined()
		})

		it('returns an independent deep clone when clone=true', () => {
			const control = createControl(makeStorage([boxElement('box0')], [feedbackModel('fb1')]))

			const json = control.toJSON(true)
			json.feedbacks.push(feedbackModel('injected'))
			json.style.layers.push(boxElement('injected'))

			// Mutating the returned copy must not affect the control's own state
			expect(control.toJSON().feedbacks.map((f) => f.id)).toEqual(['fb1'])
			expect(control.drawing.getAllElementIds()).toEqual(['box0'])
		})

		it('reports the current step id in the runtime props', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			expect(control.toRuntimeJSON()).toEqual({ current_step_id: '0' })
		})
	})

	describe('getAllElementIds', () => {
		it('returns an empty list when there are no layers', () => {
			const control = createControl(makeStorage([]))

			expect(control.drawing.getAllElementIds()).toEqual([])
		})

		it('includes ids nested inside groups, depth-first', () => {
			const control = createControl(
				makeStorage([
					boxElement('box0'),
					groupElement('grp0', [boxElement('nested0'), groupElement('grp1', [boxElement('nested1')])]),
				])
			)

			expect(control.drawing.getAllElementIds()).toEqual(['box0', 'grp0', 'nested0', 'grp1', 'nested1'])
		})
	})

	describe('realtime style-element invalidation on feedback changes', () => {
		it('emits layeredStyleElementChanged for the overridden element when a feedback value changes', () => {
			const control = createControl(makeStorage([boxElement('box0')], [feedbackWithOverride('fb1', 'box0')]))
			const emitSpy = vi.spyOn(deps.events, 'emit')

			// A runtime feedback value push. reportChange uses noSave, so no config patch is emitted - the style
			// editor only re-resolves the element via this event.
			control.entities.updateFeedbackValues(CONNECTION_ID, feedbackValues({ fb1: true }))

			expect(emittedElementIds(emitSpy)).toEqual(['box0'])
		})

		it('emits for every distinct element affected by the changed feedbacks', () => {
			const control = createControl(
				makeStorage(
					[boxElement('box0'), boxElement('box1'), textElement('txt0')],
					[
						feedbackModel('fb1', {
							styleOverrides: [
								{
									overrideId: 'o1',
									elementId: 'box0',
									elementProperty: 'color',
									override: { isExpression: false, value: 1 },
								},
								{
									overrideId: 'o2',
									elementId: 'txt0',
									elementProperty: 'color',
									override: { isExpression: false, value: 2 },
								},
							],
						}),
						feedbackWithOverride('fb2', 'box1'),
					]
				)
			)
			const emitSpy = vi.spyOn(deps.events, 'emit')

			control.entities.updateFeedbackValues(CONNECTION_ID, feedbackValues({ fb1: true, fb2: true }))

			expect(emittedElementIds(emitSpy).sort()).toEqual(['box0', 'box1', 'txt0'])
		})

		it('does not emit when the changed feedback has no style overrides', () => {
			const control = createControl(makeStorage([boxElement('box0')], [feedbackModel('fb1')]))
			const emitSpy = vi.spyOn(deps.events, 'emit')

			control.entities.updateFeedbackValues(CONNECTION_ID, feedbackValues({ fb1: true }))

			expect(emittedElementIds(emitSpy)).toEqual([])
		})

		it('does not emit for a disabled feedback even if it has an override', () => {
			const control = createControl(
				makeStorage(
					[boxElement('box0')],
					[
						feedbackModel('fb1', {
							disabled: true,
							styleOverrides: [
								{
									overrideId: 'o1',
									elementId: 'box0',
									elementProperty: 'color',
									override: { isExpression: false, value: 1 },
								},
							],
						}),
					]
				)
			)
			const emitSpy = vi.spyOn(deps.events, 'emit')

			control.entities.updateFeedbackValues(CONNECTION_ID, feedbackValues({ fb1: true }))

			expect(emittedElementIds(emitSpy)).toEqual([])
		})

		it('does not emit when the pushed value is unchanged', () => {
			const control = createControl(makeStorage([boxElement('box0')], [feedbackWithOverride('fb1', 'box0')]))
			control.entities.updateFeedbackValues(CONNECTION_ID, feedbackValues({ fb1: true }))

			// Install the spy only after the value has been established, then push the same value again
			const emitSpy = vi.spyOn(deps.events, 'emit')
			control.entities.updateFeedbackValues(CONNECTION_ID, feedbackValues({ fb1: true }))

			expect(emittedElementIds(emitSpy)).toEqual([])
		})

		it('emits for the overridden element when a feedbacks isInverted changes', () => {
			const control = createControl(makeStorage([boxElement('box0')], [feedbackWithOverride('fb1', 'box0')]))
			const emitSpy = vi.spyOn(deps.events, 'emit')

			control.entities.updateIsInvertedValues(invertedValues({ fb1: true }))

			expect(emittedElementIds(emitSpy)).toEqual(['box0'])
		})

		it('re-resolves every element when a feedback is added structurally (invalidateAllElements)', () => {
			const control = createControl(null) // canvas + box0 + text0
			const emitSpy = vi.spyOn(deps.events, 'emit')

			control.entities.entityAdd('feedbacks', null, feedbackWithOverride('fb1', 'box0'))

			expect(emittedElementIds(emitSpy).sort()).toEqual([...DEFAULT_ELEMENT_IDS].sort())
		})
	})

	describe('layered style editing', () => {
		it('adds an element, returning a retrievable id and announcing the change', () => {
			const control = createControl(makeStorage([boxElement('box0')]))
			const emitSpy = vi.spyOn(deps.events, 'emit')

			const newId = control.layeredStyleAddElement('text', null)

			expect(typeof newId).toBe('string')
			expect(control.layeredStyleGetElementById(newId)?.type).toBe('text')
			expect(emittedElementIds(emitSpy)).toContain(newId)
			expect(dbSet).toHaveBeenCalled()
		})

		it('removes an element', () => {
			const control = createControl(makeStorage([boxElement('box0'), boxElement('box1')]))

			expect(control.layeredStyleRemoveElement('box1')).toBe(true)
			expect(control.drawing.getAllElementIds()).toEqual(['box0'])
		})

		it('refuses to remove the canvas element', () => {
			const control = createControl(null)

			expect(control.layeredStyleRemoveElement('canvas')).toBe(false)
			expect(control.drawing.getAllElementIds()).toContain('canvas')
		})

		it('duplicates an element under a fresh id', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			const cloneId = control.layeredStyleDuplicateElement('box0')

			expect(cloneId).toBeTruthy()
			expect(cloneId).not.toBe('box0')
			expect(control.drawing.getAllElementIds()).toEqual(['box0', cloneId])
		})

		it('renames an element', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			expect(control.layeredStyleSetElementName('box0', 'Renamed')).toBe(true)
			expect(control.layeredStyleGetElementById('box0')?.name).toBe('Renamed')
		})

		it('updates an element option', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			expect(control.layeredStyleUpdateOption('box0', 'x', { isExpression: false, value: 42 })).toBe(true)
			const element = control.layeredStyleGetElementById('box0') as any
			expect(element.x).toEqual({ isExpression: false, value: 42 })
		})

		it('returns undefined for an unknown element id', () => {
			const control = createControl(makeStorage([boxElement('box0')]))

			expect(control.layeredStyleGetElementById('nope')).toBeUndefined()
		})

		it('reports the selected element id per usage', () => {
			const control = createControl(null)

			const selected = control.layeredStyleSelectedElementIds()
			expect(selected[ButtonGraphicsElementUsage.Text]).toBe('text0')
			expect(selected[ButtonGraphicsElementUsage.Color]).toBe('box0')
		})
	})

	describe('options', () => {
		it('recomputes the step expression when the step progression option changes', () => {
			const control = createControl(makeStorage([boxElement('box0')]))
			const stepSpy = vi.spyOn(control.entities, 'stepExpressionUpdate')

			control.optionsSetField('stepProgression', 'expression')

			expect(stepSpy).toHaveBeenCalled()
		})

		it('does not recompute the step expression for unrelated options', () => {
			const control = createControl(makeStorage([boxElement('box0')]))
			const stepSpy = vi.spyOn(control.entities, 'stepExpressionUpdate')

			control.optionsSetField('notes', 'hello')

			expect(stepSpy).not.toHaveBeenCalled()
		})
	})

	describe('references', () => {
		it('collects the connections referenced by its feedbacks', () => {
			const control = createControl(makeStorage([boxElement('box0')], [feedbackModel('fb1')]))

			const connectionIds = new Set<string>()
			control.collectReferencedConnectionsAndVariables(connectionIds, new Set(), new Set())

			expect(connectionIds.has(CONNECTION_ID)).toBe(true)
		})

		it('collects the variables referenced by an element expression', () => {
			const control = createControl(
				makeStorage([textElement('txt0', { text: { isExpression: true, value: '$(internal:time_hms)' } })])
			)

			const variables = new Set<string>()
			control.collectReferencedConnectionsAndVariables(new Set(), new Set(), variables)

			expect(variables.has('internal:time_hms')).toBe(true)
		})

		it('renames connection-label variable references in element expressions', () => {
			const control = createControl(
				makeStorage([textElement('txt0', { text: { isExpression: true, value: '$(oldlabel:foo)' } })])
			)

			control.renameVariables('oldlabel', 'newlabel')

			const element = control.layeredStyleGetElementById('txt0') as any
			expect(element.text).toEqual({ isExpression: true, value: '$(newlabel:foo)' })
		})
	})
})
