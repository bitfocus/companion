import type { SomeButtonGraphicsDrawElement } from '../Model/StyleLayersModel.js'

/**
 * Element types the backend rasterises for the editor preview, sending it a `raster` element in their place, as
 * the preview can't draw them identically itself. Text is here because font selection, measurement and shaping
 * vary by browser and OS.
 */
export const RASTERISED_ELEMENT_TYPES: ReadonlySet<string> = new Set<SomeButtonGraphicsDrawElement['type']>(['text'])

/** The canvas a raster is rendered for, which must match the one it is drawn into */
export interface ElementRasterCanvas {
	width: number
	height: number
	paddingX: number
	paddingY: number
}

/**
 * Reduce an element tree to just the path to the given element, so it can be drawn in isolation with its
 * parents' layout. The element can be inside a group, or inside the children a reference embeds.
 * The element and its ancestors keep their bounds and rotation, but have their opacity reset: the preview applies
 * that itself, from the `raster` element and through the same temporary layers as the rest of a group.
 * Siblings don't affect an element's layout, so they are dropped.
 * @returns The pruned tree, or null if the element was not found
 */
export function pruneElementsToTarget(
	elements: SomeButtonGraphicsDrawElement[],
	elementId: string
): SomeButtonGraphicsDrawElement[] | null {
	for (const element of elements) {
		if (element.id === elementId) return [element.type === 'canvas' ? element : { ...element, opacity: 1 }]

		if (element.type === 'group' || element.type === 'reference') {
			const children = pruneElementsToTarget(element.children, elementId)
			if (children) return [{ ...element, opacity: 1, children }]
		}
	}

	return null
}
