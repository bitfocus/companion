import type { CompanionAlignment, CompanionTextSize } from '@companion-module/base'
import type { SomeButtonGraphicsDrawElement } from './StyleLayersModel.js'

export type DrawStyleModel = DrawStyleLayeredButtonModel

export interface DrawStyleButtonStateProps {
	pushed: boolean

	stepCurrent: number
	stepCount: number

	button_status: 'error' | 'warning' | 'good' | undefined
	action_running: boolean | undefined
}

export interface DrawStyleLayeredButtonModel extends DrawStyleButtonStateProps {
	style: 'button-layered'
	drawType: 'button' | 'pagenum' | 'pageup' | 'pagedown'

	elements: SomeButtonGraphicsDrawElement[]

	/**
	 * Location strings (e.g. '1/0/0') transitively referenced by this button's elements.
	 * Only populated for layered buttons that went through reference element resolution.
	 */
	referencedLocations?: ReadonlySet<string>
}

export interface DrawImageBuffer {
	buffer: Buffer | string | undefined // Can be a Buffer or a base64 string
	x: number | undefined
	y: number | undefined
	width: number | undefined
	height: number | undefined
	drawScale: number | undefined
	pixelFormat: 'RGB' | 'RGBA' | 'ARGB' | undefined
}

export interface ButtonStyleProperties {
	text: string
	textExpression: boolean | undefined

	size: CompanionTextSize
	alignment: CompanionAlignment
	pngalignment: CompanionAlignment

	color: ColorValue
	bgcolor: ColorValue
	show_topbar: boolean | 'default' | undefined

	png64: string | null
}

export enum ButtonGraphicsDecorationType {
	FollowDefault = 'default',
	TopBar = 'topbar',
	// BottomBar = 'bottombar', // Future
	Border = 'border',
	None = 'none',
}

/**
 * A button decoration that has been fully resolved (global default + per-button override), so it is
 * always a concrete value and never `FollowDefault`.
 */
export type ResolvedButtonGraphicsDecoration = Exclude<
	ButtonGraphicsDecorationType,
	ButtonGraphicsDecorationType.FollowDefault
>

export enum ButtonGraphicsShowStatusIcons {
	FollowDefault = 'default',
	ShowAll = 'all',
	None = 'none',
}

export enum ButtonGraphicsElementUsage {
	Automatic = 'auto',
	Text = 'text',
	Color = 'color',
	Image = 'image',
	/** Drives a surface's addressable LED strip/ring. Internally `leds`; shown in the UI as "Gauge". */
	Leds = 'leds',
}

export type HorizontalAlignment = 'left' | 'center' | 'right'
export type VerticalAlignment = 'top' | 'center' | 'bottom'

export type TextStyle = 'italic' | 'underline' | 'strikethrough'

export type CompositeElementOptionKey = `opt:${string}`

/**
 * A color value for a button graphics element property.
 *
 * Modules may provide either a number (e.g. `0xFF0000` for red) or a css string (e.g. `'#FF0000'` or `rgb(255, 0, 0)` for red).
 */
export type ColorValue = number | string
