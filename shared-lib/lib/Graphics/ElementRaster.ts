import type { SomeButtonGraphicsDrawElement } from '../Model/StyleLayersModel.js'

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
