import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CButton } from '@coreui/react'
import type { SizeProp } from '@fortawesome/fontawesome-svg-core'
import { faQuestionCircle, faTimes, faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from '@tanstack/react-router'
import React from 'react'
import { InlineHelp } from '~/Components/InlineHelp'

export interface UserConfigProps {
	config: UserConfigModel

	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

interface ResetButtonProps {
	userConfig: UserConfigProps
	field: keyof UserConfigModel
}

interface CloseButtonProps {
	closeFn: () => void
	visibilityClass?: string
}

interface ContextHelpButtonProps {
	hoverText: string
	userGuide: string | (() => void) // could string be made more specific with a TanStack type?
	size?: SizeProp
}

export function ResetButton({ userConfig, field }: ResetButtonProps): React.JSX.Element {
	return (
		<CButton onClick={() => userConfig.resetValue(field)} title="Reset to default">
			<FontAwesomeIcon icon={faUndo} />
		</CButton>
	)
}

/*
 CloseButton - meant for panels that can be stacked, as in Connections and Surfaces
*/
export function CloseButton({ closeFn, visibilityClass }: CloseButtonProps): React.JSX.Element {
	return (
		<CButton
			color="dark"
			className={`float_right${visibilityClass ? ' ' + visibilityClass : ''} p-1 ms-2 panel-close-button`}
			onClick={closeFn}
			title="Close"
		>
			{/* The inline styling here is to make the icon square */}
			<FontAwesomeIcon icon={faTimes} size="lg" style={{ marginRight: '1px' }} />
		</CButton>
	)
}

/*
 ContextHelpButton - meant for panels and other headers such as in Connections and Surfaces
 Caller can supply a link to the user guide or a custom function.
 The default size is intended for panel headers.
*/
export function ContextHelpButton({ hoverText, userGuide, size = '2xl' }: ContextHelpButtonProps): React.JSX.Element {
	// note: an alternative way to do the following would be a default function using
	//  router.buildLocation() and window.open() to navigate to the link in a new window...
	const userGuideProps =
		typeof userGuide === 'string'
			? {
					to: userGuide,
					target: '_blank',
					rel: 'noopener noreferrer',
					as: Link,
				}
			: { onClick: userGuide }

	if (userGuide && !/click/i.test(hoverText)) {
		hoverText += ' Click the icon for more details.'
	}

	// note some styling here needs to be on the FontAwesomeIcon, not .context-help-button or the CButton,
	//  in order to get the shadowing right. However it will have to be hand-coded for different sizes even if using em units
	//  See _layout.scss for the context-help-button-2xl example (FontAwesomeIcons get class 'fa-<size>')
	// NOTE: removed the float_right class here -- we end up fighting against its margin and it doesn't seem to do much else...
	return (
		<InlineHelp help={hoverText}>
			<CButton variant="ghost" className={`context-help-button-${size} p-0`} {...userGuideProps}>
				<FontAwesomeIcon icon={faQuestionCircle} size={size} />
			</CButton>
		</InlineHelp>
	)
}
