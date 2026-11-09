import { Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { useConfig } from '~/hooks/useConfig'
import { SettingsCard, SettingsRow } from './SettingsCard'

export function DeveloperSection(): React.JSX.Element {
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

	// Saved when it loses focus, and only when changed, as each change restarts Companion
	const handleDevModulesPathBlur = () => {
		if (devModulesPath !== (config.dev_modules_path || '')) updateConfig({ dev_modules_path: devModulesPath })
	}

	const handleSelectModulesPath = () => {
		if (window.api) {
			window.api.send('pick-developer-modules-path')
		}
	}

	return (
		<>
			<p className="text-muted-foreground text-sm">Configure Companion to enable module development</p>
			<Alert>
				<Info className="h-4 w-4" />
				<AlertDescription className="leading-relaxed">
					<p>
						New to module development? Check out the{' '}
						<a
							href="https://companion.free/for-developers/module-development/module-development-101"
							target="_blank"
							className="text-brand hover:text-brand-hover whitespace-nowrap underline"
						>
							Module Development website
						</a>{' '}
						for guides and documentation.
					</p>
				</AlertDescription>
			</Alert>

			<SettingsCard>
				<SettingsRow label="Developer modules" htmlFor="enable-developer" help={null}>
					<Switch
						id="enable-developer"
						checked={enableDeveloper}
						onCheckedChange={(checked: boolean) => handleEnableDeveloperChange(checked)}
					/>
				</SettingsRow>
				<SettingsRow
					label="Modules path"
					htmlFor="dev-modules-path"
					help="Path to local modules. This will be watched for changes, and modules will be automatically restarted for you"
				>
					<Input
						id="dev-modules-path"
						type="text"
						value={devModulesPath}
						onChange={(e) => handleDevModulesPathChange(e.target.value)}
						onBlur={handleDevModulesPathBlur}
						placeholder="Path to local modules directory"
					/>
					<Button variant="outline" onClick={handleSelectModulesPath}>
						Select
					</Button>
				</SettingsRow>
			</SettingsCard>
		</>
	)
}
