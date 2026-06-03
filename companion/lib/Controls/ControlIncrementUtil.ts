import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'

type IncrementPathSegment = string | number
type IncrementPath = IncrementPathSegment[]

export interface ControlIncrementOption {
	id: string
	label: string
	currentValue: string
	valueType: 'number' | 'text'
}

interface InternalControlIncrementOption extends ControlIncrementOption {
	path: IncrementPath
}

const numericTextRegex = /-?\d+(?:\.\d+)?/
const numericTextGlobalRegex = /-?\d+(?:\.\d+)?/g
const hexColorRegex = /^#?[0-9a-f]{6,8}$/i

export function getControlIncrementOptions(controlJson: SomeControlModel): ControlIncrementOption[] {
	return collectControlIncrementOptions(controlJson).map(({ path: _path, ...field }) => field)
}

export function incrementControlModelFields(
	controlJson: SomeControlModel,
	selectedFieldIds: string[],
	incrementBy: number
): SomeControlModel {
	if (!selectedFieldIds.length || incrementBy === 0) return controlJson

	const selectedFields = new Set(selectedFieldIds)
	const candidates = collectControlIncrementOptions(controlJson)

	for (const candidate of candidates) {
		if (!selectedFields.has(candidate.id)) continue

		const target = getTargetByPath(controlJson, candidate.path)
		if (!target) continue

		const currentValue = getContainerValue(target.container, target.key)
		if (typeof currentValue === 'number') {
			setContainerValue(target.container, target.key, currentValue + incrementBy)
		} else if (typeof currentValue === 'string') {
			setContainerValue(target.container, target.key, incrementNumbersInString(currentValue, incrementBy))
		}
	}

	return controlJson
}

function collectControlIncrementOptions(controlJson: SomeControlModel): InternalControlIncrementOption[] {
	const result: InternalControlIncrementOption[] = []

	const visit = (value: unknown, path: IncrementPath, parent: unknown): void => {
		if (isIncrementCandidateValue(value, path, parent)) {
			result.push({
				id: encodePath(path),
				label: formatIncrementPath(controlJson, path),
				currentValue: String(value),
				valueType: typeof value === 'number' ? 'number' : 'text',
				path,
			})
		}

		if (Array.isArray(value)) {
			value.forEach((entry, index) => visit(entry, [...path, index], value))
		} else if (isObject(value)) {
			for (const [key, entry] of Object.entries(value)) {
				visit(entry, [...path, key], value)
			}
		}
	}

	visit(controlJson, [], null)

	return result.sort(compareIncrementOptions)
}

function compareIncrementOptions(a: InternalControlIncrementOption, b: InternalControlIncrementOption): number {
	return getIncrementOptionSortPriority(a.path) - getIncrementOptionSortPriority(b.path)
}

function getIncrementOptionSortPriority(path: IncrementPath): number {
	return path[0] === 'localVariables' ? 0 : 1
}

function isIncrementCandidateValue(value: unknown, path: IncrementPath, parent: unknown): boolean {
	if (path[path.length - 1] !== 'value') return false
	if (!isExpressionValueObject(parent) || parent.isExpression) return false

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return false
	} else if (typeof value === 'string') {
		if (!numericTextRegex.test(value)) return false
		if (hexColorRegex.test(value.trim())) return false
	} else {
		return false
	}

	return isAllowedExpressionValuePath(path)
}

function isAllowedExpressionValuePath(path: IncrementPath): boolean {
	const previous = path[path.length - 2]

	if (previous === 'text') return true
	if (previous === 'override') return true
	if (typeof previous === 'string' && previous.startsWith('opt:')) return true

	const optionsIndex = path.lastIndexOf('options')
	return optionsIndex === path.length - 3
}

function incrementNumbersInString(value: string, incrementBy: number): string {
	return value.replace(numericTextGlobalRegex, (match) => {
		const nextValue = Number(match) + incrementBy
		if (!Number.isFinite(nextValue)) return match

		if (match.includes('.')) {
			return String(Number(nextValue.toFixed(12)))
		}

		const unsignedOriginal = match.replace(/^-/, '')
		const unsignedNext = String(Math.abs(nextValue))
		const paddedNext = unsignedNext.padStart(unsignedOriginal.length, '0')

		return nextValue < 0 ? `-${paddedNext}` : paddedNext
	})
}

