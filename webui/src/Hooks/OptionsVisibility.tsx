import { observer } from 'mobx-react-lite'
import type { JsonValue } from 'type-fest'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { usePlainOptionsVisibility } from './useOptionsAndIsVisible.js'

/**
 * Compute the visibility of some option fields from their values, for use inside a render function (eg a
 * `form.Subscribe`) where the hook can't be called directly.
 */
export const OptionsVisibility = observer(function OptionsVisibility({
	options,
	values,
	children,
}: {
	options: SomeCompanionInputField[]
	values: Record<string, JsonValue | undefined>
	children: (visibility: ReadonlyMap<string, boolean>) => React.ReactNode
}) {
	const visibility = usePlainOptionsVisibility(options, values)
	return <>{children(visibility)}</>
})
