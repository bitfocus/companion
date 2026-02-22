import React, { useState, useEffect } from 'react'
import { useConfig } from '~/hooks/useConfig'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Info } from 'lucide-react'

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

	const handleSelectModulesPath = () => {
		if (window.api) {
			window.api.send('pick-developer-modules-path')
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<p className="text-muted-foreground mb-4 text-sm">Configure Companion to enable module development</p>
				<Alert className="mb-6">
					<Info className="h-4 w-4" />
					<AlertDescription className="leading-relaxed">
						<p>
							New to module development? Check out the{' '}
							<a
								href="https://companion.free/for-developers/module-development/module-development-101"
								target="_blank"
								className="text-blue-600 hover:text-blue-800 underline bg-transparent border-none p-0 cursor-pointer"
							>
								Module Development website
							</a>{' '}
							for guides and documentation.
						</p>
					</AlertDescription>
				</Alert>

				<div className="space-y-4">
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="enable-developer">Enable Developer Modules</Label>
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
							<div className="flex">
								<Input
									id="dev-modules-path"
									type="text"
									value={devModulesPath}
									onChange={(e) => handleDevModulesPathChange(e.target.value)}
									onBlur={handleDevModulesPathBlur}
									placeholder="Path to local modules directory"
									className="flex-1 rounded-r-none"
								/>
								<Button
									variant="outline"
									onClick={handleSelectModulesPath}
									className="rounded-l-none px-3 shrink-0 h-9"
								>
									Select
								</Button>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								Path to local modules. This will be watched for changes, and modules will be automatically restarted for
								you
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
