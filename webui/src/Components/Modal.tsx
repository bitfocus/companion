/* eslint-disable react-refresh/only-export-components */
import { Dialog } from '@base-ui/react/dialog'
import './Modal.css'
import './close-button.css'
import classNames from 'classnames'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes } from 'react'
import type { ButtonColor } from './Button'
import { MenuPortalContext } from './MenuPortalContext'

// ─── Static Pulse Context ────────────────────────────────────────────────────

const ModalStaticPulseContext = createContext<{ pulseKey: number }>({ pulseKey: 0 })

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface ModalRootProps extends Omit<Dialog.Root.Props, 'disablePointerDismissal'> {
	disableDismiss?: boolean
}

function ModalRoot({ disableDismiss, onOpenChange, open, ...props }: ModalRootProps): React.JSX.Element {
	const [pulseKey, setPulseKey] = useState(0)

	// When a modal is opened programmatically (not via <Dialog.Trigger>), Base UI can't associate the
	// opening pointer interaction with the dialog, so the tail of that interaction (a mouseup landing on
	// the just-mounted backdrop) can immediately dismiss it. A genuine outside-press requires a fresh
	// pointerdown that begins after the modal is open, so ignore outside-press until we've seen one.
	const isControlled = open !== undefined
	const armedRef = useRef(false)
	useEffect(() => {
		armedRef.current = false
		if (!isControlled || !open) return
		const arm = () => (armedRef.current = true)
		document.addEventListener('pointerdown', arm, true)
		return () => document.removeEventListener('pointerdown', arm, true)
	}, [isControlled, open])

	const handleOpenChange = useCallback(
		(nextOpen: boolean, details: Dialog.Root.ChangeEventDetails) => {
			if (!nextOpen) {
				if (details.reason === 'outside-press' && isControlled && !armedRef.current) {
					return
				}
				if (disableDismiss && details.reason === 'outside-press') {
					setPulseKey((k) => k + 1)
					return
				}
				if (disableDismiss && details.reason === 'escape-key') {
					setPulseKey((k) => k + 1)
					return
				}
			}
			onOpenChange?.(nextOpen, details)
		},
		[disableDismiss, onOpenChange, isControlled]
	)

	return (
		<ModalStaticPulseContext.Provider value={{ pulseKey }}>
			<Dialog.Root open={open} {...props} onOpenChange={handleOpenChange} />
		</ModalStaticPulseContext.Provider>
	)
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface ModalTriggerProps extends Omit<Dialog.Trigger.Props, 'className'> {
	className?: string

	size?: 'sm' | 'md' | 'lg'
	color?: ButtonColor | null
}

function ModalTrigger({ className, color, size, ...props }: ModalTriggerProps): React.JSX.Element {
	return (
		<Dialog.Trigger
			className={classNames(
				'button',
				color !== null && `button-${color || 'secondary'}`,
				size && `button-${size}`,
				className
			)}
			role="button"
			{...props}
		/>
	)
}

// ─── Portal ───────────────────────────────────────────────────────────────────

export type ModalPortalProps = Dialog.Portal.Props

function ModalPortal(props: ModalPortalProps): React.JSX.Element {
	return <Dialog.Portal {...props} />
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────

export interface ModalBackdropProps extends Omit<Dialog.Backdrop.Props, 'className'> {
	className?: string
}

function ModalBackdrop({ className, ...props }: ModalBackdropProps): React.JSX.Element {
	return <Dialog.Backdrop className={classNames('modal2-backdrop', className)} {...props} />
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

export interface ModalViewportProps extends Omit<Dialog.Viewport.Props, 'className'> {
	className?: string
}

function ModalViewport({ className, ...props }: ModalViewportProps): React.JSX.Element {
	return <Dialog.Viewport className={classNames('modal2-viewport', className)} {...props} />
}

// ─── Popup ────────────────────────────────────────────────────────────────────

type ModalSize = 'sm' | 'lg' | 'xl'

export interface ModalPopupProps extends Omit<Dialog.Popup.Props, 'className'> {
	className?: string
	size?: ModalSize
	scrollable?: boolean
}

function ModalPopup({
	className,
	size,
	scrollable,
	children,
	onAnimationEnd,
	...props
}: ModalPopupProps): React.JSX.Element {
	const [ref, setRef] = useState<HTMLElement | null>(null)
	const { pulseKey } = useContext(ModalStaticPulseContext)
	const [pulsing, setPulsing] = useState(false)
	const prevPulseKeyRef = useRef(pulseKey)

	useEffect(() => {
		if (pulseKey !== prevPulseKeyRef.current) {
			prevPulseKeyRef.current = pulseKey
			setPulsing(true)
		}
	}, [pulseKey])

	return (
		<Dialog.Popup
			className={classNames(
				'modal2-dialog',
				size && `modal2-${size}`,
				scrollable && 'modal2-dialog-scrollable',
				pulsing && 'modal2-static-pulse',
				className
			)}
			ref={setRef}
			onAnimationEnd={(e) => {
				if (e.animationName === 'modal2-static-pulse') setPulsing(false)
				onAnimationEnd?.(e)
			}}
			{...props}
		>
			<MenuPortalContext.Provider value={ref}>{children}</MenuPortalContext.Provider>
		</Dialog.Popup>
	)
}

// ─── Title ────────────────────────────────────────────────────────────────────

export interface ModalTitleProps extends Omit<Dialog.Title.Props, 'className'> {
	className?: string
}

function ModalTitle({ className, ...props }: ModalTitleProps): React.JSX.Element {
	return <Dialog.Title className={classNames('modal2-title', className)} {...props} />
}

// ─── Description ──────────────────────────────────────────────────────────────

export interface ModalDescriptionProps extends Omit<Dialog.Description.Props, 'className'> {
	className?: string
}

function ModalDescription({ className, ...props }: ModalDescriptionProps): React.JSX.Element {
	return <Dialog.Description className={classNames('modal2-description', className)} {...props} />
}

// ─── Close ────────────────────────────────────────────────────────────────────

export interface ModalCloseProps extends Omit<Dialog.Close.Props, 'className'> {
	className?: string

	size?: 'sm' | 'md' | 'lg'
	color?: ButtonColor
}

function ModalClose({ className, color, size, ...props }: ModalCloseProps): React.JSX.Element {
	return (
		<Dialog.Close
			className={classNames('button', `button-${color || 'secondary'}`, size && `button-${size}`, className)}
			{...props}
		/>
	)
}

// ─── Header ───────────────────────────────────────────────────────────────────

export interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
	closeButton?: boolean
}

function ModalHeader({ className, children, closeButton, ...props }: ModalHeaderProps): React.JSX.Element {
	return (
		<div className={classNames('modal2-header', className)} {...props}>
			{children}
			{closeButton && <Dialog.Close className="btn btn-close" aria-label="Close modal" tabIndex={-1} />}
		</div>
	)
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export type ModalBodyProps = HTMLAttributes<HTMLDivElement>

function ModalBody({ className, ...props }: ModalBodyProps): React.JSX.Element {
	return <div className={classNames('modal2-body', className)} {...props} />
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export type ModalFooterProps = HTMLAttributes<HTMLDivElement>

function ModalFooter({ className, ...props }: ModalFooterProps): React.JSX.Element {
	return <div className={classNames('modal2-footer', className)} {...props} />
}

// ─── Namespace export ─────────────────────────────────────────────────────────

export const Modal = {
	Root: ModalRoot,
	Trigger: ModalTrigger,
	Portal: ModalPortal,
	Backdrop: ModalBackdrop,
	Viewport: ModalViewport,
	Popup: ModalPopup,
	Title: ModalTitle,
	Description: ModalDescription,
	Close: ModalClose,
	Header: ModalHeader,
	Body: ModalBody,
	Footer: ModalFooter,
}
