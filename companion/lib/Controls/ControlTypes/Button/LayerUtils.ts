import { nanoid } from 'nanoid'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'

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
