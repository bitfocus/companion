import React, { useState } from 'react'
import { observer } from 'mobx-react-lite'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { CButton } from '@coreui/react'
import { UsageDataModal } from '../UsageDataModal.js'

export const DataCollectionConfig = observer(function DataCollectionConfig(props: UserConfigProps) {
	const [showModal, setShowModal] = useState(false)

	return (
		<>
			<UserConfigHeadingRow label="Data Collection" />

			<tr>
				<td colSpan={3}>
					The Companion project collects anonymous usage statistics to help improve the software. No personal data is
					collected. You can opt out of the full data collection below.
					<br />
					You can read the full privacy policy at the{' '}
					<a href="https://bitfocus.io/legal/privacy/" target="_blank" rel="noreferrer">
						Bitfocus Website
					</a>
					.
				</td>
			</tr>

			<UserConfigSwitchRow
				userConfig={props}
				label="Enable detailed usage statistics"
				field="detailed_data_collection"
			/>

			<tr>
				<td>View data being collected</td>
				<td className="text-end">
					<CButton color="primary" size="sm" onClick={() => setShowModal(true)}>
						View Data
					</CButton>
				</td>
				<td></td>
			</tr>

			<UsageDataModal show={showModal} onHide={() => setShowModal(false)} />
		</>
	)
})
