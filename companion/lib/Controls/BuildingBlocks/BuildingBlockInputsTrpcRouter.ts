import z from 'zod'
import { zodSomeControlId, type SomeControlId } from '@companion-app/shared/ControlId.js'
import { AuthorableInputFieldSchema } from '@companion-app/shared/Model/Options.js'
import { publicProcedure, router } from '../../UI/TRPC.js'
import type { ControlStore } from '../ControlStore.js'
import { removeBuildingBlockInputInCallers, renameBuildingBlockInputInCallers } from './BuildingBlockCallers.js'
import type { BuildingBlockInputs } from './BuildingBlockInputs.js'

/**
 * The procedures to edit the inputs of any kind of building block, keeping whatever uses one in step
 * @param controlStore The store of all the controls
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createBuildingBlockInputsTrpcRouter(controlStore: ControlStore) {
	function getInputs(controlId: SomeControlId): BuildingBlockInputs | undefined {
		const control = controlStore.controls.get(controlId)
		return control?.supportsBuildingBlockInputs ? control.buildingBlockInputs : undefined
	}

	return router({
		add: publicProcedure
			.input(z.object({ controlId: zodSomeControlId, field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const inputs = getInputs(input.controlId)
				if (!inputs) return false

				return inputs.add(input.field)
			}),

		remove: publicProcedure
			.input(z.object({ controlId: zodSomeControlId, inputId: z.string() }))
			.mutation(({ input }) => {
				const inputs = getInputs(input.controlId)
				if (!inputs) return false

				if (!inputs.remove(input.inputId)) return false

				removeBuildingBlockInputInCallers(controlStore, input.controlId, input.inputId)

				return true
			}),

		move: publicProcedure
			.input(z.object({ controlId: zodSomeControlId, inputId: z.string(), index: z.number().int().min(0) }))
			.mutation(({ input }) => {
				const inputs = getInputs(input.controlId)
				if (!inputs) return false

				return inputs.move(input.inputId, input.index)
			}),

		update: publicProcedure
			.input(z.object({ controlId: zodSomeControlId, inputId: z.string(), field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const inputs = getInputs(input.controlId)
				if (!inputs) return false

				if (!inputs.update(input.inputId, input.field)) return false

				// Make sure whatever uses it keeps its value for a renamed input
				if (input.field.id !== input.inputId) {
					renameBuildingBlockInputInCallers(controlStore, input.controlId, input.inputId, input.field.id)
				}

				return true
			}),
	})
}
