import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import { whyLinkPeerUnusable } from '~/Buttons/EditButton/LinkPeerChoices.js'
import { useActivateOnKey } from '~/Hooks/useActivateOnKey.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

/**
 * The other Companion installations, whose buttons can be placed as remote buttons. Ones that can't be used now are
 * listed with why, so that it is clear where they went
 */
export const LinkPresetsInstallationList = observer(function LinkPresetsInstallationList({
	setPeerId,
}: {
	setPeerId: (peerId: string) => void
}): React.JSX.Element | null {
	const { link } = useContext(RootAppStoreContext)
	const listed = link.sortedPeers.filter((peer) => peer.compatible)
	if (listed.length === 0) return null

	return (
		<>
			<div className="presets-list-heading">Other installations</div>
			<div className="presets-installations">
				{listed.map((peer) => (
					<InstallationRow key={peer.id} peer={peer} setPeerId={setPeerId} />
				))}
			</div>
		</>
	)
})

function InstallationRow({ peer, setPeerId }: { peer: LinkPeerInfo; setPeerId: (peerId: string) => void }) {
	const why = whyLinkPeerUnusable(peer)
	const doSelect = useCallback(() => {
		if (!why) setPeerId(peer.id)
	}, [why, setPeerId, peer.id])
	const onKeyDown = useActivateOnKey(doSelect)

	return (
		<div
			className={classNames('presets-installation-row', { disabled: !!why })}
			role="button"
			tabIndex={why ? -1 : 0}
			aria-disabled={!!why}
			onClick={doSelect}
			onKeyDown={onKeyDown}
		>
			<div className="presets-connection-name">
				<span>{peer.name}</span>
				<small>{why ?? peer.fingerprint}</small>
			</div>
			{!why && <FontAwesomeIcon icon={faArrowRight} />}
		</div>
	)
}
