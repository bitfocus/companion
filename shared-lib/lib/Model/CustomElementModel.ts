import z from 'zod'
import { CUSTOM_CONNECTION_ID } from '../ConnectionId.js'
import { ParseControlId, type CustomElementControlId, type SomeControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase } from './Collections.js'
import { AuthorableInputFieldSchema } from './Options.js'
import { SomeButtonGraphicsElementSchema } from './StyleLayersModel.js'

export type CustomElementCollection = CollectionBase<null>

export const CustomElementOptionsSchema = z.object({
	name: z.string().default('New custom element'),
	description: z.string().default(''),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	notes: z.string().default(''),
})

export type CustomElementOptions = z.output<typeof CustomElementOptionsSchema>

/**
 * The composite element which draws a control, if the control is a custom element. A custom element can't contain
 * this element, as it would draw itself
 */
export function getCustomElementUseDefinition(
	controlId: SomeControlId
): { connectionId: string; elementId: string } | null {
	const parsedId = ParseControlId(controlId)
	if (parsedId?.type !== 'custom-element') return null

	return { connectionId: CUSTOM_CONNECTION_ID, elementId: parsedId.customElementId }
}

/**
 * The ids (`<connectionId>:<elementId>`) of the custom elements which can't be added to a control, as drawing them
 * there would come back to the custom element being edited: the custom element itself, and any which use it
 * @param controlId The control being edited, or null when it is not a control
 * @param customElements Each custom element, by its control id
 */
export function getCustomElementUsesExcludedFrom(
	controlId: SomeControlId | null,
	customElements: Iterable<[CustomElementControlId, Pick<ClientCustomElementData, 'usedCustomElementIds'>]>
): Set<string> {
	const excluded = new Set<string>()
	if (!controlId) return excluded

	const self = getCustomElementUseDefinition(controlId)
	if (!self) return excluded

	excluded.add(`${self.connectionId}:${self.elementId}`)
	for (const [otherControlId, info] of customElements) {
		const other = getCustomElementUseDefinition(otherControlId)
		if (other && info.usedCustomElementIds.includes(self.elementId)) {
			excluded.add(`${other.connectionId}:${other.elementId}`)
		}
	}

	return excluded
}

/**
 * A user defined composite element: a tree of elements, with user defined inputs, which is offered as an element of
 * its own
 */
export const CustomElementModelSchema = z.object({
	type: z.literal('custom-element'),
	options: CustomElementOptionsSchema.default(() => CustomElementOptionsSchema.parse({})),

	/** The inputs of the element, available to its elements as `$(options:<id>)` */
	inputs: z.array(AuthorableInputFieldSchema).default(() => []),

	/** The elements drawn in place of the element. It has no canvas, as it is drawn inside the bounds of its use */
	elements: z.array(SomeButtonGraphicsElementSchema).default(() => []),
})

export type CustomElementModel = z.output<typeof CustomElementModelSchema>

export interface ClientCustomElementData extends CustomElementOptions {
	type: 'custom-element'
	/** The ids of every custom element it uses, directly or through others */
	usedCustomElementIds: string[]
	/** The ids along a path of uses which comes back to it, starting with it, or null if there is none */
	useLoop: string[] | null
}

/** An element which uses a custom element */
export interface CustomElementUse {
	/** The control holding the element, which may be another custom element */
	readonly controlId: SomeControlId
	readonly elementId: string
	/** Whether the element, or a group it is in, is never drawn */
	readonly disabled: boolean
}

export type CustomElementsUpdate =
	CustomElementsUpdateInitOp | CustomElementsUpdateAddOp | CustomElementsUpdateRemoveOp | CustomElementsUpdateUpdateOp

export interface CustomElementsUpdateInitOp {
	type: 'init'
	customElements: Record<CustomElementControlId, ClientCustomElementData>
}
export interface CustomElementsUpdateRemoveOp {
	type: 'remove'
	controlId: CustomElementControlId
}
export interface CustomElementsUpdateUpdateOp {
	type: 'update'
	controlId: CustomElementControlId

	patch: ObjectPatch<ClientCustomElementData>
}
export interface CustomElementsUpdateAddOp {
	type: 'add'
	controlId: CustomElementControlId

	info: ClientCustomElementData
}
