import { ExpressionOrValue, ButtonGraphicsElementBase } from '@companion-app/shared/Model/StyleLayersModel.js'
import { CFormLabel, CCol, CButton } from '@coreui/react'
import { faDollarSign, faFont } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useCallback, useContext } from 'react'
import { TextInputField } from '../../../Components/TextInputField.js'
import { LocalVariablesStore } from '../../../Controls/LocalVariablesStore.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../../../Stores/RootAppStore.js'

type ExtractValue<T> = T extends ExpressionOrValue<infer U> ? U : never
type SetValueFn<TObj, TKey extends keyof TObj> = (value: ExtractValue<TObj[TKey]>) => void

export interface InputFieldCommonProps<TObj, TKey extends keyof TObj> {
	elementProp: { value: ExtractValue<TObj[TKey]> }
	setValue: SetValueFn<TObj, TKey>
}

interface FormPropertyFieldProps<TObj, TKey extends keyof TObj> {
	controlId: string
	elementProps: TObj
	property: TKey
	label: string | React.ReactNode
	localVariablesStore: LocalVariablesStore
	children: (elementProp: { value: ExtractValue<TObj[TKey]> }, setValue: SetValueFn<TObj, TKey>) => React.ReactNode
}
export const FormPropertyField = observer(function FormPropertyField<
	TObj extends ButtonGraphicsElementBase,
	TKey extends string & keyof TObj,
>({ controlId, elementProps, property, label, localVariablesStore, children }: FormPropertyFieldProps<TObj, TKey>) {
	const { socket } = useContext(RootAppStoreContext)

	const elementId = elementProps.id

	const setValue = useCallback(
		(value: ExtractValue<TObj[TKey]>) => {
			socket
				.emitPromise('controls:style:update-option-value', [controlId, elementId, property, value])
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[socket, controlId, elementId, property]
	)

	const setIsExpression = useCallback(
		(value: boolean) => {
			socket
				.emitPromise('controls:style:update-option-is-expression', [controlId, elementId, property, value])
				.then((res) => {
					console.log('Update element', res)
				})
				.catch((e) => {
					console.error('Failed to Update element', e)
				})
		},
		[socket, controlId, elementId, property]
	)

	const elementProp = elementProps[property] as ExpressionOrValue<any>
	const toggleExpression = useCallback(() => setIsExpression(!elementProp.isExpression), [setIsExpression, elementProp])

	return (
		<>
			<CFormLabel className={classNames('col-sm-4 col-form-label col-form-label-sm')}>{label}</CFormLabel>
			<CCol sm={8} className="field-with-expression">
				<div className="expression-field">
					{elementProp.isExpression ? (
						<TextInputField
							setValue={setValue as (value: string) => void}
							value={elementProp.value ?? ''}
							useVariables
							localVariables={localVariablesStore.getOptions(null, false, true)}
							isExpression
						/>
					) : (
						children(elementProp, setValue)
					)}
				</div>
				<div className="expression-toggle-button">
					<CButton
						color="info"
						variant="outline"
						onClick={toggleExpression}
						title={elementProp.isExpression ? 'Expression mode ' : 'Value mode'}
					>
						<FontAwesomeIcon icon={elementProp.isExpression ? faDollarSign : faFont} />
					</CButton>
				</div>
			</CCol>
		</>
	)
})
