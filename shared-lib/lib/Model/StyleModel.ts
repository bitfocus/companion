import type { CompanionAlignment, CompanionTextSize } from '@companion-module/base'
import type { SomeButtonGraphicsDrawElement } from './StyleLayersModel.js'

export type DrawStyleModel =
	| {
			style: 'pageup' | 'pagedown' | 'pagenum'
	  }
	| DrawStyleLayeredButtonModel

export interface DrawStyleButtonStateProps {
	pushed: boolean

	stepCurrent: number
	stepCount: number

	button_status: 'error' | 'warning' | 'good' | undefined
	action_running: boolean | undefined
}

export interface DrawStyleLayeredButtonModel extends DrawStyleButtonStateProps {
	style: 'button-layered'

	elements: SomeButtonGraphicsDrawElement[]
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

	color: number
	bgcolor: number
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

export enum ButtonGraphicsElementUsage {
	Automatic = 'auto',
	Text = 'text',
	Color = 'color',
	Image = 'image',
}

export type HorizontalAlignment = 'left' | 'center' | 'right'
export type VerticalAlignment = 'top' | 'center' | 'bottom'

export type CompositeElementOptionKey = `opt:${string}`
