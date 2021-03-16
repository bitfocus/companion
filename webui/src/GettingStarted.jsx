import { useMemo, useState } from 'react'
import { LoadingRetryOrError, SERVER_URL, socketEmit, useMountEffect } from './util'
import io from 'socket.io-client'
import marked from 'marked'
import { CContainer, CRow } from '@coreui/react'

const helpFile = 'gettingstarted.md'

export function GettingStarted() {
	const [data, setData] = useState(null)
	const [error, setError] = useState(null)

	const doRetryLoad = () => {
		// Cheat and just reload
		window.location.reload()
	}

	useMountEffect(() => {
		const socket = new io(SERVER_URL)
		socket.on('connect', () => {
			socketEmit(socket, 'get_help_md', [{ file: helpFile }])
				.then(([res]) => {
					if (res.error) {
						setData(null)
						setError(`Failed to load help file`)
					} else {
						setData(res)
						setError(null)
					}
				})
				.catch((e) => {
					setData(null)
					setError(`Failed to load: ${e}`)
				})
		})
	})

	const html = useMemo(() => {
		if (data) {
			return {
				__html: marked(data.markdown, { baseUrl: data.baseUrl, headerPrefix: 'header-' }),
			}
		} else {
			return null
		}
	}, [data])

	return (
		<div className="page-getting-started">
			<CContainer>
				<CRow>
					<LoadingRetryOrError dataReady={data} error={error} doRetry={doRetryLoad} />

					{html ? <div dangerouslySetInnerHTML={html} /> : html}
				</CRow>
			</CContainer>
		</div>
	)
}
