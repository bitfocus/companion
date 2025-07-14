import { publicProcedure } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import z from 'zod'
import { zodLocation } from '../Graphics/Preview.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import type { ControlsController } from './Controller.js'
import type { PageController } from '../Page/Controller.js'
import { CreateBankControlId, formatLocation } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { Logger } from '../Log/Controller.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createControlsTrpcRouter(
	logger: Logger,
	controlsMap: Map<string, SomeControl<any>>,
	pageController: PageController,
	instanceDefinitions: InstanceDefinitions,
	graphicsController: GraphicsController,
	controlsController: ControlsController
) {
	return {
		importPreset: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					presetId: z.string(),
					location: zodLocation,
				})
			)
			.mutation(async ({ input }) => {
				const model = instanceDefinitions.convertPresetToControlModel(input.connectionId, input.presetId)
				if (!model) return null

				return controlsController.importControl(input.location, model)
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

				const controlId = pageController.getControlIdAt(location)

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
				if (!pageController.isPageValid(toLocation.pageNumber)) return false

				// Make sure there is something to move
				const fromControlId = pageController.getControlIdAt(fromLocation)
				if (!fromControlId) return false

				// Delete the control at the destination
				const toControlId = pageController.getControlIdAt(toLocation)
				if (toControlId) {
					controlsController.deleteControl(toControlId)
				}

				// Perform the move
				pageController.setControlIdAt(fromLocation, null)
				pageController.setControlIdAt(toLocation, fromControlId)

				// Inform the control it was moved
				const control = controlsMap.get(fromControlId)
				if (control) control.triggerLocationHasChanged()

				// Force a redraw
				graphicsController.invalidateButton(fromLocation)
				graphicsController.invalidateButton(toLocation)

				return false
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
				if (!pageController.isPageValid(toLocation.pageNumber)) return false

				// Make sure there is something to copy
				const fromControlId = pageController.getControlIdAt(fromLocation)
				if (!fromControlId) return false

				const fromControl = controlsMap.get(fromControlId)
				if (!fromControl) return false
				const controlJson = fromControl.toJSON(true)

				// Delete the control at the destination
				const toControlId = pageController.getControlIdAt(toLocation)
				if (toControlId) {
					controlsController.deleteControl(toControlId)
				}

				const newControlId = CreateBankControlId(nanoid())
				const newControl = controlsController.createClassForControl(newControlId, 'button', controlJson, true)
				if (newControl) {
					controlsMap.set(newControlId, newControl)

					pageController.setControlIdAt(toLocation, newControlId)

					newControl.triggerRedraw()

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
				if (!pageController.isPageValid(toLocation.pageNumber) || !pageController.isPageValid(fromLocation.pageNumber))
					return false

				// Find the ids to move
				const fromControlId = pageController.getControlIdAt(fromLocation)
				const toControlId = pageController.getControlIdAt(toLocation)

				// Perform the swap
				pageController.setControlIdAt(toLocation, null)
				pageController.setControlIdAt(fromLocation, toControlId)
				pageController.setControlIdAt(toLocation, fromControlId)

				// Inform the controls they were moved
				const controlA = fromControlId && controlsMap.get(fromControlId)
				if (controlA) controlA.triggerLocationHasChanged()
				const controlB = toControlId && controlsMap.get(toControlId)
				if (controlB) controlB.triggerLocationHasChanged()

				// Force a redraw
				graphicsController.invalidateButton(fromLocation)
				graphicsController.invalidateButton(toLocation)

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

				const controlId = pageController.getControlIdAt(input.location)
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

				const controlId = pageController.getControlIdAt(input.location)
				if (!controlId) return

				controlsController.rotateControl(
					controlId,
					input.direction,
					input.surfaceId ? `hot:${input.surfaceId}` : undefined
				)
			}),

		setStyleFields: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					styleFields: z.record(z.any()),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsStyle) {
					return control.styleSetFields(input.styleFields)
				} else {
					throw new Error(`Control "${input.controlId}" does not support config`)
				}
			}),

		setOptionsField: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					key: z.string(),
					value: z.any(),
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
