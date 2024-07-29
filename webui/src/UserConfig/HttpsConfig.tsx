import React, { useCallback, useContext } from 'react'
import {
	CAlert,
	CButton,
	CDropdown,
	CDropdownItem,
	CDropdownMenu,
	CDropdownToggle,
	CFormInput,
	CFormSwitch,
} from '@coreui/react'
import { SocketContext } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSync, faTrash, faUndo } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import { observer } from 'mobx-react-lite'

interface HttpsConfigProps {
	config: UserConfigModel
	setValue: (key: keyof UserConfigModel, value: any) => void
	resetValue: (key: keyof UserConfigModel) => void
}

export const HttpsConfig = observer(function HttpsConfig({ config, setValue, resetValue }: HttpsConfigProps) {
	const socket = useContext(SocketContext)

	const createSslCertificate = useCallback(() => {
		console.log('create SSL certificate')
		socket.emit('ssl_certificate_create')
	}, [socket])

	const deleteSslCertificate = useCallback(() => {
		console.log('delete SSL certificate')
		socket.emit('ssl_certificate_delete')
	}, [socket])

	const renewSslCertificate = useCallback(() => {
		console.log('renew SSL certificate')
		socket.emit('ssl_certificate_renew')
	}, [socket])

	return (
		<>
			<tr>
				<th colSpan={3} className="settings-category">
					HTTPS Web Server
				</th>
			</tr>
			<tr>
				<td colSpan={3}>
					<p>An HTTPS server can be enabled for the Companion web interfaces should your deployment require it.</p>
					<CAlert color="danger">
						Never expose the Companion web interface directly to the Internet. Note that HTTPS alone does not provide
						additional security for this configuration.
					</CAlert>
				</td>
			</tr>
			<tr>
				<td>HTTPS Web Server</td>
				<td>
					<CFormSwitch
						className="float-right"
						color="success"
						checked={config.https_enabled}
						size="xl"
						onChange={(e) => setValue('https_enabled', e.currentTarget.checked)}
					/>
				</td>
				<td>
					<CButton onClick={() => resetValue('https_enabled')} title="Reset to default">
						<FontAwesomeIcon icon={faUndo} />
					</CButton>
				</td>
			</tr>

			{config.https_enabled && (
				<>
					<tr>
						<td>HTTPS Port</td>
						<td>
							<CFormInput
								type="number"
								value={config.https_port}
								min={1024}
								max={65535}
								onChange={(e) => {
									let value = Math.floor(Number(e.currentTarget.value))
									if (isNaN(value)) return

									value = Math.min(value, 65535)
									value = Math.max(value, 1024)
									setValue('https_port', value)
								}}
							/>
						</td>
						<td>
							<CButton onClick={() => resetValue('https_port')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>

					<tr>
						<td>Certificate Type</td>
						<td>
							<CDropdown className="mt-2" style={{ display: 'inline-block', overflow: 'visible' }}>
								<CDropdownToggle>{config.https_cert_type === 'external' ? 'External' : 'Self Signed'}</CDropdownToggle>
								<CDropdownMenu>
									<CDropdownItem onClick={() => setValue('https_cert_type', 'self')}>Self Signed</CDropdownItem>
									<CDropdownItem onClick={() => setValue('https_cert_type', 'external')}>External</CDropdownItem>
								</CDropdownMenu>
							</CDropdown>
						</td>
						<td>
							<CButton onClick={() => resetValue('https_cert_type')} title="Reset to default">
								<FontAwesomeIcon icon={faUndo} />
							</CButton>
						</td>
					</tr>

					{config.https_cert_type === 'self' && (
						<tr>
							<td colSpan={3}>
								<table className="table table-responsive-sm">
									<tbody>
										<tr>
											<td colSpan={3}>This tool will help create a self-signed certificate for the server to use.</td>
										</tr>

										<tr>
											<td>Common Name (Domain Name)</td>
											<td>
												<CFormInput
													type="text"
													value={config.https_self_cn}
													onChange={(e) => setValue('https_self_cn', e.currentTarget.value)}
												/>
											</td>
											<td>
												<CButton onClick={() => resetValue('https_self_cn')} title="Reset to default">
													<FontAwesomeIcon icon={faUndo} />
												</CButton>
											</td>
										</tr>
										<tr>
											<td>Certificate Expiry Days</td>
											<td>
												<CFormInput
													type="number"
													value={config.https_self_expiry}
													min={1}
													max={65535}
													onChange={(e) => {
														let value = Math.floor(Number(e.currentTarget.value))
														if (isNaN(value)) return

														value = Math.min(value, 65535)
														value = Math.max(value, 1)
														setValue('https_self_expiry', value)
													}}
												/>
											</td>
											<td>
												<CButton onClick={() => resetValue('https_self_expiry')} title="Reset to default">
													<FontAwesomeIcon icon={faUndo} />
												</CButton>
											</td>
										</tr>
										<tr>
											<td>
												Certificate Details
												<br />
												{config.https_self_cert && config.https_self_cert.length > 0 ? (
													<ul>
														<li>Common Name: {config.https_self_cert_cn}</li>
														<li>Created: {config.https_self_cert_created}</li>
														<li>Expiry Period: {config.https_self_cert_expiry}</li>
													</ul>
												) : (
													<ul>
														<li>No certificate available</li>
													</ul>
												)}
											</td>
											<td>
												{config.https_self_cert && config.https_self_cert.length > 0 ? (
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

					{config.https_cert_type === 'external' && (
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

										<tr>
											<td>Private Key File (full path)</td>
											<td>
												<CFormInput
													type="text"
													value={config.https_ext_private_key}
													onChange={(e) => setValue('https_ext_private_key', e.currentTarget.value)}
												/>
											</td>
											<td>
												<CButton onClick={() => resetValue('https_ext_private_key')} title="Reset to default">
													<FontAwesomeIcon icon={faUndo} />
												</CButton>
											</td>
										</tr>

										<tr>
											<td>Certificate File (full path)</td>
											<td>
												<CFormInput
													type="text"
													value={config.https_ext_certificate}
													onChange={(e) => setValue('https_ext_certificate', e.currentTarget.value)}
												/>
											</td>
											<td>
												<CButton onClick={() => resetValue('https_ext_certificate')} title="Reset to default">
													<FontAwesomeIcon icon={faUndo} />
												</CButton>
											</td>
										</tr>

										<tr>
											<td>
												Chain File (full path)
												<br />
												*Optional
											</td>
											<td>
												<CFormInput
													type="text"
													value={config.https_ext_chain}
													onChange={(e) => setValue('https_ext_chain', e.currentTarget.value)}
												/>
											</td>
											<td>
												<CButton onClick={() => resetValue('https_ext_chain')} title="Reset to default">
													<FontAwesomeIcon icon={faUndo} />
												</CButton>
											</td>
										</tr>
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
