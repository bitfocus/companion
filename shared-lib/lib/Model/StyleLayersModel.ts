/**
 * The type of a button graphics element as stored in places where it can be edited
 */
export type SomeButtonGraphicsElement =
	| ButtonGraphicsCanvasElement
	| ButtonGraphicsGroupElement
	| ButtonGraphicsTextElement
	| ButtonGraphicsImageElement
	| ButtonGraphicsBoxElement

/**
 * The type of a button graphics element as used by the renderer, with any dynamic values resolved
 */
export type SomeButtonGraphicsDrawElement =
	| ButtonGraphicsCanvasDrawElement
	| ButtonGraphicsGroupDrawElement
	| ButtonGraphicsTextDrawElement
	| ButtonGraphicsImageDrawElement
	| ButtonGraphicsBoxDrawElement

export interface ButtonGraphicsDrawBase {
	readonly id: string
	usage: ButtonGraphicsElementUsage
	enabled: boolean
	/* 0-100 */
	opacity: number
}

export interface ButtonGraphicsElementBase {
	readonly id: string
	name: string
	usage: ButtonGraphicsElementUsage
}

export enum ButtonGraphicsElementUsage {
	Automatic = 'auto',
	Text = 'text',
	Color = 'color',
	Image = 'image',
}

export interface ButtonGraphicsDrawBounds {
	x: number
	y: number
	width: number
	height: number
}

export type ExpressionOrValue<T> = { value: T; isExpression: false } | { value: string; isExpression: true }
export type MakeExpressionable<T extends { type: string } /*TSkip extends keyof T = 'type'*/> = {
	[P in keyof Omit<T, 'id'>]: P extends 'type' ? T[P] : ExpressionOrValue<T[P]>
}

export interface ButtonGraphicsCanvasDrawElement extends Omit<ButtonGraphicsDrawBase, 'enabled' | 'opacity'> {
	// Note: this is the background element and can only be at the bottom of the stack
	type: 'canvas'

	// previewColor: number

	decoration: ButtonGraphicsDecorationType // replaces show_topbar
}
export interface ButtonGraphicsCanvasElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<Omit<ButtonGraphicsCanvasDrawElement, 'usage'>> {}

export enum ButtonGraphicsDecorationType {
	FollowDefault = 'default',
	TopBar = 'topbar',
	// BottomBar = 'bottombar', // Future
	Border = 'border',
	// None = 'none', // Future
}

export interface ButtonGraphicsGroupDrawElement extends ButtonGraphicsDrawBase, ButtonGraphicsDrawBounds {
	type: 'group'

	children: SomeButtonGraphicsDrawElement[]
}
export interface ButtonGraphicsGroupElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<Omit<ButtonGraphicsGroupDrawElement, 'usage' | 'children'>> {
	children: SomeButtonGraphicsElement[]
}

export type HorizontalAlignment = 'left' | 'center' | 'right'
export type VerticalAlignment = 'top' | 'center' | 'bottom'

export interface ButtonGraphicsTextDrawElement extends ButtonGraphicsDrawBase, ButtonGraphicsDrawBounds {
	type: 'text'

	text: string

	fontsize: 'auto' | number // TODO - other values?

	color: number

	halign: HorizontalAlignment
	valign: VerticalAlignment

	// Future ideas:
	// minX, maxX, minY, maxY: number
	// rotation: number
	// outlineColor: number
}
export interface ButtonGraphicsTextElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<Omit<ButtonGraphicsTextDrawElement, 'usage'>> {}

export interface ButtonGraphicsImageDrawElement extends ButtonGraphicsDrawBase, ButtonGraphicsDrawBounds {
	type: 'image'

	base64Image: string | null

	halign: HorizontalAlignment
	valign: VerticalAlignment

	fillMode: 'crop' | 'fill' | 'fit' | 'fit_or_shrink'

	// Future ideas:
	// width, height: number
	// rotation: number
	// crop: { x, y, width, height }
}
export interface ButtonGraphicsImageElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<Omit<ButtonGraphicsImageDrawElement, 'usage'>> {}

export interface ButtonGraphicsBoxDrawElement extends ButtonGraphicsDrawBase, ButtonGraphicsDrawBounds {
	type: 'box'

	color: number
}
export interface ButtonGraphicsBoxElement
	extends ButtonGraphicsElementBase,
		MakeExpressionable<Omit<ButtonGraphicsBoxDrawElement, 'usage'>> {}
