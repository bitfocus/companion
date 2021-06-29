import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CForm, CFormGroup, CInput, CLabel } from '@coreui/react'
import {
	StaticContext,
	InstancesContext,
	VariableDefinitionsContext,
	CustomVariableDefinitionsContext,
	VariableValuesContext,
	socketEmit,
} from '../util'
import { VariablesTable } from '../Components/VariablesTable'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'

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
		const instance = instancesContext[instanceId]

		return <VariablesList selectedInstanceLabel={instance?.label} setInstance={setInstance} />
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
	const context = useContext(StaticContext)
	const instancesContext = useContext(InstancesContext)
	const variableDefinitionsContext = useContext(VariableDefinitionsContext)

	const options = Object.entries(variableDefinitionsContext || []).map(([label, defs]) => {
		if (!defs || defs.length === 0) return ''

		const id = instancesLabelMap.get(label)
		const instance = id ? instancesContext[id] : undefined
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
			<div>
				<CButton color="info" className="choose_instance mb-3 mr-2" onClick={() => setShowCustom(true)}>
					Custom Variables
				</CButton>
			</div>
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

function CustomVariablesList({ setShowCustom }) {
	const doBack = useCallback(() => setShowCustom(false), [setShowCustom])

	const context = useContext(StaticContext)
	const customVariableContext = useContext(CustomVariableDefinitionsContext)
	const variableValuesContext = useContext(VariableValuesContext)

	const variableValues = variableValuesContext || {}

	const onCopied = useCallback(() => {
		context.notifier.current.show(`Copied`, 'Copied to clipboard', 5000)
	}, [context.notifier])

	const [newName, setNewName] = useState('')

	const doCreateNew = useCallback(() => {
		setNewName((newName) => {
			socketEmit(context.socket, 'custom_variables_create', [newName, ''])
				.then(([res]) => {
					// TODO
					console.log('done with', res)
				})
				.catch((e) => {
					console.error('Failed to create variable')
				})

			// clear value
			return ''
		})
	}, [context.socket])

	const setStartupValue = useCallback(
		(name, value) => {
			socketEmit(context.socket, 'custom_variables_update_default_value', [name, value])
				.then(([res]) => {
					// TODO
				})
				.catch((e) => {
					console.error('Failed to update variable')
				})
		},
		[context.socket]
	)
	const setCurrentValue = useCallback(
		(name, value) => {
			socketEmit(context.socket, 'custom_variables_update_current_value', [name, value])
				.then(([res]) => {
					// TODO
				})
				.catch((e) => {
					console.error('Failed to update variable')
				})
		},
		[context.socket]
	)

	const confirmRef = useRef(null)
	const doDelete = useCallback(
		(name) => {
			confirmRef.current.show(
				'Delete variable',
				`Are you sure you want to delete the custom variable "${name}"?`,
				'Delete',
				() => {
					socketEmit(context.socket, 'custom_variables_delete', [name]).catch((e) => {
						console.error('Failed to delete variable')
					})
				}
			)
		},
		[context.socket]
	)

	return (
		<div className="variables-panel">
			<h5>
				<CButton color="primary" size="sm" onClick={doBack}>
					Back
				</CButton>
				Custom Variables
			</h5>

			<GenericConfirmModal ref={confirmRef} />

			<table className="table table-responsive-sm variables-table">
				<thead>
					<tr>
						<th>Variable</th>
						<th>Current value</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(customVariableContext).map(([name, info]) => {
						const fullname = `internal:custom_${name}`
						return (
							<tr key={name}>
								<td>$({fullname})</td>
								{/* <td>{elms}</td> */}
								<td>
									<CForm>
										<CFormGroup>
											<CLabel htmlFor="current_value">Current value: </CLabel>
											<TextInputField
												definition={{}}
												value={variableValues[fullname] || ''}
												setValue={(val) => setCurrentValue(name, val)}
											/>
										</CFormGroup>
										<CFormGroup>
											<CLabel htmlFor="startup_value">Startup value: </CLabel>
											<TextInputField
												definition={{}}
												value={info.defaultValue}
												setValue={(val) => setStartupValue(name, val)}
											/>
										</CFormGroup>
									</CForm>
								</td>
								<td>
									<CopyToClipboard text={`$(${fullname})`} onCopy={onCopied}>
										<CButton size="sm">
											<FontAwesomeIcon icon={faCopy} />
										</CButton>
									</CopyToClipboard>
									<CButton color="danger" size="sm" onClick={() => doDelete(name)}>
										<FontAwesomeIcon icon={faTrash} />
									</CButton>
								</td>
							</tr>
						)
					})}
					{Object.keys(customVariableContext).length === 0 ? (
						<tr>
							<td colSpan={3}>No custom variables have been created</td>
						</tr>
					) : (
						''
					)}
				</tbody>
			</table>

			<hr />
			<div>
				<CForm inline>
					<CFormGroup>
						<CLabel htmlFor="new_name">Create custom variable: </CLabel>
						<CInput name="new_name" type="text" value={newName} onChange={(e) => setNewName(e.currentTarget.value)} />
						<CButton color="primary" onClick={doCreateNew}>
							Add
						</CButton>
					</CFormGroup>
				</CForm>
			</div>

			<br style={{ clear: 'both' }} />
		</div>
	)
}
