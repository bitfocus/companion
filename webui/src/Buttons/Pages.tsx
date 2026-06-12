import { useDragDropMonitor } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { faPlus, faShareFromSquare, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef } from 'react'
import { Button, ButtonGroup } from '~/Components/Button'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { PagesStoreModel } from '~/Stores/PagesStore.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { EditPagePropertiesModal, type EditPagePropertiesModalRef } from './EditPageProperties.js'

interface PagesListProps {
	setPageNumber: (page: number) => void
}

export const PagesList = observer(function PagesList({ setPageNumber }: PagesListProps): JSX.Element {
	const { pages } = useContext(RootAppStoreContext)

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

	const insertMutation = useMutationExt(trpc.pages.insert.mutationOptions())
	const doInsertPage = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const pageNumber = Number(e.currentTarget.getAttribute('data-page'))
			if (!isNaN(pageNumber)) {
				// addRef.current?.show?.(pageNumber)
				insertMutation
					.mutateAsync({
						asPageNumber: pageNumber,
						pageNames: [''],
					})
					.catch((e) => {
						console.error('Page insert failed', e)
					})
			}
		},
		[insertMutation]
	)

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

	// Reordering is handled here (the dnd-kit provider is global); we filter to page-list drags.
	// For sortables the new position is the source's projected index (1-based page number).
	const moveMutation = useMutationExt(trpc.pages.move.mutationOptions())
	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source } = event.operation
			if (!source || source.type !== 'page-list' || !isSortable(source)) return
			const { initialIndex, index } = source
			if (initialIndex === index) return
			moveMutation.mutateAsync({ pageId: String(source.id), pageNumber: index + 1 }).catch((e) => {
				console.error('Page move failed', e)
			})
		},
	})

	return (
		<div>
			<h5>Pages</h5>
			<p>
				You can insert, delete, and re-arrange the order of pages here. You can also give each page a unique name to
				help you identify its purpose.
			</p>
			<Grid.Row>
				<Grid.Col xs={12}>
					<GenericConfirmModal ref={deleteRef} />
					<EditPagePropertiesModal ref={editRef} includeName={false} />

					<div className="collections-nesting-table pages-list-table">
						<div className="collections-nesting-table-row-item">
							<div className="collections-nesting-table-row-item-grid fw-bold">
								<div className="row-reorder-handle invisible">
									<FontAwesomeIcon icon={faSort} />
								</div>
								<div className="grow d-flex align-items-center gap-2">
									<div className="pages-list-number">Number</div>
									<div className="grow">Name</div>
									<div className="ms-auto">
										<ButtonGroup className="pages-list-actions">
											<Button
												color="warning"
												size="sm"
												onClick={doInsertPage}
												title="Insert page at start"
												data-page={1}
											>
												<FontAwesomeIcon icon={faPlus} />
											</Button>
										</ButtonGroup>
									</div>
								</div>
							</div>
						</div>
						{pages.data.map((info, id) => (
							<PageListRow
								key={info.id}
								index={id}
								pageNumber={id + 1}
								info={info}
								pageCount={pages.data.length}
								goToPage={goToPage}
								configurePage={configurePage}
								doInsertPage={doInsertPage}
								doDeletePage={doDeletePage}
							/>
						))}
					</div>
				</Grid.Col>
			</Grid.Row>
		</div>
	)
})

interface PageListRowProps {
	index: number
	pageNumber: number
	info: PagesStoreModel
	pageCount: number
	goToPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	configurePage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doInsertPage: (e: React.MouseEvent<HTMLButtonElement>) => void
	doDeletePage: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const PageListRow = observer(function PageListRow({
	index,
	pageNumber,
	info,
	pageCount,
	goToPage,
	// configurePage,
	doInsertPage,
	doDeletePage,
}: PageListRowProps) {
	const setNameMutation = useMutationExt(trpc.pages.setName.mutationOptions())

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

	const { ref, handleRef } = useSortable({ id: info.id, index, type: 'page-list', accept: 'page-list' })

	return (
		<div ref={ref} className="collections-nesting-table-row-item">
			<div className="collections-nesting-table-row-item-grid">
				<div ref={handleRef} className="row-reorder-handle">
					<FontAwesomeIcon icon={faSort} />
				</div>
				<div className="grow d-flex align-items-center gap-2">
					<div className="pages-list-number fw-bold">{pageNumber}</div>
					<div className="grow">
						<TextInputFieldSimple
							id={undefined}
							value={info.name ?? ''}
							setValue={changeName}
							placeholder="Unnamed page"
						/>
					</div>
					<ButtonGroup className="pages-list-actions ms-auto">
						<Button color="secondary" size="sm" onClick={goToPage} title="Jump to page" data-page={pageNumber}>
							<FontAwesomeIcon icon={faShareFromSquare} />
						</Button>
						<Button
							color="warning"
							size="sm"
							onClick={doInsertPage}
							title="Insert page after"
							data-page={pageNumber + 1}
						>
							<FontAwesomeIcon icon={faPlus} />
						</Button>

						<Button
							color="primary"
							size="sm"
							onClick={doDeletePage}
							title="Delete page"
							data-page={pageNumber}
							data-name={info.name}
							disabled={pageCount <= 1}
						>
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					</ButtonGroup>
				</div>
			</div>
		</div>
	)
})
