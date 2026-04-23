import { CCol, CFormLabel } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { DropdownChoicesOrGroups } from '~/Components'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { groupItemsByCollection } from '~/Helpers/CollectionGrouping'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface EntityCellLeftMainProps {
	entityConnectionId: string
	setConnectionId: (connectionId: string) => void
}
export const EntityChangeConnection = observer(function EntityCellLeftMain({
	entityConnectionId,
	setConnectionId,
}: EntityCellLeftMainProps) {
	const { connections } = useContext(RootAppStoreContext)

	const connectionChoices = useComputed((): DropdownChoicesOrGroups | null => {
		const connectionInfo = connections.getInfo(entityConnectionId)
		if (!connectionInfo) return null

		// Convert connections map to array
		const allConnections = Array.from(connections.connections.values())

		const getItemChoice = (config: ClientConnectionConfig): DropdownChoice => ({
			id: config.id,
			label: config.label,
		})
		const filterItem = (config: ClientConnectionConfig) => config.moduleId === connectionInfo.moduleId

		const groupsOrItems = groupItemsByCollection(
			connections.rootCollections(),
			allConnections,
			getItemChoice,
			filterItem
		)

		// Check if there are any connections with the same moduleId
		const count = groupsOrItems.reduce((acc, item) => acc + ('options' in item ? item.options.length : 1), 0)
		if (count <= 1) return null

		return groupsOrItems
	}, [connections, entityConnectionId])

	if (!connectionChoices) return null

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
