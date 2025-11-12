import React, { useCallback, useContext, useRef } from 'react'
import { CButton, CButtonGroup, CCol, CRow } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faSort, faShareFromSquare } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { EditPagePropertiesModal, type EditPagePropertiesModalRef } from './EditPageProperties.js'
import { AddPagesModal, type AddPagesModalRef } from './PagesAddModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { useDrag, useDrop } from 'react-dnd'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

interface PagesListProps {
	setPageNumber: (page: number) => void
}

export const PagesList = observer(function PagesList({ setPageNumber }: PagesListProps): JSX.Element {
	const { pages } = useContext(RootAppStoreContext)

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

	const removeMutation = useMutationExt(trpc.pages.remove.mutationOptions())
	const doDeletePage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
			const pageName = e.currentTarget.getAttribute('data-name') ?? ''

			if (isNaN(pageNumber)) return

			deleteRef.current?.show(
				'Delete page?',
				[
					`Are you sure you want to delete Page ${pageNumber}${pageName && pageName !== 'PAGE' ? ', "' + pageName + '"' : ''}?`,
					'This will delete all controls on the page, and will adjust the page numbers of all following pages',
				],
				'Delete',
				() => {
					removeMutation.mutateAsync({ pageNumber }).catch((e) => {
						console.error('Page delete failed', e)
					})
				}
			)
		},
		[removeMutation]
	)

	return (
		<div>
			<h5>Pages</h5>
			<p>
				You can insert, delete, and re-arrange the order of pages here. You can also give each page a unique name to
				help you identify its purpose.
			</p>
			<CRow>
				<CCol xs={12}>
					<GenericConfirmModal ref={deleteRef} />
					<AddPagesModal ref={addRef} />
					<EditPagePropertiesModal ref={editRef} includeName={false} />

					<table className="table table-responsive-sm pages-list-table">
						<thead>
							<tr>
								<th></th>
								<th style={{ textAlign: 'center' }}>Number</th>
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
								<td style={{ textAlign: 'right' }}>
									<CButtonGroup style={{ width: '100%' }}>
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
		</div>
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
	// configurePage,
	doInsertPage,
	doDeletePage,
}: PageListRowProps) {
	const setNameMutation = useMutationExt(trpc.pages.setName.mutationOptions())
	const moveMutation = useMutationExt(trpc.pages.move.mutationOptions())

	const changeName = useCallback(
		(newName: string) => {
			setNameMutation
				.mutateAsync({
					pageNumber,
					name: newName ?? '',
				})
				.catch((e) => {
					console.error('Failed to set name', e)
				})
		},
		[setNameMutation, pageNumber]
	)

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<PageListDragItem>({
		accept: PAGE_LIST_DRAG_ID,
		drop(item, _monitor) {
			// We do this one on drop, as it is costly to move the page around
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
			moveMutation
				.mutateAsync({
					pageId: item.pageId,
					pageNumber: hoverPageNumber,
				})
				.catch((e) => {
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
		<tr ref={ref} className={isDragging ? 'entitylist-dragging' : ''}>
			<td ref={drag} className="td-reorder" style={{ width: 10 }}>
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td style={{ width: 80, textAlign: 'center', fontWeight: 'bold' }}>{pageNumber}</td>
			<td>
				<TextInputField value={info.name ?? ''} setValue={changeName} placeholder="Unnamed page" />
			</td>
			<td style={{ width: 100, textAlign: 'right' }}>
				<CButtonGroup>
					<CButton color="secondary" size="sm" onClick={goToPage} title="Jump to page" data-page={pageNumber}>
						<FontAwesomeIcon icon={faShareFromSquare} />
					</CButton>
					{/* <CButton
						TODO: for future use, once the modal has more properties
						color="info"
						size="sm"
						onClick={configurePage}
						title="Edit page name"
						data-page={pageNumber}
						data-page-info={JSON.stringify(info)}
					>
						<FontAwesomeIcon icon={faPencil} />
					</CButton> */}
					<CButton color="warning" size="sm" onClick={doInsertPage} title="Insert page above" data-page={pageNumber}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>

					<CButton
						color="primary"
						size="sm"
						onClick={doDeletePage}
						title="Delete page"
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
