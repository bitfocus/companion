import { Toast } from '@base-ui/react/toast'
import './Notifications.css'
import { faCircleExclamation, faInfoCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { nanoid } from 'nanoid'
import { forwardRef, useImperativeHandle } from 'react'

export interface NotificationsManagerRef {
	show(title: string, message: string, duration?: number | null, stickyId?: string): string
	close(messageId: string): void
}

interface NotificationData {
	isError: boolean
}

const toastManager = Toast.createToastManager()

/**
 * Until `show()` carries an explicit severity, "is this an error" is inferred from the text. Done
 * once when the toast is created rather than on every render of the list.
 */
function inferIsError(title: string, message: string | undefined): boolean {
	const text = `${title} ${message ?? ''}`.toLowerCase()
	return text.includes('fail') || text.includes('error')
}

function ToastList() {
	const { toasts } = Toast.useToastManager()
	return (
		<Toast.Portal>
			<Toast.Viewport className="notification-viewport">
				{toasts.map((toast) => {
					const isSticky = toast.timeout === 0
					const showHeader = !!toast.title || isSticky
					const isError = !!(toast.data as NotificationData | undefined)?.isError

					return (
						<Toast.Root
							key={toast.id}
							toast={toast}
							className={classNames(
								'notification rounded-xl border border-border/80 bg-surface shadow-xl overflow-hidden transition-all',
								isError ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-primary'
							)}
						>
							<Toast.Content className="notification-content p-3.5">
								{showHeader && (
									<div className="notification-header flex items-center justify-between gap-2 mb-1">
										<div className="flex items-center gap-2 min-w-0">
											<FontAwesomeIcon
												icon={isError ? faCircleExclamation : faInfoCircle}
												className={isError ? 'text-rose-500 text-sm shrink-0' : 'text-primary text-sm shrink-0'}
											/>
											{toast.title && (
												<Toast.Title className="notification-title font-bold text-sm text-body truncate">
													{toast.title}
												</Toast.Title>
											)}
										</div>
										<Toast.Close
											className="w-6 h-6 inline-flex items-center justify-center rounded-md text-muted hover:text-body hover:bg-surface-muted transition-colors cursor-pointer border-0 bg-transparent shrink-0"
											aria-label="Close notification"
										>
											<FontAwesomeIcon icon={faTimes} className="text-xs" />
										</Toast.Close>
									</div>
								)}
								<Toast.Description className="notification-body text-xs text-muted leading-relaxed">
									{toast.description}
								</Toast.Description>
							</Toast.Content>
						</Toast.Root>
					)
				})}
			</Toast.Viewport>
		</Toast.Portal>
	)
}

export const NotificationsManager = forwardRef<NotificationsManagerRef>(function NotificationsManager(_props, ref) {
	useImperativeHandle(ref, () => ({
		show(title, message, duration, stickyId) {
			const id = stickyId ?? nanoid()
			const timeout = duration === null ? 0 : (duration ?? 10000)
			toastManager.add({
				id,
				title: title || undefined,
				description: message ?? title,
				timeout,
				data: { isError: inferIsError(title, message) } satisfies NotificationData,
			})
			return id
		},
		close(id) {
			toastManager.close(id)
		},
	}))

	return (
		<Toast.Provider toastManager={toastManager} timeout={10000} limit={20}>
			<ToastList />
		</Toast.Provider>
	)
})
