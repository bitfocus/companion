import type { ControlLocation } from './Common.js'

/** Some text drawn by a button, and how it was drawn */
export interface DrawnText {
	readonly text: string
	readonly font: 'companion-sans' | 'companion-mono'
	readonly weight: 'normal' | 'bold'
	readonly fontsize: number
}

/** A draw which stalled a render thread, so is drawn as a placeholder instead */
export interface QuarantinedRender {
	/** Identifies what was drawn, at any size */
	readonly key: string
	/** Where the button that stalled is, or null if it isn't on a page (eg a preset) */
	readonly location: ControlLocation | null
	/** What was being drawn, for the log */
	readonly description: string
	/** The text it draws, which is the most likely to have stalled the renderer */
	readonly texts: readonly DrawnText[]
	/** When it stalled, in ms */
	readonly time: number
}

/** A restart to free the render threads which are stuck */
export type RenderStallRestart =
	| {
			/** Companion will restart itself, unless it is postponed */
			readonly type: 'scheduled'
			/** When, in ms */
			readonly at: number
	  }
	| {
			/** Companion has restarted itself too often recently, so it is left to the user */
			readonly type: 'manual'
	  }

export interface RenderStallStatus {
	readonly quarantined: readonly QuarantinedRender[]
	/** How many render threads are stuck for good */
	readonly lostThreads: number
	/** Null when no restart is needed */
	readonly restart: RenderStallRestart | null
}
