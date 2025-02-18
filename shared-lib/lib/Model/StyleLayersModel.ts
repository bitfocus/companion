import type { CompanionAlignment } from '@companion-module/base'

export type SomeButtonGraphicsLayer = ButtonGraphicsCanvasLayer | ButtonGraphicsTextLayer | ButtonGraphicsImageLayer

export interface ButtonGraphicsLayerBase {
	id: string
}

export interface ButtonGraphicsCanvasLayer extends ButtonGraphicsLayerBase {
	// Note: this is the background layer and can only be at the bottom of the stack
	type: 'canvas'

	color: number

	decoration: ButtonGraphicsDecorationType // replaces show_topbar
}

export enum ButtonGraphicsDecorationType {
	FollowDefault = 'default',
	TopBar = 'topbar',
	// BottomBar = 'bottombar', // Future
	// Border = 'border', // Future
	None = 'none',
}

export interface ButtonGraphicsTextLayer extends ButtonGraphicsLayerBase {
	type: 'text'

	text: string
	isExpression: boolean

	fontsize: 'auto' | number // TODO - other values?

	alignment: CompanionAlignment

	color: number

	// Future ideas:
	// minX, maxX, minY, maxY: number
	// rotation: number
	// outlineColor: number
}

export interface ButtonGraphicsImageLayer extends ButtonGraphicsLayerBase {
	type: 'image'

	base64Image: string | null

	alignment: CompanionAlignment

	// Future ideas:
	// width, height: number
	// rotation: number
	// crop: { x, y, width, height }
}
