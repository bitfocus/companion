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
	const [enableShellCommandAction, setEnableShellCommandAction] = useState(config.enable_shell_command_action)
	const [enableRemoteCustomModules, setEnableRemoteCustomModules] = useState(config.enable_remote_custom_modules)
	const [trustedProxies, setTrustedProxies] = useState(config.trusted_proxies || '')

	// Update local state when config changes
	useEffect(() => {
		setEnableShellCommandAction(config.enable_shell_command_action)
		setEnableRemoteCustomModules(config.enable_remote_custom_modules)
		setTrustedProxies(config.trusted_proxies || '')
	}, [config.enable_shell_command_action, config.enable_remote_custom_modules, config.trusted_proxies])

	const handleEnableShellCommandActionChange = (checked: boolean) => {
		setEnableShellCommandAction(checked)
		updateConfig({ enable_shell_command_action: checked })
	}

	const handleEnableRemoteCustomModulesChange = (checked: boolean) => {
		setEnableRemoteCustomModules(checked)
		updateConfig({ enable_remote_custom_modules: checked })
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
						<Label htmlFor="enable-shell-command-action">Run shell command action</Label>
						<div className="flex items-center col-span-3">
							<input
								type="checkbox"
								id="enable-shell-command-action"
								checked={enableShellCommandAction}
								onChange={(e) => handleEnableShellCommandActionChange(e.target.checked)}
								className="rounded"
							/>
							<p className="text-sm text-muted-foreground ml-2">
								Allows the internal "Run shell command (local)" action to execute commands on this computer.
							</p>
						</div>

						<Label htmlFor="enable-remote-custom-modules">Remote custom module import</Label>
						<div className="flex items-center col-span-3">
							<input
								type="checkbox"
								id="enable-remote-custom-modules"
								checked={enableRemoteCustomModules}
								onChange={(e) => handleEnableRemoteCustomModulesChange(e.target.checked)}
								className="rounded"
							/>
							<p className="text-sm text-muted-foreground ml-2">
								Allows remote clients to import custom modules. Importing from this computer is always allowed.
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
