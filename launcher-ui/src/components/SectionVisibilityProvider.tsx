import React, { useState, useCallback, ReactNode } from 'react'
import { SectionVisibilityContext } from '../contexts/SectionVisibilityContext'

interface SectionVisibilityProviderProps {
	children: ReactNode
}

export function SectionVisibilityProvider({ children }: SectionVisibilityProviderProps): JSX.Element {
	const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())

	const addVisibleSection = useCallback((sectionId: string) => {
		setVisibleSections((prev) => new Set([...prev, sectionId]))
	}, [])

	const removeVisibleSection = useCallback((sectionId: string) => {
		setVisibleSections((prev) => {
			const newSet = new Set(prev)
			newSet.delete(sectionId)
			return newSet
		})
	}, [])

	// Get the first visible section as the active one (topmost visible section)
	const activeSectionId = visibleSections.size > 0 ? Array.from(visibleSections)[0] : null

	const value = {
		visibleSections,
		addVisibleSection,
		removeVisibleSection,
		activeSectionId,
	}

	return <SectionVisibilityContext.Provider value={value}>{children}</SectionVisibilityContext.Provider>
}
