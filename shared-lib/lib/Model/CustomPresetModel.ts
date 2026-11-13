import z from 'zod'
import type { CustomPresetControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import { LayeredButtonModelSchema, LayeredButtonOptionsSchema, type LayeredButtonModel } from './ButtonModel.js'
import type { CollectionBase } from './Collections.js'

export type CustomPresetCollection = CollectionBase<null>

/**
 * The options of a custom preset: those of the button it places, and how the preset itself is listed. The listing
 * options are not part of the button, so are left out of what is placed
 */
export const CustomPresetOptionsSchema = LayeredButtonOptionsSchema.extend({
	name: z.string().default('New custom preset'),
	description: z.string().default(''),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
})

export type CustomPresetOptions = z.output<typeof CustomPresetOptionsSchema>

/**
 * A user defined preset: a button, built like any other, which is offered in the presets list to be placed as a copy or
 * as a linked preset which follows changes to it
 */
export const CustomPresetModelSchema = LayeredButtonModelSchema.extend({
	type: z.literal('custom-preset'),
	options: CustomPresetOptionsSchema.default(() => CustomPresetOptionsSchema.parse({})),
})

export type CustomPresetModel = z.output<typeof CustomPresetModelSchema>

/**
 * The button a custom preset places, without the options which only describe how the preset is listed
 */
export function convertCustomPresetToButtonModel(model: CustomPresetModel): LayeredButtonModel {
	const {
		name: _name,
		description: _description,
		sortOrder: _sortOrder,
		collectionId: _collectionId,
		...options
	} = model.options

	return {
		type: 'button-layered',
		options,
		style: model.style,
		feedbacks: model.feedbacks,
		steps: model.steps,
		localVariables: model.localVariables,
	}
}

export interface ClientCustomPresetData {
	type: 'custom-preset'
	name: string
	description: string
	sortOrder: number
	collectionId?: string
}

export type CustomPresetsUpdate =
	CustomPresetsUpdateInitOp | CustomPresetsUpdateAddOp | CustomPresetsUpdateRemoveOp | CustomPresetsUpdateUpdateOp

export interface CustomPresetsUpdateInitOp {
	type: 'init'
	customPresets: Record<CustomPresetControlId, ClientCustomPresetData>
}
export interface CustomPresetsUpdateRemoveOp {
	type: 'remove'
	controlId: CustomPresetControlId
}
export interface CustomPresetsUpdateUpdateOp {
	type: 'update'
	controlId: CustomPresetControlId

	patch: ObjectPatch<ClientCustomPresetData>
}
export interface CustomPresetsUpdateAddOp {
	type: 'add'
	controlId: CustomPresetControlId

	info: ClientCustomPresetData
}
