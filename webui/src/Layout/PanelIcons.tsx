import { CircleHelp, X } from 'lucide-react'
import './PanelIcons.css'
import classNames from 'classnames'
import { useCallback, useRef } from 'react'
import { InlineHelpCustom } from '~/Components/InlineHelp'
import { makeAbsolutePath } from '~/Resources/util'

interface CloseButtonProps {
	closeFn: () => void
	visibilityClass?: string
	className?: string
}

export interface ContextHelpButtonProps {
	children?: React.ReactNode
	action?: `/user-guide/${string}` | (() => void)
	className?: string
}

/*
 CloseButton - meant for panels that can be stacked, as in Connections and Surfaces
*/
export function CloseButton({ closeFn, visibilityClass, className }: CloseButtonProps): React.JSX.Element {
	return (
		<button
			type="button"
			className={classNames('panel-icon-button', visibilityClass, className)}
			onClick={closeFn}
			title="Close panel"
			aria-label="Close panel"
		>
			<X className="w-4 h-4" />
		</button>
	)
}

/*
 ContextHelpButton - a generic inline-help icon, 
 particularly handy for panels and other headers such as in Connections and Surfaces.
 - children: what to show on hover or focus. Can be plain-text or a React fragment.
 - action: optional, either a link to the user guide or a custom function (to open a modal dialog, for example).
*/
export function ContextHelpButton({ children, action, className }: ContextHelpButtonProps): React.JSX.Element {
	// First, a little trick to handle both keyboard navigation, in which the "hover help" should show up on focus,
	// and "click" (including "enter"), which will open a new tab and should close the hover-help.
	// Without removeFocus() the help icon will retain focus, and hover-help will still show when the user returns to this tab.
	// afterElementRef is a little trick to preserve tab focus order, so the next tab will go to the element after this one in the tab-order.
	const afterElementRef = useRef<HTMLDivElement>(null)
	const removeFocus = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
		event.currentTarget.blur()
		afterElementRef.current?.focus({ preventScroll: true })
	}, [])

	const onClickAction = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (typeof action === 'function') action()

			removeFocus(event)
		},
		[removeFocus, action]
	)

	if (children && typeof children === 'string' && action && !/click/i.test(children)) {
		children += ' Click the icon for further help.'
	}

	return (
		<>
			<HelpWrapper usePopover={!!children} help={children} className={className}>
				{typeof action === 'string' ? (
					// note: string is currently typed to link to /user-guide/, which is not a Tanstack route
					<a
						className="panel-icon-button"
						href={makeAbsolutePath(action)}
						target="_blank"
						rel="noopener noreferrer"
						title="Open help documentation in a new tab"
						aria-label="Open help documentation in a new tab"
					>
						<CircleHelp className="w-4 h-4" aria-label="context help" />
					</a>
				) : (
					<button type="button" className="panel-icon-button" onClick={onClickAction} title="Help" aria-label="Help">
						<CircleHelp className="w-4 h-4" aria-label="context help" />
					</button>
				)}
			</HelpWrapper>
			<span ref={afterElementRef} tabIndex={-1} style={{ outline: 'none' }} aria-hidden="true" />
		</>
	)
}

interface HelpWrapperProps extends React.ComponentProps<typeof InlineHelpCustom> {
	usePopover: boolean
	children: React.ReactNode
}
function HelpWrapper({ usePopover, children, className, ...props }: HelpWrapperProps) {
	return usePopover ? (
		<InlineHelpCustom
			{...props}
			className={classNames('context-help-button inline-flex items-center self-center', className)}
		>
			{children}
		</InlineHelpCustom>
	) : (
		<span className={classNames('context-help-button inline-flex items-center self-center', className)}>
			{children}
		</span>
	)
}
