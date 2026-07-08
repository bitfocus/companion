import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'

/**
 * The global default button decoration choices, shared between the settings page and the setup wizard.
 * These mirror the per-button canvas element's `ButtonGraphicsDecorationType`, minus the "follow default"
 * option (which only makes sense per-button, not as the global default).
 */
export const BUTTON_DECORATION_CHOICES: DropdownChoice[] = [
	{ id: 'topbar', label: 'Top bar' },
	{ id: 'border', label: 'Border (when pressed)' },
	{ id: 'none', label: 'None' },
]
