import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { socketEmitPromise } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faPencil } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { EditPagePropertiesModal, EditPagePropertiesModalRef } from './EditPageProperties.js'
import { AddPagesModal, AddPagesModalRef } from './PagesAddModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { PagesStoreModel } from '../Stores/PagesStore.js'

interface PagesListProps {
	setPageNumber: (page: number) => void
}

export const PagesList = observer(function PagesList({ setPageNumber }: PagesListProps): JSX.Element {
	const { socket, pages } = useContext(RootAppStoreContext)

	const addRef = useRef<AddPagesModalRef>(null)
	const deleteRef = useRef<GenericConfirmModalRef>(null)
	const editRef = useRef<EditPagePropertiesModalRef>(null)

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

	const configurePage = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		const pageInfoRaw = e.currentTarget.getAttribute('data-page-info')
		const pageInfo = pageInfoRaw ? JSON.parse(pageInfoRaw) : null
		if (!isNaN(pageNumber) && pageInfo) {
			editRef.current?.show(pageNumber, pageInfo)
		}
	}, [])

	const doInsertPage = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
		const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
		if (!isNaN(pageNumber)) {
			addRef.current?.show?.(pageNumber)
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
				socketEmitPromise(socket, 'pages:delete-page', [pageNumber]).catch((e) => {
					console.error('Page delete failed', e)
				})
			}
		)
	}, [])

	return (
		<CRow>
			<CCol xs={12}>
				<GenericConfirmModal ref={deleteRef} />
				<AddPagesModal ref={addRef} />
				<EditPagePropertiesModal ref={editRef} />

				<table className="table table-responsive-sm">
					<thead>
						<tr>
							<th>NO</th>
							<th>Name</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{pages.data.map((info, id) => (
							<PageListRow
								key={id}
								id={id + 1}
								info={info}
								pageCount={pages.data.length}
								goToPage={goToPage}
								configurePage={configurePage}
								doInsertPage={doInsertPage}
								doDeletePage={doDeletePage}
							/>
						))}
						<tr>
							<td></td>
							<td></td>
							<td style={{ textAlign: 'center' }}>
								<CButtonGroup>
									<CButton
										color="warning"
										size="sm"
										onClick={doInsertPage}
										title="Insert page at end"
										data-page={pages.data.length + 1}
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
})

interface PageListRowProps {
	id: number
	info: PagesStoreModel
	pageCount: number
	goToPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	configurePage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doInsertPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doDeletePage: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const PageListRow = observer(function PageListRow({
	id,
	info,
	pageCount,
	goToPage,
	configurePage,
	doInsertPage,
	doDeletePage,
}: PageListRowProps) {
	return (
		<tr>
			<td style={{ width: 0 }}>
				<CButton color="primary" variant="ghost" onClick={goToPage} data-page={id}>
					{id}
				</CButton>
			</td>
			<td>{info.name ?? ''}</td>
			<td style={{ width: 0 }}>
				<CButtonGroup>
					<CButton
						color="info"
						size="sm"
						onClick={configurePage}
						title="Edit page"
						data-page={id}
						data-page-info={JSON.stringify(info)}
					>
						<FontAwesomeIcon icon={faPencil} />
					</CButton>
					<CButton color="warning" size="sm" onClick={doInsertPage} title="Insert page before" data-page={id}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>

					<CButton
						color="danger"
						size="sm"
						onClick={doDeletePage}
						title="Delete"
						data-page={id}
						data-name={info.name}
						disabled={pageCount <= 1}
					>
						<FontAwesomeIcon icon={faTrash} />
					</CButton>
				</CButtonGroup>
			</td>
		</tr>
	)
})
