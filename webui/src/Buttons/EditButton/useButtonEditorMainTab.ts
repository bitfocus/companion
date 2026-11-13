import { useEffect, useMemo } from 'react'
import { GetStepIds } from '@companion-app/shared/Controls.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'

export interface ButtonEditorExtraTabs {
	id: string
	name: string
	position: 'start' | 'end'
}

export interface ButtonEditorMainTab {
	id: string
	name: string
	count?: number
}

export interface ButtonEditorMainTabState {
	tabs: ButtonEditorMainTab[]
	activeTab: string
	setActiveTab: (tab: string) => void
}

/** The editor's top level tabs: Actions plus the extra tabs */
export function useButtonEditorTabs(
	steps: NormalButtonSteps,
	extraTabs: ButtonEditorExtraTabs[]
): ButtonEditorMainTab[] {
	const stepCount = GetStepIds(steps).length

	return useMemo(() => {
		return [
			...extraTabs.filter((tab) => tab.position === 'start').map((tab) => ({ id: tab.id, name: tab.name })),
			{ id: 'actions', name: 'Actions', count: stepCount > 1 ? stepCount : undefined },
			...extraTabs.filter((tab) => tab.position === 'end').map((tab) => ({ id: tab.id, name: tab.name })),
		]
	}, [stepCount, extraTabs])
}

/** The editor's top level tabs, with the selected one remembered by the browser */
export function useButtonEditorMainTab(
	steps: NormalButtonSteps,
	extraTabs: ButtonEditorExtraTabs[]
): ButtonEditorMainTabState {
	const tabs = useButtonEditorTabs(steps, extraTabs)

	const [activeTab, setActiveTab] = useLocalStorage('buttonEditor.activeMainTab', 'actions')

	// Fallback to 'actions' if selected tab is invalid
	useEffect(() => {
		if (!tabs.some((t) => t.id === activeTab)) {
			setActiveTab('actions')
		}
	}, [tabs, activeTab, setActiveTab])

	return { tabs, activeTab, setActiveTab }
}

/** The tabs a regular (layered) button has besides Actions */
export const LayeredButtonExtraTabs: ButtonEditorExtraTabs[] = [
	{ id: 'style', name: 'Style', position: 'end' },
	{ id: 'feedbacks', name: 'Feedbacks', position: 'end' },
	{ id: 'variables', name: 'Local Variables', position: 'end' },
	{ id: 'options', name: 'Options', position: 'end' },
]
