import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import type { LauncherConfig } from '~/types/config'
import { getInterfaceOptions, type NetworkInterfaceOption } from './interfaceOptions'

interface LauncherSettingsProps {
	config: LauncherConfig
	interfaces: NetworkInterfaceOption[]
	platform: string
}

export function LauncherSettings({ config, interfaces, platform }: LauncherSettingsProps): React.JSX.Element {
	// The port being typed, before it is applied. The main process resends the config after every change
	const [portDraft, setPortDraft] = useState<string | null>(null)

	const supportsRunAtLogin = platform === 'win32' || platform === 'darwin'
	const interfaceItems = getInterfaceOptions(interfaces, config.bind_ip).map((iface) => ({
		value: iface.id,
		label: iface.label,
	}))

	return (
		<>
			<div className="launcher-fields">
				<div className="launcher-field">
					<Label htmlFor="launcher-interface">GUI interface</Label>
					<Select
						value={config.bind_ip}
						items={interfaceItems}
						onValueChange={(value: string | null) => {
							if (value) window.api.send('launcher-set-bind-ip', value)
						}}
					>
						<SelectTrigger id="launcher-interface" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{interfaceItems.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<form
					className="launcher-field"
					onSubmit={(e) => {
						e.preventDefault()
						if (portDraft === null) return
						window.api.send('launcher-set-http-port', portDraft)
						setPortDraft(null)
					}}
				>
					<Label htmlFor="launcher-port">Port</Label>
					<div className="flex gap-2">
						<Input
							id="launcher-port"
							className="w-18 text-center tabular-nums"
							inputMode="numeric"
							maxLength={5}
							value={portDraft ?? String(config.http_port)}
							onChange={(e) => setPortDraft(e.target.value)}
						/>
						<Button type="submit" variant="outline">
							Apply
						</Button>
					</div>
				</form>
			</div>

			<div className="launcher-toggles">
				<Label>
					<Switch
						checked={config.start_minimised}
						onCheckedChange={(checked: boolean) => window.api.send('launcher-set-start-minimised', checked)}
					/>
					Start minimized
				</Label>
				{supportsRunAtLogin && (
					<Label>
						<Switch
							checked={config.run_at_login}
							onCheckedChange={(checked: boolean) => window.api.send('launcher-set-run-at-login', checked)}
						/>
						Run at login
					</Label>
				)}
			</div>
		</>
	)
}
