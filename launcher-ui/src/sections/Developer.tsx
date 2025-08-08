import React, { useState, useEffect } from 'react'
import { useConfig } from '~/hooks/useConfig'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function DeveloperSection(): JSX.Element {
	const { state, updateConfig } = useConfig()

	// Assume data is available since loading/error states are handled elsewhere
	const { config } = state.data!

	// Local state for form inputs
	const [enableDeveloper, setEnableDeveloper] = useState(config.enable_developer)
	const [devModulesPath, setDevModulesPath] = useState(config.dev_modules_path || '')

	// Update local state when config changes
	useEffect(() => {
		setEnableDeveloper(config.enable_developer)
		setDevModulesPath(config.dev_modules_path || '')
	}, [config.enable_developer, config.dev_modules_path])

	// Handle changes and update config
	const handleEnableDeveloperChange = (checked: boolean) => {
		setEnableDeveloper(checked)
		updateConfig({ enable_developer: checked })
	}

	const handleDevModulesPathChange = (value: string) => {
		setDevModulesPath(value)
	}

	const handleDevModulesPathBlur = () => {
		updateConfig({ dev_modules_path: devModulesPath })
	}

	return (
		<div className="space-y-6">
			<div>
				<p className="text-muted-foreground mb-6">
					Advanced settings and tools for developers working with Companion modules.
				</p>

				<div className="space-y-4">
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="enable-developer">Enable Developer Mode</Label>
						<div className="flex items-center col-span-3 ">
							<input
								type="checkbox"
								id="enable-developer"
								checked={enableDeveloper}
								onChange={(e) => handleEnableDeveloperChange(e.target.checked)}
								className="rounded"
							/>
						</div>

						<Label htmlFor="dev-modules-path">Developer Modules Path</Label>
						<div className="col-span-3">
							<Input
								id="dev-modules-path"
								type="text"
								value={devModulesPath}
								onChange={(e) => handleDevModulesPathChange(e.target.value)}
								onBlur={handleDevModulesPathBlur}
								placeholder="Path to local modules directory"
							/>
							<p className="text-sm text-muted-foreground mt-1">Path to local modules for development and testing</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
