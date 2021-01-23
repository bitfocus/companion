import { CButton, CForm, CInputGroup } from "@coreui/react"
import { faSort, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { NumberInputField } from "../Components"
import { CompanionContext, socketEmit } from "../util"
import update from 'immutability-helper';
import Select from "react-select"
import { ActionTableRowOption, ErrorFallback } from './Table'

export const ActionsPanel = forwardRef(function ({ page, bank, addCommand, getCommand, updateOption, setDelay, deleteCommand }, ref) {
	const context = useContext(CompanionContext)
	const [actions, setActions] = useState([])

	// Define a reusable loadData function
	const loadData = useCallback((page, bank) => {
		socketEmit(context.socket, getCommand, [page, bank]).then(([page, bank, actions]) => {
			setActions(actions || [])
		}).catch(e => {
			console.error('Failed to load bank actions', e)
		})
	}, [context.socket, getCommand])

	// Ensure the correct data is loaded
	useEffect(() => {
		loadData(page, bank)
	}, [loadData, page, bank])

	// Expose reload to the parent
	useImperativeHandle(ref, () => ({
		reload() {
			loadData(page, bank)
		}
	}), [loadData, page, bank])

	const setValue = useCallback((actionId, key, val) => {
		// The server doesn't repond to our change, so we assume it was ok
		setActions(oldActions => {
			const actionIndex = oldActions.findIndex(a => a.id === actionId)

			const oldValue = (oldActions[actionIndex].options || {})[key]
			if (oldValue !== val) {
				context.socket.emit(updateOption, page, bank, actionId, key, val);

				return update(oldActions, {
					[actionIndex]: {
						options: {
							[key]: { $set: val }
						}
					}
				})
			} else {
				return oldActions
			}
		})
	}, [context.socket, page, bank, updateOption])

	const doDelay = useCallback((actionId, delay) => {
		// The server doesn't repond to our change, so we assume it was ok
		setActions(oldActions => {
			const actionIndex = oldActions.findIndex(a => a.id === actionId)

			const oldValue = oldActions[actionIndex].options?.delay
			if (oldValue !== delay) {
				context.socket.emit(setDelay, page, bank, actionId, delay);

				return update(oldActions, {
					[actionIndex]: {
						delay: { $set: delay }
					}
				})
			} else {
				return oldActions
			}
		})
	}, [context.socket, page, bank, setDelay])

	const doDelete = useCallback((actionId) => {
		if (window.confirm('Delete action?')) {
			socketEmit(context.socket, deleteCommand, [page, bank, actionId]).then(([page, bank, actions]) => {
				setActions(actions || [])
			}).catch(e => {
				console.error('Failed to load bank actions', e)
			})
		}
	}, [context.socket, page, bank, deleteCommand])

	const addAction = useCallback((actionType) => {
		socketEmit(context.socket, addCommand, [page, bank, actionType]).then(([page, bank, actions]) => {
			setActions(actions || [])
		}).catch(e => {
			console.error('Failed to add bank action', e)
		})
	}, [context.socket, addCommand, bank, page])

	return (
		<>
			<table className='table action-table'>
				<thead>
					<tr>
						<th></th>
						<th colspan="2">Action</th>
						<th>Delay (ms)</th>
						<th>Options</th>
					</tr>
				</thead>
				<tbody>
					{actions.map((a, i) => <ActionTableRow key={a?.id ?? i} action={a} setValue={setValue} doDelete={doDelete} doDelay={doDelay} />)}
				</tbody>
			</table>

			<AddActionDropdown
				onSelect={addAction}
			/>
		</>
	)
})

function ActionTableRow({ action, setValue, doDelete, doDelay }) {
	const context = useContext(CompanionContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])
	const innerDelay = useCallback((delay) => doDelay(action.id, delay), [doDelay])

	if (!action) {
		// Invalid action, so skip
		return ''
	}

	const instance = context.instances[action.instance]
	// const module = instance ? context.modules[instance.instance_type] : undefined
	const instanceLabel = instance?.label ?? action.instance

	const actionSpec = context.actions[action.label]
	const options = actionSpec?.options ?? []

	let name = ''
	if (actionSpec) {
		name = `${instanceLabel}: ${actionSpec.label}`;
	} else {
		const actionId = action.label.split(/:/)[1]
		name = `${instanceLabel}: ${actionId} (undefined)`;
	}

	return (
		<tr>
			<td class='actionlist-td-reorder'>
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td class='actionlist-td-delete'>
				<CButton color="danger" size="sm" onClick={innerDelete}>
					<FontAwesomeIcon icon={faTrash} />
				</CButton>
			</td>
			<td className='actionlist-td-label'>{name}</td>
			<td class='actionlist-td-delay'>
				<CInputGroup>
					<NumberInputField
						definition={{ default: 0 }}
						value={action.delay}
						setValue={innerDelay}
					/>
					{/* <CInputGroupAppend>
						<CInputGroupText>ms</CInputGroupText>
					</CInputGroupAppend> */}
				</CInputGroup>
			</td>
			<td class='actionlist-td-options'>
				<CForm className="actions-options">
					{
						options.map(opt => <ErrorBoundary FallbackComponent={ErrorFallback}>
							<ActionTableRowOption
								option={opt}
								actionId={action.id}
								value={(action.options || {})[opt.id]}
								setValue={setValue}
							/>
						</ErrorBoundary>)
					}
				</CForm>
			</td>
		</tr>
	)
}


function AddActionDropdown({ onSelect }) {
	const context = useContext(CompanionContext)

	const options = useMemo(() => {
		return Object.entries(context.actions || {}).map(([id, act]) => {
			const instanceId = id.split(/:/)[0]
			const instanceLabel = context.instances[instanceId]?.label ?? instanceId
			return ({ value: id, label: `${instanceLabel}: ${act.label}` })
		})
	}, [context.actions, context.instances])

	const innerChange = useCallback((e) => {
		if (e.value) {
			onSelect(e.value)
		}
	}, [onSelect])

	return <Select
		isClearable={false}
		isSearchable={true}
		isMulti={false}
		options={options}
		value={null}
		onChange={innerChange}
	/>
}