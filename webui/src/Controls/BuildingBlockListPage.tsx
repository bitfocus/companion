import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faAdd, faBook, faLayerGroup, faList, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet } from '@tanstack/react-router'
import classnames from 'classnames'
import { single as fuzzySingle } from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useState } from 'react'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import type { NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { DuplicateIcon } from '~/Components/DuplicateIcon.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode.js'
import type { PageEmptyStateProps } from '~/Layout/PageEmptyState.js'
import { PageHeader } from '~/Layout/PageHeader.js'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton } from '~/Layout/PanelIcons.js'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { makeAbsolutePath } from '~/Resources/util.js'

/** How a kind of building block, such as the custom actions, is named and shown */
export interface BuildingBlockListKind {
	/** Its id, which the drag and drop, and the remembered panel sizes and collapsed collections, are kept under */
	id: 'custom-action' | 'custom-feedback'
	icon: IconDefinition
	/** What one is called in a sentence, eg `custom action` */
	noun: string
	/** What one is called in a title, eg `Custom Action` */
	nounTitle: string
	/** The path of its page of the user guide */
	helpPage: `/user-guide/${string}`
	/** What they are, for the page before there are any */
	emptyDescription: React.ReactNode
	/** What happens to whatever uses one when it is deleted */
	deleteWarning: string
}

/** A building block in the list */
export interface BuildingBlockListItem {
	/** Its id, without the kind of control */
	id: string
	name: string
	description: string
	collectionId: string | null
	sortOrder: number
}

interface BuildingBlockListPageProps {
	kind: BuildingBlockListKind
	items: BuildingBlockListItem[]
	/** The top level collections */
	collections: CollectionBase<null>[]
	/** The ids of every collection, at any depth */
	allCollectionIds: string[]
	collectionsApi: NestingCollectionsApi
	/** The dialog the collections api asks to confirm with, shown by this page */
	confirmModalRef: React.RefObject<GenericConfirmModalRef | null>
	/** The id of the one being edited, or null */
	selectedId: string | null
	/** Edit one, or close the editor when null */
	select: (id: string | null) => void
	addNew: () => void
	addCollection: () => void
	clone: (id: string) => void
	/** Delete one, once the user has confirmed it */
	remove: (id: string) => void
	/** Any other buttons for a row, before its clone and delete buttons, or null */
	rowActions: ((item: BuildingBlockListItem) => React.ReactNode) | null
}

/**
 * The page of a kind of building block: the list of them in their collections, beside the editor of the selected
 * one, which is the outlet of its route
 */
