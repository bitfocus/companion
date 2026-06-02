import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	triggerLabel,
	type ButtonControl,
	type CompanionAction,
	type CompanionInstance,
	type ExecutionMode,
	type TriggerKey,
} from '../types.js'

// ---- Group traversal (defined outside component to avoid re-creation) ----

export interface GroupInfo {
	group: CompanionAction
	triggerKey: TriggerKey
	path: string[] // IDs root→this group (inclusive), used as update key
	absStart: number // absolute ms when this group fires
	depth: number
}

export function collectGroups(
	actions: CompanionAction[],
	triggerKey: TriggerKey,
	ancestorPath: string[],
	parentAbsDelay: number,
	depth: number
): GroupInfo[] {
	const result: GroupInfo[] = []
	for (const a of actions) {
		if (a.instance === 'internal' && a.action === 'action_group') {
			const path = [...ancestorPath, a.id]
			const absStart = parentAbsDelay + a.delay
			result.push({ group: a, triggerKey, path, absStart, depth })
			result.push(...collectGroups(a.children?.default ?? [], triggerKey, path, absStart, depth + 1))
		}
	}
	return result
}

export interface TimelineButton {
	key: string
	label: string // e.g. "My Button" or "Slot 5"
	pageSlot: string // e.g. "Page 1 · 5"
	control: ButtonControl
}

interface Props {
	buttons: TimelineButton[]
	selectedKey: string | null
	instances: Record<string, CompanionInstance>
	selectedActionId: string | null
	onActionSelect: (actionId: string | null, triggerKey: TriggerKey, stepKey: string) => void
	onActionMove: (stepKey: string, triggerKey: TriggerKey, actionId: string, newDelay: number) => void
	onActionAdd: (stepKey: string, triggerKey: TriggerKey, delay: number) => void
	onActionDrop: (
		stepKey: string,
		triggerKey: TriggerKey,
		delay: number,
		template: { connectionId: string; definitionId: string; options: Record<string, unknown> }
	) => void
	onActionDelete: (stepKey: string, triggerKey: TriggerKey, actionId: string) => void
	playheadMs: number
	onPlayheadChange: (ms: number) => void
	onStepAdd: () => void
	onStepRemove: (stepKey: string) => void
	onTriggerAdd: (stepKey: string, holdMs: number) => void
	onTriggerRemove: (stepKey: string, triggerKey: TriggerKey) => void
	onActionDelayChange: (stepKey: string, triggerKey: TriggerKey, actionId: string, newDelay: number) => void
	onExecutionModeChange: (stepKey: string, triggerKey: TriggerKey, mode: ExecutionMode) => void
	onVisibleMsChange?: (visibleMs: number) => void
	onChildActionMove?: (
		stepKey: string,
		triggerKey: TriggerKey,
		path: string[],
		childId: string,
		newDelay: number
	) => void
	onChildActionReorder?: (
		stepKey: string,
		triggerKey: TriggerKey,
		path: string[],
		fromIdx: number,
		toIdx: number
	) => void
	onChildActionAdd?: (stepKey: string, triggerKey: TriggerKey, path: string[], delay: number) => void
	onChildActionDrop?: (
		stepKey: string,
		triggerKey: TriggerKey,
		path: string[],
		template: { connectionId: string; definitionId: string; options: Record<string, unknown> },
		delay: number
	) => void
	onChildExecutionModeChange?: (
		stepKey: string,
		triggerKey: TriggerKey,
		path: string[],
		childId: string,
		mode: ExecutionMode
	) => void
}

const LANE_HEIGHT = 72
const LANE_PAD = 6
const LABEL_WIDTH = 120
const MIN_ZOOM_MS = 500
const MAX_ZOOM_MS = 30000
const RULER_HEIGHT = 28
const ACTION_MIN_WIDTH = 80
const CLIP_EST_PX_PER_CHAR = 7
const MIN_ACTION_WIDTH = 100
const MIN_WAIT_PX = 54

const STANDARD_TRIGGERS: TriggerKey[] = ['down', 'up']

function assignLanes<T extends { id: string; delay: number; action: string }>(
	actions: T[],
	msToPx: (ms: number) => number,
	getWidth?: (a: T) => number
): { id: string; lane: number }[] {
	const laneEdge: number[] = []
	const result: { id: string; lane: number }[] = []
	for (const a of [...actions].sort((x, y) => x.delay - y.delay)) {
		const x = msToPx(a.delay)
		const width = getWidth
			? getWidth(a)
			: Math.max(ACTION_MIN_WIDTH, (a.action?.length ?? 4) * CLIP_EST_PX_PER_CHAR + 20)
		const right = x + width
		let placed = false
		for (let lane = 0; lane < laneEdge.length; lane++) {
			if (x >= laneEdge[lane]) {
				laneEdge[lane] = right
				result.push({ id: a.id, lane })
				placed = true
				break
			}
		}
		if (!placed) {
			result.push({ id: a.id, lane: laneEdge.length })
			laneEdge.push(right)
		}
	}
	return result
}

// The execution mode of an action_group, defaulting to 'concurrent'.
function execModeOf(options: Record<string, unknown> | undefined): string {
	const v = options?.execution_mode
	return typeof v === 'string' ? v : 'concurrent'
}

// Returns the duration in ms from timeout/duration option, or null if not present.
function getActionDurationMs(action: CompanionAction): number | null {
	for (const key of ['timeout', 'duration']) {
		const v = action.options?.[key]
		if (v != null && v !== '') {
			const n = Number(v)
			if (!isNaN(n) && n > 0) return n
		}
	}
	return null
}

