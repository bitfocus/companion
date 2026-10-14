import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import { Button } from '~/Components/Button'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { UserConfigProps } from '../Components/Common.js'
import { ConfigFieldRow } from '../Components/ConfigFieldRows.js'

export const MetricsConfig = observer(function MetricsConfig(props: UserConfigProps) {
	const regenerateTokenMutation = useMutationExt(trpc.userConfig.prometheusTokenRegenerate.mutationOptions())

	const regenerateToken = useCallback(() => {
		regenerateTokenMutation.mutateAsync().catch((err) => {
			console.error('Failed to regenerate Prometheus token:', err)
		})
	}, [regenerateTokenMutation])

	const tokenId = useId()

	return (
		<ConfigFieldRow
			label="Scrape Token"
			htmlFor={tokenId}
			help={
				<>
					<p className="mb-1">Example Prometheus scrape config:</p>
					<pre className="whitespace-pre-wrap break-all mb-0">
						{`scrape_configs:
  - job_name: companion
    metrics_path: /api/metrics
    authorization:
      credentials: ${props.config.prometheus_token}
    static_configs:
      - targets: ['HOST:PORT']`}
					</pre>
				</>
			}
		>
			<div className="grow min-w-0">
				<TextInputField
					id={tokenId}
					value={props.config.prometheus_token}
					setValue={(value) => props.setValue('prometheus_token', value)}
				/>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={regenerateToken}
				title="Regenerate token (invalidates the current one)"
			>
				<FontAwesomeIcon icon={faSync} />
			</Button>
		</ConfigFieldRow>
	)
})
