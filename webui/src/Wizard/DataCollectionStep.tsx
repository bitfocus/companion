import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'

interface DataCollectionStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function DataCollectionStep({ config, setValue }: DataCollectionStepProps): React.JSX.Element {
	return (
		<div>
			<h5>Usage Statistics</h5>
			<p>
				Help us improve Companion by sharing anonymous usage statistics. This data helps us understand which features
				are used most and prioritize future development.
			</p>
			<p>
				The collected data includes information about your Companion installation (version, platform, enabled modules)
				but does NOT include any personal information, configuration details, or button content.
			</p>
			<div className="ms-3">
				<CheckboxInputFieldWithLabel
					label="Send anonymous usage statistics"
					value={!!config.detailed_data_collection}
					setValue={(val) => setValue('detailed_data_collection', val)}
				/>
			</div>
			<p className="text-muted mt-3" style={{ fontSize: '0.875rem' }}>
				You can change this setting at any time in Settings → Data Collection, where you can also view exactly what data
				is being collected.
			</p>
		</div>
	)
}
