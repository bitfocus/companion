import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { LayeredButtonDrawer } from '../../lib/Controls/ControlTypes/Button/LayeredButtonDrawer.js'
import type { CompositeElementIdString } from '../../lib/Instance/Definitions.js'

// Control the (heavy) element conversion so we can shape its result and open/close the async draw window.
const convertMock = vi.hoisted(() => vi.fn())
vi.mock('../../lib/Graphics/ConvertGraphicsElements.js', () => ({
	ConvertSomeButtonGraphicsElementForDrawing: (...args: any[]) => convertMock(...args),
}))

const CONTROL_ID = 'bank:1-0-0'
const LOCATION: ControlLocation = { pageNumber: 1, row: 0, column: 0 }
const OTHER_LOCATION: ControlLocation = { pageNumber: 2, row: 0, column: 0 }

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((r) => (resolve = r))
	return { promise, resolve }
}

const sleep = async (ms: number): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

/** A minimal conversion result; each set defaults to empty and `clockSensitive` to false. */
function conversionResult(
	opts: {
		elements?: any[]
		usedVariables?: Set<string>
		usedCompositeElements?: Set<string>
		referencedLocations?: Set<string>
		cyclicLocations?: Set<string>
		clockSensitive?: boolean
	} = {}
) {
	return {
		elements: opts.elements ?? [],
		usedVariables: opts.usedVariables ?? new Set<string>(),
		usedCompositeElements: opts.usedCompositeElements ?? new Set<string>(),
		referencedLocations: opts.referencedLocations ?? new Set<string>(),
		cyclicLocations: opts.cyclicLocations ?? new Set<string>(),
		clockSensitive: opts.clockSensitive ?? false,
	}
}

