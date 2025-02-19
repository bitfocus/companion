import type { CompanionAlignment } from '@companion-module/base'

export type SomeButtonGraphicsElement =
	| ButtonGraphicsCanvasElement
	| ButtonGraphicsTextElement
	| ButtonGraphicsImageElement

export interface ButtonGraphicsElementBase {
	id: string
	name: string
}

export interface ButtonGraphicsCanvasElement extends ButtonGraphicsElementBase {
	// Note: this is the background layer and can only be at the bottom of the stack
	type: 'canvas'

	color: number

	decoration: ButtonGraphicsDecorationType // replaces show_topbar
}

export enum ButtonGraphicsDecorationType {
	FollowDefault = 'default',
	TopBar = 'topbar',
	// BottomBar = 'bottombar', // Future
	Border = 'border',
	// None = 'none', // Future
}

export interface ButtonGraphicsTextElement extends ButtonGraphicsElementBase {
	type: 'text'

	text: string
	isExpression: boolean

	fontsize: 'auto' | number // TODO - other values?

	color: number

	alignment: CompanionAlignment

	// Future ideas:
	// minX, maxX, minY, maxY: number
	// rotation: number
	// outlineColor: number
}

export interface ButtonGraphicsImageElement extends ButtonGraphicsElementBase {
	type: 'image'

	base64Image: string | null

	alignment: CompanionAlignment

	// Future ideas:
	// width, height: number
	// rotation: number
	// crop: { x, y, width, height }
}
