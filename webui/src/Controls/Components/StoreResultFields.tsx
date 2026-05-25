import { observer } from 'mobx-react-lite'
import { useCallback, useRef } from 'react'
import { ControlLocationOption } from '@companion-app/shared/ControlLocation.js'
import {
	CustomVariableCreateIfNotExistsOption,
	CustomVariableSelectorOption,
} from '@companion-app/shared/CustomVariable.js'
import { LocalVariableNameOption } from '@companion-app/shared/LocalVariable.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	type RawStoreResult,
	type RawStoreResultCustomVariable,
	type RawStoreResultLocalVariable,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	exprVal,
	type CompanionInputFieldDropdownExtended,
	type ExpressionOrValue,
} from '@companion-app/shared/Model/Options.js'
import type { JsonValue } from '@companion-module/host'
import type { LocalVariablesStore } from '../LocalVariablesStore.js'
import { OptionsInputField } from '../OptionsInputField.js'

type StoreType = NonNullable<RawStoreResult>['type'] | 'discard'

interface LocalVariableControlsProps {
	isLocatedInGrid: boolean
	controlId: string
	tmpValue: React.MutableRefObject<RawStoreResultLocalVariable>
	value: RawStoreResultLocalVariable
	setValue: (val: RawStoreResultLocalVariable) => void
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

export const LocalVariableControls = observer(function LocalVariableControls({
	isLocatedInGrid,
	controlId,
	tmpValue,
	value,
	setValue,
	readonly,
	localVariablesStore,
}: LocalVariableControlsProps) {
	const entityType = EntityModelType.Action

	const setLocation = useCallback(
		(_key: string, location: ExpressionOrValue<JsonValue | undefined>) => {
			tmpValue.current = {
				...tmpValue.current,
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				location: location.isExpression ? location : exprVal(String(location.value)),
			}
			setValue(tmpValue.current)
		},
		[tmpValue, setValue]
	)

	const setVariableName = useCallback(
		(_key: string, variableName: ExpressionOrValue<JsonValue | undefined>) => {
			tmpValue.current = {
				...tmpValue.current,
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				variableName: variableName.isExpression ? variableName : exprVal(String(variableName.value)),
			}
			setValue(tmpValue.current)
		},
		[tmpValue, setValue]
	)

	return (
		<>
			<OptionsInputField
				allowInternalFields={true}
				isLocatedInGrid={isLocatedInGrid}
				entityType={entityType}
				controlId={controlId}
				option={ControlLocationOption}
				value={value.location}
				setValue={setLocation}
				readonly={readonly}
				visibility={true}
				localVariablesStore={localVariablesStore}
				fieldSupportsExpression={true}
			/>
			<OptionsInputField
				allowInternalFields={true}
				isLocatedInGrid={isLocatedInGrid}
				entityType={entityType}
				controlId={controlId}
				option={LocalVariableNameOption}
				value={value.variableName}
				setValue={setVariableName}
				readonly={readonly}
				visibility={true}
				localVariablesStore={localVariablesStore}
				fieldSupportsExpression={true}
			/>
		</>
	)
})

interface CustomVariableControlsProps {
	isLocatedInGrid: boolean
	controlId: string
	tmpValue: React.MutableRefObject<RawStoreResultCustomVariable>
	value: RawStoreResultCustomVariable
	setValue: (val: RawStoreResultCustomVariable) => void
	readonly: boolean // XXX necessary?
	localVariablesStore: LocalVariablesStore | null
}

const CustomVariableControls = observer(function CustomVariableControls({
	isLocatedInGrid,
	controlId,
	tmpValue,
	value,
	setValue,
	readonly,
	localVariablesStore,
}: CustomVariableControlsProps) {
	const entityType = EntityModelType.Action

	const setVariableName = useCallback(
		(_key: string, variableName: ExpressionOrValue<JsonValue | undefined>) => {
			tmpValue.current = {
				...tmpValue.current,
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				variableName: variableName.isExpression ? variableName : exprVal(String(variableName.value)),
			}
			setValue(tmpValue.current)
		},
		[tmpValue, setValue]
	)

	const setCreateIfNotExists = useCallback(
		(_key: string, createIfNotExists: ExpressionOrValue<JsonValue | undefined>) => {
			tmpValue.current = {
				...tmpValue.current,
				createIfNotExists: createIfNotExists.isExpression ? false : !!createIfNotExists.value,
			}
			setValue(tmpValue.current)
		},
		[tmpValue, setValue]
	)

	return (
		<>
			<OptionsInputField
				allowInternalFields={true}
				isLocatedInGrid={isLocatedInGrid}
				entityType={entityType}
				controlId={controlId}
				option={CustomVariableSelectorOption}
				value={value.variableName}
				setValue={setVariableName}
				readonly={readonly}
				visibility={true}
				localVariablesStore={localVariablesStore}
				fieldSupportsExpression={true}
			/>
			<OptionsInputField
				allowInternalFields={true}
				isLocatedInGrid={isLocatedInGrid}
				entityType={entityType}
				option={CustomVariableCreateIfNotExistsOption}
				value={exprVal(value.createIfNotExists)}
				setValue={setCreateIfNotExists}
				readonly={readonly}
				visibility={true}
				localVariablesStore={localVariablesStore}
				fieldSupportsExpression={false}
			/>
		</>
	)
})

const StoreResultTargetOption = {
	id: 'storeResultTarget',
	type: 'dropdown',
	choices: [
		{ id: 'discard', label: '<discard>' },
		{ id: 'local-variable', label: 'Local variable' },
		{ id: 'custom-variable', label: 'Custom variable' },
	] satisfies (DropdownChoice & { id: StoreType })[],
	default: 'discard',
	label: 'Store Action Result',
	tooltip: 'The action result will be stored here',
	disableAutoExpression: true,
} as const satisfies CompanionInputFieldDropdownExtended

interface StoreResultProps {
	isLocatedInGrid: boolean
	controlId: string
	storeResult: RawStoreResult | undefined
	setStoreResult: (val: RawStoreResult | undefined) => void
	readonly: boolean
	localVariablesStore: LocalVariablesStore | null
}

export const StoreResultFields = observer(function StoreResultFields({
	isLocatedInGrid,
	controlId,
	storeResult,
	setStoreResult,
	readonly,
	localVariablesStore,
}: StoreResultProps) {
	const targetType: StoreType = storeResult?.type ?? 'discard'

	const entityType = EntityModelType.Action

	const localVariableTarget = useRef<RawStoreResultLocalVariable>(
		storeResult?.type === 'local-variable'
			? storeResult
			: {
					type: 'local-variable',
					location: exprVal(ControlLocationOption.default),
					variableName: exprVal(LocalVariableNameOption.default),
				}
	)

	const customVariableTarget = useRef<RawStoreResultCustomVariable>(
		storeResult?.type === 'custom-variable'
			? storeResult
			: {
					type: 'custom-variable',
					variableName: exprVal(''),
					createIfNotExists: false,
				}
	)

	const switchTargetType = useCallback(
		(_key: string, target: ExpressionOrValue<JsonValue | undefined>) => {
			switch (target.value) {
				case 'discard':
				default:
					setStoreResult(undefined)
					break
				case 'local-variable':
					setStoreResult(localVariableTarget.current)
					break
				case 'custom-variable':
					setStoreResult(customVariableTarget.current)
					break
			}
		},
		[setStoreResult]
	)

	return (
		<>
			<OptionsInputField
				allowInternalFields={true}
				isLocatedInGrid={isLocatedInGrid}
				entityType={entityType}
				option={StoreResultTargetOption}
				value={exprVal(targetType)}
				setValue={switchTargetType}
				readonly={readonly}
				visibility={true}
				localVariablesStore={null}
				fieldSupportsExpression={false}
			/>

			{storeResult?.type === 'local-variable' ? (
				<LocalVariableControls
					isLocatedInGrid={isLocatedInGrid}
					controlId={controlId}
					tmpValue={localVariableTarget}
					value={localVariableTarget.current}
					setValue={setStoreResult}
					readonly={readonly}
					localVariablesStore={localVariablesStore}
				/>
			) : storeResult?.type === 'custom-variable' ? (
				<>
					<CustomVariableControls
						isLocatedInGrid={isLocatedInGrid}
						controlId={controlId}
						tmpValue={customVariableTarget}
						value={customVariableTarget.current}
						setValue={setStoreResult}
						readonly={readonly}
						localVariablesStore={localVariablesStore}
					/>
				</>
			) : null}
		</>
	)
})
