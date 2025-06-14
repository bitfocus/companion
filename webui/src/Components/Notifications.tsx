import { CToast, CToastBody, CToaster, CToastHeader } from '@coreui/react'
import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { nanoid } from 'nanoid'

export interface NotificationsManagerRef {
	show(title: string, message: string, duration?: number | null, stickyId?: string): string
	close(messageId: string): void
}

interface CurrentToast {
	id: string
	message: string
	title: string
	show: boolean
	autohide: number | undefined

	closeButton?: never
}

export const NotificationsManager = forwardRef<NotificationsManagerRef>(function NotificationsManager(_props, ref) {
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

				const autohide = duration === null ? undefined : (duration ?? 10000)
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
		<CToaster placement={'top-right'}>
			{toasts.map((toast) => {
				return (
					<React.Fragment key={toast.id}>
						<CToast visible={toast.show} autohide={(toast.autohide ?? 0) > 0} delay={toast.autohide}>
							<CToastHeader closeButton={toast.closeButton}>{toast.title}</CToastHeader>
							<CToastBody>{toast.message}</CToastBody>
						</CToast>
					</React.Fragment>
				)
			})}
		</CToaster>
	)
})
