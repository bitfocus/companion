import type { ControlLocation } from './Common.js'
import type { DrawStyleLayeredButtonModel } from './StyleModel.js'

export type RendererDrawStyle = RendererButtonStyle

export interface RendererButtonStyle extends DrawStyleLayeredButtonModel {
	show_topbar: boolean
	show_status_icons: boolean
	location: ControlLocation | undefined
}
