import React from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery } from '@tanstack/react-query'
import { CButton } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRefresh } from '@fortawesome/free-solid-svg-icons'
import { makeAbsolutePath } from '~/util'

interface DocsContentProps {
	file: string
}

export function DocsContent({ file }: DocsContentProps): React.JSX.Element {
	// strip filename
	const baseUrl = `${file}`.replace(/\/[^/]+$/, '/')

	const { isPending, error, data, refetch } = useQuery<string>({
		queryKey: [`docs_${file}`],
		queryFn: async () => fetch(makeAbsolutePath(`/docs/${file}`)).then(async (res) => res.text()),
		retry: false,
	})

	return (
		<div>
			{isPending && 'loading'}
			{error && <div>Error: {error.message}</div>}
			{data && (
				<>
					{process.env.NODE_ENV !== 'production' && (
						<CButton
							title="Dev Refresh"
							onClick={() => void refetch()}
							style={{ float: 'right', position: 'absolute', top: -40, right: 0 }}
						>
							<FontAwesomeIcon icon={faRefresh} />
						</CButton>
					)}
					<ReactMarkdown
						urlTransform={(src, key, _node) => {
							if (key === 'src' || (key === 'href' && !src.startsWith('http'))) {
								// img tag
								return makeAbsolutePath(`/docs/${baseUrl}${defaultUrlTransform(src)}`)
							} else {
								return defaultUrlTransform(src)
							}
						}}
						children={data}
						remarkPlugins={[remarkGfm]}
					/>
				</>
			)}
		</div>
	)
}
