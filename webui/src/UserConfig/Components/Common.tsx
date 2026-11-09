import { faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UserConfigModelSchema, type UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { keyValueChange, type KeyValueChange } from '@companion-app/shared/Util/KeyValue.js'
import { Button } from '~/Components/Button.js'

export interface UserConfigProps {
	config: UserConfigModel

	setValue: (change: KeyValueChange<UserConfigModel>) => void
	resetValue: (key: keyof UserConfigModel) => void

	/** Keys that are locked by a launch-time override and cannot be edited in the UI */
	readonlyKeys: ReadonlySet<keyof UserConfigModel>
}

/** Check a value from an input against a setting's schema, giving the change to set it, or null when it isn't valid */
export function parseUserConfigChange<K extends keyof UserConfigModel>(
	key: K,
	value: unknown
): KeyValueChange<UserConfigModel> | null {
	const result = UserConfigModelSchema.shape[key].safeParse(value)
	// The schema for the key gives a value of that key's type
	return result.success ? keyValueChange(key, result.data as UserConfigModel[K]) : null
}

interface ResetButtonProps {
	userConfig: UserConfigProps
	field: keyof UserConfigModel
}

export function ResetButton({ userConfig, field }: ResetButtonProps): React.JSX.Element {
	return (
		<Button variant="ghost" size="sm" onClick={() => userConfig.resetValue(field)} title="Reset to default">
			<FontAwesomeIcon icon={faUndo} />
		</Button>
	)
}
