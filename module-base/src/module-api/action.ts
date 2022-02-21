import { SomeCompanionInputField, InputValue } from './input.js'

export interface CompanionAction {
	name: string
	description?: string
	options: SomeCompanionInputField[]
	callback: (action: CompanionActionEvent) => Promise<void> | void
	subscribe?: (action: CompanionActionInfo) => Promise<void> | void
	unsubscribe?: (action: CompanionActionInfo) => Promise<void> | void
}
export interface CompanionActionInfo {
	id: string
	actionId: string
	controlId: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionActionEvent extends CompanionActionInfo {
	// Future: the contents of this should be re-evaluated in v1
	/** @deprecated */
	deviceId: string | undefined
	/** @deprecated */
	page: number
	/** @deprecated */
	bank: number
}

export interface CompanionActions {
	[actionId: string]: CompanionAction | undefined
}
