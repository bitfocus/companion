import { faKey, faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import type { ApiKeyInfo } from '@companion-app/shared/Model/ApiKeys.js'
import { Badge } from '~/Components/Badge.js'
import { Button } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { RestApiKeyModal, type RestApiKeyModalRef } from './RestApiKeyModal.js'

export const RestApiKeysSection = observer(function RestApiKeysSection() {
	const { notifier } = useContext(RootAppStoreContext)

	const { data: keysData, refetch: refetchKeys } = useQuery(trpc.restApiKeys.list.queryOptions())
	const deleteMutation = useMutationExt(trpc.restApiKeys.delete.mutationOptions())

	const modalRef = useRef<RestApiKeyModalRef>(null)
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const onSaved = useCallback(() => {
		void refetchKeys()
	}, [refetchKeys])

	const createKey = useCallback(() => modalRef.current?.create(), [])
	const editKey = useCallback((key: ApiKeyInfo) => modalRef.current?.edit(key), [])

	const deleteKey = useCallback(
		(key: ApiKeyInfo) => {
			confirmRef.current?.show(
				'Revoke API key',
				`Revoke API key "${key.name}"? Any client using it will immediately stop working.`,
				'Revoke',
				() => {
					deleteMutation
						.mutateAsync({ id: key.id })
						.then(() => {
							void refetchKeys()
						})
						.catch((err) => {
							notifier.show('Error', `Failed to revoke API key: ${err.message || err}`, 5000)
						})
				}
			)
		},
		[deleteMutation, refetchKeys, notifier]
	)

	const keys = keysData ?? []

	return (
		<EditSectionCard title="API Keys">
			<RestApiKeyModal ref={modalRef} onSaved={onSaved} />
			<GenericConfirmModal ref={confirmRef} />

			<div className="flex items-center justify-between gap-2">
				<p className="text-xs text-muted mb-0">Each client authenticates with its own key, limited to its scopes.</p>
				<Button color="primary" size="sm" className="shrink-0" onClick={createKey}>
					<FontAwesomeIcon icon={faPlus} className="me-1.5" />
					Add API key
				</Button>
			</div>

			{keys.length === 0 ? (
				<NonIdealState icon={faKey} text="No API keys yet" />
			) : (
				<div className="list-card divide-y divide-border/70">
					{keys.map((key) => (
						<RestApiKeyRow key={key.id} apiKey={key} editKey={editKey} deleteKey={deleteKey} />
					))}
				</div>
			)}
		</EditSectionCard>
	)
})

interface RestApiKeyRowProps {
	apiKey: ApiKeyInfo
	editKey: (key: ApiKeyInfo) => void
	deleteKey: (key: ApiKeyInfo) => void
}

function RestApiKeyRow({ apiKey, editKey, deleteKey }: RestApiKeyRowProps) {
	return (
		<div className="flex items-center gap-3 px-3 py-2.5">
			<div className="grow min-w-0">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="text-sm font-semibold truncate">{apiKey.name}</span>
					{apiKey.scopes.map((scope) => (
						<Badge key={scope} color="secondary" variant="tonal">
							{scope}
						</Badge>
					))}
				</div>
				<div className="text-2xs text-muted mt-0.5">
					<code>{apiKey.tokenPrefix}…</code>
					<span className="mx-1.5">·</span>
					{apiKey.lastUsedAt ? `Last used ${new Date(apiKey.lastUsedAt).toLocaleString()}` : 'Never used'}
				</div>
			</div>
			<div className="shrink-0 flex items-center gap-1">
				<Button variant="ghost" size="sm" onClick={() => editKey(apiKey)} title="Edit key">
					<FontAwesomeIcon icon={faPen} />
				</Button>
				<Button color="danger" variant="ghost" size="sm" onClick={() => deleteKey(apiKey)} title="Revoke key">
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</div>
		</div>
	)
}
