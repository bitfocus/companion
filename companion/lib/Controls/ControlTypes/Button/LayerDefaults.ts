import { SomeButtonGraphicsLayer } from '@companion-app/shared/Model/StyleLayersModel.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { nanoid } from 'nanoid'

export function CreateLayerOfType(type: SomeButtonGraphicsLayer['type']): SomeButtonGraphicsLayer {
	switch (type) {
		case 'canvas':
			throw new Error('Canvas layers can not be created')
		case 'text':
			return {
				id: nanoid(),
				name: 'Text',
				type: 'text',
				text: '',
				isExpression: false,
				fontsize: 'auto',
				alignment: 'center:center',
				color: 0xffffff,
			}
		case 'image':
			return {
				id: nanoid(),
				name: 'Image',
				type: 'image',
				base64Image: null,
				alignment: 'center:center',
			}
		default:
			assertNever(type)
			throw new Error(`Unknown layer type: ${type}`)
	}
}
