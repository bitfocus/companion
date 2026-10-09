import { faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import type { UserConfigProps } from '../Components/Common.js'
import {
	ConfigDropdownField,
	ConfigFieldRow,
	ConfigNumberField,
	ConfigTextField,
} from '../Components/ConfigFieldRows.js'
import { PORT_MAX, PORT_MIN } from '../Components/PortRange.js'

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

	const hasCertificate = !!props.config.https_self_cert && props.config.https_self_cert.length > 0

	return (
		<>
			<StaticAlert color="danger" className="mb-0 text-xs">
				Never expose the Companion web interface directly to the Internet. HTTPS alone does not protect an
				unauthenticated or publicly accessible installation.
			</StaticAlert>

			<ConfigNumberField
				userConfig={props}
				label="HTTPS Port"
				field="https_port"
				min={PORT_MIN}
				max={PORT_MAX}
				help={null}
			/>
			<ConfigDropdownField
				userConfig={props}
				label="Certificate Type"
				field="https_cert_type"
				choices={certTypeOptions}
				help={null}
			/>

			{props.config.https_cert_type === 'self' && (
				<>
					<ConfigTextField userConfig={props} label="Common Name" field="https_self_cn" help="The domain name." />
					<ConfigNumberField
						userConfig={props}
						label="Expiry"
						field="https_self_expiry"
						min={1}
						max={65535}
						help="Days the certificate is valid for."
					/>
					<ConfigFieldRow
						label="Certificate"
						htmlFor={null}
						help={
							hasCertificate ? (
								<>
									Common name {props.config.https_self_cert_cn}, created {props.config.https_self_cert_created}, valid
									for {props.config.https_self_cert_expiry} days.
								</>
							) : (
								'No certificate generated yet.'
							)
						}
					>
						{hasCertificate ? (
							<>
								<Button onClick={renewSslCertificate} color="secondary" size="sm">
									<FontAwesomeIcon icon={faSync} className="me-1.5" />
									Renew
								</Button>
								<Button onClick={deleteSslCertificate} color="danger" variant="ghost" size="sm">
									<FontAwesomeIcon icon={faTrash} className="me-1.5" />
									Delete
								</Button>
							</>
						) : (
							<Button onClick={createSslCertificate} color="secondary" size="sm">
								<FontAwesomeIcon icon={faSync} className="me-1.5" />
								Generate Self-Signed Certificate
							</Button>
						)}
					</ConfigFieldRow>
				</>
			)}

			{props.config.https_cert_type === 'external' && (
				<>
					<StaticAlert color="warning" className="mb-0 text-xs">
						Provide absolute paths to your certificate and private key files. Make sure they are readable by the
						Companion service process.
					</StaticAlert>
					<ConfigTextField userConfig={props} label="Private Key File" field="https_ext_private_key" help={null} />
					<ConfigTextField userConfig={props} label="Certificate File" field="https_ext_certificate" help={null} />
					<ConfigTextField userConfig={props} label="Certificate Chain File" field="https_ext_chain" help="Optional." />
				</>
			)}
		</>
	)
})

const certTypeOptions: DropdownChoice[] = [
	{ id: 'self', label: 'Self Signed' },
	{ id: 'external', label: 'External' },
]
