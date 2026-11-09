import type { JsonValue } from 'type-fest'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

/*
 * The stored value of an option can be anything (old data, an import, a module's default), so these give a field the
 * type of value it shows. A value of the wrong type shows as empty, and the field's validation reports it.
 */

export function optionValueAsString(value: JsonValue | undefined): string {
	if (value === undefined || value === null) return ''
	return typeof value === 'string' ? value : (stringifyVariableValue(value) ?? '')
}

export function optionValueAsStringOrNull(value: JsonValue | undefined): string | null {
	return typeof value === 'string' ? value : null
}

export function optionValueAsStrings(value: JsonValue | undefined): string[] {
	return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
}

export function isDropdownChoiceId(value: JsonValue | undefined): value is DropdownChoiceId {
	return typeof value === 'string' || typeof value === 'number'
}

export function optionValueAsChoiceId(value: JsonValue | undefined): DropdownChoiceId {
	return isDropdownChoiceId(value) ? value : ''
}

export function optionValueAsChoiceIds(value: JsonValue | undefined): DropdownChoiceId[] {
	return Array.isArray(value) ? value.filter(isDropdownChoiceId) : []
}

export function optionValueAsNumber(value: JsonValue | undefined): number | null {
	return typeof value === 'number' ? value : null
}

export function optionValueAsColor(value: JsonValue | undefined): number | string {
	return isDropdownChoiceId(value) ? value : 0
}
