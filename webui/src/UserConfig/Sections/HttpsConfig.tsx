import React, { useCallback } from 'react'
import { CAlert, CButton, CDropdown, CDropdownItem, CDropdownMenu, CDropdownToggle } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faTrash, faUndo } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { UserConfigHeadingRow } from '../Components/UserConfigHeadingRow.js'
import { UserConfigSwitchRow } from '../Components/UserConfigSwitchRow.js'
import { UserConfigProps } from '../Components/Common.js'
import { UserConfigNumberInputRow } from '../Components/UserConfigNumberInputRow.js'
import { UserConfigPortNumberRow } from '../Components/UserConfigPortNumberRow.js'
import { UserConfigTextInputRow } from '../Components/UserConfigTextInputRow.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

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
				<td colSpan={3}>
					<p>An HTTPS server can be enabled for the Companion web interfaces should your deployment require it.</p>
					<CAlert color="danger">
						Never expose the Companion web interface directly to the Internet. Note that HTTPS alone does not provide
						additional security for this configuration.
					</CAlert>
				</td>
			</tr>

			<UserConfigSwitchRow userConfig={props} label="HTTPS Web Server" field="https_enabled" />

			{props.config.https_enabled && (
				<>
					<UserConfigPortNumberRow userConfig={props} label="HTTPS Port" field="https_port" />

					<tr>
						<td>Certificate Type</td>
						<td>
							<CDropdown className="mt-2" style={{ display: 'inline-block', overflow: 'visible' }}>
								<CDropdownToggle>
									{props.config.https_cert_type === 'external' ? 'External' : 'Self Signed'}
								</CDropdownToggle>
								<CDropdownMenu>
									<CDropdownItem onClick={() => props.setValue('https_cert_type', 'self')}>Self Signed</CDropdownItem>
									<CDropdownItem onClick={() => props.setValue('https_cert_type', 'external')}>External</CDropdownItem>
								</CDropdownMenu>
							</CDropdown>
						</td>
						<td>
							<CButton onClick={() => props.resetValue('https_cert_type')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>

					{props.config.https_cert_type === 'self' && (
						<tr>
							<td colSpan={3}>
								<table className="table table-responsive-sm">
									<tbody>
										<tr>
											<td colSpan={3}>This tool will help create a self-signed certificate for the server to use.</td>
										</tr>

										<UserConfigTextInputRow
											userConfig={props}
											label="Common Name (Domain Name)"
											field="https_self_cn"
										/>
										<UserConfigNumberInputRow
											userConfig={props}
											label="Certificate Expiry Days"
											field="https_self_expiry"
											min={1}
											max={65535}
										/>

										<tr>
											<td>
												Certificate Details
												<br />
												{props.config.https_self_cert && props.config.https_self_cert.length > 0 ? (
													<ul>
														<li>Common Name: {props.config.https_self_cert_cn}</li>
														<li>Created: {props.config.https_self_cert_created}</li>
														<li>Expiry Period: {props.config.https_self_cert_expiry}</li>
													</ul>
												) : (
													<ul>
														<li>No certificate available</li>
													</ul>
												)}
											</td>
											<td>
												{props.config.https_self_cert && props.config.https_self_cert.length > 0 ? (
													<p>
														<CButton onClick={renewSslCertificate} color="success" className="mb-2">
															<FontAwesomeIcon icon={faSync} />
															&nbsp;Renew
														</CButton>
														<br />
														<CButton onClick={deleteSslCertificate} color="danger">
															<FontAwesomeIcon icon={faTrash} />
															&nbsp;Delete
														</CButton>
													</p>
												) : (
													<CButton onClick={createSslCertificate} color="success">
														<FontAwesomeIcon icon={faSync} />
														&nbsp;Generate
													</CButton>
												)}
											</td>
											<td>&nbsp;</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					)}

					{props.config.https_cert_type === 'external' && (
						<tr>
							<td colSpan={3}>
								<table className="table table-responsive-sm">
									<tbody>
										<tr>
											<td colSpan={3}>
												<p>
													This requires you to generate your own self-signed certificate or go through a certificate
													authority. A properly signed certificate will work.
												</p>
												<CAlert color="danger">
													This option is provided as-is. Support will not be provided for this feature. <br />
													DO NOT POST GITHUB ISSUES IF THIS DOES NOT WORK.
												</CAlert>
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
											label={
												<>
													Chain File (full path)
													<br />
													*Optional
												</>
											}
											field="https_ext_chain"
										/>
									</tbody>
								</table>
							</td>
						</tr>
					)}
				</>
			)}
		</>
	)
})
