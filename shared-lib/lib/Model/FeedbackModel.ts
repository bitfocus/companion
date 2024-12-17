import type { ButtonStyleProperties } from './StyleModel.js'

export interface FeedbackInstance {
	id: string
	instance_id: string
	headline?: string
	type: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex?: number
	isInverted?: boolean
	style?: Partial<ButtonStyleProperties>

	children?: FeedbackInstance[]
	advancedChildren?: FeedbackInstance[]
}

export type FeedbackChildGroup = 'children' | 'advancedChildren'

export interface FeedbackOwner {
	parentFeedbackId: string
	childGroup: FeedbackChildGroup
}
