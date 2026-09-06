import { faPen, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Table } from '~/Components/Table.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { RestApiKeyModal, type RestApiKeyModalRef } from './RestApiKeyModal.js'

export const RestApiConfig = observer(function RestApiConfig(props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="REST API" />

			<tr>
				<td colSpan={3}>
					<p>
						Exposes a versioned REST API at <code>/api/v2</code> for programmatic configuration of Companion. Requests
						are authenticated with a bearer token; create and manage keys below. See the{' '}
						<a href={makeAbsolutePath('/api/v2/docs')} target="_blank" rel="noreferrer">
							interactive API documentation
						</a>{' '}
						once enabled.
					</p>
				</td>
			</tr>

			<UserConfigSwitchRow userConfig={props} label="REST API" field="rest_api_enabled" />

			{props.config.rest_api_enabled && (
				<tr>
					<td colSpan={3}>
						<RestApiKeyManager />
					</td>
				</tr>
			)}
		</>
	)
})

const RestApiKeyManager = observer(function RestApiKeyManager() {
	const { notifier } = useContext(RootAppStoreContext)

	const { data: keysData, refetch: refetchKeys } = useQuery(trpc.restApiKeys.list.queryOptions())
	const deleteMutation = useMutationExt(trpc.restApiKeys.delete.mutationOptions())

	const modalRef = useRef<RestApiKeyModalRef>(null)
	const confirmRef = useRef<GenericConfirmModalRef>(null)

	const onSaved = useCallback(() => {
		void refetchKeys()
	}, [refetchKeys])

	const deleteKey = useCallback(
		(id: string, name: string) => {
			confirmRef.current?.show(
				'Revoke API key',
				`Revoke API key "${name}"? Any client using it will immediately stop working.`,
				'Revoke',
				() => {
					deleteMutation
						.mutateAsync({ id })
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
		<div className="flex-column-layout">
			<RestApiKeyModal ref={modalRef} onSaved={onSaved} />
			<GenericConfirmModal ref={confirmRef} />

			<Table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Scopes</th>
						<th className="fit whitespace-nowrap">Key</th>
						<th className="fit whitespace-nowrap">Last used</th>
						<th className="fit align-middle">
							<Button color="primary" size="sm" onClick={() => modalRef.current?.create()} title="Add API key">
								<FontAwesomeIcon icon={faPlus} />
							</Button>
						</th>
					</tr>
				</thead>
				<tbody>
					{keys.length === 0 && (
						<tr>
							<td colSpan={5}>No API keys yet.</td>
						</tr>
					)}
					{keys.map((key) => (
						<tr key={key.id}>
							<td>{key.name}</td>
							<td>{key.scopes.join(', ')}</td>
							<td className="whitespace-nowrap">
								<code>{key.tokenPrefix}…</code>
							</td>
							<td className="whitespace-nowrap">
								{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
							</td>
							<td className="whitespace-nowrap align-middle">
								<ButtonGroup>
									<Button color="secondary" size="sm" onClick={() => modalRef.current?.edit(key)} title="Edit key">
										<FontAwesomeIcon icon={faPen} />
									</Button>
									<Button color="danger" size="sm" onClick={() => deleteKey(key.id, key.name)} title="Revoke key">
										<FontAwesomeIcon icon={faTrash} />
									</Button>
								</ButtonGroup>
							</td>
						</tr>
					))}
				</tbody>
			</Table>
		</div>
	)
})
