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

				text: { value: '', isExpression: false },
				color: { value: 0xffffff, isExpression: false },
				alignment: { value: 'center:center', isExpression: false },
				fontsize: { value: 'auto', isExpression: false },
			}
		case 'image':
			return {
				id: nanoid(),
				name: 'Image',
				type: 'image',
				base64Image: { value: null, isExpression: false },
				alignment: { value: 'center:center', isExpression: false },
			}
		default:
			assertNever(type)
			throw new Error(`Unknown element type: ${type}`)
	}
}
