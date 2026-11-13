import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateCustomPresetControlId } from '@companion-app/shared/ControlId.js'
import { CustomPresetModelSchema, type CustomPresetModel } from '@companion-app/shared/Model/CustomPresetModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { ControlDependencies } from '../../../lib/Controls/ControlDependencies.js'
import { ControlCustomPreset } from '../../../lib/Controls/ControlTypes/CustomPreset.js'
import { ReferencedLocationsIndex } from '../../../lib/Controls/ReferencedLocationsIndex.js'
import { VariableDependencyRegistry } from '../../../lib/Variables/DependencyRegistry.js'

const CONTROL_ID = CreateCustomPresetControlId('preset1')

function makeStorage(options: Partial<CustomPresetModel['options']> = {}): CustomPresetModel {
	const storage = CustomPresetModelSchema.parse({ type: 'custom-preset' })
	storage.options = { ...storage.options, ...options }
	storage.style.layers = [{ id: 'box', name: 'box', usage: 'automatic', type: 'box' } as any]
	return storage
}

describe('ControlCustomPreset', () => {
	let deps: ControlDependencies
	let events: EventEmitter
	let changeEvents: EventEmitter
	let dbSet: ReturnType<typeof vi.fn>

	beforeEach(() => {
		const definitions = Object.assign(new EventEmitter(), {
			getEntityDefinition: vi.fn(
				() => ({ entityType: EntityModelType.Feedback, feedbackType: FeedbackEntitySubType.Boolean }) as any
			),
		})

		events = new EventEmitter()
		changeEvents = new EventEmitter()
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
			graphics: Object.assign(new EventEmitter(), {
				renderPixelBuffers: vi.fn(),
				getCachedRender: vi.fn(() => undefined),
			}) as any,
			actionRunner: {} as any,
			dbTable: { set: dbSet, delete: vi.fn() } as any,
			events: events as any,
			changeEvents: changeEvents as any,
			renderClock: { subscribe: vi.fn(() => () => {}) } as any,
			variableDependencies: new VariableDependencyRegistry(),
			linkButtons: null as any,
			referencedLocations: new ReferencedLocationsIndex(),
			customActionInstances: { entityUpdate: vi.fn(), entityDelete: vi.fn() } as any,
			customFeedbackInstances: { entityUpdate: vi.fn(), entityDelete: vi.fn(), evaluateLive: vi.fn() } as any,
			controlsAccessor: {
				getControl: vi.fn(() => undefined),
				pressControl: vi.fn(() => false),
				rotateControl: vi.fn(() => false),
			},
		}
	})

	it('a new custom preset is a button with the default elements', () => {
		const control = new ControlCustomPreset(deps, CONTROL_ID, null, false)

		const json = control.toJSON()
		expect(json.type).toBe('custom-preset')
		expect(json.options.name).toBe('New custom preset')
		expect(json.style.layers.map((layer) => layer.id)).toEqual(['canvas', 'box0', 'text0'])
		expect(dbSet).toHaveBeenCalledWith(CONTROL_ID, expect.objectContaining({ type: 'custom-preset' }))
	})

	it('places a button without the options which only list the preset', () => {
		const control = new ControlCustomPreset(
			deps,
			CONTROL_ID,
			makeStorage({ name: 'Mine', description: 'Desc', sortOrder: 3, collectionId: 'col', notes: 'Note' }),
			false
		)

		const button = control.toButtonModel()
		expect(button.type).toBe('button-layered')
		expect(button.options).toEqual({
			stepProgression: 'auto',
			stepExpression: '',
			rotaryActions: false,
			canModifyStyleInApis: false,
			notes: 'Note',
		})
		expect(button.style.layers.map((layer) => layer.id)).toEqual(['box'])
	})

	it('only sets the sortOrder and collection when forced', () => {
		const control = new ControlCustomPreset(deps, CONTROL_ID, makeStorage(), false)

		expect(() => control.optionsSetField({ key: 'sortOrder', value: 5 })).toThrow()
		expect(() => control.optionsSetField({ key: 'collectionId', value: 'col' })).toThrow()

		expect(control.optionsSetField({ key: 'sortOrder', value: 5 }, true)).toBe(true)
		expect(control.options.sortOrder).toBe(5)

		expect(control.optionsSetField({ key: 'name', value: 'Renamed' })).toBe(true)
		expect(control.options.name).toBe('Renamed')
	})

	it('reports when it changes or is deleted, so that its preset is updated', () => {
		const control = new ControlCustomPreset(deps, CONTROL_ID, makeStorage(), false)

		const changed = vi.fn()
		events.on('customPresetDefinitionChanged', changed)

		control.optionsSetField({ key: 'name', value: 'Renamed' })
		expect(changed).toHaveBeenLastCalledWith(CONTROL_ID)

		changed.mockClear()
		control.destroy()
		expect(changed).toHaveBeenCalledWith(CONTROL_ID)
	})

	it('sends the changes to how it is listed', () => {
		const updates: unknown[] = []
		changeEvents.on('customPresetChange', (_controlId, update) => updates.push(update))

		const control = new ControlCustomPreset(deps, CONTROL_ID, makeStorage({ name: 'First' }), false)
		control.optionsSetField({ key: 'name', value: 'Second' })
		control.destroy()

		expect(updates).toEqual([
			{
				type: 'add',
				controlId: CONTROL_ID,
				info: { type: 'custom-preset', name: 'First', description: '', sortOrder: 0, collectionId: undefined },
			},
			{ type: 'update', controlId: CONTROL_ID, patch: [{ op: 'set', path: ['name'], value: 'Second' }] },
			{ type: 'remove', controlId: CONTROL_ID },
		])
	})

	it('leaves a collection which is gone', () => {
		const control = new ControlCustomPreset(deps, CONTROL_ID, makeStorage({ collectionId: 'gone' }), false)

		expect(control.checkCollectionIdIsValid(new Set(['other']))).toBe(true)
		expect(control.options.collectionId).toBeUndefined()

		expect(control.checkCollectionIdIsValid(new Set(['other']))).toBe(false)
	})
})
