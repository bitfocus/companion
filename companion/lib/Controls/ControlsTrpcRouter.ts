import type EventEmitter from 'node:events'
import z from 'zod'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ButtonReferenceButtonModel, SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { JsonValueSchema } from '@companion-app/shared/Model/Options.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import type { Logger } from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { zodLocation } from '../Preview/Graphics.js'
import { publicProcedure } from '../UI/TRPC.js'
import type { ControlCommonEvents } from './ControlDependencies.js'
import type { ControlsController } from './Controller.js'
import { ControlButtonPresetReference } from './ControlTypes/Button/PresetReference.js'
import { GridTransferError, planGridTransfer } from './GridTransfer.js'
import type { SomeControl } from './IControlFragments.js'

/** A sanity bound on one batch. Far above any real selection, but stops a malformed request. */
const MAX_BATCH_LOCATIONS = 4096

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createControlsTrpcRouter(
	logger: Logger,
	controlsMap: Map<string, SomeControl<any>>,
	pageStore: IPageStore,
	instanceDefinitions: InstanceDefinitions,
	controlEvents: EventEmitter<ControlCommonEvents>,
	controlsController: ControlsController,
	userconfig: DataUserConfig
) {
	/**
	 * The UI works out where buttons go, but a location off the grid puts a button somewhere nothing
	 * can reach - so check here too rather than trusting the arithmetic that produced it.
	 */
	const isOnGrid = (location: ControlLocation): boolean => {
		const { minColumn, maxColumn, minRow, maxRow } = userconfig.getKey('gridSize')
		return (
			location.row >= minRow && location.row <= maxRow && location.column >= minColumn && location.column <= maxColumn
		)
	}

	return {
		importPreset: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					presetId: z.string(),
					location: zodLocation,
					variableValues: z.record(z.string(), JsonValueSchema.optional()).nullable(),
					/** Whether to place a live reference to the preset, or a one-off copy of its data */
					mode: z.enum(['copy', 'reference']).default('reference'),
				})
			)
			.mutation(async ({ input }) => {
				// Preset references (linked presets) are only supported by 2.0+ modules. Guard here so that an old
				// module can never be placed as a reference, even if the request asks for it - it falls back to a copy.
				const useReference =
					input.mode === 'reference' && instanceDefinitions.doesConnectionSupportPresetReferences(input.connectionId)

				const model = useReference
					? instanceDefinitions.convertPresetToReferenceControlModel(
							input.connectionId,
							input.presetId,
							input.variableValues
						)
					: instanceDefinitions.convertPresetToControlModel(input.connectionId, input.presetId, input.variableValues)
				if (!model) return null

				return controlsController.importControl(input.location, model)
			}),

		createReferenceControl: publicProcedure
			.input(
				z.object({
					fromLocation: zodLocation,
					toLocation: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				const fromStr = formatLocation(input.fromLocation)

				// Don't create a circular reference
				if (fromStr === formatLocation(input.toLocation)) return null

				// Don't place at an unreachable location
				if (!pageStore.isPageValid(input.toLocation.pageNumber)) return null

				// Place a button that mirrors `fromLocation`. Stored as a plain (non-expression) location string.
				const model: ButtonReferenceButtonModel = {
					type: 'button-reference',
					options: {
						location: { value: fromStr, isExpression: false },
					},
				}
				return controlsController.importControl(input.toLocation, model)
			}),

		setPresetReferenceVariable: publicProcedure
			.input(
				z.object({
					location: zodLocation,
					variableName: z.string(),
					value: JsonValueSchema.optional(),
				})
			)
			.mutation(async ({ input }) => {
				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return false

				const control = controlsMap.get(controlId)
				if (!(control instanceof ControlButtonPresetReference)) return false

				return control.setTemplateVariableValue(input.variableName, input.value)
			}),

		setPresetReferenceConnection: publicProcedure
			.input(
				z.object({
					location: zodLocation,
					connectionId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return false

				const control = controlsMap.get(controlId)
				if (!(control instanceof ControlButtonPresetReference)) return false

				return control.setReferencedConnection(input.connectionId)
			}),

		convertControl: publicProcedure
			.input(
				z.object({
					location: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return null

				const control = controlsMap.get(controlId)
				if (!control || !control.supportsConvert) return null

				const newModel = control.convertControl()
				return controlsController.importControl(input.location, newModel)
			}),

		resetControl: publicProcedure
			.input(
				z.object({
					location: zodLocation,
					newType: z.string().optional(),
				})
			)
			.mutation(async ({ input }) => {
				const { location, newType } = input

				const controlId = pageStore.getControlIdAt(location)

				if (controlId) {
					controlsController.deleteControl(controlId)
				}

				if (newType) {
					controlsController.createButtonControl(location, newType)
				}
			}),

		/**
		 * Copy, move or swap any number of buttons in one go.
		 *
		 * The whole batch is planned against the state as it was before anything moved, so overlapping
		 * source and destination regions are well defined - nudging a block one column across reads
		 * every source before it writes anything. It is also all-or-nothing: an invalid page rejects
		 * the request rather than leaving half of it applied.
		 */
		gridBatchTransfer: publicProcedure
			.input(
				z.object({
					operation: z.enum(['copy', 'move', 'swap']),
					pairs: z
						.array(
							z.object({
								fromLocation: zodLocation,
								toLocation: zodLocation,
							})
						)
						.min(1)
						.max(MAX_BATCH_LOCATIONS),
				})
			)
			.mutation(async ({ input }) => {
				const { operation, pairs } = input

				for (const { fromLocation, toLocation } of pairs) {
					if (!pageStore.isPageValid(fromLocation.pageNumber) || !pageStore.isPageValid(toLocation.pageNumber)) {
						logger.warn(`Rejecting ${operation} of ${pairs.length} buttons: invalid page`)
						return false
					}
					if (!isOnGrid(toLocation)) {
						logger.warn(
							`Rejecting ${operation} of ${pairs.length} buttons: ${formatLocation(toLocation)} is off the grid`
						)
						return false
					}
				}

				let plan
				try {
					plan = planGridTransfer(operation, pairs, (location) => pageStore.getControlIdAt(location))
				} catch (e) {
					if (e instanceof GridTransferError) {
						logger.warn(`Rejecting ${operation} of ${pairs.length} buttons: ${e.message}`)
						return false
					}
					throw e
				}

				if (plan.placements.length === 0) return false

				// Serialise everything being cloned before anything is deleted - a source can also be a
				// destination, and it must be read as it was at the start
				const clonedJson = new Map<string, SomeButtonModel>()
				for (const placement of plan.placements) {
					if (placement.kind !== 'clone' || clonedJson.has(placement.sourceControlId)) continue

					const control = controlsMap.get(placement.sourceControlId)
					if (control) clonedJson.set(placement.sourceControlId, control.toJSON(true) as SomeButtonModel)
				}

				// Where each control being moved started, so a change of page can be reported to it
				const previousLocations = new Map<string, ControlLocation>()
				for (const placement of plan.placements) {
					if (placement.kind !== 'existing') continue

					const previous = pageStore.getLocationOfControlId(placement.controlId)
					if (previous) previousLocations.set(placement.controlId, previous)
				}

				for (const controlId of plan.discardedControlIds) {
					controlsController.deleteControl(controlId)
				}

				// Empty every affected slot before filling any of them, so overlapping regions cannot fight
				for (const placement of plan.placements) {
					controlEvents.emit('controlRemovedFrom', placement.location)
				}

				for (const placement of plan.placements) {
					switch (placement.kind) {
						case 'empty':
							break
						case 'existing':
							controlEvents.emit('controlPlacedAt', placement.location, placement.controlId)
							break
						case 'clone': {
							const json = clonedJson.get(placement.sourceControlId)
							if (json) controlsController.importControl(placement.location, json)
							break
						}
					}
				}

				// Tell the controls that moved where they have ended up
				for (const placement of plan.placements) {
					if (placement.kind !== 'existing') continue

					const control = controlsMap.get(placement.controlId)
					if (control) control.triggerLocationHasChanged()

					const previous = previousLocations.get(placement.controlId)
					if (previous) {
						controlsController.notifyControlMovedPage(
							placement.controlId,
							previous.pageNumber,
							placement.location.pageNumber
						)
					}
				}

				for (const placement of plan.placements) {
					controlEvents.emit('invalidateLocationRender', placement.location)
				}
				for (const { fromLocation } of pairs) {
					controlEvents.emit('invalidateLocationRender', fromLocation)
				}

				return true
			}),

		/** Clear any number of buttons, optionally recreating them as a given type */
		resetControls: publicProcedure
			.input(
				z.object({
					locations: z.array(zodLocation).min(1).max(MAX_BATCH_LOCATIONS),
					newType: z.string().nullable(),
				})
			)
			.mutation(async ({ input }) => {
				for (const location of input.locations) {
					if (input.newType && !isOnGrid(location)) {
						logger.warn(`Refusing to create a button at ${formatLocation(location)}: off the grid`)
						continue
					}

					const controlId = pageStore.getControlIdAt(location)
					if (controlId) {
						controlsController.deleteControl(controlId)
					}

					if (input.newType) {
						controlsController.createButtonControl(location, input.newType)
					}
				}
			}),

		hotPressControl: publicProcedure
			.input(
				z.object({
					location: zodLocation,
					direction: z.boolean(),
					surfaceId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				logger.silly(
					`being told from gui to hot press ${formatLocation(input.location)} ${input.direction} ${input.surfaceId}`
				)
				if (!input.surfaceId) throw new Error('Missing surfaceId')

				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return

				controlsController.pressControl(controlId, input.direction, `hot:${input.surfaceId}`)
			}),

		hotRotateControl: publicProcedure
			.input(
				z.object({
					location: zodLocation,
					direction: z.boolean(),
					surfaceId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				logger.silly(
					`being told from gui to hot rotate ${formatLocation(input.location)} ${input.direction} ${input.surfaceId}`
				)

				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return

				controlsController.rotateControl(
					controlId,
					input.direction ? 1 : -1,
					input.surfaceId ? `hot:${input.surfaceId}` : undefined
				)
			}),

		hotAbortControl: publicProcedure
			.input(
				z.object({
					location: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				logger.silly(`being told from gui to abort actions on ${formatLocation(input.location)}`)

				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return

				controlsController.abortAllDelayedActions(null)
			}),

		setOptionsField: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					key: z.string(),
					value: JsonValueSchema.optional(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsOptions) {
					return control.optionsSetField(input.key, input.value)
				} else {
					throw new Error(`Control "${input.controlId}" does not support options`)
				}
			}),
	}
}
