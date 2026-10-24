import { Link } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

/** Text naming another installation, as a link to it once it has been discovered */
export const PeerLink = observer(function PeerLink({
	peerId,
	children,
}: {
	peerId: string | undefined
	children: React.ReactNode
}): React.JSX.Element {
	const { link: linkStore } = useContext(RootAppStoreContext)
	if (!peerId || !linkStore.peers.some((peer) => peer.id === peerId)) return <>{children}</>

	return (
		<Link to="/link/$peerId" params={{ peerId }}>
			{children}
		</Link>
	)
})
