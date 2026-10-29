/* eslint-disable react-refresh/only-export-components */
import { faChevronDown, faPencil, faSort, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { Button } from './Button.js'
import { DuplicateIcon } from './DuplicateIcon.js'
import { SwitchInputField } from './SwitchInputField.js'
import { TextInputFieldSimple } from './TextInputField.js'

/*
 * A row of a list of things which are edited in place, such as the actions of a control, the events of a trigger or
 * the inputs of a custom action: a handle to reorder it, a header saying what it is with buttons to change it, and
 * what it is edited with below, which can be collapsed. It is styled by `Controls/Components/EntityList.css`.
 */

interface RootProps {
	rowRef: (element: Element | null) => void
	dragRef: (element: Element | null) => void
	/** Show the row as disabled */
	disabled: boolean
	isDragging: boolean
}

function Root({
	rowRef,
	dragRef,
	disabled,
	isDragging,
	children,
}: React.PropsWithChildren<RootProps>): React.JSX.Element {
	return (
		<div
			ref={rowRef}
			className={classNames('entity-row', { 'entity-disabled': disabled, 'entity-row-grabbing': isDragging })}
		>
			<div ref={dragRef} className="entity-row-reorder">
				<FontAwesomeIcon icon={faSort} />
			</div>
			<div className="entity-row-content">{children}</div>
		</div>
	)
}

interface HeaderProps {
	/** Toggle whether the row is collapsed when what it is gets clicked, or null when it can't be collapsed */
	onToggleCollapsed: (() => void) | null
	/** The buttons, at the end of the header */
	controls: React.ReactNode
}

/** The header of a row: what it is, then `controls` */
function Header({ onToggleCollapsed, controls, children }: React.PropsWithChildren<HeaderProps>): React.JSX.Element {
	return (
		<div className="editor-grid-header flex items-center justify-between gap-3">
			<div
				className={classNames('flex items-center gap-2.5 flex-1 min-w-0 select-none py-0.5', {
					'cursor-pointer': !!onToggleCollapsed,
				})}
				onClick={(e) => {
					// Don't toggle when something in the header is being used
					if ((e.target as HTMLElement).closest('input, textarea, button')) return
					onToggleCollapsed?.()
				}}
			>
				{children}
			</div>

			<div className="cell-controls flex items-center gap-0.5 shrink-0">{controls}</div>
		</div>
	)
}

interface BadgeProps {
	children: string
}

/** A badge at the start of a header, such as the connection of an action */
function Badge({ children }: BadgeProps): React.JSX.Element {
	return (
		<span
			className="px-1.5 py-0.5 rounded text-3xs font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20 shrink-0 truncate cell-connection-label"
			title={children}
		>
			{children}
		</span>
	)
}

interface TitleProps {
	children: string
	/** A collapsed row is kept to one line */
	isCollapsed: boolean
}

/** The name of what a row is */
function Title({ children, isCollapsed }: TitleProps): React.JSX.Element {
	return (
		<span
			className={classNames('font-semibold text-xs text-body leading-tight', {
				truncate: isCollapsed,
				'whitespace-normal break-words': !isCollapsed,
			})}
			title={children}
		>
			{children}
		</span>
	)
}

interface HeadlineProps {
	headline: string | undefined
	/** Change the headline, or null when it can't be changed */
	setHeadline: ((headline: string) => void) | null
	/** Whether the headline is being edited, started by a `NoteButton` or by clicking the headline */
	editing: boolean
	setEditing: (editing: boolean) => void
	placeholder: string
	/** A collapsed row is kept to one line, and its headline can't be edited */
	isCollapsed: boolean
	readonly: boolean
}

/** A note describing what a row is for, shown below its title, which can be edited in place */
function Headline({
	headline,
	setHeadline,
	editing,
	setEditing,
	placeholder,
	isCollapsed,
	readonly,
}: HeadlineProps): React.JSX.Element | null {
	if (editing && !isCollapsed && setHeadline) {
		return (
			<div className="px-0.5 py-0.5">
				<TextInputFieldSimple
					id={undefined}
					value={headline ?? ''}
					placeholder={placeholder}
					setValue={setHeadline}
					autoFocus
					onBlur={() => setEditing(false)}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
					}}
				/>
			</div>
		)
	}

	if (!headline) return null

	return (
		<Button
			variant="inline"
			disabled={readonly || isCollapsed || !setHeadline}
			onClick={() => setEditing(true)}
			className={classNames(
				'w-fit max-w-full leading-snug p-0 text-left text-3xs font-normal text-action-text hover:text-body disabled:hover:text-action-text disabled:cursor-default disabled:pointer-events-auto',
				{ truncate: isCollapsed, 'whitespace-normal break-words': !isCollapsed }
			)}
			title={isCollapsed ? headline : `Edit note: ${headline}`}
		>
			{headline}
		</Button>
	)
}

interface ControlButtonProps {
	/** What the row is, such as `action`, for the titles */
	itemLabel: string
	disabled: boolean
	onClick: () => void
}

function NoteButton({
	itemLabel,
	hasNote,
	disabled,
	onClick,
}: ControlButtonProps & { hasNote: boolean }): React.JSX.Element {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="p-1.5"
			disabled={disabled}
			onClick={onClick}
			title={hasNote ? 'Edit note' : `Add note to ${itemLabel}`}
		>
			<FontAwesomeIcon icon={faPencil} className="text-xs" />
		</Button>
	)
}

function DuplicateButton({ itemLabel, disabled, onClick }: ControlButtonProps): React.JSX.Element {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="p-1.5"
			disabled={disabled}
			onClick={onClick}
			title={`Duplicate ${itemLabel}`}
		>
			<DuplicateIcon />
		</Button>
	)
}

function RemoveButton({ itemLabel, disabled, onClick }: ControlButtonProps): React.JSX.Element {
	return (
		<Button
			variant="ghost"
			size="sm"
			color="danger"
			className="p-1.5"
			disabled={disabled}
			onClick={onClick}
			title={`Remove ${itemLabel}`}
		>
			<FontAwesomeIcon icon={faTrash} className="text-xs" />
		</Button>
	)
}

interface EnabledSwitchProps {
	itemLabel: string
	enabled: boolean
	setEnabled: (enabled: boolean) => void
}

function EnabledSwitch({ itemLabel, enabled, setEnabled }: EnabledSwitchProps): React.JSX.Element {
	return (
		<div className="ms-1.5 me-1 flex items-center">
			<SwitchInputField
				id={undefined}
				value={enabled}
				tooltip={enabled ? `Disable ${itemLabel}` : `Enable ${itemLabel}`}
				setValue={setEnabled}
				small
			/>
		</div>
	)
}

interface CollapseButtonProps {
	itemLabel: string
	isCollapsed: boolean
	onClick: () => void
}

function CollapseButton({ itemLabel, isCollapsed, onClick }: CollapseButtonProps): React.JSX.Element {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="p-1.5"
			onClick={onClick}
			title={isCollapsed ? `Expand ${itemLabel}` : `Collapse ${itemLabel}`}
		>
			<FontAwesomeIcon
				icon={faChevronDown}
				className={classNames('text-xs transition-transform duration-200', {
					'-rotate-90': isCollapsed,
					'rotate-0': !isCollapsed,
				})}
			/>
		</Button>
	)
}

export const EditorRow = {
	Root,
	Header,
	Badge,
	Title,
	Headline,
	NoteButton,
	DuplicateButton,
	RemoveButton,
	EnabledSwitch,
	CollapseButton,
}
