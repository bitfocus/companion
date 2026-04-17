import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CModalBody, CModalFooter, CModalHeader, CSpinner } from '@coreui/react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'
import { CModalExt } from './CModalExt.js'
import { VariableValueDisplay } from './VariableValueDisplay.js'
import type { JsonValue } from 'type-fest'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { ExpressionInputField } from './ExpressionInputField.js'

interface ExpressionConversionModalProps {
	expression: string
	controlId: string | null
	fieldDefinition?: SomeCompanionInputField
	onConfirm: (value: JsonValue | undefined) => void
	onCancel: () => void
}

export function ExpressionConversionModal({
	expression,
	controlId,
	fieldDefinition,
	onConfirm,
	onCancel,
}: ExpressionConversionModalProps): React.JSX.Element {
	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: controlId,
				expression: expression,
				isVariableString: false,
			},
			{}
		)
	)

	// Keep the latest result in a ref so the confirm handler always uses it, not a stale closure value
	type SubData = typeof sub.data
	const latestDataRef = useRef<SubData>(sub.data)
	if (sub.data) {
		latestDataRef.current = sub.data
	}

	const [showSpinner, setShowSpinner] = useState(false)
	useEffect(() => {
		if (sub.data) {
			setShowSpinner(false)
			return
		}
		const timer = setTimeout(() => setShowSpinner(true), 200)
		return () => clearTimeout(timer)
	}, [sub.data])

	const displayData = sub.data ?? latestDataRef.current

	const computedValueValidation = useMemo(() => {
		if (!fieldDefinition || !displayData?.ok) return null
		return validateInputValue(fieldDefinition, displayData.value as JsonValue | undefined)
	}, [fieldDefinition, displayData])

	// The value to use when confirming — sanitised when validation ran, otherwise raw
	const sanitisedValue =
		computedValueValidation?.sanitisedValue ?? (displayData?.ok ? (displayData.value as JsonValue) : undefined)

	const defaultValue =
		fieldDefinition && 'default' in fieldDefinition ? (fieldDefinition.default as JsonValue) : undefined

	const doConfirm = useCallback(() => {
		onConfirm(sanitisedValue)
	}, [onConfirm, sanitisedValue])

	const doUseDefault = useCallback(() => {
		onConfirm(defaultValue)
	}, [onConfirm, defaultValue])

	return (
		<CModalExt visible onClose={onCancel} transition={false}>
			<CModalHeader closeButton>
				<h5>Convert to text mode</h5>
			</CModalHeader>
			<CModalBody>
				<CAlert color="primary" className="py-2">
					Do you want to replace the expression with its value? Warning: you will not be able to recover the expression!
				</CAlert>

				<h6>Expression</h6>
				<ExpressionInputField value={expression} setValue={() => null} disabled />

				<hr />

				<h6>Computed value</h6>
				{!displayData ? (
					showSpinner ? (
						<CSpinner size="sm" />
					) : (
						<em>Evaluating&hellip;</em>
					)
				) : !displayData.ok ? (
					<span className="text-danger">Error: {displayData.error}</span>
				) : (
					<>
						{!!computedValueValidation?.validationError && (
							<CAlert color="danger" className="mb-2 py-2">
								{computedValueValidation.validationError}
							</CAlert>
						)}
						<VariableValueDisplay
							value={
								computedValueValidation ? computedValueValidation.sanitisedValue : (displayData.value as JsonValue)
							}
							showCopy={false}
							onCopied={() => {}}
							forceExpanded
						/>
						{!computedValueValidation?.validationError &&
							(computedValueValidation?.validationWarnings.length ?? 0) > 0 && (
								<CAlert color="warning" className="mt-2 mb-0 py-2">
									{computedValueValidation!.validationWarnings.join(', ')}
								</CAlert>
							)}
					</>
				)}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={onCancel}>
					Cancel
				</CButton>
				{computedValueValidation?.validationError ? (
					<CButton color="primary" onClick={doUseDefault} disabled={defaultValue === undefined}>
						Use default value
					</CButton>
				) : (
					<CButton color="primary" onClick={doConfirm} disabled={!displayData?.ok}>
						Use computed value
					</CButton>
				)}
			</CModalFooter>
		</CModalExt>
	)
}