function msToLabel(ms: number): string {
	if (ms === 0) return '0'
	if (ms >= 1000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
	return `${ms}ms`
}

function snapToGrid(ms: number, snapMs: number): number {
	return Math.round(ms / snapMs) * snapMs
}

function getSnapMs(visibleMs: number): number {
	for (const s of [10, 25, 50, 100, 250, 500, 1000, 2000, 5000]) {
		if (visibleMs / s <= 20) return s
	}
	return 5000
}

export default function Timeline({
	buttons,
	selectedKey,
	instances,
	selectedActionId,
	onActionSelect,
	onActionMove,
	onActionAdd,
	onActionDrop,
	onActionDelete,
	playheadMs,
	onPlayheadChange,
	onStepAdd,
	onStepRemove,
	onTriggerAdd,
	onTriggerRemove,
	onActionDelayChange,
	onExecutionModeChange,
	onVisibleMsChange,
	onChildActionMove,
	onChildActionReorder,
	onChildActionAdd,
	onChildActionDrop,
	onChildExecutionModeChange,
}: Props): React.JSX.Element {
	const trackAreaRef = useRef<HTMLDivElement>(null)
	const [visibleMs, setVisibleMs] = useState(5000)
	const [scrollMs, setScrollMs] = useState(0)
	const [activeStepKey, setActiveStepKey] = useState<string>('0')
	const [addingHold, setAddingHold] = useState(false)
	const [holdInput, setHoldInput] = useState('2000')
	const [editingWaitId, setEditingWaitId] = useState<string | null>(null)
	const [waitInput, setWaitInput] = useState('')
	const [contextMenu, setContextMenu] = useState<{
		x: number
		y: number
		stepKey: string
		triggerKey: TriggerKey
		actionId: string
	} | null>(null)
	const [dropTarget, setDropTarget] = useState<{ triggerKey: TriggerKey; x: number } | null>(null)
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

	const toggleCollapse = useCallback((id: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	useEffect(() => {
		if (!contextMenu) return
		const close = () => setContextMenu(null)
		window.addEventListener('mousedown', close)
		return () => window.removeEventListener('mousedown', close)
	}, [contextMenu])

	useEffect(() => {
		onVisibleMsChange?.(visibleMs)
	}, [visibleMs, onVisibleMsChange])

	const selectedBtn = buttons.find((b) => b.key === selectedKey) ?? null
	const selectedControl = selectedBtn?.control ?? null
	const stepKeys = selectedControl ? Object.keys(selectedControl.steps).sort() : []
	const currentStepKey = stepKeys.includes(activeStepKey) ? activeStepKey : (stepKeys[0] ?? '0')

	const snapMs = getSnapMs(visibleMs)

	const selectedTracks = useMemo(() => {
		if (!selectedControl) return []
		const step = selectedControl.steps[currentStepKey]
		if (!step) return []
		const result: { triggerKey: TriggerKey; actions: CompanionAction[] }[] = []
		const allTriggers = Object.keys(step.action_sets)
		const ordered = [
			...STANDARD_TRIGGERS.filter((t) => allTriggers.includes(t)),
			...allTriggers
				.filter((t) => !STANDARD_TRIGGERS.includes(t as TriggerKey))
				.sort((a, b) => {
					const na = parseInt(a),
						nb = parseInt(b)
					return isNaN(na) ? 1 : isNaN(nb) ? -1 : na - nb
				}),
		] as TriggerKey[]
		for (const tKey of ordered) {
			result.push({ triggerKey: tKey, actions: step.action_sets[tKey] ?? [] })
		}
		return result
	}, [selectedControl, currentStepKey])

	const handleZoomIn = useCallback(() => setVisibleMs((v) => Math.max(MIN_ZOOM_MS, Math.round(v * 0.6))), [])
	const handleZoomOut = useCallback(() => setVisibleMs((v) => Math.min(MAX_ZOOM_MS, Math.round(v * 1.6))), [])
	const handleZoomFit = useCallback(() => {
		if (!selectedControl) return
		// Use end time = start + timeout (if present), so the bar tail is included
		let maxEndMs = MIN_ZOOM_MS
		const actionEnd = (a: CompanionAction, parentDelayMs = 0) => {
			const absStart = parentDelayMs + a.delay
			const dur = getActionDurationMs(a) ?? 0
			maxEndMs = Math.max(maxEndMs, absStart + dur)
			for (const kids of Object.values(a.children ?? {})) {
				for (const c of kids ?? []) actionEnd(c, absStart)
			}
		}
		for (const step of Object.values(selectedControl.steps))
			for (const actions of Object.values(step.action_sets)) for (const a of actions ?? []) actionEnd(a)

		// Add ~15% padding so the last clip block isn't flush against the right edge
		setVisibleMs(Math.max(MIN_ZOOM_MS, Math.min(MAX_ZOOM_MS, Math.round(maxEndMs * 1.15 + 400))))
		setScrollMs(0)
	}, [selectedControl])

	const pxPerMs = useCallback((w: number) => w / visibleMs, [visibleMs])
	const msToPx = useCallback((ms: number, w: number) => (ms - scrollMs) * pxPerMs(w), [scrollMs, pxPerMs])
	const pxToMs = useCallback((px: number, w: number) => px / pxPerMs(w) + scrollMs, [scrollMs, pxPerMs])

	const dragRef = useRef<{
		actionId: string
		stepKey: string
		triggerKey: TriggerKey
		startDelay: number
		startX: number
		containerWidth: number
	} | null>(null)

	const resizeRef = useRef<{
		nextActionId: string
		stepKey: string
		triggerKey: TriggerKey
		startNextDelay: number
		minDelay: number
		startX: number
		containerWidth: number
	} | null>(null)

	const containerWidth = (trackAreaRef.current?.clientWidth ?? 900) - LABEL_WIDTH

	const handleResizeMouseDown = useCallback(
		(e: React.MouseEvent, nextAction: CompanionAction, minDelay: number, triggerKey: TriggerKey) => {
			e.preventDefault()
			e.stopPropagation()
			const w = (trackAreaRef.current?.clientWidth ?? 900) - LABEL_WIDTH
			resizeRef.current = {
				nextActionId: nextAction.id,
				stepKey: currentStepKey,
				triggerKey,
				startNextDelay: nextAction.delay,
				minDelay,
				startX: e.clientX,
				containerWidth: w,
			}
			const ppm = pxPerMs(w)
			const onMove = (ev: MouseEvent) => {
				if (!resizeRef.current) return
				const newDelay = Math.max(
					resizeRef.current.minDelay,
					snapToGrid(resizeRef.current.startNextDelay + (ev.clientX - resizeRef.current.startX) / ppm, snapMs)
				)
				onActionDelayChange(
					resizeRef.current.stepKey,
					resizeRef.current.triggerKey,
					resizeRef.current.nextActionId,
					newDelay
				)
			}
			const onUp = () => {
				resizeRef.current = null
				window.removeEventListener('mousemove', onMove)
				window.removeEventListener('mouseup', onUp)
			}
			window.addEventListener('mousemove', onMove)
			window.addEventListener('mouseup', onUp)
		},
		[currentStepKey, pxPerMs, snapMs, onActionDelayChange]
	)

	const handleActionMouseDown = useCallback(
		(e: React.MouseEvent, action: CompanionAction, triggerKey: TriggerKey) => {
			e.preventDefault()
			e.stopPropagation()
			onActionSelect(action.id, triggerKey, currentStepKey)
			const w = (trackAreaRef.current?.clientWidth ?? 900) - LABEL_WIDTH
			dragRef.current = {
				actionId: action.id,
				stepKey: currentStepKey,
				triggerKey,
				startDelay: action.delay,
				startX: e.clientX,
				containerWidth: w,
			}
			const ppm = pxPerMs(w)
			const onMove = (ev: MouseEvent) => {
				if (!dragRef.current) return
				onActionMove(
					dragRef.current.stepKey,
					dragRef.current.triggerKey,
					dragRef.current.actionId,
					Math.max(0, snapToGrid(dragRef.current.startDelay + (ev.clientX - dragRef.current.startX) / ppm, snapMs))
				)
			}
			const onUp = () => {
				dragRef.current = null
				window.removeEventListener('mousemove', onMove)
				window.removeEventListener('mouseup', onUp)
			}
			window.addEventListener('mousemove', onMove)
			window.addEventListener('mouseup', onUp)
		},
		[onActionSelect, onActionMove, pxPerMs, snapMs, currentStepKey]
	)

	const handleTrackDoubleClick = useCallback(
		(e: React.MouseEvent, triggerKey: TriggerKey) => {
			const w = (trackAreaRef.current?.clientWidth ?? 900) - LABEL_WIDTH
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
			onActionAdd(currentStepKey, triggerKey, Math.max(0, snapToGrid(pxToMs(e.clientX - rect.left, w), snapMs)))
		},
		[pxToMs, snapMs, onActionAdd, currentStepKey]
	)

	const handleDragOver = useCallback((e: React.DragEvent, triggerKey: TriggerKey) => {
		if (!e.dataTransfer.types.includes('application/companion-action')) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'copy'
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
		setDropTarget({ triggerKey, x: e.clientX - rect.left })
	}, [])

	const handleDragLeave = useCallback(() => setDropTarget(null), [])

	const handlePlayheadDragStart = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			e.preventDefault()
			const trackArea = trackAreaRef.current
			if (!trackArea) return
			const w = trackArea.clientWidth - LABEL_WIDTH
			const rulerRect = trackArea.querySelector('.ruler-ticks')?.getBoundingClientRect()
			if (!rulerRect) return
			const onMove = (ev: MouseEvent) =>
				onPlayheadChange(Math.max(0, snapToGrid(pxToMs(ev.clientX - rulerRect.left, w), snapMs)))
			const onUp = () => {
				window.removeEventListener('mousemove', onMove)
				window.removeEventListener('mouseup', onUp)
			}
			window.addEventListener('mousemove', onMove)
			window.addEventListener('mouseup', onUp)
		},
		[pxToMs, snapMs, onPlayheadChange]
	)

	const handleRulerClick = useCallback(
		(e: React.MouseEvent) => {
			const trackArea = trackAreaRef.current
			if (!trackArea) return
			const w = trackArea.clientWidth - LABEL_WIDTH
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
			onPlayheadChange(Math.max(0, snapToGrid(pxToMs(e.clientX - rect.left, w), snapMs)))
		},
		[pxToMs, snapMs, onPlayheadChange]
	)

	const handleDrop = useCallback(
		(e: React.DragEvent, triggerKey: TriggerKey) => {
			setDropTarget(null)
			const raw = e.dataTransfer.getData('application/companion-action')
			if (!raw) return
			e.preventDefault()
			const template = JSON.parse(raw)
			const w = (trackAreaRef.current?.clientWidth ?? 900) - LABEL_WIDTH
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
			onActionDrop(
				currentStepKey,
				triggerKey,
				Math.max(0, snapToGrid(pxToMs(e.clientX - rect.left, w), snapMs)),
				template
			)
		},
		[pxToMs, snapMs, onActionDrop, currentStepKey]
	)

	const handleWheel = useCallback(
		(e: WheelEvent) => {
			// ⌘/Ctrl + scroll → zoom the time axis
			if (e.metaKey || e.ctrlKey) {
				e.preventDefault()
				setVisibleMs((v) => Math.max(MIN_ZOOM_MS, Math.min(MAX_ZOOM_MS, v * (e.deltaY > 0 ? 1.2 : 0.8))))
				return
			}
			const w = (trackAreaRef.current?.clientWidth ?? 900) - LABEL_WIDTH
			// Shift + wheel, or a horizontal trackpad gesture → pan the time axis
			if (e.shiftKey) {
				e.preventDefault()
				setScrollMs((s) => Math.max(0, s + (e.deltaY || e.deltaX) / pxPerMs(w)))
				return
			}
			if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
				e.preventDefault()
				setScrollMs((s) => Math.max(0, s + e.deltaX / pxPerMs(w)))
				return
			}
			// Vertical gesture → let the track area scroll naturally (don't hijack it)
		},
		[pxPerMs]
	)

	useEffect(() => {
		const el = trackAreaRef.current
		if (!el) return
		el.addEventListener('wheel', handleWheel, { passive: false })
		return () => el.removeEventListener('wheel', handleWheel)
	}, [handleWheel])

	const renderRuler = () => {
		const ticks: React.ReactNode[] = []
		let t = Math.floor(scrollMs / snapMs) * snapMs
		while (t <= scrollMs + visibleMs) {
			const x = msToPx(t, containerWidth)
			if (x >= 0 && x <= containerWidth) {
				ticks.push(
					<div key={t} className="ruler-tick" style={{ left: x }}>
						<span className="ruler-label">{msToLabel(t)}</span>
					</div>
				)
			}
			t += snapMs
		}
		return ticks
	}

	const renderGridLines = (w: number) =>
		Array.from({ length: Math.ceil(visibleMs / snapMs) + 1 }, (_, i) => {
			const t = Math.floor(scrollMs / snapMs) * snapMs + i * snapMs
			const x = msToPx(t, w)
			return x >= 0 && x <= w ? <div key={t} className="grid-line" style={{ left: x }} /> : null
		})

	// Render a single trigger track for the SELECTED (editable) button
	const renderSelectedTrack = (triggerKey: TriggerKey, actions: CompanionAction[]) => {
		const isHoldTrack = !['down', 'up', 'rotate_left', 'rotate_right'].includes(triggerKey)
		const hasGroups = actions.some((a) => a.instance === 'internal' && a.action === 'action_group')
		const trackCollapseKey = `track-${currentStepKey}-${triggerKey}`
		const isTrackCollapsed = collapsedGroups.has(trackCollapseKey)

		if (isTrackCollapsed) {
			return (
				<div
					key={triggerKey}
					className="track-row track-row--collapsed"
					style={{ display: 'flex', alignItems: 'center' }}
				>
					<div className="track-label" style={{ width: LABEL_WIDTH }}>
						<button className="track-collapse-btn" onClick={() => toggleCollapse(trackCollapseKey)}>
							▶
						</button>
						<span className="track-label-text">{triggerLabel(triggerKey)}</span>
						<span className="track-label-sub">
							{actions.length} action{actions.length !== 1 ? 's' : ''}
						</span>
					</div>
					<div style={{ flex: 1, borderTop: '1px solid var(--border)' }} />
				</div>
			)
		}

		const sorted = [...actions].sort((a, b) => a.delay - b.delay)
		const nextAction = new Map<string, CompanionAction>()
		for (let i = 0; i < sorted.length - 1; i++) nextAction.set(sorted[i].id, sorted[i + 1])

		const ppm = pxPerMs(containerWidth)
		const waitPx = (action: CompanionAction) => {
			const next = nextAction.get(action.id)
			if (!next || next.delay <= action.delay) return 0
			const gap = (next.delay - action.delay) * ppm
			const waitWidth = gap - MIN_ACTION_WIDTH
			return waitWidth >= MIN_WAIT_PX ? waitWidth : 0
		}

		const laneAssignments = assignLanes(
			actions,
			(ms) => ms * ppm,
			(a) => {
				const dur = getActionDurationMs(a)
				return dur ? Math.max(MIN_ACTION_WIDTH, Math.round(dur * ppm)) : MIN_ACTION_WIDTH
			}
		)
		const laneMap = new Map(laneAssignments.map(({ id, lane }) => [id, lane]))
		const laneCount = Math.max(1, ...laneAssignments.map((l) => l.lane + 1))
		const trackHeight = laneCount * LANE_HEIGHT

		return (
			<div key={triggerKey} className="track-row" style={{ height: trackHeight }}>
				<div className="track-label" style={{ width: LABEL_WIDTH }}>
					<button className="track-collapse-btn" onClick={() => toggleCollapse(trackCollapseKey)}>
						▼
					</button>
					<span className="track-label-text">{triggerLabel(triggerKey)}</span>
					<div className="track-label-meta">
						{hasGroups && (
							<span className="track-mode-badge" title="Track contains Action Groups">
								GRP
							</span>
						)}
						{isHoldTrack && (
							<button
								className="track-remove-btn"
								title="Remove hold group"
								onClick={() => onTriggerRemove(currentStepKey, triggerKey)}
							>
								×
							</button>
						)}
					</div>
				</div>
				<div
					className="track-body"
					style={{ position: 'relative', flex: 1, height: '100%' }}
					onDoubleClick={(e) => handleTrackDoubleClick(e, triggerKey)}
					onDragOver={(e) => handleDragOver(e, triggerKey)}
					onDragLeave={handleDragLeave}
					onDrop={(e) => handleDrop(e, triggerKey)}
				>
					{dropTarget?.triggerKey === triggerKey && <div className="drop-indicator" style={{ left: dropTarget.x }} />}
					{renderGridLines(containerWidth)}
					{laneCount > 1 &&
						Array.from({ length: laneCount - 1 }, (_, i) => (
							<div key={`ld-${i}`} className="lane-divider" style={{ top: (i + 1) * LANE_HEIGHT }} />
						))}
					{actions.map((action) => {
						const x = msToPx(action.delay, containerWidth)
						const lane = laneMap.get(action.id) ?? 0
						const top = lane * LANE_HEIGHT + LANE_PAD
						const bottom = (laneCount - lane - 1) * LANE_HEIGHT + LANE_PAD
						const next = nextAction.get(action.id)
						const wp = waitPx(action)
						const hasWait = wp > 0
						const waitMs = next ? next.delay - action.delay : 0
						const instLabel = instances[action.instance]?.label ?? action.instance?.slice(0, 6) ?? '?'
						const isSelected = selectedActionId === action.id
						const isEditingWait = editingWaitId === action.id
						const isGroup = action.instance === 'internal' && action.action === 'action_group'
						const execMode = isGroup ? execModeOf(action.options) : null
						const childCount = isGroup ? (action.children?.default?.length ?? 0) : 0
						const durationMs = !isGroup ? getActionDurationMs(action) : null
						const durationPx = durationMs ? Math.max(0, Math.round(durationMs * ppm) - MIN_ACTION_WIDTH) : 0

						return (
							<div
								key={action.id}
								className={`clip-block ${isSelected ? 'clip-block--selected' : ''} ${isGroup ? 'clip-block--group' : ''}`}
								style={{ left: x, top, bottom, width: MIN_ACTION_WIDTH + Math.max(wp, durationPx) }}
								onDragOver={
									isGroup
										? (e) => {
												if (e.dataTransfer.types.includes('application/companion-action')) {
													e.preventDefault()
													e.stopPropagation()
													e.dataTransfer.dropEffect = 'copy'
												}
											}
										: undefined
								}
								onDrop={
									isGroup
										? (e) => {
												const raw = e.dataTransfer.getData('application/companion-action')
												if (!raw) return
												e.preventDefault()
												e.stopPropagation()
												const tmpl = JSON.parse(raw)
												const kids = action.children?.default ?? []
												const delay =
													execMode === 'sequential' && kids.length > 0 ? Math.max(...kids.map((c) => c.delay)) + 500 : 0
												onChildActionDrop?.(currentStepKey, triggerKey, [action.id], tmpl, delay)
											}
										: undefined
								}
							>
								<div
									className={`clip-action ${isGroup ? 'clip-action--group' : ''}`}
									style={{ width: MIN_ACTION_WIDTH }}
									onMouseDown={(e) => handleActionMouseDown(e, action, triggerKey)}
									onContextMenu={(e) => {
										e.preventDefault()
										setContextMenu({
											x: e.clientX,
											y: e.clientY,
											stepKey: currentStepKey,
											triggerKey,
											actionId: action.id,
										})
									}}
								>
									{isGroup ? (
										<>
											<span className="action-name">Action Group</span>
											<span className="action-instance">
												{childCount} action{childCount !== 1 ? 's' : ''}
											</span>
											<span className="action-exec-mode" style={{ display: 'contents' }}>
												<select
													className="exec-mode-select"
													value={execMode ?? 'concurrent'}
													onMouseDown={(e) => e.stopPropagation()}
													onChange={(e) => {
														e.stopPropagation()
														onExecutionModeChange(currentStepKey, triggerKey, e.target.value as ExecutionMode)
													}}
												>
													<option value="concurrent">Concurrent</option>
													<option value="sequential">Sequential</option>
													<option value="inherit">Inherit</option>
												</select>
											</span>
										</>
									) : (
										<>
											<span className="action-name">{action.action || <em>new</em>}</span>
											<span className="action-instance">{instLabel}</span>
											{action.delay > 0 && <span className="action-delay">{msToLabel(action.delay)}</span>}
											{durationMs && (
												<span className="action-duration-badge" title={`Timeout: ${durationMs}ms`}>
													⏱ {msToLabel(durationMs)}
												</span>
											)}
										</>
									)}
									{!hasWait && next && (
										<button
											className="clip-add-wait"
											title="Add wait before next action"
											onMouseDown={(e) => e.stopPropagation()}
											onClick={(e) => {
												e.stopPropagation()
												setEditingWaitId(action.id)
												setWaitInput('500')
											}}
										>
											⏱+
										</button>
									)}
								</div>

								{durationPx > 0 && !hasWait && (
									<div
										className="clip-duration-bar"
										style={{ width: durationPx }}
										title={`Timeout: ${msToLabel(durationMs!)} — action active for this duration`}
									/>
								)}

								{hasWait && (
									<div className="clip-wait" style={{ width: wp }} onMouseDown={(e) => e.stopPropagation()}>
										{isEditingWait ? (
											<div className="clip-wait-editor" onMouseDown={(e) => e.stopPropagation()}>
												<input
													className="wait-input"
													type="number"
													min={0}
													step={50}
													value={waitInput}
													autoFocus
													onChange={(e) => setWaitInput(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === 'Enter') {
															const ms = parseInt(waitInput)
															if (!isNaN(ms) && ms >= 0 && next)
																onActionDelayChange(currentStepKey, triggerKey, next.id, action.delay + ms)
															setEditingWaitId(null)
														}
														if (e.key === 'Escape') setEditingWaitId(null)
													}}
												/>
												<span className="wait-input-unit">ms</span>
											</div>
										) : (
											<button
												className="clip-wait-label"
												title="Click to edit wait duration"
												onClick={(e) => {
													e.stopPropagation()
													setEditingWaitId(action.id)
													setWaitInput(String(waitMs))
												}}
											>
												<span>⏱</span>
												<span>{msToLabel(waitMs)}</span>
											</button>
										)}
										{next && (
											<div
												className="clip-resize-handle"
												onMouseDown={(e) => handleResizeMouseDown(e, next, action.delay, triggerKey)}
											/>
										)}
									</div>
								)}

								{isEditingWait && !hasWait && (
									<div className="clip-wait clip-wait--new" onMouseDown={(e) => e.stopPropagation()}>
										<div className="clip-wait-editor">
											<input
												className="wait-input"
												type="number"
												min={0}
												step={50}
												value={waitInput}
												autoFocus
												onChange={(e) => setWaitInput(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														const ms = parseInt(waitInput)
														if (!isNaN(ms) && ms > 0 && next)
															onActionDelayChange(currentStepKey, triggerKey, next.id, action.delay + ms)
														setEditingWaitId(null)
													}
													if (e.key === 'Escape') setEditingWaitId(null)
												}}
											/>
											<span className="wait-input-unit">ms</span>
										</div>
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>
		)
	}

	// ---- Group rendering helpers ----

	// Depth colour palette — same look as main timeline, just tinted differently per level
	const DEPTH_TINT = [
		'rgba(74,158,255,0.05)',
		'rgba(100,220,160,0.05)',
		'rgba(255,180,74,0.05)',
		'rgba(220,100,220,0.05)',
	]
	const DEPTH_BORDER = [
		'rgba(74,158,255,0.3)',
		'rgba(100,220,160,0.3)',
		'rgba(255,180,74,0.3)',
		'rgba(220,100,220,0.3)',
	]

	const renderSequentialSubTrack = (info: GroupInfo) => {
		const { group, triggerKey, path, absStart, depth } = info
		const collapsed = collapsedGroups.has(group.id)
		const tint = DEPTH_TINT[depth % DEPTH_TINT.length]
		const border = DEPTH_BORDER[depth % DEPTH_BORDER.length]
		const indent = depth * 8
		const children = [...(group.children?.default ?? [])].sort((a, b) => a.delay - b.delay)

		if (collapsed) {
			return (
				<div
					key={`sub-${group.id}`}
					className="track-row track-row--subtimeline track-row--collapsed"
					style={{ background: tint, borderTopColor: border }}
				>
					<div
						className="track-label track-label--subtimeline"
						style={{ width: LABEL_WIDTH, paddingLeft: 10 + indent }}
					>
						<button className="track-collapse-btn" onClick={() => toggleCollapse(group.id)}>
							▶
						</button>
						<span className="track-label-text" style={{ color: border }}>
							↓ Sequential
						</span>
						<span className="track-label-sub">
							{children.length} action{children.length !== 1 ? 's' : ''}
						</span>
					</div>
					<div style={{ flex: 1 }} />
				</div>
			)
		}
		const ppm = pxPerMs(containerWidth)
		const absChildren = children.map((c) => ({ ...c, delay: absStart + c.delay }))
		const laneAssignments = assignLanes(
			absChildren,
			(ms) => ms * ppm,
			(c) => {
				const dur = getActionDurationMs(c)
				return dur ? Math.max(MIN_ACTION_WIDTH, Math.round(dur * ppm)) : MIN_ACTION_WIDTH
			}
		)
		const laneMap = new Map(laneAssignments.map(({ id, lane }) => [id, lane]))
		const laneCount = Math.max(1, ...laneAssignments.map((l) => l.lane + 1))
		const trackHeight = laneCount * LANE_HEIGHT
		const startX = msToPx(absStart, containerWidth)

		return (
			<div
				key={`sub-${group.id}`}
				className="track-row track-row--subtimeline"
				style={{ height: trackHeight, background: tint, borderTopColor: border }}
			>
				<div className="track-label track-label--subtimeline" style={{ width: LABEL_WIDTH, paddingLeft: 10 + indent }}>
					<button className="track-collapse-btn" onClick={() => toggleCollapse(group.id)}>
						▼
					</button>
					<span className="track-label-text" style={{ color: border }}>
						{'↓'.repeat(depth + 1)} Sequential
					</span>
					<span className="track-label-sub">{msToLabel(absStart)}+</span>
				</div>
				<div
					className="track-body"
					style={{ position: 'relative', flex: 1, height: '100%' }}
					onDoubleClick={(e) => {
						const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
						const absMs = Math.max(0, snapToGrid(pxToMs(e.clientX - rect.left, containerWidth), snapMs))
						onChildActionAdd?.(currentStepKey, triggerKey, path, Math.max(0, absMs - absStart))
					}}
					onDragOver={(e) => {
						if (e.dataTransfer.types.includes('application/companion-action')) {
							e.preventDefault()
							e.dataTransfer.dropEffect = 'copy'
						}
					}}
					onDrop={(e) => {
						const raw = e.dataTransfer.getData('application/companion-action')
						if (!raw) return
						e.preventDefault()
						const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
						const absMs = Math.max(0, snapToGrid(pxToMs(e.clientX - rect.left, containerWidth), snapMs))
						onChildActionDrop?.(currentStepKey, triggerKey, path, JSON.parse(raw), Math.max(0, absMs - absStart))
					}}
				>
					{renderGridLines(containerWidth)}
					{startX >= 0 && startX <= containerWidth && (
						<div
							className="subtimeline-start-line"
							style={{ left: startX, background: DEPTH_BORDER[depth % DEPTH_BORDER.length] }}
						/>
					)}
					{children.length === 0 && <div className="subtimeline-empty">double-click or drag to add</div>}
					{children.map((child) => {
						const x = msToPx(absStart + child.delay, containerWidth)
						const lane = laneMap.get(child.id) ?? 0
						const top = lane * LANE_HEIGHT + LANE_PAD
						const bottom = (laneCount - lane - 1) * LANE_HEIGHT + LANE_PAD
						const instLabel = instances[child.instance]?.label ?? child.instance?.slice(0, 6) ?? '?'
						const isGroup = child.instance === 'internal' && child.action === 'action_group'
						const childDurMs = !isGroup ? getActionDurationMs(child) : null
						const childDurPx = childDurMs ? Math.max(0, Math.round(childDurMs * ppm) - MIN_ACTION_WIDTH) : 0
						return (
							<div
								key={child.id}
								className={`clip-block clip-block--child ${isGroup ? 'clip-block--group' : ''}`}
								style={{ left: x, top, bottom, width: MIN_ACTION_WIDTH + childDurPx }}
								onMouseDown={(e) => {
									e.preventDefault()
									e.stopPropagation()
									const startAbsMs = absStart + child.delay
									const sx = e.clientX
									const onMove = (ev: MouseEvent) => {
										const newAbsMs = Math.max(0, snapToGrid(startAbsMs + (ev.clientX - sx) / ppm, snapMs))
										onChildActionMove?.(currentStepKey, triggerKey, path, child.id, Math.max(0, newAbsMs - absStart))
									}
									const onUp = () => {
										window.removeEventListener('mousemove', onMove)
										window.removeEventListener('mouseup', onUp)
									}
									window.addEventListener('mousemove', onMove)
									window.addEventListener('mouseup', onUp)
								}}
								onDragOver={
									isGroup
										? (e) => {
												if (e.dataTransfer.types.includes('application/companion-action')) {
													e.preventDefault()
													e.stopPropagation()
													e.dataTransfer.dropEffect = 'copy'
												}
											}
										: undefined
								}
								onDrop={
									isGroup
										? (e) => {
												const raw = e.dataTransfer.getData('application/companion-action')
												if (!raw) return
												e.preventDefault()
												e.stopPropagation()
												const childPath = [...path, child.id]
												const kids = child.children?.default ?? []
												const childMode = execModeOf(child.options)
												const delay =
													childMode === 'sequential' && kids.length > 0
														? Math.max(...kids.map((c) => c.delay)) + 500
														: 0
												onChildActionDrop?.(currentStepKey, triggerKey, childPath, JSON.parse(raw), delay)
											}
										: undefined
								}
							>
								<div className="clip-action" style={{ width: MIN_ACTION_WIDTH }}>
									{isGroup ? (
										<>
											<span className="action-name">Group</span>
											<select
												className="exec-mode-select"
												value={execModeOf(child.options)}
												onMouseDown={(e) => e.stopPropagation()}
												onChange={(e) => {
													e.stopPropagation()
													onChildExecutionModeChange?.(
														currentStepKey,
														triggerKey,
														path,
														child.id,
														e.target.value as ExecutionMode
													)
												}}
											>
												<option value="concurrent">Concurrent</option>
												<option value="sequential">Sequential</option>
												<option value="inherit">Inherit</option>
											</select>
										</>
									) : (
										<>
											<span className="action-name">{child.action || <em>new</em>}</span>
											<span className="action-instance">{instLabel}</span>
											{child.delay > 0 && <span className="action-delay">+{msToLabel(child.delay)}</span>}
											{childDurMs && (
												<span className="action-duration-badge" title={`Timeout: ${childDurMs}ms`}>
													⏱ {msToLabel(childDurMs)}
												</span>
											)}
										</>
									)}
								</div>
								{childDurPx > 0 && (
									<div
										className="clip-duration-bar"
										style={{ width: childDurPx }}
										title={`Timeout: ${msToLabel(childDurMs!)}`}
									/>
								)}
							</div>
						)
					})}
				</div>
			</div>
		)
	}

	const renderConcurrentList = (info: GroupInfo) => {
		const { group, triggerKey, path, absStart, depth } = info
		const collapsed = collapsedGroups.has(group.id)
		const children = group.children?.default ?? []
		const mode = execModeOf(group.options)
		const indent = depth * 8
		const tint = DEPTH_TINT[depth % DEPTH_TINT.length]
		const border = DEPTH_BORDER[depth % DEPTH_BORDER.length]
		const modeLabel = mode === 'inherit' ? 'Inherit' : 'Concurrent'

		if (collapsed) {
			return (
				<div
					key={`conc-${group.id}`}
					className="concurrent-group-section concurrent-group-section--collapsed"
					style={{ borderTopColor: border, background: tint }}
				>
					<div className="concurrent-section-label" style={{ width: LABEL_WIDTH, paddingLeft: 10 + indent }}>
						<button className="track-collapse-btn" onClick={() => toggleCollapse(group.id)}>
							▶
						</button>
						<span style={{ color: border }}>⇉ {modeLabel}</span>
						<span className="track-label-sub">
							{children.length} action{children.length !== 1 ? 's' : ''}
						</span>
					</div>
				</div>
			)
		}

		return (
			<div
				key={`conc-${group.id}`}
				className="concurrent-group-section"
				style={{ borderTopColor: border, background: tint }}
			>
				<div className="concurrent-section-label" style={{ width: LABEL_WIDTH, paddingLeft: 10 + indent }}>
					<button className="track-collapse-btn" onClick={() => toggleCollapse(group.id)}>
						▼
					</button>
					<span style={{ color: border }}>⇉ {modeLabel}</span>
					<span className="track-label-sub">{msToLabel(absStart)}</span>
				</div>
				<div className="concurrent-section-body">
					{children.map((child, idx) => {
						const instLabel = instances[child.instance]?.label ?? child.instance?.slice(0, 6) ?? '?'
						const isGroup = child.instance === 'internal' && child.action === 'action_group'
						return (
							<div
								key={child.id}
								className="concurrent-item"
								draggable
								onDragStart={(e) => {
									e.stopPropagation()
									e.dataTransfer.setData('application/concurrent-reorder', JSON.stringify({ groupId: group.id, idx }))
									e.dataTransfer.effectAllowed = 'move'
								}}
								onDragOver={(e) => {
									if (e.dataTransfer.types.includes('application/concurrent-reorder')) {
										e.preventDefault()
										e.dataTransfer.dropEffect = 'move'
									}
								}}
								onDrop={(e) => {
									const raw = e.dataTransfer.getData('application/concurrent-reorder')
									if (!raw) return
									e.preventDefault()
									const { groupId, idx: fromIdx } = JSON.parse(raw)
									if (groupId === group.id && fromIdx !== idx)
										onChildActionReorder?.(currentStepKey, triggerKey, path, fromIdx, idx)
								}}
							>
								<span className="concurrent-item-handle">⠿</span>
								{isGroup ? (
									<>
										<span className="concurrent-item-name">Group</span>
										<select
											className="exec-mode-select"
											value={execModeOf(child.options)}
											onMouseDown={(e) => e.stopPropagation()}
											onChange={(e) => {
												e.stopPropagation()
												onChildExecutionModeChange?.(
													currentStepKey,
													triggerKey,
													path,
													child.id,
													e.target.value as ExecutionMode
												)
											}}
										>
											<option value="concurrent">Concurrent</option>
											<option value="sequential">Sequential</option>
											<option value="inherit">Inherit</option>
										</select>
									</>
								) : (
									<>
										<span className="concurrent-item-name">{child.action || '(new)'}</span>
										<span className="concurrent-item-inst">{instLabel}</span>
										{(() => {
											const d = getActionDurationMs(child)
											return d ? (
												<span className="action-duration-badge" title={`Timeout: ${d}ms`}>
													⏱ {msToLabel(d)}
												</span>
											) : null
										})()}
									</>
								)}
							</div>
						)
					})}
					<div
						className="concurrent-item-drop"
						onDragOver={(e) => {
							if (e.dataTransfer.types.includes('application/companion-action')) {
								e.preventDefault()
								e.dataTransfer.dropEffect = 'copy'
							}
						}}
						onDrop={(e) => {
							const raw = e.dataTransfer.getData('application/companion-action')
							if (!raw) return
							e.preventDefault()
							onChildActionDrop?.(currentStepKey, triggerKey, path, JSON.parse(raw), 0)
						}}
					>
						+ Drop action here
					</div>
				</div>
			</div>
		)
	}

	const hasAnyContent = !!selectedControl

	return (
		<div className="timeline-wrap">
			{/* Step bar — only shown for selected button */}
			{selectedControl && (
				<div className="step-bar">
					<span className="step-bar-label">Steps</span>
					{stepKeys.map((sk) => (
						<button
							key={sk}
							className={`step-tab ${sk === currentStepKey ? 'step-tab--active' : ''}`}
							onClick={() => setActiveStepKey(sk)}
						>
							{parseInt(sk) + 1}
						</button>
					))}
					<button className="step-tab step-tab--add" onClick={onStepAdd} title="Add step">
						+
					</button>
					{stepKeys.length > 1 && (
						<button
							className="step-tab step-tab--remove"
							onClick={() => onStepRemove(currentStepKey)}
							title="Remove current step"
						>
							−
						</button>
					)}

					<div className="step-bar-divider" />

					<span className="step-bar-label">Hold</span>
					{!addingHold ? (
						<button
							className="step-tab step-tab--add"
							title="Add hold duration group"
							onClick={() => setAddingHold(true)}
						>
							+
						</button>
					) : (
						<div className="hold-input-group">
							<input
								className="hold-input"
								type="number"
								min={100}
								step={100}
								value={holdInput}
								onChange={(e) => setHoldInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										const ms = parseInt(holdInput)
										if (!isNaN(ms) && ms >= 100) {
											onTriggerAdd(currentStepKey, ms)
											setAddingHold(false)
											setHoldInput('2000')
										}
									} else if (e.key === 'Escape') setAddingHold(false)
								}}
								autoFocus
							/>
							<span className="hold-input-unit">ms</span>
							<button
								className="step-tab step-tab--add"
								onClick={() => {
									const ms = parseInt(holdInput)
									if (!isNaN(ms) && ms >= 100) {
										onTriggerAdd(currentStepKey, ms)
										setAddingHold(false)
										setHoldInput('2000')
									}
								}}
							>
								✓
							</button>
							<button className="step-tab step-tab--remove" onClick={() => setAddingHold(false)}>
								✕
							</button>
						</div>
					)}

					<div className="step-bar-divider" />

					<span className="step-bar-label">Zoom</span>
					<button className="step-tab zoom-btn" title="Zoom in (or ⌘ scroll)" onClick={handleZoomIn}>
						+
					</button>
					<button className="step-tab zoom-btn" title="Zoom out (or ⌘ scroll)" onClick={handleZoomOut}>
						−
					</button>
					<button className="step-tab zoom-btn zoom-btn--fit" title="Fit all actions" onClick={handleZoomFit}>
						Fit
					</button>
				</div>
			)}

			<div className="timeline" ref={trackAreaRef}>
				{/* Ruler */}
				<div className="timeline-ruler" style={{ height: RULER_HEIGHT }}>
					<div className="ruler-track-label" style={{ width: LABEL_WIDTH }} />
					<div className="ruler-ticks" style={{ position: 'relative', flex: 1 }} onClick={handleRulerClick}>
						{renderRuler()}
						{msToPx(playheadMs, containerWidth) >= 0 && (
							<div
								className="playhead-ruler-marker"
								style={{ left: msToPx(playheadMs, containerWidth) }}
								onMouseDown={handlePlayheadDragStart}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="playhead-ruler-label">{msToLabel(playheadMs)}</div>
								<div className="playhead-ruler-arrow" />
							</div>
						)}
					</div>
				</div>

				{/* Full-height playhead line */}
				<div className="playhead-line" style={{ left: msToPx(playheadMs, containerWidth) + LABEL_WIDTH }} />

				{/* Selected button tracks */}
				{selectedTracks.map(({ triggerKey, actions }) => renderSelectedTrack(triggerKey, actions))}

				{/* Group sub-timelines and lists — recursive, all nesting depths */}
				{selectedTracks.flatMap(({ triggerKey, actions }) =>
					collectGroups(actions, triggerKey, [], 0, 0)
						.filter((info) => execModeOf(info.group.options) === 'sequential')
						.map((info) => renderSequentialSubTrack(info))
				)}
				{selectedTracks.flatMap(({ triggerKey, actions }) =>
					collectGroups(actions, triggerKey, [], 0, 0)
						.filter((info) => execModeOf(info.group.options) !== 'sequential')
						.map((info) => renderConcurrentList(info))
				)}

				{!hasAnyContent && (
					<div className="timeline-empty">
						<p>Select a button to start editing</p>
					</div>
				)}

				{selectedTracks.length === 0 && selectedControl && (
					<div className="timeline-empty">
						<p>No tracks — double-click to add an action</p>
					</div>
				)}

				<div className="timeline-footer">
					<span>
						scroll ↕ tracks · shift-scroll / swipe ↔ time · ⌘ scroll to zoom · double-click to add · right-click for
						options · ⌘Z undo
					</span>
					<span>
						{msToLabel(scrollMs)} – {msToLabel(scrollMs + visibleMs)}
					</span>
				</div>
			</div>

			{contextMenu && (
				<div
					className="timeline-context-menu"
					style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<button
						className="context-menu-item context-menu-item--danger"
						onClick={() => {
							onActionDelete(contextMenu.stepKey, contextMenu.triggerKey, contextMenu.actionId)
							setContextMenu(null)
						}}
					>
						Delete action
					</button>
				</div>
			)}
		</div>
	)
}
