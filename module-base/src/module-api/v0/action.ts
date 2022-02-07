import { SomeCompanionInputField, InputValue } from './input.js';

export interface CompanionAction {
	name: string;
	description?: string;
	options: SomeCompanionInputField[];
	callback: (action: CompanionActionEvent) => Promise<void> | void;
	subscribe?: (action: CompanionActionInfo) => Promise<void> | void;
	unsubscribe?: (action: CompanionActionInfo) => Promise<void> | void;
}
export interface CompanionActionInfo {
	actionId: string;
	options: { [key: string]: InputValue | undefined };
}

export interface CompanionActionEvent extends CompanionActionInfo {
	// TODO
	// deviceId: string | undefined;
	// page: number;
	// bank: number;
}

export interface CompanionActions {
	[actionId: string]: CompanionAction | undefined;
}