describe('LayeredButtonDrawer', () => {
	let events: EventEmitter
	let deps: any
	let host: any
	let currentLocation: ControlLocation | undefined
	let drawer: LayeredButtonDrawer
	let invalidateSpy: ReturnType<typeof vi.fn>

	/** Spy on the drawer's (protected) element-conversion cache. */
	function cacheOf(d: LayeredButtonDrawer) {
		return (d as any).elementConversionCache
	}

	beforeEach(() => {
		convertMock.mockReset()
		currentLocation = LOCATION

		events = new EventEmitter()
		deps = {
			events,
			pageStore: { getLocationOfControlId: vi.fn(() => currentLocation) },
			variableValues: { createVariablesAndExpressionParser: vi.fn(() => ({ marker: 'parser' })) },
			getPageVariableEntities: vi.fn(() => ({ marker: 'page-entities' })),
			instance: { definitions: { marker: 'definitions' } },
			graphics: {
				renderPixelBuffers: vi.fn(),
				getCachedRender: vi.fn(() => undefined),
			},
		}
		host = {
			getButtonStateProps: () => ({
				pushed: false,
				stepCurrent: 0,
				stepCount: 0,
				button_status: undefined,
				action_running: undefined,
			}),
			entities: null,
		}

		drawer = new LayeredButtonDrawer(deps, CONTROL_ID, host)

		invalidateSpy = vi.fn()
		events.on('invalidateControlRender', invalidateSpy as (...args: any[]) => void)
	})

	describe('getDrawStyle', () => {
		it('produces a layered button style, defaulting drawType to "button"', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ elements: [{ id: 'text0', type: 'text' }] }))

			const style = await drawer.getDrawStyle()

			expect(style).toMatchObject({
				style: 'button-layered',
				drawType: 'button',
				pushed: false,
				stepCurrent: 0,
				stepCount: 0,
				elements: [{ id: 'text0', type: 'text' }],
			})
		})

		it('reports the drawType passed to the constructor', async () => {
			const pageDrawer = new LayeredButtonDrawer(deps, 'bank:1-0-0', host, 'pageup')
			convertMock.mockResolvedValueOnce(conversionResult())

			const style = await pageDrawer.getDrawStyle()

			expect(style.drawType).toBe('pageup')
		})

		it('maps a falsy clockSensitive to undefined and a truthy one through', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ clockSensitive: false }))
			expect((await drawer.getDrawStyle()).clockSensitive).toBeUndefined()

			convertMock.mockResolvedValueOnce(conversionResult({ clockSensitive: true }))
			expect((await drawer.getDrawStyle()).clockSensitive).toBe(true)
		})

		it('passes referencedLocations through to the style', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ referencedLocations: new Set(['2/0/0']) }))

			const style = await drawer.getDrawStyle()

			expect(style.referencedLocations).toEqual(new Set(['2/0/0']))
		})

		it('builds the parser and conversion call from the control location', async () => {
			convertMock.mockResolvedValueOnce(conversionResult())

			await drawer.getDrawStyle()

			expect(deps.variableValues.createVariablesAndExpressionParser).toHaveBeenCalledWith(
				LOCATION,
				null, // no entities host
				expect.any(Object), // injected variable values
				{ marker: 'page-entities' }
			)
			expect(deps.getPageVariableEntities).toHaveBeenCalledWith(LOCATION.pageNumber)

			const args = convertMock.mock.calls[0]
			expect(args[0]).toBe(deps.instance.definitions) // composite element store
			expect(args[3]).toBe((drawer as any).drawElementsList) // elements to draw
			expect(args[5]).toBe(true) // onlyEnabled
			expect(args[6]).toBe(cacheOf(drawer)) // conversion cache
			expect(args[7]).toBe('1/0/0') // location string
		})

		it('handles a control with no location (no page entities, null location string)', async () => {
			currentLocation = undefined
			convertMock.mockResolvedValueOnce(conversionResult())

			await drawer.getDrawStyle()

			expect(deps.getPageVariableEntities).not.toHaveBeenCalled()
			const args = convertMock.mock.calls[0]
			expect(args[7]).toBeNull() // location string
			expect(deps.variableValues.createVariablesAndExpressionParser).toHaveBeenCalledWith(
				undefined,
				null,
				expect.any(Object),
				null
			)
		})

		it('wires the getRenderAtLocation callback to the graphics cache', async () => {
			convertMock.mockResolvedValueOnce(conversionResult())
			await drawer.getDrawStyle()

			const getRenderAtLocation = convertMock.mock.calls[0][8] as (loc: ControlLocation) => unknown

			// Returns null when nothing is cached
			expect(getRenderAtLocation(OTHER_LOCATION)).toBeNull()
			expect(deps.graphics.getCachedRender).toHaveBeenCalledWith(OTHER_LOCATION)

			// Returns the cached render when present
			const cached = { marker: 'render' }
			deps.graphics.getCachedRender.mockReturnValueOnce(cached)
			expect(getRenderAtLocation(OTHER_LOCATION)).toBe(cached)
		})

		it('uses the entity host for local variables and feedback overrides when present', async () => {
			const localEntities = [{ id: 'lv' }]
			const overrides = new Map()
			host.entities = {
				getLocalVariableEntities: vi.fn(() => localEntities),
				getFeedbackStyleOverrides: vi.fn(() => overrides),
			}
			convertMock.mockResolvedValueOnce(conversionResult())

			await drawer.getDrawStyle()

			expect(deps.variableValues.createVariablesAndExpressionParser).toHaveBeenCalledWith(
				LOCATION,
				localEntities,
				expect.any(Object),
				{ marker: 'page-entities' }
			)
			expect(convertMock.mock.calls[0][4]).toBe(overrides) // feedbackOverrides
		})

		it('records the last draw style, exposed via getLastDrawStyle', async () => {
			expect(drawer.getLastDrawStyle()).toBeNull()

			convertMock.mockResolvedValueOnce(conversionResult())
			const style = await drawer.getDrawStyle()

			expect(drawer.getLastDrawStyle()).toBe(style)
		})
	})

	describe('onVariablesChanged', () => {
		it('does nothing before any draw has happened', async () => {
			drawer.onVariablesChanged(new Set(['local:x']))

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('redraws and evicts affected cache entries when a used variable changes', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ usedVariables: new Set(['local:preset_name']) }))
			await drawer.getDrawStyle()

			const queueSpy = vi.spyOn(cacheOf(drawer), 'queueInvalidateVariables')
			const changed = new Set(['local:preset_name', 'internal:other'])
			drawer.onVariablesChanged(changed)

			expect(queueSpy).toHaveBeenCalledWith(changed)
			await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(CONTROL_ID))
		})

		it('does not redraw when the change is disjoint from the last draw', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ usedVariables: new Set(['local:preset_name']) }))
			await drawer.getDrawStyle()

			const queueSpy = vi.spyOn(cacheOf(drawer), 'queueInvalidateVariables')
			drawer.onVariablesChanged(new Set(['internal:unrelated']))

			expect(queueSpy).not.toHaveBeenCalled()
			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('does not redraw when the last draw used no variables', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ usedVariables: new Set() }))
			await drawer.getDrawStyle()

			drawer.onVariablesChanged(new Set(['local:anything']))

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('redraws when a used variable changes while the draw is in flight (mid-draw race)', async () => {
			// The draw suspends mid-flight, having already read the (stale) variable value.
			const pending = deferred<ReturnType<typeof conversionResult>>()
			convertMock.mockReturnValueOnce(pending.promise)

			const drawPromise = drawer.getDrawStyle()

			// The variable it depends on changes before #lastDrawVariables is committed. Previously this was
			// tested against a null/stale #lastDrawVariables and silently dropped.
			drawer.onVariablesChanged(new Set(['local:preset_name']))

			pending.resolve(conversionResult({ usedVariables: new Set(['local:preset_name']) }))
			await drawPromise

			await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(CONTROL_ID))
		})

		it('does not redraw when an unrelated variable changes during the draw', async () => {
			const pending = deferred<ReturnType<typeof conversionResult>>()
			convertMock.mockReturnValueOnce(pending.promise)

			const drawPromise = drawer.getDrawStyle()
			drawer.onVariablesChanged(new Set(['internal:unrelated']))
			pending.resolve(conversionResult({ usedVariables: new Set(['local:preset_name']) }))
			await drawPromise

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('does not leak a change accumulated during a finished draw into a later window', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ usedVariables: new Set(['local:preset_name']) }))
			await drawer.getDrawStyle()

			// A later draw uses a different variable; a change to the first draw's variable now (no draw in
			// flight, disjoint from the last-draw set) must not schedule a redraw.
			convertMock.mockResolvedValueOnce(conversionResult({ usedVariables: new Set(['local:other']) }))
			await drawer.getDrawStyle()

			invalidateSpy.mockClear()
			drawer.onVariablesChanged(new Set(['local:preset_name']))

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})
	})

	describe('onCompositeElementsChanged', () => {
		it('does nothing before any draw', async () => {
			drawer.onCompositeElementsChanged(new Set<CompositeElementIdString>(['conn:elem']))
			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('redraws and evicts when a used composite type changes', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ usedCompositeElements: new Set(['conn:elem']) }))
			await drawer.getDrawStyle()

			const queueSpy = vi.spyOn(cacheOf(drawer), 'queueInvalidateCompositeType')
			const changed = new Set<CompositeElementIdString>(['conn:elem'])
			drawer.onCompositeElementsChanged(changed)

			expect(queueSpy).toHaveBeenCalledWith(changed)
			await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(CONTROL_ID))
		})

		it('does not redraw for an unrelated composite type', async () => {
			convertMock.mockResolvedValueOnce(conversionResult({ usedCompositeElements: new Set(['conn:elem']) }))
			await drawer.getDrawStyle()

			drawer.onCompositeElementsChanged(new Set<CompositeElementIdString>(['conn:other']))

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})
	})

	describe('onButtonDrawn', () => {
		async function drawReferencing(referenced: string[], cyclic: string[] = []) {
			convertMock.mockResolvedValueOnce(
				conversionResult({
					referencedLocations: new Set(referenced),
					cyclicLocations: new Set(cyclic),
				})
			)
			await drawer.getDrawStyle()
		}

		it('ignores a render for a location we do not reference', async () => {
			await drawReferencing(['3/0/0'])

			drawer.onButtonDrawn(OTHER_LOCATION, { referencedLocations: new Set() } as any)

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('redraws and evicts when a referenced location is drawn', async () => {
			await drawReferencing([formatLocation(OTHER_LOCATION)])

			const queueSpy = vi.spyOn(cacheOf(drawer), 'queueInvalidateReferencedLocation')
			drawer.onButtonDrawn(OTHER_LOCATION, { referencedLocations: new Set() } as any)

			expect(queueSpy).toHaveBeenCalledWith(formatLocation(OTHER_LOCATION))
			await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(CONTROL_ID))
		})

		it('suppresses the redraw for an established cycle (target still references us back)', async () => {
			const otherStr = formatLocation(OTHER_LOCATION)
			await drawReferencing([otherStr], [otherStr])

			// The re-rendered target still points back at us -> no visible change, so suppress.
			drawer.onButtonDrawn(OTHER_LOCATION, { referencedLocations: new Set([formatLocation(LOCATION)]) } as any)

			await sleep(30)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})

		it('redraws for a previously-cyclic location once the target no longer references us', async () => {
			const otherStr = formatLocation(OTHER_LOCATION)
			await drawReferencing([otherStr], [otherStr])

			// The target no longer references us -> the cycle is broken, we must redraw.
			drawer.onButtonDrawn(OTHER_LOCATION, { referencedLocations: new Set() } as any)

			await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(CONTROL_ID))
		})
	})

	describe('locationChanged / cache hooks', () => {
		it('clears the conversion cache and redraws on locationChanged', async () => {
			const clearSpy = vi.spyOn(cacheOf(drawer), 'clear')

			drawer.locationChanged()

			expect(clearSpy).toHaveBeenCalled()
			await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith(CONTROL_ID))
		})

		it('queues a single element for invalidation via invalidateElement', () => {
			const queueSpy = vi.spyOn(cacheOf(drawer), 'queueInvalidate')

			drawer.invalidateElement('text0')

			expect(queueSpy).toHaveBeenCalledWith('text0')
		})

		it('clears the whole cache via clearCache', () => {
			const clearSpy = vi.spyOn(cacheOf(drawer), 'clear')

			drawer.clearCache()

			expect(clearSpy).toHaveBeenCalled()
		})
	})

	describe('loadElements / drawElements / visit', () => {
		it('exposes loaded elements and normalises them', () => {
			const clearSpy = vi.spyOn(cacheOf(drawer), 'clear')

			drawer.loadElements([{ id: 'c', type: 'canvas' } as any])

			expect(clearSpy).toHaveBeenCalled()
			expect(drawer.drawElements).toHaveLength(1)
			// Canvas gains its defaulted showStatusIcons during normalisation
			expect((drawer.drawElements[0] as any).showStatusIcons).toBeDefined()
		})

		it('normalises nested group children', () => {
			drawer.loadElements([{ id: 'g', type: 'group', children: [{ id: 'c2', type: 'canvas' }] } as any])

			const group = drawer.drawElements[0] as any
			expect(group.children[0].showStatusIcons).toBeDefined()
		})

		it('treats undefined elements as an empty list', () => {
			drawer.loadElements(undefined)
			expect(drawer.drawElements).toEqual([])
		})

		it('passes the draw elements to a visitor', () => {
			drawer.loadElements([{ id: 'c', type: 'canvas' } as any])
			const visitor = { visitDrawElements: vi.fn() }

			drawer.visit(visitor)

			expect(visitor.visitDrawElements).toHaveBeenCalledWith(drawer.drawElements)
		})
	})

	describe('dispose', () => {
		it('clears the cache and cancels a pending redraw', async () => {
			const clearSpy = vi.spyOn(cacheOf(drawer), 'clear')

			// Schedule a redraw, then dispose before the debounce fires
			drawer.locationChanged()
			drawer.dispose()

			expect(clearSpy).toHaveBeenCalled()
			await sleep(40)
			expect(invalidateSpy).not.toHaveBeenCalled()
		})
	})
})
