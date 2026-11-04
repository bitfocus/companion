import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

/**
 * The global default button decoration choices, shared between the settings page and the setup wizard.
 * These mirror the per-button canvas element's `ButtonGraphicsDecorationType`, minus the "follow default"
 * option (which only makes sense per-button, not as the global default).
 */
export const BUTTON_DECORATION_CHOICES: DropdownChoice<UserConfigModel['buttons_decoration']>[] = [
	{ id: ButtonGraphicsDecorationType.TopBar, label: 'Top bar' },
	{ id: ButtonGraphicsDecorationType.Border, label: 'Border (when pressed)' },
	{ id: ButtonGraphicsDecorationType.None, label: 'None' },
]
