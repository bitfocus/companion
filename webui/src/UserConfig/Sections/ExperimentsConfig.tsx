import { faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
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
				<td>Companion Cloud Tab (Deprecated)</td>
				<td className="settings-value-end">
					<div className="flex justify-end items-center">
						<SwitchInputField
							id={undefined}
							value={window.localStorage.getItem('show_companion_cloud') === '1'}
							setValue={(val) => {
								safeSetLocalStorage('show_companion_cloud', val ? '1' : '0')
								window.location.reload()
							}}
						/>
					</div>
				</td>
				<td>
					<Button variant="ghost" size="sm" disabled title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</Button>
				</td>
			</tr>
		</>
	)
})
