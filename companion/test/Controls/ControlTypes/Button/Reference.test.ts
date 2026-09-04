import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ButtonReferenceButtonModel, LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ControlDependencies } from '../../../../lib/Controls/ControlDependencies.js'
import { ControlButtonReference } from '../../../../lib/Controls/ControlTypes/Button/Reference.js'
import { mangleReferenceSurfaceId, MAX_REFERENCE_DEPTH } from '../../../../lib/Surface/ReferenceSurfaceId.js'

const MY_CONTROL_ID = 'bank:test01'
const MY_LOCATION: ControlLocation = { pageNumber: 1, row: 2, column: 3 }

function makeModel(location: ButtonReferenceButtonModel['options']['location']): ButtonReferenceButtonModel {
	return { type: 'button-reference', options: { location } }
}

function plainLocation(value: string): ButtonReferenceButtonModel['options']['location'] {
	return { value, isExpression: false }
}

describe('ControlButtonReference', () => {
	let deps: ControlDependencies
	let controlsAccessor: {
		getControl: ReturnType<typeof vi.fn>
		pressControl: ReturnType<typeof vi.fn>
		rotateControl: ReturnType<typeof vi.fn>
	}
	let getControlIdAt: ReturnType<typeof vi.fn>

	beforeEach(() => {
		controlsAccessor = {
			getControl: vi.fn(() => undefined),
			pressControl: vi.fn(() => true),
			rotateControl: vi.fn(() => true),
		}

		// Identity parser: a plain value passes through untouched, an expression evaluates to its raw text
		const parser = {
			parseVariables: vi.fn((value: string) => ({ text: String(value), variableIds: new Set<string>() })),
			executeExpression: vi.fn((value: string) => ({ ok: true, value, variableIds: new Set<string>() })),
		}

		getControlIdAt = vi.fn(() => undefined)

		deps = {
			surfaces: {} as any,
			pageStore: {
				getLocationOfControlId: vi.fn(() => MY_LOCATION),
				getControlIdAt,
			} as any,
			getPageVariableEntities: () => null,
			triggerEvents: null as any,
			expressionVariableNamesMap: null as any,
			internalModule: { entityUpgrade: vi.fn(() => undefined), visitReferences: vi.fn() } as any,
			instance: {} as any,
			variableValues: {
				createVariablesAndExpressionParser: vi.fn(() => parser),
			} as any,
			userconfig: {} as any,
			graphics: new EventEmitter() as any,
			actionRunner: {} as any,
			dbTable: { set: vi.fn(), delete: vi.fn() } as any,
			events: new EventEmitter() as any,
			changeEvents: new EventEmitter() as any,
			renderClock: { subscribe: vi.fn(() => () => {}) } as any,
			controlsAccessor: controlsAccessor as any,
		}
	})

	function createControl(location = plainLocation('4/0/0')) {
		return new ControlButtonReference(deps, MY_CONTROL_ID, makeModel(location), false)
	}

	it('exposes the reference metadata and capability flags', () => {
		const control = createControl()
		expect(control.type).toBe('button-reference')
		expect(control.supportsConvert).toBe(true)
		expect(control.supportsOptions).toBe(true)
		expect(control.supportsActions).toBe(false)
		expect(control.supportsEntities).toBe(false)
		expect(control.supportsLayeredStyle).toBe(false)
		expect(control.drawing).toBeTruthy()
	})

	it('round-trips the stored location and notes', () => {
		const control = new ControlButtonReference(
			deps,
			MY_CONTROL_ID,
			{ type: 'button-reference', options: { location: plainLocation('2/1/1'), notes: 'hello' } },
			false
		)
		const json = control.toJSON()
		expect(json.type).toBe('button-reference')
		expect(json.options.location).toEqual(plainLocation('2/1/1'))
		expect(json.options.notes).toBe('hello')
	})

	describe('optionsSetField', () => {
		it('accepts a new location', () => {
			const control = createControl()
			expect(control.optionsSetField('location', plainLocation('5/0/0'))).toBe(true)
			expect(control.toJSON().options.location).toEqual(plainLocation('5/0/0'))
		})

		it('accepts notes', () => {
			const control = createControl()
			expect(control.optionsSetField('notes', 'a note')).toBe(true)
			expect(control.toJSON().options.notes).toBe('a note')
		})

		it('rejects a non-string notes value', () => {
			const control = createControl()
			expect(control.optionsSetField('notes', 5 as any)).toBe(false)
		})

		it('rejects a location that is not an expression-or-value', () => {
			const control = createControl()
			expect(control.optionsSetField('location', 'nope' as any)).toBe(false)
		})

		it('rejects any other field', () => {
			const control = createControl()
			expect(control.optionsSetField('rotaryActions', true)).toBe(false)
		})
	})

	describe('pressControl', () => {
		it('forwards to the resolved target with a mangled surfaceId', () => {
			getControlIdAt.mockReturnValue('bank:target')
			const control = createControl(plainLocation('4/0/0'))

			control.pressControl(true, 'surface1', false)

			expect(controlsAccessor.pressControl).toHaveBeenCalledWith(
				'bank:target',
				true,
				mangleReferenceSurfaceId('surface1', MY_CONTROL_ID),
				false
			)
		})

		it('does nothing when the location does not resolve to a control', () => {
			getControlIdAt.mockReturnValue(undefined)
			const control = createControl(plainLocation('4/0/0'))

			control.pressControl(true, 'surface1')
			expect(controlsAccessor.pressControl).not.toHaveBeenCalled()
		})

		it('does nothing when the location is empty', () => {
			const control = createControl(plainLocation(''))

			control.pressControl(true, 'surface1')
			expect(controlsAccessor.pressControl).not.toHaveBeenCalled()
		})

		it('does not forward to itself (self-reference)', () => {
			getControlIdAt.mockReturnValue(MY_CONTROL_ID)
			const control = createControl(plainLocation('1/2/3'))

			control.pressControl(true, 'surface1')
			expect(controlsAccessor.pressControl).not.toHaveBeenCalled()
		})

		it('stops forwarding once the loop guard depth is reached', () => {
			getControlIdAt.mockReturnValue('bank:target')
			const control = createControl(plainLocation('4/0/0'))

			let deepSurfaceId = 'surface1'
			for (let i = 0; i < MAX_REFERENCE_DEPTH; i++) {
				deepSurfaceId = mangleReferenceSurfaceId(deepSurfaceId, 'bank:hop')
			}

			control.pressControl(true, deepSurfaceId)
			expect(controlsAccessor.pressControl).not.toHaveBeenCalled()
		})
	})

	describe('rotateControl', () => {
		it('forwards and reports handled', () => {
			getControlIdAt.mockReturnValue('bank:target')
			const control = createControl(plainLocation('4/0/0'))

			expect(control.rotateControl(1, 'surface1')).toBe(true)
			expect(controlsAccessor.rotateControl).toHaveBeenCalledWith(
				'bank:target',
				1,
				mangleReferenceSurfaceId('surface1', MY_CONTROL_ID)
			)
		})

		it('reports not-handled when there is no target', () => {
			getControlIdAt.mockReturnValue(undefined)
			const control = createControl(plainLocation('4/0/0'))

			expect(control.rotateControl(1, 'surface1')).toBe(false)
			expect(controlsAccessor.rotateControl).not.toHaveBeenCalled()
		})

		it('reports not-handled once the loop guard depth is reached', () => {
			getControlIdAt.mockReturnValue('bank:target')
			const control = createControl(plainLocation('4/0/0'))

			let deepSurfaceId = 'surface1'
			for (let i = 0; i < MAX_REFERENCE_DEPTH; i++) {
				deepSurfaceId = mangleReferenceSurfaceId(deepSurfaceId, 'bank:hop')
			}

			expect(control.rotateControl(1, deepSurfaceId)).toBe(false)
			expect(controlsAccessor.rotateControl).not.toHaveBeenCalled()
		})
	})

	describe('convertControl', () => {
		it('snapshots the target button, breaking the link', () => {
			const targetModel: LayeredButtonModel = {
				type: 'button-layered',
				options: { stepProgression: 'auto', rotaryActions: false, canModifyStyleInApis: false },
				style: { layers: [] },
				feedbacks: [],
				steps: {},
				localVariables: [],
			}
			getControlIdAt.mockReturnValue('bank:target')
			controlsAccessor.getControl.mockReturnValue({ toJSON: vi.fn(() => targetModel) })

			const control = createControl(plainLocation('4/0/0'))
			const converted = control.convertControl()

			expect(converted).toEqual(targetModel)
			// A snapshot, not the same object
			expect(converted).not.toBe(targetModel)
		})

		it('produces a blank layered button when the target cannot be resolved', () => {
			getControlIdAt.mockReturnValue(undefined)
			const control = createControl(plainLocation('4/0/0'))

			const converted = control.convertControl()
			expect(converted.type).toBe('button-layered')
			expect((converted as LayeredButtonModel).style.layers.length).toBeGreaterThan(0)
			expect(controlsAccessor.getControl).not.toHaveBeenCalled()
		})
	})

	describe('references', () => {
		it('collects variables referenced by an expression location', () => {
			const control = createControl({ value: '`${$(internal:page)}/0/0`', isExpression: true })

			const foundVariables = new Set<string>()
			control.collectReferencedConnectionsAndVariables(new Set(), new Set(), foundVariables)

			expect(foundVariables).toContain('internal:page')
		})

		it('renames a connection label used inside the location expression', () => {
			const control = createControl({ value: '$(old:pos)', isExpression: true })

			control.renameVariables('old', 'new')
			expect(control.toJSON().options.location.value).toBe('$(new:pos)')
		})
	})
})