export const BuildingBlockListPage = observer(function BuildingBlockListPage({
	kind,
	items,
	collections,
	allCollectionIds,
	collectionsApi,
	confirmModalRef,
	selectedId,
	select,
	addNew,
	addCollection,
	clone,
	remove,
	rowActions,
}: BuildingBlockListPageProps) {
	const twoPanelMode = useTwoPanelMode()
	const [filter, setFilter] = useState('')

	const confirmRemove = useCallback(
		(id: string) => {
			confirmModalRef.current?.show(
				`Delete ${kind.noun}`,
				`Are you sure you wish to delete this ${kind.noun}? ${kind.deleteWarning}`,
				'Delete',
				() => remove(id)
			)
		},
		[confirmModalRef, kind, remove]
	)

	const ItemRow = (item: BuildingBlockListItem) => {
		// Perform a fuzzy filter to hide irrelevant items
		if (filter) {
			const search = fuzzySingle(filter, item.name)
			if (!search || search.score < 0.5) return null
		}
		return (
			<BuildingBlockListRow
				kind={kind}
				item={item}
				isSelected={selectedId === item.id}
				select={select}
				clone={clone}
				remove={confirmRemove}
				rowActions={rowActions}
			/>
		)
	}

	const NoContent = useCallback(() => <NonIdealState icon={faList} text={`No ${kind.noun}s yet`} />, [kind])

	const empty: PageEmptyStateProps | null =
		items.length === 0 && collections.length === 0 && !selectedId
			? {
					icon: kind.icon,
					title: `No ${kind.noun}s yet`,
					description: kind.emptyDescription,
					actions: (
						<>
							<Button color="primary" onClick={addNew}>
								<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add your first {kind.noun}
							</Button>
							<LinkButtonExternal color="secondary" href={makeAbsolutePath(kind.helpPage)}>
								<FontAwesomeIcon icon={faBook} className="me-1.5" /> Read the guide
							</LinkButtonExternal>
						</>
					),
				}
			: null

	return (
		<div className="page-shell">
			<PageHeader icon={kind.icon} title={`${kind.nounTitle}s`} helpAction={kind.helpPage} beta />

			<GenericConfirmModal ref={confirmModalRef} />

			<SplitPanels.Root showing={selectedId ? 'secondary' : 'primary'} resize={{ storageKey: kind.id }} empty={empty}>
				<SplitPanels.Primary>
					<div className="flex flex-col h-full min-h-0 gap-2">
						<div className="bg-surface-muted/50 border border-border/70 p-3 rounded-lg flex flex-col gap-2.5 shrink-0">
							<div className="flex flex-wrap items-center gap-2">
								<Button color="primary" onClick={addNew} size="sm">
									<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Add {kind.nounTitle}
								</Button>
								<Button color="secondary" size="sm" onClick={addCollection}>
									<FontAwesomeIcon icon={faLayerGroup} className="me-1.5" /> Create Collection
								</Button>
							</div>

							<SearchBox
								placeholder={`Search ${kind.noun}s...`}
								filter={filter}
								setFilter={setFilter}
								className="w-full h-9"
							/>
						</div>

						<div className="flex-1 min-h-0 scrollable-content list-card">
							<PanelCollapseHelperProvider
								storageId={`${kind.id}-groups`}
								knownPanelIds={allCollectionIds}
								defaultCollapsed
							>
								<CollectionsNestingTable<CollectionBase<null>, BuildingBlockListItem>
									NoContent={NoContent}
									ItemRow={ItemRow}
									itemName={kind.noun}
									dragId={kind.id}
									collectionsApi={collectionsApi}
									collections={collections}
									items={items}
									selectedItemId={selectedId}
								/>
							</PanelCollapseHelperProvider>
						</div>
					</div>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedId && (
							<PanelHeader icon={kind.icon} title={`Edit ${kind.nounTitle}`}>
								{!twoPanelMode && <CloseButton closeFn={() => select(null)} />}
							</PanelHeader>
						)}
						<Outlet />
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

interface BuildingBlockListRowProps {
	kind: BuildingBlockListKind
	item: BuildingBlockListItem
	isSelected: boolean
	select: (id: string) => void
	clone: (id: string) => void
	remove: (id: string) => void
	rowActions: ((item: BuildingBlockListItem) => React.ReactNode) | null
}

const BuildingBlockListRow = observer(function BuildingBlockListRow({
	kind,
	item,
	isSelected,
	select,
	clone,
	remove,
	rowActions,
}: BuildingBlockListRowProps) {
	const doEditKey = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			select(item.id)
		}
	}

	return (
		<div
			className={classnames(
				'list-row group flex flex-row items-center gap-3 py-2 pe-3',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/60'
			)}
		>
			<div
				role="button"
				tabIndex={0}
				className="flex flex-col grow min-w-0"
				onClick={() => select(item.id)}
				onKeyDown={doEditKey}
			>
				<span className="truncate text-sm font-semibold text-body">{item.name}</span>
				{item.description && <span className="truncate text-xs text-muted/80 mt-0.5">{item.description}</span>}
			</div>

			<div className="shrink-0 flex items-center gap-1">
				{rowActions?.(item)}
				<Button variant="ghost" size="sm" onClick={() => clone(item.id)} title={`Clone ${kind.noun}`} className="p-1.5">
					<DuplicateIcon />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => remove(item.id)}
					title={`Delete ${kind.noun}`}
					className="p-1.5"
					color="danger"
				>
					<FontAwesomeIcon icon={faTrash} className="text-xs" />
				</Button>
			</div>
		</div>
	)
})
