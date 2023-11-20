import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CButton } from '@coreui/react'
import { ConnectionsContext, VariableDefinitionsContext, ModulesContext } from '../util'
import { VariablesTable } from '../Components/VariablesTable'
import { CustomVariablesList } from './CustomVariablesList'

interface ConnectionVariablesProps {
	resetToken: string
}

export const ConnectionVariables = function ConnectionVariables({ resetToken }: ConnectionVariablesProps) {
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
	useEffect(() => {
		setConnectionId(null)
	}, [resetToken])

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

function VariablesConnectionList({
	setConnectionId,
	setShowCustom,
	connectionsLabelMap,
}: VariablesConnectionListProps) {
	const modules = useContext(ModulesContext)
	const connectionsContext = useContext(ConnectionsContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const options = Object.entries(variableDefinitionsContext || []).map(([label, defs]) => {
		if (!defs || Object.keys(defs).length === 0) return ''

		if (label === 'internal') {
			return (
				<div key={label}>
					<CButton color="info" className="choose_connection mb-3 mr-2" onClick={() => setConnectionId('internal')}>
						Internal
					</CButton>
				</div>
			)
		}

		const connectionId = connectionsLabelMap.get(label)
		const connectionInfo = connectionId ? connectionsContext[connectionId] : undefined
		const moduleInfo = connectionInfo ? modules[connectionInfo.instance_type] : undefined

		return (
			<div key={connectionId}>
				<CButton
					color="info"
					className="choose_connection mb-3 mr-2"
					onClick={() => setConnectionId(connectionId ?? null)}
				>
					{moduleInfo?.name ?? moduleInfo?.name ?? '?'} ({label ?? connectionId})
				</CButton>
			</div>
		)
	})

	return (
		<div>
			<h5>Variables</h5>
			<p>Some connection types provide variables for you to use in button text.</p>
			<div>
				<CButton color="info" className="choose_connection mb-3 mr-2" onClick={() => setShowCustom(true)}>
					Custom Variables
				</CButton>
			</div>
			{options}
		</div>
	)
}

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
