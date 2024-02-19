import { CModal, CModalHeader, CInput, CModalBody, CModalFooter, CButton, CButtonGroup } from '@coreui/react'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useState } from 'react'
import { SocketContext, socketEmitPromise } from '../util.js'

interface AddPagesModalProps {
	// addAction: (actionType: string) => void
}
export interface AddPagesModalRef {
	show(beforePageNumber: number): void
}

const DEFAULT_PAGE_NAME = 'New Page'

interface ModalState {
	show: boolean

	readonly beforePage: number
	names: string[]
}

const defaultState: ModalState = {
	show: false,

	beforePage: 1,
	names: [DEFAULT_PAGE_NAME],
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
		socketEmitPromise(socket, 'pages:insert-pages', [state.beforePage, state.names]).catch((e) => {
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
				newNames.splice(pageNumber, 0, DEFAULT_PAGE_NAME)
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
		<CModal show={state.show} onClose={doClose} onClosed={onClosed} size="lg" scrollable={true}>
			<CModalHeader closeButton>
				<h5>Add Pages</h5>
			</CModalHeader>
			<CModalBody className="shadow-inset">
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
							<td style={{ textAlign: 'left' }}>
								<CButtonGroup>
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
					Add
				</CButton>
			</CModalFooter>
		</CModal>
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
				<CInput type="text" value={name} onChange={changeName} data-page={index} />
			</td>
			<td style={{ width: 0 }}>
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
					<CButton color="warning" size="sm" onClick={doInsertPage} title="Add page before" data-page={index}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>

					<CButton
						color="danger"
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
