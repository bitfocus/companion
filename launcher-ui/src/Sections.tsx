import React from 'react'
import { DeveloperSection } from './sections/Developer'

export interface SectionDefinition {
	title: string
	id: string
	component: React.ComponentType
}

export const SectionDefinitions: SectionDefinition[] = [
	{
		title: 'Developer',
		id: 'developer',
		component: DeveloperSection,
	},
	{
		title: 'Developer',
		id: 'developer2',
		component: DeveloperSection,
	},
	{
		title: 'Developer',
		id: 'developer3',
		component: DeveloperSection,
	},
	{
		title: 'Developer',
		id: 'developer4',
		component: DeveloperSection,
	},
]
