import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CButton, CButtonGroup, CForm, CFormGroup, CInput, CLabel } from '@coreui/react'
import {
	CustomVariableDefinitionsContext,
	socketEmitPromise,
	SocketContext,
	NotifierContext,
	PreventDefaultHandler,
} from '../util'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCompressArrowsAlt, faCopy, faExpandArrowsAlt, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField'
import { CheckboxInputField } from '../Components/CheckboxInputField'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { isCustomVariableValid } from '@companion/shared/CustomVariable'
import { useDrag, useDrop } from 'react-dnd'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'

const DRAG_ID = 'custom-variables'

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
				socketEmitPromise(socket, 'custom-variables:create', [newName, ''])
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
			socketEmitPromise(socket, 'custom-variables:set-default', [name, value]).catch((e) => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)
	const setCurrentValue = useCallback(
		(name, value) => {
			socketEmitPromise(socket, 'custom-variables:set-current', [name, value]).catch((e) => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)

	const setPersistenceValue = useCallback(
		(name, value) => {
			socketEmitPromise(socket, 'custom-variables:set-persistence', [name, value]).catch((e) => {
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
					socketEmitPromise(socket, 'custom-variables:delete', [name]).catch((e) => {
						console.error('Failed to delete variable')
					})
				}
			)
		},
		[socket]
	)

	const customVariablesRef = useRef(null)
	useEffect(() => {
		customVariablesRef.current = customVariableContext
	}, [customVariableContext])

	const moveRow = useCallback(
		(itemName, targetName) => {
			if (customVariablesRef.current) {
				const rawNames = Object.entries(customVariablesRef.current)
					.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
					.map(([id]) => id)

				const itemIndex = rawNames.indexOf(itemName)
				const targetIndex = rawNames.indexOf(targetName)
				if (itemIndex === -1 || targetIndex === -1) return

				const newNames = rawNames.filter((id) => id !== itemName)
				newNames.splice(targetIndex, 0, itemName)

				socketEmitPromise(socket, 'custom-variables:set-order', [newNames]).catch((e) => {
					console.error('Reorder failed', e)
				})
			}
		},
		[socket]
	)

	const variableNames = useMemo(() => Object.keys(customVariableContext || {}), [customVariableContext])
	const { setPanelCollapsed, isPanelCollapsed, setAllCollapsed, setAllExpanded, canExpandAll, canCollapseAll } =
		usePanelCollapseHelper(`custom_variables`, variableNames)

	const hasNoVariables = variableNames.length === 0

	return (
		<div className="variables-panel">
			<h5>
				Custom Variables
				<CButtonGroup>
					{!hasNoVariables && canExpandAll && (
						<CButton color="white" size="sm" onClick={setAllExpanded} title="Expand all">
							<FontAwesomeIcon icon={faExpandArrowsAlt} />
						</CButton>
					)}
					{!hasNoVariables && canCollapseAll && (
						<CButton color="white" size="sm" onClick={setAllCollapsed} title="Collapse all">
							<FontAwesomeIcon icon={faCompressArrowsAlt} />
						</CButton>
					)}
					<CButton color="primary" size="sm" onClick={doBack} className="gap-b">
						Back
					</CButton>
				</CButtonGroup>
			</h5>

			<GenericConfirmModal ref={confirmRef} />

			<table className="table variables-table">
				<tbody>
					{Object.entries(customVariableContext)
						.sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
						.map(([name, info], index) => {
							const shortname = `custom_${name}`

							return (
								<CustomVariableRow
									key={name}
									index={index}
									name={name}
									shortname={shortname}
									value={variableValues[shortname]}
									info={info}
									onCopied={onCopied}
									doDelete={doDelete}
									setStartupValue={setStartupValue}
									setCurrentValue={setCurrentValue}
									setPersistenceValue={setPersistenceValue}
									moveRow={moveRow}
									setCollapsed={setPanelCollapsed}
									isCollapsed={isPanelCollapsed(name)}
								/>
							)
						})}
					{hasNoVariables && (
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
						<CLabel htmlFor="new_name">Create custom variable:&nbsp;</CLabel>
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
	index,
	name,
	shortname,
	value,
	info,
	onCopied,
	doDelete,
	setStartupValue,
	setCurrentValue,
	setPersistenceValue,
	moveRow,
	isCollapsed,
	setCollapsed,
}) {
	const fullname = `internal:${shortname}`

	const doCollapse = useCallback(() => setCollapsed(name, true), [setCollapsed, name])
	const doExpand = useCallback(() => setCollapsed(name, false), [setCollapsed, name])

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: DRAG_ID,
		hover(item, monitor) {
			if (!ref.current) {
				return
			}
			const dragIndex = item.index
			const hoverIndex = index

			// Don't replace items with themselves
			if (dragIndex === hoverIndex) {
				return
			}

			// Don't replace items with themselves
			if (item.name === name) {
				return
			}

			// Time to actually perform the action
			moveRow(item.name, name)
		},
	})
	const [{ isDragging }, drag, preview] = useDrag({
		type: DRAG_ID,
		canDrag: true,
		item: {
			name: name,
			// index: index,
			// ref: ref,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	return (
		<tr ref={ref} className={isDragging ? 'variable-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td style={{ paddingRight: 0 }}>
				<div className="editor-grid">
					<div className="cell-header">
						$({fullname})
						<CButtonGroup className="right">
							{isCollapsed ? (
								<CButton size="sm" onClick={doExpand} title="Expand variable view">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							) : (
								<CButton size="sm" onClick={doCollapse} title="Collapse variable view">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
							<CopyToClipboard text={`$(${fullname})`} onCopy={onCopied}>
								<CButton size="sm">
									<FontAwesomeIcon icon={faCopy} />
								</CButton>
							</CopyToClipboard>
							<CButton color="danger" size="sm" onClick={() => doDelete(name)}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						</CButtonGroup>
					</div>

					{!isCollapsed && (
						<>
							<div className="cell-options">
								<CForm onSubmit={PreventDefaultHandler}>
									<CFormGroup>
										<CLabel htmlFor="persist_value">Persist value: </CLabel>
										<CheckboxInputField
											value={info.persistCurrentValue}
											setValue={(val) => setPersistenceValue(name, val)}
										/>
									</CFormGroup>
								</CForm>
							</div>

							<div className="cell-values">
								<CForm onSubmit={PreventDefaultHandler}>
									<CFormGroup>
										<CLabel htmlFor="current_value">Current value: </CLabel>
										<TextInputField value={value || ''} setValue={(val) => setCurrentValue(name, val)} />
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
							</div>
						</>
					)}
				</div>
			</td>
		</tr>
	)
}
