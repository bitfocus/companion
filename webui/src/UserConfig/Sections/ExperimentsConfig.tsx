import { useId } from 'react'
import { StaticAlert } from '~/Components/Alert.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
import { ConfigFieldRow } from '../Components/ConfigFieldRows.js'

export function ExperimentsConfig(): React.JSX.Element {
	const cloudTabId = useId()

	return (
		<>
			<StaticAlert color="danger" className="mb-0 text-xs">
				Do not touch these settings unless you know what you are doing!
			</StaticAlert>

			{/* Kept in this browser rather than the user config, and applied by reloading the page */}
			<ConfigFieldRow
				label="Companion Cloud Tab"
				htmlFor={cloudTabId}
				help="Deprecated. Changing this reloads the page."
			>
				<SwitchInputField
					id={cloudTabId}
					value={window.localStorage.getItem('show_companion_cloud') === '1'}
					setValue={(val) => {
						safeSetLocalStorage('show_companion_cloud', val ? '1' : '0')
						window.location.reload()
					}}
				/>
			</ConfigFieldRow>
		</>
	)
}
