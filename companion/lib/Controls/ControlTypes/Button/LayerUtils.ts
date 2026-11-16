import { nanoid } from 'nanoid'
import {
	SomeButtonGraphicsElementSchema,
	type SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'

export function cloneElementWithNewIds(element: SomeButtonGraphicsElement): SomeButtonGraphicsElement {
	if (element.type === 'group' && Array.isArray(element.children)) {
		return {
			...structuredClone(element),
			id: nanoid(),
			children: element.children.map(cloneElementWithNewIds),
		}
	}
	return { ...structuredClone(element), id: nanoid() }
}

/**
 * Backfill missing properties and migrate legacy values on loaded elements, in place, recursing into group children
 * so that nested layers stay consistent with top-level ones.
 */
export function normalizeLoadedElements(elements: SomeButtonGraphicsElement[]): void {
	for (const element of elements) {
		normalizeLoadedElement(element)
	}
}

function normalizeLoadedElement(element: SomeButtonGraphicsElement): void {
	// Fill in the properties added since the element was saved, with the defaults that keep it drawing as it did.
	// Not the values a new element is created with, which can differ to show off what the element can do
	const parsed = SomeButtonGraphicsElementSchema.safeParse(element)
	if (parsed.success) {
		for (const [key, value] of Object.entries(parsed.data)) {
			if (!(key in element)) (element as Record<string, unknown>)[key] = value
		}
	}

	switch (element.type) {
		case 'image':
			if (!element.fillMode.isExpression && (element.fillMode.value as string) === 'fit_or_shrink') {
				element.fillMode.value = 'fit'
			}
			break
		case 'line': {
			// Line position used to reuse the box inside/center/outside enum, which is meaningless for a line
			const position = element.borderPosition.value
			if (!element.borderPosition.isExpression && (position === 'inside' || position === 'outside')) {
				element.borderPosition = { isExpression: false, value: 'center' }
			}
			break
		}
		case 'group':
			normalizeLoadedElements(element.children)
			break
	}
}
