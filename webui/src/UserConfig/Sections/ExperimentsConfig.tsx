import { observer } from 'mobx-react-lite'
import { useGridViewAsFlag } from '~/Buttons/GridViewAsFlag.js'
import { StaticAlert } from '~/Components/Alert.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'

export const ExperimentsConfig = observer(function ExperimentsConfig(_props: UserConfigProps) {
	const [gridViewAsEnabled, setGridViewAsEnabled] = useGridViewAsFlag()

	return (
		<>
			<UserConfigHeadingRow label="Experiments" />

			<tr>
				<td colSpan={3}>
					<StaticAlert color="danger">Do not touch these settings unless you know what you are doing!</StaticAlert>
				</td>
			</tr>

			<tr title="Adds a control to the buttons page which redraws the grid as the surface you choose">
				<td>View the button grid as one of your surfaces</td>
				<td>
					<div className="float-right">
						<SwitchInputField id={undefined} value={gridViewAsEnabled} setValue={setGridViewAsEnabled} />
					</div>
				</td>
				<td>&nbsp;</td>
			</tr>

			<tr>
				<td>Companion Cloud Tab (Deprecated)</td>
				<td>
					<div className="float-right">
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
				<td>&nbsp;</td>
			</tr>
		</>
	)
})
