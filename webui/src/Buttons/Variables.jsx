import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CAlert, CButton } from '@coreui/react'
import { CompanionContext } from '../util'
import { VariablesTable } from '../Components/VariablesTable'

export const InstanceVariables = function InstanceVariables({ resetToken }) {
	const context = useContext(CompanionContext)

	const [instanceId, setInstance] = useState(null)

	const instancesLabelMap = useMemo(() => {
		const labelMap = new Map()
		for (const [id, instance] of Object.entries(context.instances)) {
			labelMap.set(instance.label, id)
		}
		return labelMap
	}, [context.instances])

	// Reset selection on resetToken change
	useEffect(() => {
		setInstance(null)
	}, [resetToken])

	if (instanceId) {
		const instance = context.instances[instanceId]

		return <VariablesList selectedInstanceLabel={instance?.label} setInstance={setInstance} />
	} else {
		return <VariablesInstanceList setInstance={setInstance} instancesLabelMap={instancesLabelMap} />
	}
}

function VariablesInstanceList({ setInstance, instancesLabelMap }) {
	const context = useContext(CompanionContext)

	const options = Object.entries(context.variableDefinitions || []).map(([label, defs]) => {
		if (!defs || defs.length === 0) return ''

		const id = instancesLabelMap.get(label)
		const instance = id ? context.instances[id] : undefined
		const module = instance ? context.modules[instance.instance_type] : undefined

		return (
			<div key={id}>
				<CButton color="info" className="choose_instance mb-3 mr-2" onClick={() => setInstance(id)}>
					{module?.label ?? module?.name ?? '?'} ({label ?? id})
				</CButton>
			</div>
		)
	})

	return (
		<div>
			<h5>Variables</h5>
			<p>Some connection types provide variables for you to use in button text.</p>
			{options.length === 0 ? (
				<CAlert color="primary">
					You have no connections that support variables at the moment. More modules will support variables in the
					future.
				</CAlert>
			) : (
				options
			)}
		</div>
	)
}

function VariablesList({ selectedInstanceLabel, setInstance }) {
	const doBack = useCallback(() => setInstance(null), [setInstance])

	return (
		<div>
			<h5>
				<CButton color="primary" size="sm" onClick={doBack}>
					Back
				</CButton>
				Variables for {selectedInstanceLabel}
			</h5>

			<VariablesTable label={selectedInstanceLabel} />

			<br style={{ clear: 'both' }} />
		</div>
	)
}
