import { RotateCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import { LoadingSpinner } from '~/components/ui/loading-spinner'
import { ConfigProvider } from './contexts/ConfigContext'
import { useConfig } from './hooks/useConfig'
import { SectionDefinitions, type SectionDefinition } from './Sections'

function SettingsSection({ section }: { section: SectionDefinition }): React.JSX.Element {
	const SectionComponent = section.component

	return (
		<section id={section.id} className="settings-section">
			<h2 className="settings-section-title">{section.title}</h2>
			<SectionComponent />
		</section>
	)
}

function SettingsContent(): React.JSX.Element {
	const { state } = useConfig()

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
		<div className="settings-content">
			<Alert variant="warning">
				<RotateCw />
				<AlertTitle>
					Changed settings are saved immediately, and Companion restarts when needed to apply them
				</AlertTitle>
				<AlertDescription>This may disconnect your surfaces and connections.</AlertDescription>
			</Alert>
			{SectionDefinitions.map((section) => (
				<SettingsSection key={section.id} section={section} />
			))}
		</div>
	)
}

export function Settings(): React.JSX.Element {
	return (
		<ConfigProvider>
			<main className="settings-window">
				<SettingsContent />
			</main>
		</ConfigProvider>
	)
}
