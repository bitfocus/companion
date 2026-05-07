import { observer } from 'mobx-react-lite'
import { StaticAlert } from '~/Components/Alert.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'

export const ExperimentsConfig = observer(function ExperimentsConfig(_props: UserConfigProps) {
	return (
		<>
			<UserConfigHeadingRow label="Experiments" />

			<tr>
				<td colSpan={3}>
					<StaticAlert color="danger">Do not touch these settings unless you know what you are doing!</StaticAlert>
				</td>
			</tr>

			<tr>
				<td>Use TouchBackend for Drag and Drop</td>
				<td>
					<div className="float-right">
						<SwitchInputField
							value={window.localStorage.getItem('test_touch_backend') === '1'}
							setValue={(val) => {
								window.localStorage.setItem('test_touch_backend', val ? '1' : '0')
								window.location.reload()
							}}
						/>
					</div>
				</td>
				<td>&nbsp;</td>
			</tr>
			<tr>
				<td>Companion Cloud Tab (Deprecated)</td>
				<td>
					<div className="float-right">
						<SwitchInputField
							value={window.localStorage.getItem('show_companion_cloud') === '1'}
							setValue={(val) => {
								window.localStorage.setItem('show_companion_cloud', val ? '1' : '0')
								window.location.reload()
							}}
						/>
					</div>
				</td>
				<td>&nbsp;</td>
			</tr>
		</>
	)
})
