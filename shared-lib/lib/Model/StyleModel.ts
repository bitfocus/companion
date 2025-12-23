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

	cloud: boolean | undefined
	cloud_error: boolean | undefined
	button_status: 'error' | 'warning' | 'good' | undefined
	action_running: boolean | undefined
}

export interface DrawStyleLayeredButtonModel extends DrawStyleButtonStateProps {
	style: 'button-layered'

	elements: SomeButtonGraphicsDrawElement[]
}

export interface DrawImageBuffer {
	buffer: Buffer | undefined
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
