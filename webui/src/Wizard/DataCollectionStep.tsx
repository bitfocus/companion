import React from 'react'
import { CFormCheck } from '@coreui/react'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

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
			<div className="indent3">
				<CFormCheck
					label="Send anonymous usage statistics"
					checked={config.detailed_data_collection}
					onChange={(e) => setValue('detailed_data_collection', e.currentTarget.checked)}
				/>
			</div>
			<p className="text-muted mt-3" style={{ fontSize: '0.875rem' }}>
				You can change this setting at any time in Settings → Data Collection, where you can also view exactly what data
				is being collected.
			</p>
		</div>
	)
}
