import type { DataStoreSchemaTableView } from '../../../lib/Data/Tables/SchemaTableView.js'
import { StoredPeerSchema } from '../../../lib/Link/PeerRegistry.js'
import { FakeSchemaTableView, FakeTableView } from '../../utils/FakeTableView.js'

/** The peers table, parsed with its schema like the real one, with `store.data` holding what would be persisted */
export function peerStore(
	store: FakeTableView<any> = new FakeTableView<any>()
): DataStoreSchemaTableView<typeof StoredPeerSchema> {
	return new FakeSchemaTableView(store, StoredPeerSchema) as unknown as DataStoreSchemaTableView<
		typeof StoredPeerSchema
	>
}
