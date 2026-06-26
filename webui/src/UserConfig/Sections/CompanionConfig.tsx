import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigDropdownRow } from '../Components/UserConfigDropdownRow.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

export const CompanionConfig = observer(function CompanionConfig(props: UserConfigProps) {
	const timezoneChoices = useMemo<DropdownChoice[]>(() => {
		const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
		return [{ id: '', label: 'System Default' }, ...zones.map((zone): DropdownChoice => ({ id: zone, label: zone }))]
	}, [])

	return (
		<>
			<UserConfigHeadingRow label="Installation Settings" helpAction="/user-guide/config/settings#general" />
			<UserConfigTextInputRow userConfig={props} label="Installation Name" field="installName" />
			<UserConfigTextInputRow
				userConfig={props}
				useVariables={true}
				label="Default Export File Name"
				field="default_export_filename"
			/>
			<UserConfigDropdownRow
				userConfig={props}
				label="Timezone for time variables and triggers"
				field="timezone"
				choices={timezoneChoices}
				searchLabelsOnly
			/>
		</>
	)
})
