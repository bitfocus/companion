import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

interface FinishStepProps {
	oldConfig: UserConfigModel
	newConfig: UserConfigModel
}

export function FinishStep(_props: FinishStepProps): React.JSX.Element {
	return (
		<div>
			<h4>Congratulations!</h4>
			<p style={{ fontWeight: 'bold' }}>
				Companion is now configured and ready for use.
				<br />
				Your next steps are:
			</p>
			<ol>
				<li>Review the 'Surfaces' tab and ensure the USB devices you have plugged in are detected for use. </li>
				<li>Go to the 'Connections' tab to configure the devices you'd like to control.</li>
				<li>
					Go to the 'Buttons' tab to program buttons to control your devices.
					<br />
					<span style={{ fontStyle: 'italic' }}>
						Helpful hint: many devices have 'Presets' (pre-configured buttons) that you can drag and drop onto the
						surfaces.
					</span>
				</li>
			</ol>
		</div>
	)
}
