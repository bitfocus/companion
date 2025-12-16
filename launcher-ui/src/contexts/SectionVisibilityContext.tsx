import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface SectionVisibilityContextType {
	visibleSections: Set<string>
	addVisibleSection: (sectionId: string) => void
	removeVisibleSection: (sectionId: string) => void
	activeSectionId: string | null
	setSectionOrder: (order: string[]) => void
}

const SectionVisibilityContext = createContext<SectionVisibilityContextType | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useSectionVisibility(): SectionVisibilityContextType {
	const context = useContext(SectionVisibilityContext)
	if (!context) {
		throw new Error('useSectionVisibility must be used within a SectionVisibilityProvider')
	}
	return context
}

interface SectionVisibilityProviderProps {
	children: ReactNode
}

export function SectionVisibilityProvider({ children }: SectionVisibilityProviderProps): JSX.Element {
	const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
	const [sectionOrder, setSectionOrder] = useState<string[]>([])

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

	const setSectionOrderCallback = useCallback((order: string[]) => {
		setSectionOrder(order)
	}, [])

	// Get the active section based on visible sections and their order
	const activeSectionId = React.useMemo(() => {
		if (visibleSections.size === 0) {
			// If no sections are visible, determine which one should be active based on scroll position
			// For now, we'll return the first section as a fallback
			return sectionOrder.length > 0 ? sectionOrder[0] : null
		}

		// Find the first visible section in document order
		for (const sectionId of sectionOrder) {
			if (visibleSections.has(sectionId)) {
				return sectionId
			}
		}

		// Fallback to first visible section
		return Array.from(visibleSections)[0] || null
	}, [visibleSections, sectionOrder])

	const value = {
		visibleSections,
		addVisibleSection,
		removeVisibleSection,
		activeSectionId,
		setSectionOrder: setSectionOrderCallback,
	}

	return <SectionVisibilityContext.Provider value={value}>{children}</SectionVisibilityContext.Provider>
}
