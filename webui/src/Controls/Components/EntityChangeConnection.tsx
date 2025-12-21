import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import React, { useContext } from 'react'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useComputed } from '~/Resources/util.js'
import { observer } from 'mobx-react-lite'
import { CCol, CFormLabel } from '@coreui/react'

interface EntityCellLeftMainProps {
	entityConnectionId: string
	setConnectionId: (connectionId: string) => void
}
export const EntityChangeConnection = observer(function EntityCellLeftMain({
	entityConnectionId,
	setConnectionId,
}: EntityCellLeftMainProps) {
	const { connections } = useContext(RootAppStoreContext)

	const connectionChoices = useComputed(() => {
		const connectionInfo = connections.getInfo(entityConnectionId)

		const connectionsWithSameType = connectionInfo ? connections.getAllOfModuleId(connectionInfo.moduleId) : []

		return connectionsWithSameType
			.sort((connectionA, connectionB) => connectionA[1].sortOrder - connectionB[1].sortOrder)
			.map((connection) => {
				const [id, info] = connection
				return { id, label: info.label }
			})
	}, [connections, entityConnectionId])

	if (connectionChoices.length <= 1) return null

	return (
		<>
			<CFormLabel htmlFor="colFormConnection" className="col-sm-4 col-form-label col-form-label-sm">
				Connection
			</CFormLabel>
			<CCol sm={8}>
				<DropdownInputField
					htmlName="colFormConnection"
					choices={connectionChoices}
					value={entityConnectionId}
					setValue={setConnectionId as (value: DropdownChoiceId) => void}
				/>
			</CCol>
		</>
	)
})
