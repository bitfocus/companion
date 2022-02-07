import { InputValue } from './input.js';

export type CompanionUpgradeScript<TConfig> = (
	config: CompanionCoreInstanceconfig & TConfig,
	actions: CompanionMigrationAction[],
	release_actions: CompanionMigrationAction[],
	feedbacks: CompanionMigrationFeedback[],
) => boolean;

export interface CompanionCoreInstanceconfig {
	instance_type: string;
	label: string;
	enabled: boolean;
}

export interface CompanionMigrationAction {
	readonly id: string;
	readonly instance: string;
	label: string;
	action: string;
	options: { [key: string]: InputValue | undefined };
}

export interface CompanionMigrationFeedback {
	readonly id: string;
	readonly instance_id: string;
	type: string;
	options: { [key: string]: InputValue | undefined };
}
