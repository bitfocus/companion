import { CAlert, CButton, CForm, CFormGroup, CInput, CInputGroup, CInputGroupText, CLabel } from "@coreui/react"
import { faSort, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { CheckboxInputField, ColorInputField, DropdownInputField, NumberInputField, TextInputField } from "../Components"
import { CompanionContext, socketEmit } from "../util"
import update from 'immutability-helper';

export const ActionsPanel = forwardRef(function ({ page, bank, getCommand, setCommand, deleteCommand }, ref) {
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
				context.socket.emit(setCommand, page, bank, actionId, key, val);
				
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
		
	}, [context.socket, page, bank, setCommand])

	const doDelete = useCallback((actionId) => {
		if (window.confirm('Delete action?')) {
			socketEmit(context.socket, deleteCommand, [page, bank, actionId]).then(([page, bank, actions]) => {
				setActions(actions || [])
			}).catch(e => {
				console.error('Failed to load bank actions', e)
			})
		}
	}, [context.socket, page, bank, deleteCommand])

	return (
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
				{actions.map((a, i) => <ActionTableRow key={a?.id ?? i} action={a} setValue={setValue} doDelete={doDelete} />)}
			</tbody>
		</table>
	)
})

function ActionTableRow({ action, setValue, doDelete }) {
	const context = useContext(CompanionContext)

	const innerDelete = useCallback(() => doDelete(action.id), [action.id, doDelete])

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
					<CInput type="number" placeholder="ms" value={action.delay} />
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

function ErrorFallback ({error, resetErrorBoundary}) {
	return (
		<CAlert color="danger">
			<p>Something went wrong:</p>
			<pre>{error.message}</pre>
			<CButton color='primary' size="sm" onClick={resetErrorBoundary}>Try again</CButton>
		</CAlert>
	)
}

function ActionTableRowOption({ actionId, option, value, setValue }) {
	const setValue2 = useCallback((val) => setValue(actionId, option.id, val), [actionId, option.id, setValue])

	if (!option) {
		return <p>Unknown - TODO</p>
	}

	let control = ''
	switch (option.type) {
		case 'textinput': {
			control = <TextInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'dropdown': {
			control = <DropdownInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'multiselect': {
			control = <DropdownInputField value={value} definition={option} multiple={true} setValue={setValue2} />
			break
		}
		case 'checkbox': {
			control = <CheckboxInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'colorpicker': {
			control = <ColorInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		case 'number': {
			control = <NumberInputField value={value} definition={option} setValue={setValue2} />
			break
		}
		default:
			control = <CInputGroupText>Unknown type "{option.type}"</CInputGroupText>
			break
	}



	return (
		<CFormGroup>
			<CLabel>{option.label}</CLabel>
			{ control}
		</CFormGroup>
	)
}