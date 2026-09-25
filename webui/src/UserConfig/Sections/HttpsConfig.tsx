import { faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { SimpleDropdownInputField } from '~/Components/DropdownInputFieldSimple.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { ResetButton, type UserConfigProps } from '../Components/Common.js'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'
import { UserConfigPortNumberRow } from '../Components/UserConfigPortNumberRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'

export const HttpsConfig = observer(function HttpsConfig(props: UserConfigProps) {
	const createSslCertificateMutation = useMutationExt(trpc.userConfig.sslCertificateCreate.mutationOptions())
	const deleteSslCertificateMutation = useMutationExt(trpc.userConfig.sslCertificateDelete.mutationOptions())
	const renewSslCertificateMutation = useMutationExt(trpc.userConfig.sslCertificateRenew.mutationOptions())

	const createSslCertificate = useCallback(() => {
		console.log('create SSL certificate')
		createSslCertificateMutation.mutateAsync().catch((err) => {
			console.error('Failed to create SSL certificate:', err)
		})
	}, [createSslCertificateMutation])

	const deleteSslCertificate = useCallback(() => {
		console.log('delete SSL certificate')
		deleteSslCertificateMutation.mutateAsync().catch((err) => {
			console.error('Failed to delete SSL certificate:', err)
		})
	}, [deleteSslCertificateMutation])

	const renewSslCertificate = useCallback(() => {
		console.log('renew SSL certificate')
		renewSslCertificateMutation.mutateAsync().catch((err) => {
			console.error('Failed to renew SSL certificate:', err)
		})
	}, [renewSslCertificateMutation])

	return (
		<>
			<UserConfigHeadingRow label="HTTPS Web Server" />

			<tr>
				<td colSpan={3} className="bg-surface-muted/20 p-4">
					<p className="text-xs text-muted mb-2">
						An HTTPS server can be enabled for the Companion web interfaces should your deployment require encrypted
						transport.
					</p>
					<StaticAlert color="danger" className="mb-0 text-xs">
						Never expose the Companion web interface directly to the Internet. HTTPS alone does not protect an
						unauthenticated or publicly accessible installation.
					</StaticAlert>
				</td>
			</tr>

			<UserConfigSwitchRow userConfig={props} label="HTTPS Web Server" field="https_enabled" />

			{props.config.https_enabled && (
				<>
					<UserConfigPortNumberRow userConfig={props} label="HTTPS Port" field="https_port" />

					<tr>
						<td>Certificate Type</td>
						<td>
							<SimpleDropdownInputField
								id={undefined}
								value={props.config.https_cert_type}
								setValue={(val) => props.setValue('https_cert_type', val)}
								choices={certTypeOptions}
							/>
						</td>
						<td>
							<ResetButton userConfig={props} field="https_cert_type" />
						</td>
					</tr>

					{props.config.https_cert_type === 'self' && (
						<>
							<UserConfigTextInputRow userConfig={props} label="Common Name (Domain Name)" field="https_self_cn" />
							<UserConfigNumberInputRow
								userConfig={props}
								label="Certificate Expiry Days"
								field="https_self_expiry"
								min={1}
								max={65535}
							/>

							<tr>
								<td>
									<div className="font-semibold text-body mb-1">Certificate Details</div>
									{props.config.https_self_cert && props.config.https_self_cert.length > 0 ? (
										<div className="text-xs text-muted space-y-1">
											<div>
												<span className="font-medium text-body">Common Name:</span> {props.config.https_self_cert_cn}
											</div>
											<div>
												<span className="font-medium text-body">Created:</span> {props.config.https_self_cert_created}
											</div>
											<div>
												<span className="font-medium text-body">Validity:</span> {props.config.https_self_cert_expiry}{' '}
												days
											</div>
										</div>
									) : (
										<div className="text-xs text-muted italic">No certificate generated yet</div>
									)}
								</td>
								<td className="settings-value-end">
									<div className="flex items-center justify-end gap-2">
										{props.config.https_self_cert && props.config.https_self_cert.length > 0 ? (
											<>
												<Button onClick={renewSslCertificate} color="success" size="sm">
													<FontAwesomeIcon icon={faSync} className="me-1.5" />
													Renew Certificate
												</Button>
												<Button onClick={deleteSslCertificate} color="danger" size="sm">
													<FontAwesomeIcon icon={faTrash} className="me-1.5" />
													Delete
												</Button>
											</>
										) : (
											<Button onClick={createSslCertificate} color="success" size="sm">
												<FontAwesomeIcon icon={faSync} className="me-1.5" />
												Generate Self-Signed Certificate
											</Button>
										)}
									</div>
								</td>
								<td />
							</tr>
						</>
					)}

					{props.config.https_cert_type === 'external' && (
						<>
							<tr>
								<td colSpan={3} className="bg-surface-muted/20 p-4">
									<p className="text-xs text-muted mb-2">
										Provide absolute filesystem paths to your custom certificate and private key files.
									</p>
									<StaticAlert color="warning" className="mb-0 text-xs">
										Ensure the files are accessible and readable by the Companion service process.
									</StaticAlert>
								</td>
							</tr>

							<UserConfigTextInputRow
								userConfig={props}
								label="Private Key File (full path)"
								field="https_ext_private_key"
							/>
							<UserConfigTextInputRow
								userConfig={props}
								label="Certificate File (full path)"
								field="https_ext_certificate"
							/>
							<UserConfigTextInputRow
								userConfig={props}
								label="Certificate Chain File (optional full path)"
								field="https_ext_chain"
							/>
						</>
					)}
				</>
			)}
		</>
	)
})

const certTypeOptions: DropdownChoice[] = [
	{ id: 'self', label: 'Self Signed' },
	{ id: 'external', label: 'External' },
]
