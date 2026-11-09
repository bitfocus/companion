import { useEffect, useState } from 'react'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'
import { useConfig } from '~/hooks/useConfig'
import { SettingsCard, SettingsRow } from './SettingsCard'

export function SyslogSection(): React.JSX.Element {
	const { state, updateConfig } = useConfig()

	// Assume data is available since loading/error states are handled elsewhere
	const { config } = state.data!

	// Local state for form inputs
	const [enableSyslog, setEnableSyslog] = useState(config.enable_syslog)
	const [syslogHost, setSyslogHost] = useState(config.syslog_host || '127.0.0.1')
	const [syslogPort, setSyslogPort] = useState(String(config.syslog_port || 514))
	const [syslogTcp, setSyslogTcp] = useState(config.syslog_use_tcp)
	const [syslogLocalHost, setSyslogLocalHost] = useState(config.syslog_local_hostname || '')

	// Update local state when config changes
	useEffect(() => {
		setEnableSyslog(config.enable_syslog)
		setSyslogHost(config.syslog_host || '127.0.0.1')
		setSyslogPort(String(config.syslog_port || 514))
		setSyslogTcp(config.syslog_use_tcp)
		setSyslogLocalHost(config.syslog_local_hostname || '')
	}, [
		config.enable_syslog,
		config.syslog_host,
		config.syslog_port,
		config.syslog_use_tcp,
		config.syslog_local_hostname,
	])

	// Handle changes and update config
	const handleEnableSyslog = (checked: boolean) => {
		setEnableSyslog(checked)
		updateConfig({ enable_syslog: checked })
	}

	// The text fields save when they lose focus, and only when changed, as each change restarts Companion. They
	// compare against the same defaults the fields start from
	const handleSyslogHostBlur = () => {
		if (syslogHost !== (config.syslog_host || '127.0.0.1')) updateConfig({ syslog_host: syslogHost })
	}

	const handleSyslogPortBlur = () => {
		const savedPort = config.syslog_port || 514
		let port = syslogPort.trim() === '' ? 514 : Number(syslogPort)
		if (!Number.isInteger(port)) {
			// Not a whole number, so put back the saved port rather than guess
			setSyslogPort(String(savedPort))
			return
		}
		// The server ignores ports of 100 or below
		port = port < 101 ? 101 : port
		port = port > 65535 ? 65535 : port
		setSyslogPort(String(port))
		if (port !== savedPort) updateConfig({ syslog_port: port })
	}

	const handleSyslogTcpChange = (checked: boolean) => {
		setSyslogTcp(checked)
		updateConfig({ syslog_use_tcp: checked })
	}

	const handleSyslogLocalHostBlur = () => {
		if (syslogLocalHost !== (config.syslog_local_hostname || ''))
			updateConfig({ syslog_local_hostname: syslogLocalHost })
	}

	return (
		<>
			<p className="text-muted-foreground text-sm">Configure Companion syslog client</p>
			<SettingsCard>
				<SettingsRow label="Enable" htmlFor="enable_syslog" help={null}>
					<Switch
						id="enable_syslog"
						checked={enableSyslog}
						onCheckedChange={(checked: boolean) => handleEnableSyslog(checked)}
					/>
				</SettingsRow>
				<SettingsRow label="Syslog server" htmlFor="syslog_host" help="IP of Syslog Server">
					<Input
						id="syslog_host"
						type="text"
						value={syslogHost}
						onChange={(e) => setSyslogHost(e.target.value)}
						onBlur={handleSyslogHostBlur}
					/>
				</SettingsRow>
				<SettingsRow label="Port" htmlFor="syslog_port" help={null}>
					<Input
						id="syslog_port"
						type="number"
						value={syslogPort}
						onChange={(e) => setSyslogPort(e.target.value)}
						onBlur={handleSyslogPortBlur}
						className="w-32"
						min={101}
						max={65535}
					/>
				</SettingsRow>
				<SettingsRow label="Use TCP" htmlFor="syslog_use_tcp" help={null}>
					<Switch
						id="syslog_use_tcp"
						checked={syslogTcp}
						onCheckedChange={(checked: boolean) => handleSyslogTcpChange(checked)}
					/>
				</SettingsRow>
				<SettingsRow
					label="Local hostname"
					htmlFor="syslog_local_hostname"
					help="Change the hostname this companion instance will report. If not set the system hostname will be used"
				>
					<Input
						id="syslog_local_hostname"
						type="text"
						value={syslogLocalHost}
						onChange={(e) => setSyslogLocalHost(e.target.value)}
						onBlur={handleSyslogLocalHostBlur}
						placeholder={state.data?.hostname}
					/>
				</SettingsRow>
			</SettingsCard>
		</>
	)
}
