import { InputValue } from './input.js';

export interface CompanionPreset {
	category: string;
	description: string;
	bank: {
		style: 'text';
		text: string;
		size: 'auto' | '7' | '14' | '18' | '24' | '30' | '44';
		color: number;
		bgcolor: number;
	};
	feedbacks: Array<{
		type: string;
		options: { [key: string]: InputValue | undefined };
	}>;
	actions: Array<{
		type: string;
		options: { [key: string]: InputValue | undefined };
	}>;
}
