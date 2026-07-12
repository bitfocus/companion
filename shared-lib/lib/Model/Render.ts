import type { ControlLocation } from './Common.js'
import type { DrawStyleLayeredButtonModel, ResolvedButtonGraphicsDecoration } from './StyleModel.js'

export type RendererDrawStyle = RendererButtonStyle

export interface RendererButtonStyle extends DrawStyleLayeredButtonModel {
	decoration: ResolvedButtonGraphicsDecoration
	show_status_icons: boolean
	location: ControlLocation | undefined
}
