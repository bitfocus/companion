import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { NonIdealState } from '~/Components/NonIdealState'

interface FinishStepProps {
	oldConfig: UserConfigModel
	newConfig: UserConfigModel
}

export function FinishStep(_props: FinishStepProps): React.JSX.Element {
	return (
		<div className="wizard-centered-step">
			<NonIdealState icon={faCircleCheck}>
				<h4 className="mb-2">You're all set!</h4>
				<p>Companion is configured and ready to use. Here's where to go next:</p>
				<ul className="text-start d-inline-block mb-0">
					<li>
						Check the <b>Surfaces</b> tab to confirm your USB devices are detected.
					</li>
					<li>
						Use the <b>Connections</b> tab to add the devices you want to control.
					</li>
					<li>
						Open the <b>Buttons</b> tab to program your buttons - many devices ship with <b>Presets</b> you can drag
						straight onto a surface.
					</li>
				</ul>
			</NonIdealState>
		</div>
	)
}
