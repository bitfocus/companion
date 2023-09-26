import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CButton } from '@coreui/react'
import { InstancesContext, VariableDefinitionsContext, ModulesContext } from '../util'
import { VariablesTable } from '../Components/VariablesTable'
import { CustomVariablesList } from './CustomVariablesList'

export const InstanceVariables = function InstanceVariables({ resetToken }) {
	const instancesContext = useContext(InstancesContext)

	const [instanceId, setInstance] = useState(null)
	const [showCustom, setShowCustom] = useState(false)

	const instancesLabelMap = useMemo(() => {
		const labelMap = new Map()
		for (const [id, instance] of Object.entries(instancesContext)) {
			labelMap.set(instance.label, id)
		}
		return labelMap
	}, [instancesContext])

	// Reset selection on resetToken change
	useEffect(() => {
		setInstance(null)
	}, [resetToken])

	if (showCustom) {
		return <CustomVariablesList setShowCustom={setShowCustom} />
	} else if (instanceId) {
		let instanceLabel = instancesContext[instanceId]?.label
		if (instanceId === 'internal') instanceLabel = 'internal'

		return <VariablesList selectedInstanceLabel={instanceLabel} setInstance={setInstance} />
	} else {
		return (
			<VariablesInstanceList
				setInstance={setInstance}
				setShowCustom={setShowCustom}
				instancesLabelMap={instancesLabelMap}
			/>
		)
	}
}

function VariablesInstanceList({ setInstance, setShowCustom, instancesLabelMap }) {
	const modules = useContext(ModulesContext)
	const instancesContext = useContext(InstancesContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const options = Object.entries(variableDefinitionsContext || []).map(([label, defs]) => {
		if (!defs || Object.keys(defs).length === 0) return ''

		if (label === 'internal') {
			return (
				<div key={label}>
					<CButton color="info" className="choose_instance mb-3 mr-2" onClick={() => setInstance('internal')}>
						Internal
					</CButton>
				</div>
			)
		}

		const id = instancesLabelMap.get(label)
		const instance = id ? instancesContext[id] : undefined
		const module = instance ? modules[instance.instance_type] : undefined

		return (
			<div key={id}>
				<CButton color="info" className="choose_instance mb-3 mr-2" onClick={() => setInstance(id)}>
					{module?.name ?? module?.name ?? '?'} ({label ?? id})
				</CButton>
			</div>
		)
	})

	return (
		<div>
			<h5>Variables</h5>
			<p>Some connection types provide variables for you to use in button text.</p>
			<div>
				<CButton color="info" className="choose_instance mb-3 mr-2" onClick={() => setShowCustom(true)}>
					Custom Variables
				</CButton>
			</div>
			{options}
		</div>
	)
}

function VariablesList({ selectedInstanceLabel, setInstance }) {
	const doBack = useCallback(() => setInstance(null), [setInstance])

	return (
		<div className="variables-panel">
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
