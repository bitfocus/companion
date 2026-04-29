import type { ControlLocation } from './Common.js'
import type { DrawStyleLayeredButtonModel } from './StyleModel.js'

export type RendererDrawStyle = RendererButtonStyle | RendererPageUpDownStyle | RendererPageNumStyle

export interface RendererButtonStyle extends DrawStyleLayeredButtonModel {
	show_topbar: boolean
	show_status_icons: boolean
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
