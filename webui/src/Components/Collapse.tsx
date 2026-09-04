/* eslint-disable react-refresh/only-export-components */
import { Collapsible } from '@base-ui/react/collapsible'
import './Collapse.css'
import classNames from 'classnames'
import type { HTMLAttributes } from 'react'

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface CollapseRootProps {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	disabled?: boolean
	children?: React.ReactNode
	className?: string
}

function CollapseRoot({ className, ...props }: CollapseRootProps): React.JSX.Element {
	return <Collapsible.Root className={classNames('collapse2-root', className)} {...props} />
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface CollapseTriggerProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'className'> {
	className?: string
	children?: React.ReactNode
}

function CollapseTrigger({ className, ...props }: CollapseTriggerProps): React.JSX.Element {
	return <Collapsible.Trigger className={classNames('collapse2-trigger', className)} {...props} />
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface CollapsePanelProps extends Pick<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
	children?: React.ReactNode
	keepMounted?: boolean
	/** Lay the panel out as a grid row, so its own `Grid.Col` children don't need a `Grid.Row`. */
	row?: boolean
}

function CollapsePanel({ className, keepMounted, row, ...props }: CollapsePanelProps): React.JSX.Element {
	return (
		<Collapsible.Panel
			keepMounted={keepMounted}
			className={classNames('collapse2-panel', row && 'row', className)}
			{...props}
		/>
	)
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Collapse = {
	Root: CollapseRoot,
	Trigger: CollapseTrigger,
	Panel: CollapsePanel,
}