function encodePath(path: IncrementPath): string {
	return `/${path.map((segment) => String(segment).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`
}

function getTargetByPath(
	root: unknown,
	path: IncrementPath
): { container: Record<string, any> | any[]; key: string | number } | null {
	if (path.length === 0) return null

	let container = root
	for (const segment of path.slice(0, -1)) {
		if (!isObject(container) && !Array.isArray(container)) return null
		container = (container as any)[segment]
	}

	if (!isObject(container) && !Array.isArray(container)) return null

	return {
		container,
		key: path[path.length - 1],
	}
}

function getContainerValue(container: Record<string, any> | any[], key: string | number): unknown {
	return Array.isArray(container) ? container[Number(key)] : container[String(key)]
}

function setContainerValue(container: Record<string, any> | any[], key: string | number, value: unknown): void {
	if (Array.isArray(container)) {
		container[Number(key)] = value
	} else {
		container[String(key)] = value
	}
}

function formatIncrementPath(controlJson: SomeControlModel, path: IncrementPath): string {
	const optionKey = formatOptionKey(String(path[path.length - 2] ?? 'value'))

	const actionSetsIndex = path.indexOf('action_sets')
	if (actionSetsIndex >= 0) {
		const setId = path[actionSetsIndex + 1]
		const actionIndex = path[actionSetsIndex + 2]
		const actionNumber = typeof actionIndex === 'number' ? actionIndex + 1 : String(actionIndex ?? '?')

		return `${formatActionSetId(setId)} action ${actionNumber} / ${optionKey}`
	}

	if (path[0] === 'feedbacks' && typeof path[1] === 'number') {
		return `Feedback ${path[1] + 1} / ${optionKey}`
	}

	if (path[0] === 'localVariables' && typeof path[1] === 'number') {
		return `Local variable ${path[1] + 1}${formatLocalVariableName(controlJson, path[1])} | ${optionKey}:`
	}

	if (path[0] === 'style' && path[1] === 'layers') {
		return `Button label ${formatLayerName(controlJson, path)} / ${optionKey}`
	}

	return path.map((segment) => formatOptionKey(String(segment))).join(' / ')
}

function formatLayerName(controlJson: SomeControlModel, path: IncrementPath): string {
	let layerName = ''

	for (let i = 0; i < path.length; i++) {
		const previous = path[i - 1]
		const segment = path[i]
		if (typeof segment !== 'number' || (previous !== 'layers' && previous !== 'children')) continue

		const layer = getValueByPath(controlJson, path.slice(0, i + 1))
		if (isObject(layer) && typeof layer.name === 'string' && layer.name) {
			layerName = layer.name
		}
	}

	return layerName ? `"${layerName}"` : ''
}

function formatLocalVariableName(controlJson: SomeControlModel, index: number): string {
	const variable = getValueByPath(controlJson, ['localVariables', index])

	if (isObject(variable) && typeof variable.variableName === 'string' && variable.variableName) {
		return ` (${variable.variableName})`
	}

	return ''
}

function getValueByPath(root: unknown, path: IncrementPath): unknown {
	let value = root
	for (const segment of path) {
		if (!isObject(value) && !Array.isArray(value)) return undefined
		value = (value as any)[segment]
	}
	return value
}

function formatActionSetId(setId: IncrementPathSegment | undefined): string {
	switch (setId) {
		case 'down':
			return 'Press'
		case 'up':
			return 'Release'
		case 'rotate_left':
			return 'Rotate left'
		case 'rotate_right':
			return 'Rotate right'
		default:
			return `Step ${String(setId ?? '?')}`
	}
}

function formatOptionKey(key: string): string {
	return key.replace(/^opt:/, '').replace(/_/g, ' ')
}

function isExpressionValueObject(value: unknown): value is { value: unknown; isExpression: boolean } {
	return isObject(value) && 'value' in value && value.isExpression === false
}

function isObject(value: unknown): value is Record<string, any> {
	return typeof value === 'object' && value !== null
}
