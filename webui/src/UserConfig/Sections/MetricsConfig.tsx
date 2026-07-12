import { faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Button } from '~/Components/Button'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'

export const MetricsConfig = observer(function MetricsConfig(props: UserConfigProps) {
	const regenerateTokenMutation = useMutationExt(trpc.userConfig.prometheusTokenRegenerate.mutationOptions())

	const regenerateToken = useCallback(() => {
		regenerateTokenMutation.mutateAsync().catch((err) => {
			console.error('Failed to regenerate Prometheus token:', err)
		})
	}, [regenerateTokenMutation])

	return (
		<>
			<UserConfigHeadingRow label="Prometheus Metrics" />

			<tr>
				<td colSpan={3}>
					<p>
						Exposes a Prometheus-compatible metrics endpoint at <code>/api/metrics</code> reporting memory usage, the
						drawing pipeline and high-level counts. Scrape it with the bearer token below.
					</p>
				</td>
			</tr>

			<UserConfigSwitchRow userConfig={props} label="Prometheus metrics endpoint" field="prometheus_enabled" />

			{props.config.prometheus_enabled && (
				<>
					<tr>
						<td colSpan={3}>
							{/* This is ugly, but it works well enough for now */}
							<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
								<span style={{ flex: '0 0 auto' }}>Scrape token</span>
								<div style={{ flex: 1, minWidth: 0 }}>
									<TextInputField
										id={undefined}
										value={props.config.prometheus_token}
										setValue={(value) => props.setValue('prometheus_token', value)}
									/>
								</div>
								<Button onClick={regenerateToken} title="Regenerate token (invalidates the current one)">
									<FontAwesomeIcon icon={faSync} />
								</Button>
							</div>
						</td>
					</tr>

					<tr>
						<td colSpan={3}>
							<p>Example Prometheus scrape config:</p>
							<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
								{`scrape_configs:
  - job_name: companion
    metrics_path: /api/metrics
    authorization:
      credentials: ${props.config.prometheus_token}
    static_configs:
      - targets: ['HOST:PORT']`}
							</pre>
						</td>
					</tr>
				</>
			)}
		</>
	)
})
