/* eslint-disable react-refresh/only-export-components */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faBorderAll,
	faClock,
	faCode,
	faDollarSign,
	faGamepad,
	faGear,
	faImages,
	faList,
	faNetworkWired,
	faPlug,
	faPuzzlePiece,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { useId } from 'react'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { FormLabel } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp.js'

/**
 * A single selectable config section: a tonal icon badge, a label, and a checkbox pushed to the right of the
 * row. Rows live inside a bordered `.config-selection-list` card, echoing the setup wizard's review styling.
 * Shared by the Export and Reset modals so the two flows look and read identically; each modal supplies its
 * own `value`/`setValue` to bridge its form's value type (boolean for export, 'reset'/'unchanged' for reset).
 */
export function ConfigOptionRow({
	icon,
	label,
	value,
	setValue,
	onBlur,
	disabled,
	indeterminate,
	sub,
}: {
	icon: IconDefinition
	label: React.ReactNode
	value: boolean
	setValue: (value: boolean) => void
	onBlur?: React.FocusEventHandler<HTMLSpanElement>
	disabled?: boolean
	indeterminate?: boolean
	sub?: boolean
}): React.JSX.Element {
	const id = useId()
	return (
		<div
			className={classNames('config-selection-row', {
				'config-selection-row-sub': sub,
				'config-selection-row-disabled': disabled,
			})}
		>
			<span className="config-selection-icon">
				<FontAwesomeIcon icon={icon} fixedWidth />
			</span>
			<FormLabel htmlFor={id} className="config-selection-label">
				{label}
			</FormLabel>
			<CheckboxInputField
				id={id}
				value={value}
				setValue={setValue}
				onBlur={onBlur}
				disabled={disabled}
				indeterminate={indeterminate}
			/>
		</div>
	)
}

export interface ConfigOptionMeta {
	icon: IconDefinition
	label: React.ReactNode
}

/**
 * Shared description (icon + label) of each top-level config section, so the Export and Reset modals can't
 * drift apart. Each modal decides which of these to show and how to wire them to its own form.
 */
export const CONFIG_OPTION_META = {
	connections: { icon: faPlug, label: 'Connections' },
	buttons: { icon: faBorderAll, label: 'Buttons' },
	triggers: { icon: faClock, label: 'Triggers' },
	customVariables: { icon: faDollarSign, label: 'Custom Variables' },
	expressionVariables: { icon: faCode, label: 'Expression Variables' },
	imageLibrary: { icon: faImages, label: 'Image Library' },
	surfaces: { icon: faGamepad, label: 'Surfaces' },
	userconfig: { icon: faGear, label: 'Settings' },
} satisfies Record<string, ConfigOptionMeta>

/** The plain sections shown in the "Content" group of both modals, in display order. */
export const CONTENT_OPTION_KEYS = [
	'buttons',
	'triggers',
	'customVariables',
	'expressionVariables',
	'imageLibrary',
] as const

/** The Surfaces sub-options, with their help text. */
export const SURFACE_CHILD_OPTIONS: ReadonlyArray<{
	key: 'known' | 'instances' | 'remote'
	icon: IconDefinition
	label: React.ReactNode
}> = [
	{
		key: 'known',
		icon: faList,
		label: (
			<>
				Known Surfaces
				<InlineHelpIcon className="ms-1">The list of known surfaces, and their settings</InlineHelpIcon>
			</>
		),
	},
	{
		key: 'instances',
		icon: faPuzzlePiece,
		label: (
			<>
				Surface Integrations
				<InlineHelpIcon className="ms-1">The configured surface integrations</InlineHelpIcon>
			</>
		),
	},
	{
		key: 'remote',
		icon: faNetworkWired,
		label: (
			<>
				Remote Surfaces
				<InlineHelpIcon className="ms-1">Connections for surfaces that are connected remotely</InlineHelpIcon>
			</>
		),
	},
]
