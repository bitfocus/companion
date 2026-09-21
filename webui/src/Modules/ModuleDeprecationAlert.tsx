import { faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { StaticAlert } from '~/Components/Alert.js'
import type { ModuleDeprecationInfo } from './useModuleDeprecationInfo.js'

interface ModuleDeprecationAlertProps {
	info: ModuleDeprecationInfo
}

/**
 * An explanation of what it means for a module to be deprecated, for the places where a user is
 * looking at one in detail. The reason and any replacement come from the module store.
 */
export function ModuleDeprecationAlert({ info }: ModuleDeprecationAlertProps): React.JSX.Element {
	return (
		<StaticAlert color="warning">
			<strong>
				<FontAwesomeIcon icon={faWarning} className="me-1" />
				This module is deprecated
			</strong>
			{!!info.reason && <p className="mb-0 mt-2">{info.reason}</p>}
			<p className="mb-0 mt-2">
				It is no longer maintained, so it will not receive further fixes or support for new devices. Anything already
				using it keeps working for now, but you should plan to move away from it.
			</p>
			{info.replacementNames.length > 0 && (
				<p className="mb-0 mt-2">
					{info.replacementNames.length === 1
						? `${info.replacementNames[0]} is offered as a replacement.`
						: `These modules are offered as a replacement: ${info.replacementNames.join(', ')}.`}{' '}
					You can switch over from the Module Version setting.
				</p>
			)}
		</StaticAlert>
	)
}
