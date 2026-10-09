import { observer } from 'mobx-react-lite'
import { StaticAlert } from '~/Components/Alert.js'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigNumberField, ConfigTextField } from '../Components/ConfigFieldRows.js'

export const AdminPasswordConfig = observer(function AdminPasswordConfig(props: UserConfigProps) {
	return (
		<>
			<StaticAlert color="danger" className="mb-0 text-xs">
				This does not make an installation secure! It is intended to keep normal users from stumbling upon the settings
				and changing things. It will not keep out someone determined to bypass it.
			</StaticAlert>

			<ConfigTextField userConfig={props} label="Password" field="admin_password" help={null} />
			<ConfigNumberField
				userConfig={props}
				label="Session Timeout"
				field="admin_timeout"
				min={0}
				max={24 * 60}
				help="Minutes of inactivity before the interface locks again, or 0 for no timeout."
			/>
		</>
	)
})
