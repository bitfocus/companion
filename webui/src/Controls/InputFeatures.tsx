import { faDollarSign, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CompanionFieldVariablesSupport, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'

export interface InputFeatureIconsProps {
	variables?: boolean
	local?: boolean
}

export const ExpressionModeFeatures: InputFeatureIconsProps = Object.freeze({
	variables: true,
	local: true,
})

// eslint-disable-next-line react-refresh/only-export-components
export function getInputFeatures(option: SomeCompanionInputField): InputFeatureIconsProps | undefined {
	if (option.type === 'textinput') {
		return {
			variables: !!option.useVariables,
			local:
				option.useVariables === CompanionFieldVariablesSupport.InternalParser ||
				option.useVariables === CompanionFieldVariablesSupport.LocalVariables,
		}
	} else if (option.type === 'expression') {
		return ExpressionModeFeatures
	}
	return undefined
}

export function InputFeatureIcons(props: InputFeatureIconsProps): JSX.Element | null {
	const featureIcons: JSX.Element[] = []
	if (props.variables)
		featureIcons.push(
			<InlineHelpCustom key="variables" help="Supports global variables">
				<FontAwesomeIcon icon={faDollarSign} />
			</InlineHelpCustom>
		)
	if (props.local)
		featureIcons.push(
			<InlineHelpCustom key="local" help="Supports local variables">
				<FontAwesomeIcon icon={faGlobe} />
			</InlineHelpCustom>
		)

	return featureIcons.length ? <span className="feature-icons">{featureIcons}</span> : null
}
