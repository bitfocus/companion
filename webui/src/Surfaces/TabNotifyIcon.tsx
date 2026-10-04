import { observer } from 'mobx-react-lite'
import { useConnectionsNotifications, useSurfacesNotifications, type TabNotifications } from './useTabNotifications.js'

function NotifyCount({ notifications }: { notifications: TabNotifications }): React.JSX.Element | null {
	if (notifications.count === 0) return null

	return (
		<span className="notification-count" title={notifications.lines.join(', ')}>
			{notifications.count}
		</span>
	)
}

export const SurfacesTabNotifyIcon = observer(function SurfacesTabNotifyIcon(): React.JSX.Element | null {
	return <NotifyCount notifications={useSurfacesNotifications()} />
})

export const ConnectionsTabNotifyIcon = observer(function ConnectionsTabNotifyIcon(): React.JSX.Element | null {
	return <NotifyCount notifications={useConnectionsNotifications()} />
})
