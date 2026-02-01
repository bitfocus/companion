import React, { useEffect } from 'react'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar.js'
import { LoadingSpinner } from '~/components/ui/loading-spinner'
import { AppSidebar } from './AppSidebar'
import { SectionDefinitions, type SectionDefinition } from './Sections'
import { SectionVisibilityProvider, useSectionVisibility } from './contexts/SectionVisibilityContext'
import { ConfigProvider } from './contexts/ConfigContext'
import { useConfig } from './hooks/useConfig'
import { useSectionVisibilityObserver } from './hooks/useSectionVisibilityObserver'
import { cn } from './lib/utils'

function SectionWithObserver({ section, isLast }: { section: SectionDefinition; isLast: boolean }): JSX.Element {
	const SectionComponent = section.component
	const sectionRef = useSectionVisibilityObserver({ sectionId: section.id })

	return (
		<div id={section.id} ref={sectionRef} className={cn('py-4', isLast ? 'min-h-screen' : '')}>
			<h2 className="text-xl font-semibold">{section.title}</h2>
			<SectionComponent />
			{!isLast && <hr className="mt-4 mb-[10vh]" />}
		</div>
	)
}

function SettingsContent(): JSX.Element {
	const { setSectionOrder } = useSectionVisibility()
	const { state } = useConfig()

	useEffect(() => {
		// Set the section order when component mounts
		const order = SectionDefinitions.map((section) => section.id)
		setSectionOrder(order)
	}, [setSectionOrder])

	if (state.isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<div className="flex items-center justify-center">
						<LoadingSpinner className="mb-4 h-12 w-12" />
					</div>
					<p className="text-muted-foreground">Loading configuration...</p>
				</div>
			</div>
		)
	}

	if (state.error) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<p className="text-red-600 mb-2">Error loading configuration</p>
					<p className="text-muted-foreground text-sm">{state.error}</p>
				</div>
			</div>
		)
	}

	// Ensure data is available before rendering sections
	if (!state.data) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">No configuration data available</p>
				</div>
			</div>
		)
	}

	return (
		<>
			{/* <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
					<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
					Something
				</header> */}
			<div className="flex flex-1 flex-col gap-4 px-4">
				{/* <div className="grid auto-rows-min gap-4 md:grid-cols-3">
						<div className="bg-muted/50 aspect-video rounded-xl" />
						<div className="bg-muted/50 aspect-video rounded-xl" />
						<div className="bg-muted/50 aspect-video rounded-xl" />
					</div>
					<div className="bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min" /> */}
				{SectionDefinitions.map((section, i, arr) => (
					<React.Fragment key={section.id}>
						<SectionWithObserver section={section} isLast={arr.length === i + 1} />
						{/* {arr.length > i + 1 ? <hr className="mb-[10vh]" /> : <div className="mb-[20vh]" />} */}
					</React.Fragment>
				))}
			</div>
		</>
	)
}

export function Settings(): JSX.Element {
	return (
		<ConfigProvider>
			<SectionVisibilityProvider>
				<SidebarProvider>
					<AppSidebar />
					<SidebarInset>
						<SettingsContent />
					</SidebarInset>
				</SidebarProvider>
			</SectionVisibilityProvider>
		</ConfigProvider>
	)
}
