import React, { useCallback, useContext, useMemo, useState } from 'react'
import { CButton, CButtonGroup } from '@coreui/react'
import { ConnectionsContext } from '../util.js'
import { VariablesTable } from '../Components/VariablesTable.js'
import { CustomVariablesList } from '../Buttons/CustomVariablesList.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'

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
		const compactName = moduleInfo?.name?.replace(/\;.*/, '...')

		return (
			<CButton key={connectionId} color="primary" onClick={() => setConnectionId(connectionId ?? null)}>
				<h6>{label ?? connectionId}</h6> <small>{compactName ?? '?'}</small>
			</CButton>
		)
	})

	return (
		<div>
			<h4>Variables</h4>
			<p>
				We use variables as placeholders in text, allowing dynamic updates based on the provided content. This enables
				live updating of messages, making customization quick and easy.
			</p>
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
			<h4 style={{ marginBottom: '0.8rem' }}>Variables</h4>
			<CButtonGroup size="sm">
				<CButton color="primary" onClick={doBack}>
					<FontAwesomeIcon icon={faArrowLeft} />
					&nbsp; Go back
				</CButton>
				<CButton color="secondary" onClick={doBack} disabled>
					{selectedConnectionLabel}
				</CButton>
			</CButtonGroup>

			<VariablesTable label={selectedConnectionLabel} />
			<br style={{ clear: 'both' }} />
		</div>
	)
}
