import { useCallback, useEffect, useRef, useState } from 'react'
import { CAlert, CButton, CModalBody, CModalFooter, CModalHeader, CSpinner } from '@coreui/react'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'
import { CModalExt } from './CModalExt.js'
import { VariableValueDisplay } from './VariableValueDisplay.js'
import type { JsonValue } from 'type-fest'

interface ExpressionConversionModalProps {
	expression: string
	controlId: string | null
	onConfirm: (value: JsonValue | undefined) => void
	onCancel: () => void
}

export function ExpressionConversionModal({
	expression,
	controlId,
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

	const doConfirm = useCallback(() => {
		const data = latestDataRef.current
		const value = data?.ok ? data.value : undefined
		onConfirm(value as JsonValue | undefined)
	}, [onConfirm])

	const computedValueDisplay = (): React.ReactNode => {
		if (!displayData) {
			if (!showSpinner) return <em>Evaluating&hellip;</em>
			return <CSpinner size="sm" />
		}
		if (!displayData.ok) {
			return <span className="text-danger">Error: {displayData.error}</span>
		}
		return <VariableValueDisplay value={displayData.value} showCopy={false} onCopied={() => {}} />
	}

	return (
		<CModalExt visible onClose={onCancel} transition={false}>
			<CModalHeader closeButton>
				<h5>Disable expression mode</h5>
			</CModalHeader>
			<CModalBody>
				<CAlert color="info">This expression will be lost and replaced with the current computed value.</CAlert>

				<h6>Expression</h6>
				<pre
					style={{
						whiteSpace: 'pre-wrap',
						wordBreak: 'break-all',
						maxHeight: '8em',
						overflowY: 'auto',
						padding: '0.5rem 0.75rem',
						borderRadius: '0.25rem',
						border: '1px solid var(--cui-border-color)',
						background: 'var(--cui-tertiary-bg)',
					}}
				>
					{expression}
				</pre>
				<hr />
				<h6>Computed value</h6>
				{computedValueDisplay()}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={onCancel}>
					Cancel
				</CButton>
				<CButton color="primary" onClick={doConfirm}>
					Use computed value
				</CButton>
			</CModalFooter>
		</CModalExt>
	)
}
