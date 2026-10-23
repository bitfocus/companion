import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import { trpc } from '~/Resources/TRPC.js'

/** The number of things on the Link pages that need the user's attention, eg pairing requests */
export function LinkTabNotifyIcon(): React.JSX.Element | null {
	const [lines, setLines] = useState<string[]>([])

	useSubscription(
		trpc.link.watchAttention.subscriptionOptions(undefined, {
			onStarted: () => setLines([]),
			onData: (data) => setLines(data),
		})
	)

	if (lines.length === 0) return null

	return (
		<span className="notification-count" title={lines.join(', ')}>
			{lines.length}
		</span>
	)
}
