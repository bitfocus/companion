import { useCallback, useEffect, useState } from 'react'

export function usePanelCollapseHelper(storageId, panelIds) {
	const collapseStorageId = `companion_ui_collapsed_${storageId}`

	const [collapsed, setCollapsed] = useState({})
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
	// const panelIds = useMemo(() => panelIds.map((a) => a.id), [panelIds])
	const setPanelCollapsed = useCallback(
		(panelId, collapsed) => {
			setCollapsed((oldState) => {
				const newState = {
					...oldState,
					ids: {},
				}

				// preserve only the panels which exist
				for (const id of panelIds) {
					newState.ids[id] = oldState.ids[id]
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
			const newState = {
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
			const newState = {
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

	return {
		collapsed,
		setAllCollapsed,
		setAllExpanded,
		setPanelCollapsed,
	}
}
