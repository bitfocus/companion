import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { formatLinkIdFingerprint, type LinkPeerInfo } from '@companion-app/shared/Model/Link.js'

/**
 * The installations a remote button can show a button of, named so that each can be told apart (by its fingerprint,
 * when another has the same name) and saying why one can't be used now
 */
export function linkPeerChoices(peers: readonly LinkPeerInfo[], chosenPeerId: string): DropdownChoice[] {
	const nameCounts = new Map<string, number>()
	for (const peer of peers) nameCounts.set(peer.name, (nameCounts.get(peer.name) ?? 0) + 1)

	const choices: DropdownChoice[] = peers
		.toSorted((a, b) => a.name.localeCompare(b.name))
		.map((peer) => {
			const name = (nameCounts.get(peer.name) ?? 0) > 1 ? `${peer.name} (${peer.fingerprint})` : peer.name
			const why = whyLinkPeerUnusable(peer)
			return { id: peer.id, label: why ? `${name} - ${why}` : name }
		})

	// Keep the chosen installation selectable even when it hasn't been discovered
	if (chosenPeerId && !peers.some((peer) => peer.id === chosenPeerId)) {
		choices.unshift({ id: chosenPeerId, label: `Unknown installation (${formatLinkIdFingerprint(chosenPeerId)})` })
	}
	return choices
}

/** Why buttons of an installation can't be used now, in a word or two, or null if they can */
export function whyLinkPeerUnusable(peer: LinkPeerInfo): string | null {
	if (!peer.compatible) return 'incompatible'
	if (!peer.online) return 'offline'
	if (peer.sharedWithUs?.buttons === false) return 'not shared'
	return null
}
