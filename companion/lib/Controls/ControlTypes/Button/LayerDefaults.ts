import { nanoid } from 'nanoid'
import { FONTSIZE_SHRINK_DEFAULT } from '@companion-app/shared/Graphics/ElementPropertiesSchemas.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'
import { assertNever } from '@companion-app/shared/Util.js'

export function CreateElementOfType(type: SomeButtonGraphicsElement['type']): SomeButtonGraphicsElement {
	switch (type) {
		case 'canvas':
			throw new Error('Canvas elements cannot be created')
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
				fontsize: { value: FONTSIZE_SHRINK_DEFAULT, isExpression: false },
				fontsizeAllowShrink: { value: true, isExpression: false },
				font: { value: 'companion-sans', isExpression: false },
				weight: { value: 'normal', isExpression: false },
				styles: { value: [], isExpression: false },
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
				fillMode: { value: 'fit', isExpression: false },
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
				cornerRadius: { value: 0, isExpression: false },
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
				squareCoords: { value: false, isExpression: false },
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
		case 'gauge':
			return {
				id: nanoid(),
				name: 'Gauge',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'gauge',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				rotation: { value: 0, isExpression: false },
				value: { value: 0, isExpression: false },
				min: { value: 0, isExpression: false },
				max: { value: 100, isExpression: false },
				origin: { value: 0, isExpression: false },
				symmetric: { value: false, isExpression: false },
				orientation: { value: 'horizontal', isExpression: false },
				reverse: { value: false, isExpression: false },
				trackWidth: { value: 100, isExpression: false },
				startAngle: { value: 0, isExpression: false },
				endAngle: { value: 360, isExpression: false },
				ringWidth: { value: 20, isExpression: false },
				roundedEnds: { value: true, isExpression: false },
				fillEnabled: { value: true, isExpression: false },
				multiColour: { value: true, isExpression: false },
				stops: {
					value: [
						{
							_id: { value: nanoid(), isExpression: false },
							value: { value: 0, isExpression: false },
							color: { value: 0x00ff00, isExpression: false },
							gradient: { value: false, isExpression: false },
						},
						{
							_id: { value: nanoid(), isExpression: false },
							value: { value: 66, isExpression: false },
							color: { value: 0xffff00, isExpression: false },
							gradient: { value: false, isExpression: false },
						},
						{
							_id: { value: nanoid(), isExpression: false },
							value: { value: 85, isExpression: false },
							color: { value: 0xff0000, isExpression: false },
							gradient: { value: false, isExpression: false },
						},
					],
					isExpression: false,
				},
				markerEnabled: { value: false, isExpression: false },
				markerColor: { value: 0xffffff, isExpression: false },
				markerWidth: { value: 15, isExpression: false },
				trackStyle: { value: 'transparent', isExpression: false },
				trackAmount: { value: 30, isExpression: false },
			}
		case 'composite':
			// Composite elements should not be created directly through this function
			// They are created with custom logic in layeredStyleAddElement
			throw new Error('Composite elements should be created through layeredStyleAddElement')
		case 'reference':
			return {
				id: nanoid(),
				name: 'Reference',
				usage: ButtonGraphicsElementUsage.Automatic,
				type: 'reference',
				enabled: { value: true, isExpression: false },
				opacity: { value: 100, isExpression: false },
				x: { value: 0, isExpression: false },
				y: { value: 0, isExpression: false },
				width: { value: 100, isExpression: false },
				height: { value: 100, isExpression: false },
				rotation: { value: 0, isExpression: false },
				location: { value: '', isExpression: false },
			}
		default:
			assertNever(type)
			throw new Error(`Unknown element type: ${type}`)
	}
}
