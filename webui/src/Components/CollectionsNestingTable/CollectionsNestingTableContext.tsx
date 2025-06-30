/* eslint-disable react-refresh/only-export-components */
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
	gridLayout?: boolean
}

const CollectionsNestingTableContext = createContext<CollectionsNestingTableContextType<any, any> | null>(null)

export function useCollectionsNestingTableContext<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>(): CollectionsNestingTableContextType<TCollection, TItem> {
	const ctx = useContext(CollectionsNestingTableContext)
	if (!ctx)
		throw new Error('useCollectionsNestingTableContext must be used within a CollectionsNestingTableContextProvider')
	return ctx as CollectionsNestingTableContextType<TCollection, TItem>
}

type CollectionsNestingTableContextProviderProps<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> = CollectionsNestingTableContextType<TCollection, TItem>

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
	gridLayout,
	children,
}: React.PropsWithChildren<CollectionsNestingTableContextProviderProps<TCollection, TItem>>): React.JSX.Element {
	const value = useMemo<CollectionsNestingTableContextType<TCollection, TItem>>(() => {
		return {
			ItemRow,
			GroupHeaderContent,
			itemName,
			dragId,
			collectionsApi,
			selectedItemId,
			gridLayout,
		}
	}, [ItemRow, GroupHeaderContent, itemName, dragId, collectionsApi, selectedItemId, gridLayout])

	return <CollectionsNestingTableContext.Provider value={value}>{children}</CollectionsNestingTableContext.Provider>
}
