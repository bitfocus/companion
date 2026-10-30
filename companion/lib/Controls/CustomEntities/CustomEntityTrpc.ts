import z from 'zod'
import {
	AuthorableInputFieldSchema,
	type AuthorableInputField,
	type ExpressionableOptionsObject,
} from '@companion-app/shared/Model/Options.js'
import { publicProcedure } from '../../UI/TRPC.js'
import type { ControlStore } from '../ControlStore.js'

/**
 * The editing of the inputs of a custom action or feedback
 */
export interface CustomEntityInputsEditable {
	inputAdd(field: AuthorableInputField): boolean
	inputRemove(inputId: string): boolean
	inputMove(inputId: string, target: number): boolean
	inputUpdate(inputId: string, field: AuthorableInputField): boolean
}

/**
 * Update the entities which call a custom action or feedback, after one of its inputs has been renamed
 * @param controlStore The store of all the controls
 * @param call The connection and definition of the entities which call it
 * @param fromId The old id of the input
 * @param toId The new id of the input
 */
export function renameCustomEntityInputInCallers(
	controlStore: ControlStore,
	call: { connectionId: string; definitionId: string },
	fromId: string,
	toId: string
): void {
	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (entity.connectionId !== call.connectionId || entity.definitionId !== call.definitionId) continue
			if (!(fromId in entity.rawOptions)) continue

			const newOptions: ExpressionableOptionsObject = {}
			for (const [key, value] of Object.entries(entity.rawOptions)) {
				newOptions[key === fromId ? toId : key] = value
			}
			entity.setOptions(newOptions)
			changed = true
		}

		if (changed) control.commitChange(false)
	}
}

/**
 * The procedures to edit the inputs of a custom action or feedback
 * @param controlStore The store of all the controls
 * @param getControl Get the custom entity with a control id
 * @param getCallDefinition Get the connection and definition of the entities which call a custom entity
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomEntityInputsProcedures(
	controlStore: ControlStore,
	getControl: (controlId: string) => CustomEntityInputsEditable | undefined,
	getCallDefinition: (controlId: string) => { connectionId: string; definitionId: string } | null
) {
	return {
		inputAdd: publicProcedure
			.input(z.object({ controlId: z.string(), field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				return control.inputAdd(input.field)
			}),

		inputRemove: publicProcedure
			.input(z.object({ controlId: z.string(), inputId: z.string() }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				return control.inputRemove(input.inputId)
			}),

		inputMove: publicProcedure
			.input(z.object({ controlId: z.string(), inputId: z.string(), index: z.number().int().min(0) }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				return control.inputMove(input.inputId, input.index)
			}),

		inputUpdate: publicProcedure
			.input(z.object({ controlId: z.string(), inputId: z.string(), field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const control = getControl(input.controlId)
				if (!control) return false

				if (!control.inputUpdate(input.inputId, input.field)) return false

				// Make sure the entities using it keep their value for a renamed input
				const call = getCallDefinition(input.controlId)
				if (call && input.field.id !== input.inputId) {
					renameCustomEntityInputInCallers(controlStore, call, input.inputId, input.field.id)
				}

				return true
			}),
	}
}
