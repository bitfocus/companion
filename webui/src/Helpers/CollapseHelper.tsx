import { useCallback, useEffect, useState } from 'react'

interface PanelCollapseHelperResult {
	setAllCollapsed: () => void
	setAllExpanded: () => void
	canExpandAll: boolean
	canCollapseAll: boolean
	setPanelCollapsed: (panelId: string, collapsed: boolean) => void
	isPanelCollapsed: (panelId: string) => boolean
}

interface CollapsedState {
	defaultCollapsed: boolean
	ids: Record<string, boolean | undefined>
}

export function usePanelCollapseHelper(storageId: string, panelIds: string[]): PanelCollapseHelperResult {
	const collapseStorageId = `companion_ui_collapsed_${storageId}`

	const [collapsed, setCollapsed] = useState<CollapsedState>({ defaultCollapsed: false, ids: {} })
	useEffect(() => {
		// Reload from storage whenever the storage key changes
		const oldState = window.localStorage.getItem(collapseStorageId)
		if (oldState) {
			setCollapsed(JSON.parse(oldState))
		} else {
			setCollapsed({
				defaultCollapsed: false,
				ids: {},
			})
		}
	}, [collapseStorageId])

	const setPanelCollapsed = useCallback(
		(panelId, collapsed) => {
			setCollapsed((oldState) => {
				const newState: CollapsedState = {
					...oldState,
					ids: {},
				}

				// preserve only the panels which exist
				for (const id of panelIds) {
					newState.ids[id] = oldState.ids?.[id]
				}

				// set the new one
				newState.ids[panelId] = collapsed

				window.localStorage.setItem(collapseStorageId, JSON.stringify(newState))
				return newState
			})
		},
		[collapseStorageId, panelIds]
	)
	const setAllCollapsed = useCallback(() => {
		setCollapsed((oldState) => {
			const newState: CollapsedState = {
				...oldState,
				defaultCollapsed: true,
				ids: {},
			}

			// set all to collapsed
			for (const id of panelIds) {
				newState.ids[id] = true
			}

			window.localStorage.setItem(collapseStorageId, JSON.stringify(newState))
			return newState
		})
	}, [collapseStorageId, panelIds])
	const setAllExpanded = useCallback(() => {
		setCollapsed((oldState) => {
			const newState: CollapsedState = {
				...oldState,
				defaultCollapsed: false,
				ids: {},
			}

			// set all to collapsed
			for (const id of panelIds) {
				newState.ids[id] = false
			}

			window.localStorage.setItem(collapseStorageId, JSON.stringify(newState))
			return newState
		})
	}, [collapseStorageId, panelIds])

	const isPanelCollapsed = useCallback(
		(panelId: string) => {
			return collapsed?.ids?.[panelId] ?? collapsed?.defaultCollapsed ?? false
		},
		[collapsed]
	)

	const canExpandAll = collapsed.defaultCollapsed || !Object.values(collapsed.ids || {}).every((v) => !v)
	const canCollapseAll = !collapsed.defaultCollapsed || !Object.values(collapsed.ids || {}).every((v) => v)

	return {
		setAllCollapsed,
		setAllExpanded,
		canExpandAll,
		canCollapseAll,
		setPanelCollapsed,
		isPanelCollapsed,
	}
}
