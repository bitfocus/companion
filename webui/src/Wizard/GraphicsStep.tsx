import { ButtonGraphicsDecorationType } from '@companion-app/shared/Model/StyleModel.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { DropdownInputField } from '~/Components/DropdownInputField'
import { FormLabel } from '~/Components/Form'
import { BUTTON_DECORATION_CHOICES } from '~/UserConfig/ButtonAppearanceChoices.js'
import { GraphicsPreviewButton } from './GraphicsPreview.js'

interface GraphicsStepProps {
	config: Partial<UserConfigModel>
	setValue: (key: keyof UserConfigModel, value: any) => void
}

export function GraphicsStep({ config, setValue }: GraphicsStepProps): React.JSX.Element {
	const decoration = config.buttons_decoration ?? ButtonGraphicsDecorationType.TopBar
	const statusIcons = config.buttons_status_icons ?? 'show'

	return (
		<div>
			<h5>Button Appearance</h5>
			<p>
				Choose how buttons should look by default. The <strong>decoration</strong> is the bar or border drawn around
				each button, and the <strong>status icons</strong> flag warnings and errors from your connections. Both can be
				overridden on individual buttons later.
			</p>

			<div className="flex items-start gap-6 flex-wrap">
				<div style={{ flex: '1 1 220px', minWidth: 200 }}>
					<div className="mb-4">
						<FormLabel htmlFor="buttons_decoration">Default decoration</FormLabel>
						<DropdownInputField
							htmlName="buttons_decoration"
							choices={BUTTON_DECORATION_CHOICES}
							value={decoration}
							setValue={(value) => setValue('buttons_decoration', value)}
						/>
					</div>

					<CheckboxInputFieldWithLabel
						label="Show status icons on each button"
						value={statusIcons === 'show'}
						setValue={(val) => setValue('buttons_status_icons', val ? 'show' : 'none')}
					/>
				</div>

				<div className="flex flex-col items-center gap-2">
					<div className="flex gap-3">
						<GraphicsPreviewButton decoration={decoration} statusIcons={statusIcons} buttonStatus="warning" />
						<GraphicsPreviewButton decoration={decoration} statusIcons={statusIcons} pushed buttonStatus="error" />
					</div>
					<small className="text-muted">Preview (idle &amp; pressed)</small>
				</div>
			</div>

			<p className="text-muted mt-4 text-sm">You can change these later on the 'Settings' tab under Buttons.</p>
		</div>
	)
}
