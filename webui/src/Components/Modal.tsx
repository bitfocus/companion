/* eslint-disable react-refresh/only-export-components */
import { Dialog } from '@base-ui/react/dialog'
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

function ModalRoot({ disableDismiss, onOpenChange, ...props }: ModalRootProps): JSX.Element {
	const [pulseKey, setPulseKey] = useState(0)

	const handleOpenChange = useCallback(
		(open: boolean, details: Dialog.Root.ChangeEventDetails) => {
			if (!open) {
				if (disableDismiss && details.reason === 'outside-press') {
					setPulseKey((k) => k + 1)
					return
				}
				if (disableDismiss && details.reason === 'escape-key') {
					setPulseKey((k) => k + 1)
					return
				}
			}
			onOpenChange?.(open, details)
		},
		[disableDismiss, onOpenChange]
	)

	return (
		<ModalStaticPulseContext.Provider value={{ pulseKey }}>
			<Dialog.Root {...props} onOpenChange={handleOpenChange} />
		</ModalStaticPulseContext.Provider>
	)
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface ModalTriggerProps extends Omit<Dialog.Trigger.Props, 'className'> {
	className?: string

	size?: 'sm' | 'md' | 'lg'
	color?: ButtonColor | null
}

function ModalTrigger({ className, color, size, ...props }: ModalTriggerProps): JSX.Element {
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

function ModalPortal(props: ModalPortalProps): JSX.Element {
	return <Dialog.Portal {...props} />
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────

export interface ModalBackdropProps extends Omit<Dialog.Backdrop.Props, 'className'> {
	className?: string
}

function ModalBackdrop({ className, ...props }: ModalBackdropProps): JSX.Element {
	return <Dialog.Backdrop className={classNames('modal2-backdrop', className)} {...props} />
}

// ─── Viewport ─────────────────────────────────────────────────────────────────

export interface ModalViewportProps extends Omit<Dialog.Viewport.Props, 'className'> {
	className?: string
}

function ModalViewport({ className, ...props }: ModalViewportProps): JSX.Element {
	return <Dialog.Viewport className={classNames('modal2-viewport', className)} {...props} />
}

// ─── Popup ────────────────────────────────────────────────────────────────────

type ModalSize = 'sm' | 'lg' | 'xl'

export interface ModalPopupProps extends Omit<Dialog.Popup.Props, 'className'> {
	className?: string
	size?: ModalSize
	scrollable?: boolean
}

function ModalPopup({ className, size, scrollable, children, onAnimationEnd, ...props }: ModalPopupProps): JSX.Element {
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

function ModalTitle({ className, ...props }: ModalTitleProps): JSX.Element {
	return <Dialog.Title className={classNames('modal2-title', className)} {...props} />
}

// ─── Description ──────────────────────────────────────────────────────────────

export interface ModalDescriptionProps extends Omit<Dialog.Description.Props, 'className'> {
	className?: string
}

function ModalDescription({ className, ...props }: ModalDescriptionProps): JSX.Element {
	return <Dialog.Description className={classNames('modal2-description', className)} {...props} />
}

// ─── Close ────────────────────────────────────────────────────────────────────

export interface ModalCloseProps extends Omit<Dialog.Close.Props, 'className'> {
	className?: string

	size?: 'sm' | 'md' | 'lg'
	color?: ButtonColor
}

function ModalClose({ className, color, size, ...props }: ModalCloseProps): JSX.Element {
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

function ModalHeader({ className, children, closeButton, ...props }: ModalHeaderProps): JSX.Element {
	return (
		<div className={classNames('modal2-header', className)} {...props}>
			{children}
			{closeButton && <Dialog.Close className="btn btn-close" tabIndex={-1} />}
		</div>
	)
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export type ModalBodyProps = HTMLAttributes<HTMLDivElement>

function ModalBody({ className, ...props }: ModalBodyProps): JSX.Element {
	return <div className={classNames('modal2-body', className)} {...props} />
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export type ModalFooterProps = HTMLAttributes<HTMLDivElement>

function ModalFooter({ className, ...props }: ModalFooterProps): JSX.Element {
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
