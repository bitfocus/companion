import z from 'zod'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { AuthorableInputFieldSchema, type AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import { publicProcedure, router } from '../../UI/TRPC.js'
import type { ControlStore } from '../ControlStore.js'
import { removeBuildingBlockInputInCallers, renameBuildingBlockInputInCallers } from './BuildingBlockCallers.js'

/** A building block whose inputs can be edited */
export interface BuildingBlockWithInputs {
	inputAdd(field: AuthorableInputField): boolean
	inputRemove(inputId: string): boolean
	inputMove(inputId: string, target: number): boolean
	inputUpdate(inputId: string, field: AuthorableInputField): boolean
}

/**
 * The procedures to edit the inputs of a kind of building block, keeping whatever uses one in step
 * @param controlStore The store of all the controls
 * @param zodControlId The schema of the control id of this kind, so that each kind's procedures take only its own
 * @param getControl The building block with a control id, or undefined if there is none
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createBuildingBlockInputsTrpcRouter<TId extends SomeControlId, TInputId>(
	controlStore: ControlStore,
	// The core type, as the branded control ids carry their brand only on the core output type
	zodControlId: z.core.$ZodType<TId, TInputId>,
	getControl: (controlId: TId) => BuildingBlockWithInputs | undefined
) {
	return router({
		add: publicProcedure
			.input(z.object({ controlId: zodControlId, field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				return control.inputAdd(input.field)
			}),

		remove: publicProcedure.input(z.object({ controlId: zodControlId, inputId: z.string() })).mutation(({ input }) => {
			const control = getControl(input.controlId)
			if (!control) return false

			if (!control.inputRemove(input.inputId)) return false

			removeBuildingBlockInputInCallers(controlStore, input.controlId, input.inputId)

			return true
		}),

		move: publicProcedure
			.input(z.object({ controlId: zodControlId, inputId: z.string(), index: z.number().int().min(0) }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				return control.inputMove(input.inputId, input.index)
			}),

		update: publicProcedure
			.input(z.object({ controlId: zodControlId, inputId: z.string(), field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				if (!control.inputUpdate(input.inputId, input.field)) return false

				// Make sure whatever uses it keeps its value for a renamed input
				if (input.field.id !== input.inputId) {
					renameBuildingBlockInputInCallers(controlStore, input.controlId, input.inputId, input.field.id)
				}

				return true
			}),
	})
}
