import React, { FormEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup, CForm, CFormInput, CInputGroup } from '@coreui/react'
import { socketEmitPromise, PreventDefaultHandler, useComputed } from '../util.js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faArrowLeft,
	faCompressArrowsAlt,
	faCopy,
	faExpandArrowsAlt,
	faSort,
	faSquareRootVariable,
	faTimes,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { TextInputField } from '../Components/TextInputField.js'
import { CheckboxInputField } from '../Components/CheckboxInputField.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { isCustomVariableValid } from '@companion-app/shared/CustomVariable.js'
import { useDrag, useDrop } from 'react-dnd'
import { PanelCollapseHelperLite, usePanelCollapseHelperLite } from '../Helpers/CollapseHelper.js'
import type { CompanionVariableValues } from '@companion-module/base'
import { CustomVariableDefinition } from '@companion-app/shared/Model/CustomVariableModel.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'

const DRAG_ID = 'custom-variables'

interface CustomVariableDefinitionExt extends CustomVariableDefinition {
	name: string
}

interface CustomVariablesListProps {
	setShowCustom: (show: boolean) => void
}

export const CustomVariablesList = observer(function CustomVariablesList({ setShowCustom }: CustomVariablesListProps) {
	const doBack = useCallback(() => setShowCustom(false), [setShowCustom])

	const { socket, notifier, variablesStore: customVariables } = useContext(RootAppStoreContext)

	const [variableValues, setVariableValues] = useState<CompanionVariableValues>({})

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
		notifier.current?.show(`Copied`, 'Copied to clipboard', 5000)
	}, [notifier])

	const [newName, setNewName] = useState('')

	const doCreateNew = useCallback(
		(e: FormEvent) => {
			e?.preventDefault()

			if (isCustomVariableValid(newName)) {
				socketEmitPromise(socket, 'custom-variables:create', [newName, ''])
					.then((res) => {
						console.log('done with', res)
						if (res) {
							notifier.current?.show(`Failed to create variable`, res, 5000)
						}

						// clear value
						setNewName('')
					})
					.catch((e) => {
						console.error('Failed to create variable')
						notifier.current?.show(`Failed to create variable`, e?.toString?.() ?? e ?? 'Failed', 5000)
					})
			}
		},
		[socket, notifier, newName]
	)

	const setStartupValue = useCallback(
		(name: string, value: any) => {
			socketEmitPromise(socket, 'custom-variables:set-default', [name, value]).catch(() => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)
	const setCurrentValue = useCallback(
		(name: string, value: any) => {
			socketEmitPromise(socket, 'custom-variables:set-current', [name, value]).catch(() => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)

	const setPersistenceValue = useCallback(
		(name: string, value: boolean) => {
			socketEmitPromise(socket, 'custom-variables:set-persistence', [name, value]).catch(() => {
				console.error('Failed to update variable')
			})
		},
		[socket]
	)

	const confirmRef = useRef<GenericConfirmModalRef>(null)
	const doDelete = useCallback(
		(name: string) => {
			confirmRef.current?.show(
				'Delete variable',
				`Are you sure you want to delete the custom variable "${name}"?`,
				'Delete',
				() => {
					socketEmitPromise(socket, 'custom-variables:delete', [name]).catch(() => {
						console.error('Failed to delete variable')
					})
				}
			)
		},
		[socket]
	)

	const moveRow = useCallback(
		(itemName: string, targetName: string) => {
			const rawNames = Array.from(customVariables.customVariables)
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
		},
		[socket, customVariables]
	)

	const allVariableNames = useComputed(() => Array.from(customVariables.customVariables.keys()), [customVariables])
	const panelCollapseHelper = usePanelCollapseHelperLite(`custom_variables`, allVariableNames)

	const [filter, setFilter] = useState('')
	const clearFilter = useCallback(() => setFilter(''), [])
	const updateFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.currentTarget.value), [])

	const variableDefinitions = useComputed(() => {
		const defs: CustomVariableDefinitionExt[] = []
		for (const [name, variable] of customVariables.customVariables.entries()) {
			defs.push({
				...variable,
				name,
			})
		}

		defs.sort((a, b) => a.sortOrder - b.sortOrder)

		return defs
	}, [customVariables])
	const hasNoVariables = variableDefinitions.length === 0

	const [candidates, errorMsg] = useMemo(() => {
		let candidates: CustomVariableDefinitionExt[] = []
		try {
			if (!filter) {
				candidates = variableDefinitions
			} else {
				const regexp = new RegExp(filter, 'i')

				candidates = variableDefinitions.filter((variable) => variable.name.match(regexp))
			}
			return [candidates, null]
		} catch (e) {
			console.error('Failed to compile candidates list:', e)

			return [null, e?.toString() || 'Unknown error']
		}
	}, [variableDefinitions, filter])

	return (
		<div className="variables-panel">
			<div>
				<h4 style={{ marginBottom: '0.8rem' }}>Variables</h4>
				<CButtonGroup size="sm">
					<CButton color="primary" onClick={doBack}>
						<FontAwesomeIcon icon={faArrowLeft} />
						&nbsp; Go back
					</CButton>
					<CButton color="secondary" disabled>
						Custom Variables
					</CButton>
					{!hasNoVariables && panelCollapseHelper.canExpandAll() && (
						<CButton color="secondary" onClick={panelCollapseHelper.setAllExpanded} title="Expand all">
							<FontAwesomeIcon icon={faExpandArrowsAlt} /> Expand
						</CButton>
					)}
					{!hasNoVariables && panelCollapseHelper.canCollapseAll() && (
						<CButton color="secondary" onClick={panelCollapseHelper.setAllCollapsed} title="Collapse all">
							<FontAwesomeIcon icon={faCompressArrowsAlt} /> Collapse
						</CButton>
					)}
				</CButtonGroup>
			</div>

			<GenericConfirmModal ref={confirmRef} />

			<CInputGroup className="variables-table-filter">
				<CFormInput
					type="text"
					placeholder="Filter ..."
					onChange={updateFilter}
					value={filter}
					style={{ fontSize: '1.2em' }}
				/>
				<CButton color="danger" onClick={clearFilter}>
					<FontAwesomeIcon icon={faTimes} />
				</CButton>
			</CInputGroup>

			<table className="table variables-table">
				<tbody>
					{!hasNoVariables && errorMsg && (
						<tr>
							<td>
								<CAlert color="warning" role="alert">
									Failed to build list of variables:
									<br />
									{errorMsg}
								</CAlert>
							</td>
						</tr>
					)}

					{candidates &&
						candidates.map((info, index) => {
							const shortname = `custom_${info.name}`

							return (
								<CustomVariableRow
									key={info.name}
									index={index}
									name={info.name}
									shortname={shortname}
									value={variableValues[shortname]}
									info={info}
									onCopied={onCopied}
									doDelete={doDelete}
									setStartupValue={setStartupValue}
									setCurrentValue={setCurrentValue}
									setPersistenceValue={setPersistenceValue}
									moveRow={moveRow}
									panelCollapseHelper={panelCollapseHelper}
								/>
							)
						})}
					{hasNoVariables && (
						<tr>
							<td colSpan={3}>
								<NonIdealState icon={faSquareRootVariable} text="No custom variables defined" />
							</td>
						</tr>
					)}
				</tbody>
			</table>

			<h5>Create custom variable</h5>
			<div>
				<CForm onSubmit={doCreateNew}>
					<CInputGroup>
						<CFormInput
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.currentTarget.value)}
							placeholder="variableName"
						/>
						<CButton color="primary" onClick={doCreateNew} disabled={!isCustomVariableValid(newName)}>
							Add
						</CButton>
					</CInputGroup>
				</CForm>
			</div>

			<br style={{ clear: 'both' }} />
		</div>
	)
})

