import { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { nanoid } from 'nanoid'

export function CreateElementOfType(type: SomeButtonGraphicsElement['type']): SomeButtonGraphicsElement {
	switch (type) {
		case 'canvas':
			throw new Error('Canvas c can not be created')
		case 'text':
			return {
				id: nanoid(),
				name: 'Text',
				type: 'text',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 1, isExpression: false },
				height: { value: 1, isExpression: false },
				text: { value: '', isExpression: false },
				color: { value: 0xffffff, isExpression: false },
				halign: { value: 'center', isExpression: false },
				valign: { value: 'center', isExpression: false },
				fontsize: { value: 'auto', isExpression: false },
			}
		case 'image':
			return {
				id: nanoid(),
				name: 'Image',
				type: 'image',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 1, isExpression: false },
				height: { value: 1, isExpression: false },
				base64Image: { value: null, isExpression: false },
				halign: { value: 'center', isExpression: false },
				valign: { value: 'center', isExpression: false },
				fillMode: { value: 'fit_or_shrink', isExpression: false },
			}
		case 'box':
			return {
				id: nanoid(),
				name: 'Box',
				type: 'box',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 1, isExpression: false },
				height: { value: 1, isExpression: false },
				color: { value: 0xff0000, isExpression: false },
			}
		case 'group':
			return {
				id: nanoid(),
				name: 'Group',
				type: 'group',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 1, isExpression: false },
				height: { value: 1, isExpression: false },
				children: [],
			}
		default:
			assertNever(type)
			throw new Error(`Unknown element type: ${type}`)
	}
}
