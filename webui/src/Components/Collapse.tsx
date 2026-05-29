/* eslint-disable react-refresh/only-export-components */
import { Collapsible } from '@base-ui/react/collapsible'
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

function CollapseRoot({ className, ...props }: CollapseRootProps): JSX.Element {
	return <Collapsible.Root className={classNames('collapse2-root', className)} {...props} />
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface CollapseTriggerProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'className'> {
	className?: string
	children?: React.ReactNode
}

function CollapseTrigger({ className, ...props }: CollapseTriggerProps): JSX.Element {
	return <Collapsible.Trigger className={classNames('collapse2-trigger', className)} {...props} />
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface CollapsePanelProps extends Pick<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
	children?: React.ReactNode
	keepMounted?: boolean
}

function CollapsePanel({ className, keepMounted, ...props }: CollapsePanelProps): JSX.Element {
	return <Collapsible.Panel keepMounted={keepMounted} className={classNames('collapse2-panel', className)} {...props} />
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const Collapse = {
	Root: CollapseRoot,
	Trigger: CollapseTrigger,
	Panel: CollapsePanel,
}
