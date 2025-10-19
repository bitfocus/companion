import { CButton } from '@coreui/react'
import { faDollarSign } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { Tuck } from '~/Components/Tuck.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ClientConnectionConfigWithId } from './ConnectionList.js'
import { useConnectionListContext } from './ConnectionListContext.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { InstancesListTableRow } from '~/Instances/List/InstancesListTableRow.js'

interface ConnectionsTableRowProps {
	connection: ClientConnectionConfigWithId
	isSelected: boolean
}
export const ConnectionsTableRow = observer(function ConnectionsTableRow({
	connection,
	isSelected,
}: ConnectionsTableRowProps) {
	const { connections, variablesStore } = useContext(RootAppStoreContext)
	const { showVariables, deleteModalRef, configureConnection } = useConnectionListContext()

	const id = connection.id

	const deleteMutation = useMutationExt(trpc.instances.connections.delete.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.instances.connections.setEnabled.mutationOptions())

	const doDelete = useCallback(() => {
		deleteModalRef.current?.show(
			'Delete connection',
			[
				`Are you sure you want to delete "${connection.label}"?`,
				'This will remove all actions and feedbacks associated with this connection.',
			],
			'Delete',
			() => {
				deleteMutation.mutateAsync({ connectionId: id }).catch((e) => {
					console.error('Delete failed', e)
				})
				configureConnection(null)
			}
		)
	}, [deleteMutation, deleteModalRef, id, connection.label, configureConnection])

	const isEnabled = connection.enabled === undefined || connection.enabled
	const doToggleEnabled = useCallback(() => {
		setEnabledMutation.mutateAsync({ connectionId: id, enabled: !isEnabled }).catch((e) => {
			console.error('Set enabled failed', e)
		})
	}, [setEnabledMutation, id, isEnabled])

	const doShowVariables = useCallback(() => showVariables(connection.label), [showVariables, connection.label])

	const connectionVariables = variablesStore.variables.get(connection.label)

	const editClickId = isSelected ? null : id // If this row is selected, don't allow editing on click, as it will close the selection
	const doEdit = useCallback(() => configureConnection(editClickId), [configureConnection, editClickId])

	return (
		<InstancesListTableRow
			collectionsStore={connections}
			instance={connection}
			instanceStatus={connection.status}
			extraMenuItems={
				<CButton
					onMouseDown={doShowVariables}
					title="Variables"
					color="secondary"
					disabled={!isEnabled || !(connectionVariables && connectionVariables.size > 0)}
					style={{ textAlign: 'left' }}
				>
					<Tuck>
						<FontAwesomeIcon icon={faDollarSign} />
					</Tuck>
					Variables
				</CButton>
			}
			labelStr="connection"
			doDelete={doDelete}
			doEdit={doEdit}
			doToggleEnabled={doToggleEnabled}
			debugLogUrl={`/connection-debug/${id}`}
		/>
	)
})
