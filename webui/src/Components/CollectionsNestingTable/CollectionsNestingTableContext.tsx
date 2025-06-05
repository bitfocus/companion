import React, { createContext, useContext, useMemo } from 'react'
import type { NestingCollectionsApi, CollectionsNestingTableItem } from './Types.js'

export interface CollectionsNestingTableContextType<TItem extends CollectionsNestingTableItem> {
	ItemRow: (item: TItem, index: number) => React.ReactNode | null
	itemName: string
	dragId: string
	collectionsApi: NestingCollectionsApi
	selectedItemId: string | null
}

const CollectionsNestingTableContext = createContext<CollectionsNestingTableContextType<any> | null>(null)

export function useCollectionsNestingTableContext<TItem extends CollectionsNestingTableItem>() {
	const ctx = useContext(CollectionsNestingTableContext)
	if (!ctx)
		throw new Error('useCollectionsNestingTableContext must be used within a CollectionsNestingTableContextProvider')
	return ctx as CollectionsNestingTableContextType<TItem>
}

interface CollectionsNestingTableContextProviderProps<TItem extends CollectionsNestingTableItem>
	extends CollectionsNestingTableContextType<TItem> {
	// visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
}

export function CollectionsNestingTableContextProvider<TItem extends CollectionsNestingTableItem>({
	ItemRow,
	itemName,
	dragId,
	collectionsApi,
	selectedItemId,
	children,
}: React.PropsWithChildren<CollectionsNestingTableContextProviderProps<TItem>>) {
	const value = useMemo<CollectionsNestingTableContextType<TItem>>(() => {
		return {
			ItemRow,
			itemName,
			dragId,
			collectionsApi,
			selectedItemId,
		}
	}, [ItemRow, itemName, dragId, collectionsApi, selectedItemId])

	return <CollectionsNestingTableContext.Provider value={value}>{children}</CollectionsNestingTableContext.Provider>
}
