import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { socketEmitPromise } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faPencil, faSort } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { EditPagePropertiesModal, EditPagePropertiesModalRef } from './EditPageProperties.js'
import { AddPagesModal, AddPagesModalRef } from './PagesAddModal.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { PagesStoreModel } from '../Stores/PagesStore.js'
import { useDrag, useDrop } from 'react-dnd'

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

				<table className="table table-responsive-sm pages-list-table">
					<thead>
						<tr>
							<th></th>
							<th>NO</th>
							<th>Name</th>
							<th>&nbsp;</th>
						</tr>
					</thead>
					<tbody>
						{pages.data.map((info, id) => (
							<PageListRow
								key={id}
								pageNumber={id + 1}
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
							<td></td>
							<td style={{ textAlign: 'center' }}>
								<CButtonGroup>
									<CButton
										color="white"
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

const PAGE_LIST_DRAG_ID = 'PAGE_LIST_DRAG'
interface PageListDragItem {
	pageNumber: number
	pageId: string
}
interface PageListDragStatus {
	isDragging: boolean
}

interface PageListRowProps {
	pageNumber: number
	info: PagesStoreModel
	pageCount: number
	goToPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	configurePage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doInsertPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doDeletePage: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const PageListRow = observer(function PageListRow({
	pageNumber,
	info,
	pageCount,
	goToPage,
	configurePage,
	doInsertPage,
	doDeletePage,
}: PageListRowProps) {
	const { socket } = useContext(RootAppStoreContext)

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<PageListDragItem>({
		accept: PAGE_LIST_DRAG_ID,
		hover(item, _monitor) {
			if (!ref.current) {
				return
			}
			const dragPageNumber = item.pageNumber
			const hoverPageNumber = pageNumber
			// Don't replace items with themselves
			if (dragPageNumber === hoverPageNumber && item.pageId === info.id) {
				return
			}

			// Time to actually perform the action
			// serviceFactory.moveCard(item.stepId, item.setId, item.index, index)
			console.log('do move', item, hoverPageNumber)
			socketEmitPromise(socket, 'pages:move-page', [item.pageId, hoverPageNumber]).catch((e) => {
				console.error('Page move failed', e)
			})

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.pageNumber = hoverPageNumber
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<PageListDragItem, unknown, PageListDragStatus>({
		type: PAGE_LIST_DRAG_ID,
		canDrag: true,
		item: {
			pageNumber,
			pageId: info.id,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	return (
		<tr ref={ref} className={isDragging ? 'actionlist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td style={{ width: 0 }}>
				<CButton color="primary" variant="ghost" onClick={goToPage} data-page={pageNumber}>
					{pageNumber}
				</CButton>
			</td>
			<td>{info.name ?? ''}</td>
			<td style={{ width: 0 }}>
				<CButtonGroup>
					<CButton
						color="white"
						size="sm"
						onClick={configurePage}
						title="Edit page"
						data-page={pageNumber}
						data-page-info={JSON.stringify(info)}
					>
						<FontAwesomeIcon icon={faPencil} />
					</CButton>
					<CButton color="white" size="sm" onClick={doInsertPage} title="Insert page before" data-page={pageNumber}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>

					<CButton
						color="white"
						size="sm"
						onClick={doDeletePage}
						title="Delete"
						data-page={pageNumber}
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
