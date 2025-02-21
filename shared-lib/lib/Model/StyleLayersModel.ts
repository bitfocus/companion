import type { CompanionAlignment } from '@companion-module/base'

export type SomeButtonGraphicsElement =
	| ButtonGraphicsCanvasElement
	| ButtonGraphicsTextElement
	| ButtonGraphicsImageElement

export type SomeButtonGraphicsDrawElement =
	| (ButtonGraphicsCanvasDrawElement & ButtonGraphicsDrawBase)
	| (ButtonGraphicsTextDrawElement & ButtonGraphicsDrawBase)
	| (ButtonGraphicsImageDrawElement & ButtonGraphicsDrawBase)

export interface ButtonGraphicsDrawBase {
	readonly id: string
}

export interface ButtonGraphicsElementBase {
	readonly id: string
	name: string
}

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }
export type MakeExpressionable<T extends { type: string }> = {
	[P in keyof T]: P extends 'type' ? T[P] : ExpressionOrValue<T[P]>
}

export interface ButtonGraphicsCanvasDrawElement {
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

export interface ButtonGraphicsTextDrawElement {
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

export interface ButtonGraphicsImageDrawElement {
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
