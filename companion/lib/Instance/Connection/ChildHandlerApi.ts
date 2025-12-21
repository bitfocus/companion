import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

export interface RunActionExtras {
	controlId: string
	surfaceId: string | undefined
	location: ControlLocation | undefined
	abortDelayed: AbortSignal
	executionMode: 'sequential' | 'concurrent'
}
