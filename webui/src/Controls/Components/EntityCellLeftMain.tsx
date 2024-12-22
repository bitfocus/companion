import { DropdownChoiceId } from '@companion-module/base'
import React, { useContext } from 'react'
import { DropdownInputField } from '../../Components/DropdownInputField.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { useComputed } from '../../util.js'
import { observer } from 'mobx-react-lite'

interface EntityCellLeftMainProps {
	entityConnectionId: string
	setConnectionId: (connectionId: string) => void
}
export const EntityCellLeftMain = observer(function EntityCellLeftMain({
	entityConnectionId,
	setConnectionId,
	children,
}: React.PropsWithChildren<EntityCellLeftMainProps>) {
	const { connections } = useContext(RootAppStoreContext)

	const connectionChoices = useComputed(() => {
		const connectionInfo = connections.getInfo(entityConnectionId)

		const connectionsWithSameType = connectionInfo ? connections.getAllOfType(connectionInfo.instance_type) : []

		return connectionsWithSameType
			.sort((connectionA, connectionB) => connectionA[1].sortOrder - connectionB[1].sortOrder)
			.map((connection) => {
				const [id, info] = connection
				return { id, label: info.label }
			})
	}, [connections, entityConnectionId])

	return (
		<div className="cell-left-main">
			{connectionChoices.length > 1 && (
				<div className="option-field">
					<DropdownInputField
						label="Connection"
						choices={connectionChoices}
						multiple={false}
						value={entityConnectionId}
						setValue={setConnectionId as (value: DropdownChoiceId) => void}
					/>
				</div>
			)}

			{children}
		</div>
	)
})
