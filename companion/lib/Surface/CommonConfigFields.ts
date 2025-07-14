import type { CompanionSurfaceConfigField } from '@companion-app/shared/Model/Surfaces.js'

export const OffsetConfigFields: CompanionSurfaceConfigField[] = [
	{
		id: 'xOffset',
		type: 'number',
		label: 'Horizontal Offset in grid',
		default: 0,
		min: -10000,
		max: 10000,
	},
	{
		id: 'yOffset',
		type: 'number',
		label: 'Vertical Offset in grid',
		default: 0,
		min: -10000,
		max: 10000,
	},
]

export const BrightnessConfigField: CompanionSurfaceConfigField = {
	id: 'brightness',
	type: 'number',
	label: 'Brightness',
	default: 100,
	min: 1,
	step: 1,
	max: 100,
	range: true,
}

export const RotationConfigField: CompanionSurfaceConfigField = {
	id: 'rotation',
	type: 'dropdown',
	label: 'Surface Rotation',
	default: 0,
	choices: [
		{ id: 0, label: 'Normal' },
		{ id: 'surface-90', label: '90 CCW' },
		{ id: 'surface90', label: '90 CW' },
		{ id: 'surface180', label: '180' },
	],
}

export const LegacyRotationConfigField: CompanionSurfaceConfigField = {
	id: 'rotation',
	type: 'dropdown',
	label: 'Surface Rotation',
	default: 0,
	choices: [
		{ id: 0, label: 'Normal' },
		{ id: 'surface-90', label: '90 CCW' },
		{ id: 'surface90', label: '90 CW' },
		{ id: 'surface180', label: '180' },
		{ id: -90, label: '90 CCW (Legacy)' },
		{ id: 90, label: '90 CW (Legacy)' },
		{ id: 180, label: '180 (Legacy)' },
	],
}

export const LockConfigFields: CompanionSurfaceConfigField[] = [
	{
		id: 'never_lock',
		type: 'checkbox',
		label: 'Never Pin code lock',
		default: false,
	},
]
