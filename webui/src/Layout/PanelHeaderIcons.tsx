import React, { useCallback, useRef, type ElementType } from 'react'
import { CButton } from '@coreui/react'
import type { SizeProp } from '@fortawesome/fontawesome-svg-core'
import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InlineHelp } from '~/Components/InlineHelp'
import { makeAbsolutePath } from '~/Resources/util'

interface CloseButtonProps {
	closeFn: () => void
	visibilityClass?: string
}

interface ContextHelpButtonProps {
	hoverText: string
	help: `/user-guide/${string}` | (() => void)
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
export function ContextHelpButton({ hoverText, help, size = '2xl' }: ContextHelpButtonProps): React.JSX.Element {
	// First, a little trick to handle both keyboard navigation, in which the "hover help" should show up on focus,
	// and "click" (including "enter"), which will open a new tab and should close the hover-help.
	// Without removeFocus() the help icon will retain focus, and hover-help will still show when the user returns to this tab.
	// afterElementRef is a little trick to preserve tab focus order, so the next tab will go to the element after this one in the tab-order.
	const afterElementRef = useRef<HTMLDivElement>(null)
	const removeFocus = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
		event.currentTarget.blur()
		afterElementRef.current?.focus({ preventScroll: true })
	}, [])

	const onClick2 = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>, helpFn: () => void) => {
			helpFn()
			removeFocus(event)
		},
		[removeFocus]
	)

	const helpButtonProps =
		typeof help === 'string'
			? {
					// note: string is currently typed to link to /user-guide/, which is not a Tanstack route
					href: makeAbsolutePath(help),
					target: '_blank',
					rel: 'noopener noreferrer',
					as: 'a' as ElementType,
					onClick: removeFocus,
				}
			: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => onClick2(e, help) }

	if (help && !/click/i.test(hoverText)) {
		hoverText += ' Click the icon for more details.'
	}

	// note some styling here needs to be on the FontAwesomeIcon, not .context-help-button or the CButton,
	//  in order to get the shadowing right. However it will have to be hand-coded for different sizes even if using em units
	//  See _layout.scss for the context-help-button-2xl example (FontAwesomeIcons get class 'fa-<size>')
	// NOTE: removed the float_right class here -- we end up fighting against its margin and it doesn't seem to do much else...
	return (
		<>
			<InlineHelp help={hoverText}>
				<CButton variant="ghost" className={`context-help-button-${size} p-0`} {...helpButtonProps}>
					<FontAwesomeIcon icon={faQuestionCircle} size={size} aria-label="context help" />
				</CButton>
			</InlineHelp>
			<div ref={afterElementRef} tabIndex={-1} style={{ outline: 'none' }} aria-hidden="true" />
		</>
	)
}
