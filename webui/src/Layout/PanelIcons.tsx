import { faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef, type ElementType } from 'react'
import { Button } from '~/Components/Button'
import { InlineHelpCustom } from '~/Components/InlineHelp'
import { makeAbsolutePath } from '~/Resources/util'

interface CloseButtonProps {
	closeFn: () => void
	visibilityClass?: string
}

export interface ContextHelpButtonProps {
	children?: React.ReactNode
	action?: `/user-guide/${string}` | (() => void)
}

/*
 CloseButton - meant for panels that can be stacked, as in Connections and Surfaces
*/
export function CloseButton({ closeFn, visibilityClass }: CloseButtonProps): React.JSX.Element {
	return (
		<Button
			color="dark"
			className={`float_right${visibilityClass ? ' ' + visibilityClass : ''} p-1 ms-2 panel-close-button`}
			onClick={closeFn}
			title="Close"
			aria-label="Close"
		>
			{/* The inline styling here is to make the icon square */}
			<FontAwesomeIcon icon={faTimes} />
		</Button>
	)
}

/*
 ContextHelpButton - a generic inline-help icon, 
 particularly handy for panels and other headers such as in Connections and Surfaces.
 - children: what to show on hover or focus. Can be plain-text or a React fragment.
 - action: optional, either a link to the user guide or a custom function (to open a modal dialog, for example).
*/
export function ContextHelpButton({ children, action }: ContextHelpButtonProps): React.JSX.Element {
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

	const helpButtonProps = {
		...(typeof action === 'string'
			? {
					// note: string is currently typed to link to /user-guide/, which is not a Tanstack route
					href: makeAbsolutePath(action),
					target: '_blank',
					rel: 'noopener noreferrer',
					as: 'a' as ElementType,
					onClick: removeFocus,
				}
			: action !== undefined
				? { onClick: (e: React.MouseEvent<HTMLButtonElement>) => onClick2(e, action) }
				: {}),
		...(children ? {} : { title: 'Open help in a new tab', 'aria-label': 'Open help in a new tab' }),
	}

	if (children && typeof children === 'string' && action && !/click/i.test(children)) {
		children += ' Click the icon for further help.'
	}

	// note some styling here needs to be on the FontAwesomeIcon, not .context-help-button or the Button,
	//  in order to get the shadowing right. However it will have to be hand-coded for different sizes even if using em units
	//  See _layout.scss for the context-help-button-2xl example (FontAwesomeIcons get class 'fa-<size>')
	// NOTE: removed the float_right class here -- we end up fighting against its margin and it doesn't seem to do much else...
	return (
		<>
			<HelpWrapper usePopover={!!children} help={children}>
				<Button variant="ghost" className="context-help-button-btn p-0" {...helpButtonProps}>
					<FontAwesomeIcon icon={faQuestionCircle} aria-label="context help" />
				</Button>
			</HelpWrapper>
			<span ref={afterElementRef} tabIndex={-1} style={{ outline: 'none' }} aria-hidden="true" />
		</>
	)
}

interface HelpWrapperProps extends React.ComponentProps<typeof InlineHelpCustom> {
	usePopover: boolean
	children: React.ReactNode
}
function HelpWrapper({ usePopover, children, ...props }: HelpWrapperProps) {
	return usePopover ? (
		<InlineHelpCustom {...props} className="context-help-button">
			{children}
		</InlineHelpCustom>
	) : (
		<span className="context-help-button">{children}</span>
	)
}
