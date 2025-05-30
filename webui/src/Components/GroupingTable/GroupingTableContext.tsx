import React, { createContext, useContext, useMemo } from 'react'
import type { GroupApi, GroupingTableItem } from './Types.js'

export interface GroupingTableContextType<TItem extends GroupingTableItem> {
	ItemRow: React.ComponentType<{ item: TItem; index: number }>
	itemName: string
	dragId: string
	groupApi: GroupApi
	selectedItemId: string | null
}

const GroupingTableContext = createContext<GroupingTableContextType<any> | null>(null)

export function useGroupingTableContext<TItem extends GroupingTableItem>() {
	const ctx = useContext(GroupingTableContext)
	if (!ctx) throw new Error('useGroupingTableContext must be used within a ConnectionListProvider')
	return ctx as GroupingTableContextType<TItem>
}

interface GroupingTableContextProviderProps<TItem extends GroupingTableItem> extends GroupingTableContextType<TItem> {
	// visibleConnections: TableVisibilityHelper<VisibleConnectionsState>
}

export function GroupingTableContextProvider<TItem extends GroupingTableItem>({
	ItemRow,
	itemName,
	dragId,
	groupApi,
	selectedItemId,
	children,
}: React.PropsWithChildren<GroupingTableContextProviderProps<TItem>>) {
	const value = useMemo<GroupingTableContextType<TItem>>(() => {
		return {
			ItemRow,
			itemName,
			dragId,
			groupApi,
			selectedItemId,
		}
	}, [ItemRow, itemName, dragId, groupApi, selectedItemId])

	return <GroupingTableContext.Provider value={value}>{children}</GroupingTableContext.Provider>
}
