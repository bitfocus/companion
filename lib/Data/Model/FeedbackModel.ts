export interface FeedbackInstance {
	id: string
	instance_id: string
	type: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex?: number
	isInverted?: boolean
	style?: Record<string, any> // TODO - better
}
