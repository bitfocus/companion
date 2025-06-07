import React, { createContext, useContext, useMemo } from 'react'
import type { NestingCollectionsApi, CollectionsNestingTableItem, CollectionsNestingTableCollection } from './Types.js'

export interface CollectionsNestingTableContextType<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> {
	ItemRow: (item: TItem, index: number) => React.ReactNode | null
	GroupHeaderContent?: React.ComponentType<{ collection: TCollection }>
	itemName: string
	dragId: string
	collectionsApi: NestingCollectionsApi
	selectedItemId: string | null
}

const CollectionsNestingTableContext = createContext<CollectionsNestingTableContextType<any, any> | null>(null)

export function useCollectionsNestingTableContext<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>() {
	const ctx = useContext(CollectionsNestingTableContext)
	if (!ctx)
		throw new Error('useCollectionsNestingTableContext must be used within a CollectionsNestingTableContextProvider')
	return ctx as CollectionsNestingTableContextType<TCollection, TItem>
}

interface CollectionsNestingTableContextProviderProps<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> extends CollectionsNestingTableContextType<TCollection, TItem> {
	// visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
}

export function CollectionsNestingTableContextProvider<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({
	ItemRow,
	GroupHeaderContent,
	itemName,
	dragId,
	collectionsApi,
	selectedItemId,
	children,
}: React.PropsWithChildren<CollectionsNestingTableContextProviderProps<TCollection, TItem>>) {
	const value = useMemo<CollectionsNestingTableContextType<TCollection, TItem>>(() => {
		return {
			ItemRow,
			GroupHeaderContent,
			itemName,
			dragId,
			collectionsApi,
			selectedItemId,
		}
	}, [ItemRow, GroupHeaderContent, itemName, dragId, collectionsApi, selectedItemId])

	return <CollectionsNestingTableContext.Provider value={value}>{children}</CollectionsNestingTableContext.Provider>
}
