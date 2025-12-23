import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
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
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'text',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				rotation: { value: 0, isExpression: false },
				text: { value: '', isExpression: false },
				color: { value: 0xffffff, isExpression: false },
				halign: { value: 'center', isExpression: false },
				valign: { value: 'center', isExpression: false },
				fontsize: { value: 'auto', isExpression: false },
				outlineColor: { value: 0xff000000, isExpression: false },
			}
		case 'image':
			return {
				id: nanoid(),
				name: 'Image',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'image',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				rotation: { value: 0, isExpression: false },
				base64Image: { value: null, isExpression: false },
				halign: { value: 'center', isExpression: false },
				valign: { value: 'center', isExpression: false },
				fillMode: { value: 'fit_or_shrink', isExpression: false },
			}
		case 'box':
			return {
				id: nanoid(),
				name: 'Box',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'box',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				rotation: { value: 0, isExpression: false },
				color: { value: 0xff0000, isExpression: false },
				borderWidth: { value: 0, isExpression: false },
				borderColor: { value: 0, isExpression: false },
				borderPosition: { value: 'inside', isExpression: false },
			}
		case 'group':
			return {
				id: nanoid(),
				name: 'Group',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'group',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				rotation: { value: 0, isExpression: false },
				children: [],
			}
		case 'line':
			return {
				id: nanoid(),
				name: 'Line',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'line',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				fromX: { value: 0, isExpression: false },
				fromY: { value: 0, isExpression: false },
				toX: { value: 100, isExpression: false },
				toY: { value: 100, isExpression: false },
				borderWidth: { value: 2, isExpression: false },
				borderColor: { value: 0xffffff, isExpression: false },
				borderPosition: { value: 'center', isExpression: false },
			}
		case 'circle':
			return {
				id: nanoid(),
				name: 'Circle',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'circle',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				color: { value: 0xff0000, isExpression: false },
				startAngle: { value: 0, isExpression: false },
				endAngle: { value: 360, isExpression: false },
				drawSlice: { value: false, isExpression: false },
				borderWidth: { value: 2, isExpression: false },
				borderColor: { value: 0xffffff, isExpression: false },
				borderPosition: { value: 'center', isExpression: false },
				borderOnlyArc: { value: false, isExpression: false },
			}
		default:
			assertNever(type)
			throw new Error(`Unknown element type: ${type}`)
	}
}
