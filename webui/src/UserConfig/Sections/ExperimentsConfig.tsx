import React from 'react'
import { CAlert, CFormSwitch } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import type { UserConfigProps } from '../Components/Common.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { useLocalStorage } from 'usehooks-ts'

export const ExperimentsConfig = observer(function ExperimentsConfig(_props: UserConfigProps) {
	const [hideSidebarHelp, setHideSidebarHelp] = useLocalStorage('hide_sidebar_help', false)
	const [showCloud, setShowCloud] = useLocalStorage('show_companion_cloud', '0')

	return (
		<>
			<UserConfigHeadingRow label="Experiments" />

			<tr>
				<td colSpan={3}>
					<p>
						Please note that the following are saved to the local browser and may reset if you change the "GUI
						Interface" address (hostname) in the launcher.
					</p>
					<CAlert color="danger">Do not touch these settings unless you know what you are doing!</CAlert>
				</td>
			</tr>

			<tr>
				<td>
					Hide the Sidebar Help Buttons{' '}
					<InlineHelp help="All help is still accessible from the new help menu at the top-right, so this just frees up space in the sidebar. This option is stored in your browser, not the Companion database, so you set it once per browser.">
						<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
					</InlineHelp>
				</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={hideSidebarHelp}
						size="xl"
						onChange={(e) => {
							setHideSidebarHelp(e.currentTarget.checked)
						}}
					/>
				</td>
				<td>&nbsp;</td>
			</tr>
			<tr>
				<td>
					Use TouchBackend for Drag and Drop{' '}
					<InlineHelp help="Allow touch gestures to trigger drag-and-drop. It works but is a bit buggy, visually. This option is stored in your browser, not the Companion database, so you set it once per browser.">
						<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
					</InlineHelp>
				</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={window.localStorage.getItem('test_touch_backend') === '1'}
						size="xl"
						onChange={(e) => {
							window.localStorage.setItem('test_touch_backend', e.currentTarget.checked ? '1' : '0')
							window.location.reload()
						}}
					/>
				</td>
				<td>&nbsp;</td>
			</tr>
			<tr>
				<td>
					Companion Cloud Tab (Deprecated){' '}
					<InlineHelp help="This is a paid service that we anticipate being replaced by buttons. Consider using Companion Satellite as an alternative. This option is stored in your browser, not the Companion database, so you set it once per browser.">
						<FontAwesomeIcon icon={faQuestionCircle} size="lg" />
					</InlineHelp>
				</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={showCloud === '1'}
						size="xl"
						onChange={(e) => {
							setShowCloud(e.currentTarget.checked ? '1' : '0')
							//window.location.reload()
						}}
					/>
				</td>
				<td>&nbsp;</td>
			</tr>
		</>
	)
})
