import React from 'react'
import { DeveloperSection } from './sections/Developer'
import { GeneralSection } from './sections/General'

export interface SectionDefinition {
	title: string
	id: string
	component: React.ComponentType
}

export const SectionDefinitions: SectionDefinition[] = [
	{
		title: 'General',
		id: 'general',
		component: GeneralSection,
	},
	{
		title: 'Developer',
		id: 'developer',
		component: DeveloperSection,
	},
]
