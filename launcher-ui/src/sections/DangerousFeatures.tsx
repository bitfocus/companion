import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { useConfig } from '~/hooks/useConfig'
import { SettingsCard, SettingsRow } from './SettingsCard'

export function DangerousFeaturesSection(): React.JSX.Element {
	const { state, updateConfig } = useConfig()

	// Assume data is available since loading/error states are handled elsewhere
	const { config } = state.data!

	// Local state for form inputs
	const [enableShellCommandSupport, setEnableShellCommandSupport] = useState(config.enable_shell_command_support)
	const [enableRestrictedModules, setEnableRestrictedModules] = useState(config.enable_restricted_modules)
	const [trustedProxies, setTrustedProxies] = useState(config.trusted_proxies || '')

	// Update local state when config changes
	useEffect(() => {
		setEnableShellCommandSupport(config.enable_shell_command_support)
		setEnableRestrictedModules(config.enable_restricted_modules)
		setTrustedProxies(config.trusted_proxies || '')
	}, [config.enable_shell_command_support, config.enable_restricted_modules, config.trusted_proxies])

	const handleEnableShellCommandSupportChange = (checked: boolean) => {
		setEnableShellCommandSupport(checked)
		updateConfig({ enable_shell_command_support: checked })
	}

	const handleEnableRestrictedModulesChange = (checked: boolean) => {
		setEnableRestrictedModules(checked)
		updateConfig({ enable_restricted_modules: checked })
	}

	// Saved when it loses focus, and only when changed, as each change restarts Companion
	const handleTrustedProxiesBlur = () => {
		if (trustedProxies !== (config.trusted_proxies || '')) updateConfig({ trusted_proxies: trustedProxies })
	}

	return (
		<>
			<p className="text-muted-foreground text-sm">
				These features allow code to run on this computer. They are disabled by default and should only be enabled if
				you understand and accept the risk - especially if Companion is reachable over a network.
			</p>
			<Alert variant="destructive">
				<TriangleAlert className="h-4 w-4" />
				<AlertDescription className="leading-relaxed">Only enable these in a trusted environment.</AlertDescription>
			</Alert>

			<SettingsCard>
				<SettingsRow
					label="Shell command support"
					htmlFor="enable-shell-command-support"
					help='Allows running shell commands on this computer (e.g. the internal "Run shell command" action).'
				>
					<Switch
						id="enable-shell-command-support"
						checked={enableShellCommandSupport}
						onCheckedChange={(checked: boolean) => handleEnableShellCommandSupportChange(checked)}
					/>
				</SettingsRow>
				<SettingsRow
					label="Restricted modules"
					htmlFor="enable-restricted-modules"
					help="Allows loading modules that are otherwise held back for safety, such as importing custom modules from remote clients. Importing from this computer is always allowed."
				>
					<Switch
						id="enable-restricted-modules"
						checked={enableRestrictedModules}
						onCheckedChange={(checked: boolean) => handleEnableRestrictedModulesChange(checked)}
					/>
				</SettingsRow>
				<SettingsRow
					label="Trusted proxies"
					htmlFor="trusted-proxies"
					help="Set this when running Companion behind a reverse proxy, so the real client address is used. Without it, remote clients may appear to be local."
				>
					<Input
						id="trusted-proxies"
						type="text"
						value={trustedProxies}
						onChange={(e) => setTrustedProxies(e.target.value)}
						onBlur={handleTrustedProxiesBlur}
						placeholder="e.g. loopback, or a comma separated list of proxy ip addresses"
					/>
				</SettingsRow>
			</SettingsCard>
		</>
	)
}
