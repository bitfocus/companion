import React, { useState, useEffect } from 'react'
import { useConfig } from '~/hooks/useConfig'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function SyslogSection(): JSX.Element {
	const { state, updateConfig } = useConfig()

	// Assume data is available since loading/error states are handled elsewhere
	const { config } = state.data!

	// Local state for form inputs
	const [enableSyslog, setEnableSyslog] = useState(config.enable_syslog)
	const [syslogHost, setSyslogHost] = useState(config.syslog_host || '127.0.0.1')
	const [syslogPort, setSyslogPort] = useState(config.syslog_port || 514)
	const [syslogTcp, setSyslogTcp] = useState(config.syslog_use_tcp)
	const [syslogLocalHost, setSyslogLocalHost] = useState(config.syslog_local_hostname || '')

	// Update local state when config changes
	useEffect(() => {
		setEnableSyslog(config.enable_syslog)
		setSyslogHost(config.syslog_host || '127.0.0.1')
		setSyslogPort(config.syslog_port || 514)
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

	const handleSyslogHostChange = (value: string) => {
		setSyslogHost(value)
		updateConfig({ syslog_host: value })
	}
	const handleSyslogPortChange = (value: string) => {
		let port = Number.parseInt(value)
		port = Number.isNaN(port) ? 514 : port
		port = port < 100 ? 100 : port
		port = port > 65535 ? 65535 : port
		setSyslogPort(port)
		updateConfig({ syslog_port: port })
	}

	const handleSyslogTcpChange = (checked: boolean) => {
		setSyslogTcp(checked)
		updateConfig({ syslog_use_tcp: checked })
	}

	const handleSyslogLocalHostChange = (value: string) => {
		setSyslogLocalHost(value)
		updateConfig({ syslog_local_hostname: value })
	}

	return (
		<div className="space-y-6">
			<div>
				<p className="text-muted-foreground mb-4 text-sm">Configure Companion syslog client</p>
				<div className="space-y-4">
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="enable-syslog">Enable</Label>
						<div className="flex items-center col-span-3 ">
							<input
								type="checkbox"
								id="enable_syslog"
								checked={enableSyslog}
								onChange={(e) => handleEnableSyslog(e.target.checked)}
								className="rounded"
							/>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="syslog-host">Syslog Server</Label>
						<div className="col-span-3">
							<div className="flex">
								<Input
									id="syslog_host"
									type="text"
									value={syslogHost}
									onChange={(e) => handleSyslogHostChange(e.target.value)}
									placeholder=""
									className="flex-1 rounded-r-none"
								/>
							</div>
							<p className="text-sm text-muted-foreground mt-1">IP of Syslog Server</p>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="syslog-port">Port</Label>
						<div className="col-span-3">
							<div className="flex">
								<Input
									id="syslog_port"
									type="number"
									value={syslogPort}
									onChange={(e) => handleSyslogPortChange(e.target.value)}
									className="flex-1 rounded-r-none"
									min={101}
									max={65535}
								/>
							</div>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="syslog-tcp">Use TCP</Label>
						<div className="flex items-center col-span-3 ">
							<input
								type="checkbox"
								id="syslog_use_tcp"
								checked={syslogTcp}
								onChange={(e) => handleSyslogTcpChange(e.target.checked)}
								className="rounded"
							/>
						</div>
					</div>
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="syslog-local-host">Local Hostname</Label>
						<div className="col-span-3">
							<div className="flex">
								<Input
									id="syslog_local_hostname"
									type="text"
									value={syslogLocalHost}
									onChange={(e) => handleSyslogLocalHostChange(e.target.value)}
									className="flex-1 rounded-r-none"
									placeholder={state.data?.hostname}
								/>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								Change the hostname this companion instance will report. If not set the system hostname will be used
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
