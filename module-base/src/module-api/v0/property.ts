import { SomeCompanionInputField } from './input.js';

export type CompanionPropertyInstanceId = string | number;
export type CompanionPropertyValue = string | number | boolean;

export interface CompanionReadOnlyProperty {
	name: string;
	description?: string;
	/**
	 * Instances of this property.
	 * eg, channel number of the audio fader
	 * null if no instances
	 */
	instanceIds: Array<{ id: CompanionPropertyInstanceId; label: string }> | null;

	subscribe?: (info: CompanionPropertySubscribeInfo) => Promise<void> | void;
	unsubscribe?: (info: CompanionPropertySubscribeInfo) => Promise<void> | void;
}
export interface CompanionProperty extends CompanionReadOnlyProperty {
	valueField: SomeCompanionInputField;
	setValue: (info: CompanionPropertyEvent) => Promise<void> | void;
}

export interface CompanionPropertySubscribeInfo {
	propertyId: string;
	instanceIds: CompanionPropertyInstanceId[] | null;
}

export interface CompanionPropertyEvent {
	propertyId: string;
	instanceId: CompanionPropertyInstanceId | null;

	// TODO
	// deviceId: string | undefined;
	// page: number;
	// bank: number;
}

export interface CompanionProperties {
	[actionId: string]: CompanionProperty | CompanionReadOnlyProperty | undefined;
}
