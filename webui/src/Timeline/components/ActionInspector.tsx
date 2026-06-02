import React, { useCallback, useState } from 'react'
import { triggerLabel, type CompanionAction, type CompanionInstance, type TriggerKey } from '../types.js'

// Render an option value (which may be any JSON value) as editable text.
function optionToString(val: unknown): string {
	if (val == null) return ''
	if (typeof val === 'string') return val
	if (typeof val === 'number' || typeof val === 'boolean') return val.toString()
	return JSON.stringify(val)
}

interface Props {
	action: CompanionAction
	triggerKey: TriggerKey
	stepKey: string
	instances: Record<string, CompanionInstance>
	knownActionIds: string[]
	waitAfterMs: number | null // null = no next action; ≥0 = current gap to next
	onChange: (updated: CompanionAction) => void
	onSetWaitAfter: (ms: number) => void
	onAddActionAfter: (delayMs: number) => void
	onDelete: () => void
	onSyncOptionToAll?: (key: string, value: unknown) => void
}

export default function ActionInspector({
	action,
	triggerKey,
	stepKey,
	instances,
	knownActionIds,
	waitAfterMs,
	onChange,
	onSetWaitAfter,
	onAddActionAfter,
	onDelete,
	onSyncOptionToAll,
}: Props): React.JSX.Element {
	const handleField = useCallback(
		(field: keyof CompanionAction, value: unknown) => onChange({ ...action, [field]: value }),
		[action, onChange]
	)

	const handleDelay = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const v = parseInt(e.target.value)
			if (!isNaN(v) && v >= 0) handleField('delay', v)
		},
		[handleField]
	)

	const handleOption = useCallback(
		(key: string, raw: string) => {
			const num = Number(raw)
			const value = raw === '' ? '' : isNaN(num) ? raw : num
			onChange({ ...action, options: { ...action.options, [key]: value } })
		},
		[action, onChange]
	)

	const [newOptKey, setNewOptKey] = useState('')

	const commitNewOption = useCallback(() => {
		const key = newOptKey.trim()
		if (!key) return
		setNewOptKey('')
		onChange({ ...action, options: { ...action.options, [key]: '' } })
	}, [newOptKey, action, onChange])

	const removeOption = useCallback(
		(key: string) => {
			const opts = { ...action.options }
			delete opts[key]
			onChange({ ...action, options: opts })
		},
		[action, onChange]
	)

	const [waitInput, setWaitInput] = useState<string>(waitAfterMs != null && waitAfterMs > 0 ? String(waitAfterMs) : '')

	// Reset input when the selected action changes
	const prevActionId = React.useRef(action.id)
	if (action.id !== prevActionId.current) {
		prevActionId.current = action.id
		// Sync waitInput to the new action's current gap
		const next = waitAfterMs != null && waitAfterMs > 0 ? String(waitAfterMs) : ''
		if (waitInput !== next) setWaitInput(next)
	}

	const handleWaitApply = useCallback(() => {
		const ms = parseInt(waitInput)
		if (!isNaN(ms) && ms >= 0) onSetWaitAfter(ms)
	}, [waitInput, onSetWaitAfter])

	const handleAddAfter = useCallback(() => {
		const ms = parseInt(waitInput) || 500
		onAddActionAfter(ms)
	}, [waitInput, onAddActionAfter])

	const actionSuggestions = knownActionIds

	const listId = `action-list-${action.id}`

	return (
		<div className="inspector">
			<div className="inspector-header">
				<span className="inspector-title">Action</span>
				<button className="inspector-delete" onClick={onDelete} title="Delete action">
					✕
				</button>
			</div>

			{/* Instance picker */}
			<div className="inspector-section">
				<div className="inspector-section-title">Connection</div>
				<div className="inspector-row">
					<label>Instance</label>
					<div className="inspector-input-row">
						<select
							className="inspector-input inspector-select"
							value={action.instance}
							onChange={(e) => handleField('instance', e.target.value)}
						>
							{!action.instance && <option value="">— pick instance —</option>}
							{Object.entries(instances).map(([id, inst]) => (
								<option key={id} value={id}>
									{inst.label} ({inst.instance_type})
								</option>
							))}
							{action.instance && !instances[action.instance] && (
								<option value={action.instance}>{action.instance} (unknown)</option>
							)}
						</select>
					</div>
				</div>

				{/* Action definition picker */}
				<div className="inspector-row">
					<label>Action ID</label>
					<input
						list={listId}
						className="inspector-input"
						value={action.action}
						placeholder="e.g. go, pause, play"
						onChange={(e) => handleField('action', e.target.value)}
					/>
					<datalist id={listId}>
						{actionSuggestions.map((id) => (
							<option key={id} value={id} />
						))}
					</datalist>
					<div className="inspector-hint">
						Trigger: {triggerLabel(triggerKey)} · Step {parseInt(stepKey) + 1}
					</div>
				</div>
			</div>

			{/* Timing */}
			<div className="inspector-section">
				<div className="inspector-section-title">Timing</div>
				<div className="inspector-row">
					<label>Delay (ms)</label>
					<input
						type="number"
						min={0}
						step={10}
						value={action.delay}
						onChange={handleDelay}
						className="inspector-input"
					/>
				</div>
			</div>

			{/* Wait After */}
			<div className="inspector-section">
				<div className="inspector-section-title">Wait After</div>
				{waitAfterMs === null ? (
					<div className="inspector-row">
						<label>Add after (ms)</label>
						<div className="inspector-input-row">
							<input
								type="number"
								min={0}
								step={50}
								className="inspector-input"
								placeholder="500"
								value={waitInput}
								onChange={(e) => setWaitInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleAddAfter()
								}}
							/>
							<button
								className="modal-btn modal-btn--primary"
								style={{ padding: '4px 10px', fontSize: 12 }}
								onClick={handleAddAfter}
							>
								Add
							</button>
						</div>
					</div>
				) : (
					<>
						{waitAfterMs > 0 && (
							<div className="inspector-row">
								<label>Current gap</label>
								<span className="inspector-value muted">{waitAfterMs}ms</span>
							</div>
						)}
						<div className="inspector-row">
							<label>Set wait (ms)</label>
							<div className="inspector-input-row">
								<input
									type="number"
									min={0}
									step={50}
									className="inspector-input"
									placeholder={waitAfterMs > 0 ? String(waitAfterMs) : '0'}
									value={waitInput}
									onChange={(e) => setWaitInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') handleWaitApply()
									}}
								/>
								<button
									className="modal-btn modal-btn--primary"
									style={{ padding: '4px 10px', fontSize: 12 }}
									onClick={handleWaitApply}
								>
									{waitAfterMs > 0 ? 'Update' : 'Add'}
								</button>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Options */}
			<div className="inspector-section">
				<div className="inspector-section-title-row">
					<span className="inspector-section-title">Options</span>
				</div>
				{Object.entries(action.options).map(([key, val]) => (
					<div key={key} className="inspector-row inspector-option-row">
						<div className="inspector-option-key">
							<span className="inspector-opt-label">{key}</span>
							<button className="inspector-remove-opt" onClick={() => removeOption(key)} title="Remove">
								×
							</button>
						</div>
						<div className="inspector-input-row">
							<input
								className="inspector-input"
								value={optionToString(val)}
								onChange={(e) => handleOption(key, e.target.value)}
							/>
							{onSyncOptionToAll && (
								<button
									className="inspector-sync-opt"
									title={`Apply ${key} = ${val} to all "${action.action}" actions on this button`}
									onClick={() => onSyncOptionToAll(key, val)}
								>
									≡
								</button>
							)}
						</div>
					</div>
				))}
				<div className="inspector-row inspector-option-add-row">
					<input
						className="inspector-input"
						placeholder="New option key…"
						value={newOptKey}
						onChange={(e) => setNewOptKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') commitNewOption()
						}}
					/>
					<button
						className="modal-btn modal-btn--primary"
						style={{ padding: '4px 10px', fontSize: 12 }}
						onClick={commitNewOption}
					>
						Add
					</button>
				</div>
			</div>
		</div>
	)
}
