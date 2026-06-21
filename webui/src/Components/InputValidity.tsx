/* eslint-disable react-refresh/only-export-components */
import { CheckIcon, XIcon } from 'lucide-react'

export type InputValidity = 'valid' | 'invalid' | 'unknown'

/**
 * Compute the tri-state validity of an input value.
 * - `unknown` when there is no rule to check against (`checkValid` is undefined, or returns
 *   `undefined`), or when the field accepts variables and the value contains an unresolved variable
 *   like `$(internal:foo)` which can't be meaningfully checked.
 * - `valid` / `invalid` otherwise, based on `checkValid`.
 *
 * `checkValid` may itself return `undefined` to signal "no rule applied" (e.g. the `validity` field
 * from `validateInputValue`), which is how a field reports it has no validation without anything
 * having to disable the check.
 *
 * @param allowVariables Whether the field accepts variables. Only then is `$(...)` treated as
 *   unknown; otherwise `$(` is literal text and is validated normally.
 */
export function computeInputValidity(
	checkValid: boolean | ((value: string) => boolean | undefined) | undefined,
	value: string,
	allowVariables = false
): InputValidity {
	if (checkValid === undefined) return 'unknown'
	if (allowVariables && value.includes('$(')) return 'unknown'
	const result = typeof checkValid === 'boolean' ? checkValid : checkValid(value)
	if (result === undefined) return 'unknown'
	return result ? 'valid' : 'invalid'
}

export function InputValidityIcon({ validity }: { validity: InputValidity }): React.JSX.Element | null {
	if (validity === 'unknown') return null
	return validity === 'valid' ? (
		<CheckIcon className="input-validity-icon input-validity-icon--valid" />
	) : (
		<XIcon className="input-validity-icon input-validity-icon--invalid" />
	)
}
