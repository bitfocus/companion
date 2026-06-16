import { TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '~/components/ui/alert'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useConfig } from '~/hooks/useConfig'

export function DangerousFeaturesSection(): JSX.Element {
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

	const handleTrustedProxiesBlur = () => {
		updateConfig({ trusted_proxies: trustedProxies })
	}

	return (
		<div className="space-y-6">
			<div>
				<p className="text-muted-foreground mb-4 text-sm">
					These features allow code to run on this computer. They are disabled by default and should only be enabled if
					you understand and accept the risk - especially if Companion is reachable over a network.
				</p>
				<Alert className="mb-6" variant="destructive">
					<TriangleAlert className="h-4 w-4" />
					<AlertDescription className="leading-relaxed">
						<p>Only enable these in a trusted environment. Changing these settings restarts Companion.</p>
					</AlertDescription>
				</Alert>

				<div className="space-y-4">
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="enable-shell-command-support">Shell command support</Label>
						<div className="flex items-center col-span-3">
							<input
								type="checkbox"
								id="enable-shell-command-support"
								checked={enableShellCommandSupport}
								onChange={(e) => handleEnableShellCommandSupportChange(e.target.checked)}
								className="rounded"
							/>
							<p className="text-sm text-muted-foreground ml-2">
								Allows running shell commands on this computer (e.g. the internal "Run shell command" action).
							</p>
						</div>

						<Label htmlFor="enable-restricted-modules">Restricted modules</Label>
						<div className="flex items-center col-span-3">
							<input
								type="checkbox"
								id="enable-restricted-modules"
								checked={enableRestrictedModules}
								onChange={(e) => handleEnableRestrictedModulesChange(e.target.checked)}
								className="rounded"
							/>
							<p className="text-sm text-muted-foreground ml-2">
								Allows loading modules that are otherwise held back for safety, such as importing custom modules from
								remote clients. Importing from this computer is always allowed.
							</p>
						</div>

						<Label htmlFor="trusted-proxies">Trusted proxies</Label>
						<div className="col-span-3">
							<Input
								id="trusted-proxies"
								type="text"
								value={trustedProxies}
								onChange={(e) => setTrustedProxies(e.target.value)}
								onBlur={handleTrustedProxiesBlur}
								placeholder="e.g. loopback, or a comma separated list of proxy ip addresses"
							/>
							<p className="text-sm text-muted-foreground mt-1">
								Set this when running Companion behind a reverse proxy, so the real client address is used. Without it,
								remote clients may appear to be local.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
