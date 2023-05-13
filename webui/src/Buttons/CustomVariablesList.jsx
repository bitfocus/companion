import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CButton, CForm, CFormGroup, CInput, CLabel } from '@coreui/react'
import {
	CustomVariableDefinitionsContext,
	socketEmitPromise,
	SocketContext,
	NotifierContext,
	PreventDefaultHandler,
} from '../util'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField'
import { CheckboxInputField } from '../Components/CheckboxInputField'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { isCustomVariableValid } from '@companion/shared/CustomVariable'

export function CustomVariablesList({ setShowCustom }) {
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
				<CButton color="primary" size="sm" onClick={doBack} className="gap-b">
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

						return (
							<CustomVariableRow
								key={name}
								name={name}
								shortname={shortname}
								value={variableValues[shortname]}
								info={info}
								onCopied={onCopied}
								doDelete={doDelete}
								setStartupValue={setStartupValue}
								setCurrentValue={setCurrentValue}
								setPersistenceValue={setPersistenceValue}
							/>
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

function CustomVariableRow({
	name,
	shortname,
	value,
	info,
	onCopied,
	doDelete,
	setStartupValue,
	setCurrentValue,
	setPersistenceValue,
}) {
	const fullname = `internal:${shortname}`

	return (
		<tr>
			<td>$({fullname})</td>
			{/* <td>{elms}</td> */}
			<td>
				<CForm onSubmit={PreventDefaultHandler}>
					<CFormGroup>
						<CLabel htmlFor="current_value">Current value: </CLabel>
						<TextInputField value={value || ''} setValue={(val) => setCurrentValue(name, val)} />
					</CFormGroup>
					<CFormGroup>
						<CLabel htmlFor="persist_value">Persist value: </CLabel>
						<CheckboxInputField value={info.persistCurrentValue} setValue={(val) => setPersistenceValue(name, val)} />
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
}