interface CustomVariableDragItem {
	index: number
	name: string
}
interface CustomVariableDragStatus {
	isDragging: boolean
}

interface CustomVariableRowProps {
	index: number
	name: string
	shortname: string
	value: any
	info: CustomVariableDefinitionExt
	onCopied: () => void
	doDelete: (name: string) => void
	setStartupValue: (name: string, value: any) => void
	setCurrentValue: (name: string, value: any) => void
	setPersistenceValue: (name: string, persisted: boolean) => void
	moveRow: (itemName: string, targetName: string) => void
	panelCollapseHelper: PanelCollapseHelperLite
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
	panelCollapseHelper,
}: CustomVariableRowProps) {
	const fullname = `internal:${shortname}`

	const doCollapse = useCallback(() => panelCollapseHelper.setPanelCollapsed(name, true), [panelCollapseHelper, name])
	const doExpand = useCallback(() => panelCollapseHelper.setPanelCollapsed(name, false), [panelCollapseHelper, name])
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(name)

	const ref = useRef(null)
	const [, drop] = useDrop<CustomVariableDragItem>({
		accept: DRAG_ID,
		hover(item, _monitor) {
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
	const [{ isDragging }, drag, preview] = useDrag<CustomVariableDragItem, unknown, CustomVariableDragStatus>({
		type: DRAG_ID,
		canDrag: true,
		item: {
			name: name,
			index: index,
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
						<CopyToClipboard text={`$(${fullname})`} onCopy={onCopied}>
							<span className="variable-style">$({fullname})</span>
						</CopyToClipboard>
						<CButtonGroup className="right" size={isCollapsed ? 'sm' : undefined}>
							{isCollapsed ? (
								<CButton onClick={doExpand} title="Expand variable view">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							) : (
								<CButton onClick={doCollapse} title="Collapse variable view">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
							<CopyToClipboard text={`$(${fullname})`} onCopy={onCopied}>
								<CButton>
									<FontAwesomeIcon icon={faCopy} />
								</CButton>
							</CopyToClipboard>
							<CButton onClick={() => doDelete(name)}>
								<FontAwesomeIcon icon={faTrash} />
							</CButton>
						</CButtonGroup>
					</div>

					{!isCollapsed && (
						<>
							<div className="cell-options">
								<CForm onSubmit={PreventDefaultHandler}>
									<CheckboxInputField
										label="Persist value"
										value={info.persistCurrentValue}
										setValue={(val) => setPersistenceValue(name, val)}
										helpText="If enabled, the current value will be saved and restored when Companion restarts."
									/>
								</CForm>
							</div>

							<div className="cell-values">
								<CForm onSubmit={PreventDefaultHandler}>
									<TextInputField
										label="Current value: "
										value={value || ''}
										setValue={(val) => setCurrentValue(name, val)}
									/>

									<TextInputField
										label="Startup value: "
										disabled={!!info.persistCurrentValue}
										value={info.defaultValue + ''}
										setValue={(val) => setStartupValue(name, val)}
									/>
								</CForm>
							</div>
						</>
					)}
				</div>
			</td>
		</tr>
	)
}
