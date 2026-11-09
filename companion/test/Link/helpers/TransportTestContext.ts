import type { JsonValue } from 'type-fest'
import type {
	LinkTransportInfoItem,
	LinkTransportSection,
	LinkTransportStatus,
} from '@companion-app/shared/Model/Link.js'
import { LinkIdentity } from '../../../lib/Link/Identity.js'
import type { LinkMessageOrigin, LinkTransportContext } from '../../../lib/Link/Transports/Types.js'
import LogController from '../../../lib/Log/Controller.js'

/** The identity of each installation, by its storage, so that reusing the storage is the same installation */
const identities = new WeakMap<Map<string, JsonValue>, LinkIdentity>()

/** A fake of what the Link core gives a transport, recording what the transport does with it */
export function createTransportTestContext(name: string, storage = new Map<string, JsonValue>()) {
	let identity = identities.get(storage)
	if (!identity) {
		identity = LinkIdentity.generate()
		identities.set(storage, identity)
	}

	/** The announcements handed over, by the Link id of the installation they are from */
	const announcements: [string, string | null][] = []
	const received: [string, LinkMessageOrigin][] = []
	const state = {
		status: 'disabled' as LinkTransportStatus,
		message: null as string | null,
		info: [] as LinkTransportInfoItem[],
		sections: [] as LinkTransportSection[],
	}

	const context: LinkTransportContext = {
		logger: LogController.createLogger(`test/${name}`),
		identity,
		getName: () => name,
		storage: { get: (key) => storage.get(key), set: (key, value) => storage.set(key, value) },
		receiveAnnouncement: (peerId, payload) => announcements.push([peerId, payload]),
		receive: (payload, origin) => received.push([payload, origin]),
		setStatus: (status, message) => {
			state.status = status
			state.message = message
		},
		setInfo: (info) => {
			state.info = info
		},
		setSections: (sections) => {
			state.sections = sections
		},
	}

	return { name, context, announcements, received, state, storage }
}

export type TransportTestContext = ReturnType<typeof createTransportTestContext>
