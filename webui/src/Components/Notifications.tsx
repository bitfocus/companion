import { CToast, CToastBody, CToaster, CToastHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { nanoid } from 'nanoid'

export interface NotificationsManagerRef {
	show(title: string, message: string, duration?: number, stickyId?: string): string
	close(messageId: string): void
}

interface NotificationsManagerProps {
	// Nothing
}

interface CurrentToast {
	id: string
	message: string
	title: string
	show: boolean
	autohide: number | undefined

	fade?: never
	closeButton?: never
}

export const NotificationsManager = forwardRef<NotificationsManagerRef, NotificationsManagerProps>(
	function NotificationsManager(_props, ref) {
		const [toasts, setToasts] = useState<CurrentToast[]>([])

		const doPruneToastIdInner = useCallback((id: string) => {
			setToasts((oldToasts) => oldToasts.filter((t) => t.id !== id))
		}, [])
		const doPruneToastId = useCallback(
			(id: string, duration: number) => {
				setTimeout(() => {
					// now prune them
					doPruneToastIdInner(id)
				}, 3000 + duration)
			},
			[doPruneToastIdInner]
		)
		const doDisposeToastId = useCallback(
			(id: string) => {
				// hide them
				setToasts((oldToasts) => oldToasts.map((t) => (t.id === id ? { ...t, autohide: 1 } : t)))

				doPruneToastIdInner(id)
			},
			[doPruneToastIdInner]
		)

		// Expose reload to the parent
		useImperativeHandle(
			ref,
			() => ({
				show(title, message, duration, stickyId) {
					const id = stickyId ?? nanoid()

					const autohide = duration === null ? undefined : duration ?? 10000
					if (typeof autohide === 'number') {
						doPruneToastId(id, autohide)
					}

					setToasts((oldToasts) => [
						...oldToasts.filter((t) => t.id !== id),
						{
							id: id,
							message: message ?? title,
							title: title,
							show: true,
							autohide: autohide,
						},
					])

					return id
				},
				close(id) {
					doDisposeToastId(id)
				},
			}),
			[doDisposeToastId, doPruneToastId]
		)

		return (
			<>
				<CToaster position={'top-right'}>
					{toasts.map((toast) => {
						return (
							<CToast key={toast.id} show={toast.show} autohide={toast.autohide} fade={toast.fade}>
								<CToastHeader closeButton={toast.closeButton}>{toast.title}</CToastHeader>
								<CToastBody>{toast.message}</CToastBody>
							</CToast>
						)
					})}
				</CToaster>
			</>
		)
	}
)
