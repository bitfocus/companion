import React from 'react'
import { useConfig } from '~/hooks/useConfig'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { LoadingSpinner } from '~/components/ui/loading-spinner'

export function DeveloperSection(): JSX.Element {
	const { state } = useConfig()

	if (state.isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<LoadingSpinner size="md" />
			</div>
		)
	}

	if (state.error) {
		return (
			<div className="text-center py-8">
				<p className="text-red-600 mb-2">Error loading configuration</p>
				<p className="text-muted-foreground text-sm">{state.error}</p>
			</div>
		)
	}

	if (!state.data) {
		return <div>No configuration data available</div>
	}

	const { config } = state.data

	return (
		<div className="space-y-6">
			<div>
				<p className="text-muted-foreground mb-6">
					Advanced settings and tools for developers working with Companion modules.
				</p>

				<div className="space-y-4">
					<div className="flex items-center space-x-2">
						<input
							type="checkbox"
							id="enable-developer"
							checked={config.enable_developer}
							readOnly
							className="rounded"
						/>
						<Label htmlFor="enable-developer">Enable Developer Mode</Label>
					</div>

					{config.enable_developer && (
						<div>
							<Label htmlFor="dev-modules-path">Developer Modules Path</Label>
							<Input
								id="dev-modules-path"
								type="text"
								value={config.dev_modules_path || ''}
								readOnly
								className="bg-muted"
								placeholder="No path set"
							/>
							<p className="text-sm text-muted-foreground mt-1">Path to local modules for development and testing</p>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
