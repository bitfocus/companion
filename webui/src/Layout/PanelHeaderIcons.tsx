import React from 'react'
import { CButton } from '@coreui/react'
import type { SizeProp } from '@fortawesome/fontawesome-svg-core'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Link } from '@tanstack/react-router'
import { InlineHelp } from '~/Components/InlineHelp'
import { makeAbsolutePath } from '~/Resources/util'

interface CloseButtonProps {
	closeFn: () => void
	visibilityClass?: string
}

interface ContextHelpButtonProps {
	hoverText: string
	userGuide: `/user-guide/${string}` | (() => void) // could string be made more specific with a TanStack type?
	size?: SizeProp
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
			aria-label="Close"
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
					href: makeAbsolutePath(userGuide), // or "to:"" w/o makeAbsolutePath... (but currently Tanstack isn't serving the user-guide)
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
				<FontAwesomeIcon icon={faQuestionCircle} size={size} aria-label="context help" />
			</CButton>
		</InlineHelp>
	)
}
