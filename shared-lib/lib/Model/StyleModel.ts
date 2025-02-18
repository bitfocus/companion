import type { CompanionAlignment, CompanionTextSize } from '@companion-module/base'
import { SomeButtonGraphicsLayer } from './StyleLayersModel.js'

export type DrawStyleModel =
	| {
			style: 'pageup' | 'pagedown' | 'pagenum'
	  }
	| DrawStyleButtonModel
	| DrawStyleLayeredButtonModel

export interface DrawStyleButtonStateProps {
	pushed: boolean
	step_cycle: number | undefined
	cloud: boolean | undefined
	cloud_error: boolean | undefined
	button_status: 'error' | 'warning' | 'good' | undefined
	action_running: boolean | undefined
}

export interface DrawStyleLayeredButtonModel extends DrawStyleButtonStateProps {
	style: 'button-layered'

	// imageBuffers: DrawImageBuffer[]

	layers: SomeButtonGraphicsLayer[]
}

export interface DrawStyleButtonModel extends ButtonStyleProperties, DrawStyleButtonStateProps {
	style: 'button'

	imageBuffers: DrawImageBuffer[]
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

export interface UnparsedButtonStyle extends ButtonStyleProperties {
	imageBuffers: DrawImageBuffer[]
}

export interface ButtonStyleProperties {
	text: string
	textExpression: boolean | undefined

	size: CompanionTextSize | number | 'small' | 'large'
	alignment: CompanionAlignment
	pngalignment: CompanionAlignment

	color: number
	bgcolor: number
	show_topbar: boolean | 'default' | undefined

	png64: string | null
}
