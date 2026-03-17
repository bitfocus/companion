import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'

export type RendererDrawStyle = RendererButtonStyle | RendererPageUpDownStyle | RendererPageNumStyle

export interface RendererButtonStyle extends DrawStyleButtonModel {
	show_topbar: boolean
	location: ControlLocation | undefined
}

export interface RendererPageUpDownStyle {
	style: 'pageup' | 'pagedown'
	plusminus: boolean
	direction_flipped: boolean
}

export interface RendererPageNumStyle {
	style: 'pagenum'
	pageNumber: number
	pageName: string | undefined
}
