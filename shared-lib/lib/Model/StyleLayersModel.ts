import type { CompanionAlignment } from '@companion-module/base'

/**
 * The type of a button graphics element as stored in places where it can be edited
 */
export type SomeButtonGraphicsElement =
	| ButtonGraphicsCanvasElement
	| ButtonGraphicsTextElement
	| ButtonGraphicsImageElement

/**
 * The type of a button graphics element as used by the renderer, with any dynamic values resolved
 */
export type SomeButtonGraphicsDrawElement =
	| ButtonGraphicsCanvasDrawElement
	| ButtonGraphicsTextDrawElement
	| ButtonGraphicsImageDrawElement

export interface ButtonGraphicsDrawBase {
	readonly id: string
	enabled: boolean
}

export interface ButtonGraphicsElementBase {
	readonly id: string
	name: string
}

export interface ButtonGraphicsDrawBounds {
	x: number
	y: number
	width: number
	height: number
}

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }
export type MakeExpressionable<T extends { type: string }> = {
	[P in keyof Omit<T, 'id'>]: P extends 'type' ? T[P] : ExpressionOrValue<T[P]>
}

export interface ButtonGraphicsCanvasDrawElement extends Omit<ButtonGraphicsDrawBase, 'enabled'> {
	// Note: this is the background element and can only be at the bottom of the stack
	type: 'canvas'

	color: number

	decoration: ButtonGraphicsDecorationType // replaces show_topbar
}
export interface ButtonGraphicsCanvasElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<ButtonGraphicsCanvasDrawElement> {}

export enum ButtonGraphicsDecorationType {
	FollowDefault = 'default',
	TopBar = 'topbar',
	// BottomBar = 'bottombar', // Future
	Border = 'border',
	// None = 'none', // Future
}

export interface ButtonGraphicsTextDrawElement extends ButtonGraphicsDrawBase {
	type: 'text'

	text: string

	fontsize: 'auto' | number // TODO - other values?

	color: number

	alignment: CompanionAlignment

	// Future ideas:
	// minX, maxX, minY, maxY: number
	// rotation: number
	// outlineColor: number
}
export interface ButtonGraphicsTextElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<ButtonGraphicsTextDrawElement> {}

export interface ButtonGraphicsImageDrawElement extends ButtonGraphicsDrawBase, ButtonGraphicsDrawBounds {
	type: 'image'

	base64Image: string | null

	alignment: CompanionAlignment

	fillMode: 'crop' | 'fill' | 'fit' | 'fit_or_shrink'

	// Future ideas:
	// width, height: number
	// rotation: number
	// crop: { x, y, width, height }
}
export interface ButtonGraphicsImageElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<ButtonGraphicsImageDrawElement> {}
