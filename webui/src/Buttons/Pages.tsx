import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { PagesContext, SocketContext, socketEmitPromise } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { PageModel } from '@companion/shared/Model/PageModel'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal'
import { usePageCount } from '../Hooks/usePagesInfoSubscription'

interface PagesListProps {
	setPageNumber: (page: number) => void
}

export function PagesList({ setPageNumber }: PagesListProps): JSX.Element {
	const socket = useContext(SocketContext)
	const pages = useContext(PagesContext)

	const pageCount = usePageCount()

	const deleteRef = useRef<GenericConfirmModalRef>(null)

	const goToPage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
			if (!isNaN(pageNumber)) {
				setPageNumber(pageNumber)
			}
			console.log(pageNumber)
		},
		[setPageNumber]
	)

	const doInsertPage = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		if (!isNaN(pageNumber)) {
			socketEmitPromise(socket, 'loadsave:insert-page', [pageNumber]).catch((e) => {
				console.error('Page insert failed', e)
			})
		}
	}, [])

	const doDeletePage = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		const pageName = e.currentTarget.getAttribute('data-name') ?? ''

		if (isNaN(pageNumber)) return

		deleteRef.current?.show(
			'Delete page?',
			[
				`Are you sure you want to delete page ${pageNumber} "${pageName ?? 'PAGE'}"?`,
				'This will delete all controls on the page, and will adjust the page numbers of all following pages',
			],
			'Delete',
			() => {
				socketEmitPromise(socket, 'loadsave:delete-page', [pageNumber]).catch((e) => {
					console.error('Page delete failed', e)
				})
			}
		)
	}, [])

	return (
		<CRow>
			<CCol xs={12}>
				<GenericConfirmModal ref={deleteRef} />

				<table className="table table-responsive-sm">
					<thead>
						<tr>
							<th>NO</th>
							<th>Name</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{Object.entries(pages).map(([id, info]) => (
							<PageListRow
								key={id}
								id={Number(id)}
								info={info}
								pageCount={pageCount}
								goToPage={goToPage}
								doInsertPage={doInsertPage}
								doDeletePage={doDeletePage}
							/>
						))}
						<tr>
							<td></td>
							<td></td>
							<td>
								<CButtonGroup>
									<CButton
										color="warning"
										size="sm"
										onClick={doInsertPage}
										title="Insert page at end"
										data-page={pageCount + 1}
									>
										<FontAwesomeIcon icon={faPlus} />
									</CButton>
								</CButtonGroup>
							</td>
						</tr>
					</tbody>
				</table>
			</CCol>
		</CRow>
	)
}

interface PageListRowProps {
	id: number
	info: PageModel | undefined
	pageCount: number
	goToPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doInsertPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doDeletePage: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function PageListRow({ id, info, pageCount, goToPage, doInsertPage, doDeletePage }: PageListRowProps) {
	return (
		<tr>
			<td>
				<CButton color="primary" variant="ghost" onClick={goToPage} data-page={id}>
					{id}
				</CButton>
			</td>
			<td>{info?.name ?? ''}</td>
			<td>
				<CButtonGroup>
					<CButton color="warning" size="sm" onClick={doInsertPage} title="Insert page before" data-page={id}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>
					<CButton
						color="danger"
						size="sm"
						onClick={doDeletePage}
						title="Delete"
						data-page={id}
						data-name={info?.name}
						disabled={pageCount <= 1}
					>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
}
