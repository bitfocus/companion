import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { DropdownInputField } from '~/Components/DropdownInputField'
import { Grid } from '~/Components/Grid'
import { TIMEZONE_CHOICES } from '~/Resources/timezones.js'

interface TimezoneStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function TimezoneStep({ config, setValue }: TimezoneStepProps): React.JSX.Element {
	return (
		<Grid.Row>
			<Grid.Col sm={12}>
				<h5>Timezone</h5>
				<p>
					Choose the timezone Companion should use for its time and date variables (such as{' '}
					<code>$(internal:time_hms)</code>) and for time-based triggers. Leave this as <strong>System Default</strong>{' '}
					to follow the timezone of the machine running Companion, which is usually correct for desktop installs but may
					be incorrect on headless devices.
				</p>
			</Grid.Col>

			<Grid.Col sm={12} className="mb-2">
				<DropdownInputField
					htmlName="timezone"
					choices={TIMEZONE_CHOICES}
					value={String(config.timezone ?? '')}
					setValue={(value) => setValue('timezone', value)}
					searchLabelsOnly
				/>
			</Grid.Col>

			<Grid.Col sm={12}>
				<p className="text-muted mt-3" style={{ fontSize: '0.875rem' }}>
					You can change this later on the 'Settings' tab in the GUI.
				</p>
			</Grid.Col>
		</Grid.Row>
	)
}
