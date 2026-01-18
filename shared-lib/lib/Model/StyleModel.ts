import type { CompanionAlignment, CompanionTextSize } from '@companion-module/base'

export type DrawStyleModel =
	| {
			style: 'pageup' | 'pagedown' | 'pagenum'
	  }
	| DrawStyleButtonModel

export interface DrawStyleButtonStateProps {
	pushed: boolean

	stepCurrent: number
	stepCount: number

	cloud: boolean | undefined
	cloud_error: boolean | undefined
	button_status: 'error' | 'warning' | 'good' | undefined
	action_running: boolean | undefined
}

export interface DrawStyleButtonModel extends ButtonStyleProperties, DrawStyleButtonStateProps {
	style: 'button'

	imageBuffers: DrawImageBuffer[]
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
