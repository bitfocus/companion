/* eslint-disable react-refresh/only-export-components */
import { Tabs } from '@base-ui/react/tabs'
import classNames from 'classnames'

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface TabAreaRootProps extends Omit<Tabs.Root.Props, 'className'> {
	className?: string
}

function TabAreaRoot({ className, ...props }: TabAreaRootProps): JSX.Element {
	return <Tabs.Root className={classNames('tab-area', className)} {...props} />
}

// ─── List ─────────────────────────────────────────────────────────────────────

export interface TabAreaListProps extends Omit<Tabs.List.Props, 'className'> {
	className?: string
}

function TabAreaList({ className, ...props }: TabAreaListProps): JSX.Element {
	return <Tabs.List className={classNames('tab-bar', className)} {...props} />
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

export interface TabAreaTabProps extends Omit<Tabs.Tab.Props, 'className'> {
	className?: string
}

function TabAreaTab({ className, ...props }: TabAreaTabProps): JSX.Element {
	return <Tabs.Tab className={classNames('tab-bar__tab', className)} {...props} />
}

// ─── Indicator ────────────────────────────────────────────────────────────────

export interface TabAreaIndicatorProps extends Omit<Tabs.Indicator.Props, 'className'> {
	className?: string
}

function TabAreaIndicator({ className, ...props }: TabAreaIndicatorProps): JSX.Element {
	return <Tabs.Indicator className={classNames('tab-bar__indicator', className)} {...props} />
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface TabAreaPanelProps extends Omit<Tabs.Panel.Props, 'className'> {
	className?: string
}

function TabAreaPanel({ className, ...props }: TabAreaPanelProps): JSX.Element {
	return <Tabs.Panel className={classNames('tab-panel', className)} {...props} />
}

// ─── Namespace export ─────────────────────────────────────────────────────────

export const TabArea = {
	Root: TabAreaRoot,
	List: TabAreaList,
	Tab: TabAreaTab,
	Indicator: TabAreaIndicator,
	Panel: TabAreaPanel,
}
