/** @type {import("@companion-app/shared/Model/Surfaces.js").CompanionSurfaceConfigField[]} */
export const OffsetConfigFields = [
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

/** @type {import("@companion-app/shared/Model/Surfaces.js").CompanionSurfaceConfigField} */
export const BrightnessConfigField = {
	id: 'brightness',
	type: 'number',
	label: 'Brightness',
	default: 100,
	min: 1,
	step: 1,
	max: 100,
}

/** @type {import("@companion-app/shared/Model/Surfaces.js").CompanionSurfaceConfigField} */
export const RotationConfigField = {
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

/** @type {import("@companion-app/shared/Model/Surfaces.js").CompanionSurfaceConfigField} */
export const LegacyRotationConfigField = {
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

/** @type {import("@companion-app/shared/Model/Surfaces.js").CompanionSurfaceConfigField[]} */
export const LockConfigFields = [
	{
		id: 'never_lock',
		type: 'checkbox',
		label: 'Never Pin code lock',
		default: false,
	},
]
