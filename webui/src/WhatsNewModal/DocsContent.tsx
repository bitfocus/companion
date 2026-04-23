import { useQuery } from '@tanstack/react-query'
import { type ComponentProps } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { makeAbsolutePath } from '~/Resources/util.js'

interface DocsContentProps {
	file: string
}

const components: Components = {
	img: (props: ComponentProps<'img'>) => {
		// 1. Destructure and "throw away" img-only props that break <video>
		// 2. Keep 'src' and 'alt' for logic
		// 3. Collect everything else in 'rest'
		const { src, alt, loading: _l, decoding: _d, fetchPriority: _f, ...rest } = props

		// Check if the file extension is a video format
		const isVideo = src?.match(/\.(mp4|webm|ogg)$/i)

		if (isVideo) {
			const vtype = isVideo[1].toLowerCase()
			return (
				<video controls aria-label={alt} {...(rest as ComponentProps<'video'>)}>
					<source src={src} type={`video/${vtype}`} />
					Your browser does not support the video tag.
				</video>
			)
		}

		// Fallback to standard image rendering
		return <img src={src} alt={alt} {...props} />
	},
}

export function DocsContent({ file }: DocsContentProps): React.JSX.Element {
	const { isPending, error, data } = useQuery<string>({
		queryKey: [`docs_${file}`],
		queryFn: async () => fetch(makeAbsolutePath(`/whatsnew/${file}.md`)).then(async (res) => res.text()),
		retry: false,
	})

	return (
		<div className="markdown">
			{isPending && 'loading'}
			{error && <div>Error: {error.message}</div>}
			{data && (
				<ReactMarkdown
					urlTransform={(src, key, _node) => {
						if (key === 'src' || (key === 'href' && !src.startsWith('http') && !src.startsWith('#'))) {
							// img tag
							return makeAbsolutePath(`/whatsnew/${defaultUrlTransform(src)}`)
						} else {
							return defaultUrlTransform(src)
						}
					}}
					children={data}
					remarkPlugins={[remarkGfm]}
					components={components}
				/>
			)}
		</div>
	)
}
