import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'

/**
 * The list of selectable timezones, with a leading "System Default" option (empty value).
 * Derived from the runtime's IANA timezone database via `Intl.supportedValuesOf`.
 */
export const TIMEZONE_CHOICES: DropdownChoice[] = [
	{ id: '', label: 'System Default' },
	...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []).map(
		(zone): DropdownChoice => ({ id: zone, label: zone })
	),
]
