import React, { useCallback, useMemo, useState } from 'react'
import type { ActionEntry } from '../library.js'

interface Props {
	library: ActionEntry[]
}

export default function LibraryPanel({ library }: Props): React.JSX.Element {
	const [search, setSearch] = useState('')
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

	const filtered = useMemo(() => {
		const q = search.toLowerCase().trim()
		if (!q) return library
		return library.filter(
			(a) =>
				a.definitionId.toLowerCase().includes(q) ||
				a.label.toLowerCase().includes(q) ||
				a.connectionLabel.toLowerCase().includes(q)
		)
	}, [library, search])

	const grouped = useMemo(() => {
		const map = new Map<string, { label: string; actions: ActionEntry[] }>()
		for (const a of filtered) {
			if (!map.has(a.connectionId)) map.set(a.connectionId, { label: a.connectionLabel, actions: [] })
			map.get(a.connectionId)!.actions.push(a)
		}
		return map
	}, [filtered])

	const handleDragStart = useCallback((e: React.DragEvent, action: ActionEntry) => {
		e.dataTransfer.setData(
			'application/companion-action',
			JSON.stringify({
				connectionId: action.connectionId,
				definitionId: action.definitionId,
				options: action.options ?? {},
			})
		)
		e.dataTransfer.effectAllowed = 'copy'
	}, [])

	const toggleGroup = useCallback((connId: string) => {
		setCollapsed((c) => ({ ...c, [connId]: !c[connId] }))
	}, [])

	return (
		<div className="library-panel">
			<div className="library-header">
				<span className="library-title">Action Library</span>
				<span className="library-hint">drag to timeline</span>
			</div>

			<input
				className="inspector-input library-search"
				placeholder="Search actions…"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>

			<div className="library-list">
				{grouped.size === 0 && <div className="library-empty">No actions found</div>}

				{[...grouped.entries()].map(([connId, { label, actions: connActions }]) => (
					<div key={connId} className="library-group">
						<button className="library-group-header" onClick={() => toggleGroup(connId)}>
							<span className="library-group-chevron">{collapsed[connId] ? '▶' : '▼'}</span>
							<span className="library-group-label">{label}</span>
							<span className="library-group-count">{connActions[0]?.noActions ? 0 : connActions.length}</span>
						</button>

						{!collapsed[connId] && (
							<div className="library-group-items">
								{connActions[0]?.noActions ? (
									<div className="library-no-actions">No actions for this connection</div>
								) : (
									connActions.map((a) => (
										<div
											key={`${a.connectionId}:${a.definitionId}`}
											className={`library-item ${a.usedBefore ? 'library-item--used' : ''}`}
											draggable
											onDragStart={(e) => handleDragStart(e, a)}
											title={`${a.connectionLabel} · ${a.label || a.definitionId}`}
										>
											<span className="library-item-icon">⠿</span>
											<span className="library-item-name">{a.label || a.definitionId}</span>
											{a.usedBefore && <span className="library-item-dot" title="Used on this button" />}
										</div>
									))
								)}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	)
}
