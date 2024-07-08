import React, { useCallback, useContext, useMemo, useState } from 'react'
import { CButton } from '@coreui/react'
import { ConnectionsContext } from '../util.js'
import { VariablesTable } from '../Components/VariablesTable.js'
import { CustomVariablesList } from '../Buttons/CustomVariablesList.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

export const ConnectionVariables = function ConnectionVariables() {
	const connectionsContext = useContext(ConnectionsContext)

	const [connectionId, setConnectionId] = useState<string | null>(null)
	const [showCustom, setShowCustom] = useState(false)

	const connectionsLabelMap: ReadonlyMap<string, string> = useMemo(() => {
		const labelMap = new Map<string, string>()
		for (const [connectionId, connectionInfo] of Object.entries(connectionsContext)) {
			labelMap.set(connectionInfo.label, connectionId)
		}
		return labelMap
	}, [connectionsContext])

	// Reset selection on resetToken change
	// useEffect(() => {
	// 	setConnectionId(null)
	// }, [resetToken])

	if (showCustom) {
		return <CustomVariablesList setShowCustom={setShowCustom} />
	} else if (connectionId) {
		let connectionLabel = connectionsContext[connectionId]?.label
		if (connectionId === 'internal') connectionLabel = 'internal'

		return <VariablesList selectedConnectionLabel={connectionLabel} setConnectionId={setConnectionId} />
	} else {
		return (
			<VariablesConnectionList
				setConnectionId={setConnectionId}
				setShowCustom={setShowCustom}
				connectionsLabelMap={connectionsLabelMap}
			/>
		)
	}
}

interface VariablesConnectionListProps {
	setConnectionId: (connectionId: string | null) => void
	setShowCustom: (show: boolean) => void
	connectionsLabelMap: ReadonlyMap<string, string>
}

const VariablesConnectionList = observer(function VariablesConnectionList({
	setConnectionId,
	setShowCustom,
	connectionsLabelMap,
}: VariablesConnectionListProps) {
	const { modules, variablesStore } = useContext(RootAppStoreContext)
	const connectionsContext = useContext(ConnectionsContext)

	const options = variablesStore.connectionLabelsWithDefinitions.get().map((label) => {
		if (label === 'internal') {
			return (
				<CButton key={label} color="primary" onClick={() => setConnectionId('internal')}>
					Internal
				</CButton>
			)
		}

		const connectionId = connectionsLabelMap.get(label)
		const connectionInfo = connectionId ? connectionsContext[connectionId] : undefined
		const moduleInfo = connectionInfo ? modules.modules.get(connectionInfo.instance_type) : undefined

		return (
			<CButton key={connectionId} color="primary" onClick={() => setConnectionId(connectionId ?? null)}>
				{moduleInfo?.name ?? moduleInfo?.name ?? '?'} ({label ?? connectionId})
			</CButton>
		)
	})

	return (
		<div>
			<h5>Variables</h5>
			<p>Some connection types provide variables for you to use in button text.</p>
			<div className="variables-category-grid">
				<CButton color="primary" onClick={() => setShowCustom(true)}>
					Custom Variables
				</CButton>

				{options}
			</div>
		</div>
	)
})

interface VariablesListProps {
	selectedConnectionLabel: string
	setConnectionId: (connectionId: string | null) => void
}

function VariablesList({ selectedConnectionLabel, setConnectionId }: VariablesListProps) {
	const doBack = useCallback(() => setConnectionId(null), [setConnectionId])

	return (
		<div className="variables-panel">
			<h5>
				<CButton color="primary" size="sm" onClick={doBack}>
					Back
				</CButton>
				Variables for {selectedConnectionLabel}
			</h5>

			<VariablesTable label={selectedConnectionLabel} />

			<br style={{ clear: 'both' }} />
		</div>
	)
}
