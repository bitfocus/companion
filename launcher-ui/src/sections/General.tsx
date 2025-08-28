import React, { useState, useEffect } from 'react'
import { useConfig } from '~/hooks/useConfig'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

export function GeneralSection(): JSX.Element {
	const { state, updateConfig } = useConfig()

	// Assume data is available since loading/error states are handled elsewhere
	const { config } = state.data!

	// Local state for form inputs
	const [logLevel, setLogLevel] = useState(config.log_level || 'info')

	// Update local state when config changes
	useEffect(() => {
		setLogLevel(config.log_level || 'info')
	}, [config.log_level])

	// Handle changes and update config
	const handleLogLevelChange = (value: string) => {
		setLogLevel(value)
		updateConfig({ log_level: value })
	}

	return (
		<div className="space-y-6">
			<div>
				<div className="space-y-4">
					<div className="grid grid-cols-4 gap-4 items-center">
						<Label htmlFor="log-level">Log Level</Label>
						<div className="col-span-3">
							<Select value={logLevel} onValueChange={handleLogLevelChange}>
								<SelectTrigger className="w-48">
									<SelectValue placeholder="Select log level" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="error">Error</SelectItem>
									<SelectItem value="warn">Warning</SelectItem>
									<SelectItem value="info">Info</SelectItem>
									<SelectItem value="debug">Debug</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-sm text-muted-foreground mt-1">
								Controls the level of detail for logs written to disk. Higher levels include more information.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
