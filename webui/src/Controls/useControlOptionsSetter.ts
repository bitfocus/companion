import { useCallback } from 'react'
import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import type {
	ControlOptionsChange,
	ControlOptionsOfType,
	ControlTypeWithOptions,
} from '@companion-app/shared/Model/Controls.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

/** Sets one option of a control, to a value of that option's type */
export type ControlOptionsSetter<T extends ControlTypeWithOptions> = <K extends keyof ControlOptionsOfType<T>>(
	key: K,
	value: ControlOptionsOfType<T>[K]
) => Promise<boolean>

/** Set the options of a control, typed for the type of control it is */
export function useControlOptionsSetter<T extends ControlTypeWithOptions>(
	controlId: SomeControlId,
	controlType: T
): ControlOptionsSetter<T> {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	return useCallback(
		async (key, value) =>
			setOptionsFieldMutation.mutateAsync({
				controlId,
				// A key and value of a generic type can't be checked against the union, but they are typed for this control
				change: { controlType, key, value } as ControlOptionsChange,
			}),
		[setOptionsFieldMutation, controlId, controlType]
	)
}
