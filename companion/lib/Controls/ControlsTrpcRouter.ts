import type EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import { CreateBankControlId, formatLocation } from '@companion-app/shared/ControlId.js'
import { JsonValueSchema } from '@companion-app/shared/Model/Options.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import type { Logger } from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { zodLocation } from '../Preview/Graphics.js'
import { publicProcedure } from '../UI/TRPC.js'
import type { ControlCommonEvents } from './ControlDependencies.js'
import type { ControlsController } from './Controller.js'
import { ControlButtonPresetReference } from './ControlTypes/Button/PresetReference.js'
import type { ControlsFactory } from './Factory.js'
import type { SomeControl } from './IControlFragments.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createControlsTrpcRouter(
	logger: Logger,
	controlsMap: Map<string, SomeControl<any>>,
	pageStore: IPageStore,
	instanceDefinitions: InstanceDefinitions,
	controlEvents: EventEmitter<ControlCommonEvents>,
	controlsController: ControlsController,
	factory: ControlsFactory
) {
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

		moveControl: publicProcedure
			.input(
				z.object({
					fromLocation: zodLocation,
					toLocation: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				const { fromLocation, toLocation } = input

				// Don't try moving over itself
				if (
					fromLocation.pageNumber === toLocation.pageNumber &&
					fromLocation.column === toLocation.column &&
					fromLocation.row === toLocation.row
				)
					return false

				// Make sure target page number is valid
				if (!pageStore.isPageValid(toLocation.pageNumber)) return false

				// Make sure there is something to move
				const fromControlId = pageStore.getControlIdAt(fromLocation)
				if (!fromControlId) return false

				// Delete the control at the destination
				const toControlId = pageStore.getControlIdAt(toLocation)
				if (toControlId) {
					controlsController.deleteControl(toControlId)
				}

				// Perform the move
				controlEvents.emit('controlRemovedFrom', fromLocation)
				controlEvents.emit('controlPlacedAt', toLocation, fromControlId)

				// Inform the control it was moved
				const control = controlsMap.get(fromControlId)
				if (control) control.triggerLocationHasChanged()

				// Force a redraw
				controlEvents.emit('invalidateLocationRender', fromLocation)
				controlEvents.emit('invalidateLocationRender', toLocation)

				return true
			}),

		copyControl: publicProcedure
			.input(
				z.object({
					fromLocation: zodLocation,
					toLocation: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				const { fromLocation, toLocation } = input

				// Don't try copying over itself
				if (
					fromLocation.pageNumber === toLocation.pageNumber &&
					fromLocation.column === toLocation.column &&
					fromLocation.row === toLocation.row
				)
					return false

				// Make sure target page number is valid
				if (!pageStore.isPageValid(toLocation.pageNumber)) return false

				// Make sure there is something to copy
				const fromControlId = pageStore.getControlIdAt(fromLocation)
				if (!fromControlId) return false

				const fromControl = controlsMap.get(fromControlId)
				if (!fromControl) return false
				const controlJson = fromControl.toJSON(true)

				// Delete the control at the destination
				const toControlId = pageStore.getControlIdAt(toLocation)
				if (toControlId) {
					controlsController.deleteControl(toControlId)
				}

				const newControlId = CreateBankControlId(nanoid())
				const newControl = factory.createClassForControl(newControlId, 'button', controlJson, true)
				if (newControl) {
					controlsMap.set(newControlId, newControl)

					controlEvents.emit('controlPlacedAt', toLocation, newControlId)

					// Ensure it is redrawn
					newControl.commitChange(true)

					return true
				}

				return false
			}),

		swapControl: publicProcedure
			.input(
				z.object({
					fromLocation: zodLocation,
					toLocation: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				const { fromLocation, toLocation } = input

				// Don't try moving over itself
				if (
					fromLocation.pageNumber === toLocation.pageNumber &&
					fromLocation.column === toLocation.column &&
					fromLocation.row === toLocation.row
				)
					return false

				// Make sure both page numbers are valid
				if (!pageStore.isPageValid(toLocation.pageNumber) || !pageStore.isPageValid(fromLocation.pageNumber))
					return false

				// Find the ids to move
				const fromControlId = pageStore.getControlIdAt(fromLocation)
				const toControlId = pageStore.getControlIdAt(toLocation)

				// Perform the swap
				controlEvents.emit('controlRemovedFrom', toLocation)
				if (toControlId) {
					controlEvents.emit('controlPlacedAt', fromLocation, toControlId)
				} else {
					controlEvents.emit('controlRemovedFrom', fromLocation)
				}
				if (fromControlId) {
					controlEvents.emit('controlPlacedAt', toLocation, fromControlId)
				}

				// Inform the controls they were moved
				const controlA = fromControlId && controlsMap.get(fromControlId)
				if (controlA) controlA.triggerLocationHasChanged()
				const controlB = toControlId && controlsMap.get(toControlId)
				if (controlB) controlB.triggerLocationHasChanged()

				// Force a redraw
				controlEvents.emit('invalidateLocationRender', fromLocation)
				controlEvents.emit('invalidateLocationRender', toLocation)

				return true
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
					input.direction,
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
