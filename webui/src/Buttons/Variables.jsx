import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CForm, CFormGroup, CInput, CLabel } from '@coreui/react'
import {
	InstancesContext,
	VariableDefinitionsContext,
	CustomVariableDefinitionsContext,
	socketEmitPromise,
	SocketContext,
	NotifierContext,
	ModulesContext,
} from '../util'
import { VariablesTable } from '../Components/VariablesTable'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField'
import { CheckboxInputField } from '../Components/CheckboxInputField'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { isCustomVariableValid } from '@companion/shared/CustomVariable'

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

function CustomVariablesList({ setShowCustom }) {
	const doBack = useCallback(() => setShowCustom(false), [setShowCustom])

	const socket = useContext(SocketContext)
	const notifier = useContext(NotifierContext)
	const customVariableContext = useContext(CustomVariableDefinitionsContext)

	const [variableValues, setVariableValues] = useState({})

	useEffect(() => {
		const doPoll = () => {
			socketEmitPromise(socket, 'variables:instance-values', ['internal'])
				.then((values) => {
					setVariableValues(values || {})
				})
				.catch((e) => {
					setVariableValues({})
					console.log('Failed to fetch variable values: ', e)
				})
		}

		doPoll()
		const interval = setInterval(doPoll, 1000)

		return () => {
			setVariableValues({})
			clearInterval(interval)
		}
	}, [socket])

	const onCopied = useCallback(() => {
		notifier.current.show(`Copied`, 'Copied to clipboard', 5000)
	}, [notifier])

	const [newName, setNewName] = useState('')

	const doCreateNew = useCallback(
		(e) => {
			e?.preventDefault()

			if (isCustomVariableValid(newName)) {
				socketEmitPromise(socket, 'custom-variables::create', [newName, ''])
					.then((res) => {
						console.log('done with', res)
						if (res) {
							notifier.current.show(`Failed to create variable`, res, 5000)
						}

						// clear value
						setNewName('')
					})
					.catch((e) => {
						console.error('Failed to create variable')
						notifier.current.show(`Failed to create variable`, e?.toString?.() ?? e ?? 'Failed', 5000)
					})
			}
		},
		[socket, notifier, newName]
	)

	const setStartupValue = useCallback(
		(name, value) => {
			socketEmitPromise(socket, 'custom-variables::set-default', [name, value]).catch((e) => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)
	const setCurrentValue = useCallback(
		(name, value) => {
			socketEmitPromise(socket, 'custom-variables::set-current', [name, value]).catch((e) => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)

	const setPersistenceValue = useCallback(
		(name, value) => {
			socketEmitPromise(socket, 'custom-variables::set-persistence', [name, value]).catch((e) => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)

	const confirmRef = useRef(null)
	const doDelete = useCallback(
		(name) => {
			confirmRef.current.show(
				'Delete variable',
				`Are you sure you want to delete the custom variable "${name}"?`,
				'Delete',
				() => {
					socketEmitPromise(socket, 'custom-variables::delete', [name]).catch((e) => {
						console.error('Failed to delete variable')
					})
				}
			)
		},
		[socket]
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
						const shortname = `custom_${name}`
						const fullname = `internal:${shortname}`
						return (
							<tr key={name}>
								<td>$({fullname})</td>
								{/* <td>{elms}</td> */}
								<td>
									<CForm>
										<CFormGroup>
											<CLabel htmlFor="current_value">Current value: </CLabel>
											<TextInputField
												value={variableValues[shortname] || ''}
												setValue={(val) => setCurrentValue(name, val)}
											/>
										</CFormGroup>
										<CFormGroup>
											<CLabel htmlFor="persist_value">Persist value: </CLabel>
											<CheckboxInputField
												value={info.persistCurrentValue}
												setValue={(val) => setPersistenceValue(name, val)}
											/>
										</CFormGroup>
										<CFormGroup>
											<CLabel htmlFor="startup_value">Startup value: </CLabel>
											<TextInputField
												disabled={!!info.persistCurrentValue}
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
					{Object.keys(customVariableContext).length === 0 && (
						<tr>
							<td colSpan={3}>No custom variables have been created</td>
						</tr>
					)}
				</tbody>
			</table>

			<hr />
			<div>
				<CForm inline onSubmit={doCreateNew}>
					<CFormGroup>
						<CLabel htmlFor="new_name">Create custom variable: </CLabel>
						<CInput name="new_name" type="text" value={newName} onChange={(e) => setNewName(e.currentTarget.value)} />
						<CButton color="primary" onClick={doCreateNew} disabled={!isCustomVariableValid(newName)}>
							Add
						</CButton>
					</CFormGroup>
				</CForm>
			</div>

			<br style={{ clear: 'both' }} />
		</div>
	)
}
