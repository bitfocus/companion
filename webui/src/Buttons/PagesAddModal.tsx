import { CModalHeader, CFormInput, CModalBody, CModalFooter, CButton, CButtonGroup } from '@coreui/react'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { SocketContext } from '~/util.js'
import { CModalExt } from '~/Components/CModalExt.js'

interface AddPagesModalProps {
	// addAction: (actionType: string) => void
}
export interface AddPagesModalRef {
	show(beforePageNumber: number): void
}

interface ModalState {
	show: boolean

	readonly beforePage: number
	names: string[]
}

const defaultState: ModalState = {
	show: false,

	beforePage: 1,
	names: [''],
}

export const AddPagesModal = forwardRef<AddPagesModalRef, AddPagesModalProps>(function AddPagesModal({}, ref) {
	const socket = useContext(SocketContext)

	const [state, setState] = useState<ModalState>(defaultState)

	const doClose = useCallback(
		() =>
			setState((oldState) => {
				return {
					...oldState,
					show: false,
				}
			}),
		[]
	)
	const onClosed = useCallback(() => {
		setState(defaultState)
	}, [])

	useImperativeHandle(
		ref,
		() => ({
			show(beforePageNumber: number) {
				console.log('show', beforePageNumber)
				setState({
					...defaultState,
					show: true,
					beforePage: beforePageNumber,
				})
			},
		}),
		[]
	)

	const doSave = useCallback(() => {
		socket.emitPromise('pages:insert-pages', [state.beforePage, state.names]).catch((e) => {
			console.error('Page insert failed', e)
		})
		setState((oldPage) => {
			return {
				...oldPage,
				show: false,
			}
		})
	}, [socket, state])

	const changeName = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		if (!isNaN(pageNumber)) {
			const newName = e.currentTarget.value || ''
			setState((oldState) => {
				const newNames = [...oldState.names]
				newNames[pageNumber] = newName
				return { ...oldState, names: newNames }
			})
		}
	}, [])
	const doInsertPage = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		if (!isNaN(pageNumber)) {
			setState((oldState) => {
				const newNames = [...oldState.names]
				newNames.splice(pageNumber, 0, '')
				return { ...oldState, names: newNames }
			})
		}
	}, [])
	const doDeletePage = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		if (!isNaN(pageNumber)) {
			setState((oldState) => {
				const newNames = [...oldState.names]
				newNames.splice(pageNumber, 1)
				return { ...oldState, names: newNames }
			})
		}
	}, [])

	return (
		<CModalExt visible={state.show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
			<CModalHeader closeButton>
				<h5>Insert Pages</h5>
			</CModalHeader>
			<CModalBody>
				<table className="table table-responsive-sm">
					<thead>
						<tr>
							<th>Name</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{state.names.map((name, index) => (
							<AddPageRow
								key={index}
								index={Number(index)}
								name={name}
								canDelete={state.names.length > 1}
								changeName={changeName}
								doInsertPage={doInsertPage}
								doDeletePage={doDeletePage}
							/>
						))}

						<tr>
							<td></td>
							<td>
								<CButtonGroup style={{ width: '100%' }}>
									<CButton
										color="warning"
										size="sm"
										onClick={doInsertPage}
										title="Add at end"
										data-page={state.names.length + 1}
									>
										<FontAwesomeIcon icon={faPlus} />
									</CButton>
								</CButtonGroup>
							</td>
						</tr>
					</tbody>
				</table>
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={doSave}>
					Add {state.names.length && state.names.length > 1 ? `${state.names.length} Pages` : '1 Page'}
				</CButton>
			</CModalFooter>
		</CModalExt>
	)
})

interface AddPageRowProps {
	index: number
	name: string
	canDelete: boolean
	changeName: (e: React.ChangeEvent<HTMLInputElement>) => void
	doInsertPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doDeletePage: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function AddPageRow({ index, name, canDelete, changeName, doInsertPage, doDeletePage }: AddPageRowProps) {
	return (
		<tr>
			<td>
				<CFormInput type="text" value={name} onChange={changeName} data-page={index} placeholder="Unnamed page" />
			</td>
			<td style={{ width: 50, textAlign: 'right' }}>
				<CButtonGroup>
					{/* <CButton
						color="info"
						size="sm"
						onClick={configurePage}
						title="Edit page"
						data-page={id}
						data-page-info={JSON.stringify(info)}
					>
						<FontAwesomeIcon icon={faPencil} />
					</CButton> */}
					<CButton color="warning" size="sm" onClick={doInsertPage} title="Insert page above" data-page={index}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>

					<CButton
						color="primary"
						size="sm"
						onClick={doDeletePage}
						title="Delete"
						data-page={index}
						disabled={!canDelete}
					>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}
