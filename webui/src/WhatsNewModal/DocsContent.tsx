import { useQuery } from '@tanstack/react-query'
import { type ComponentProps } from 'react'
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { makeAbsolutePath } from '~/Resources/util.js'

interface DocsContentProps {
	file: string
}

const ImgOrVideo: Components = {
	// note: react-markdown does not currently pass other img-specific props such as width/height
	img: ({ src, alt }: ComponentProps<'img'>) => {
		// Check if the file extension is a video format
		const isVideo = src?.match(/\.(mp4|webm|ogg)$/i)

		if (isVideo) {
			const vtype = isVideo[1].toLowerCase()
			return (
				<video controls preload="metadata" aria-label={alt || 'Video content'}>
					<source src={src} type={`video/${vtype}`} />
					Your browser does not support the video tag.
				</video>
			)
		} else {
			return <img src={src} alt={alt} />
		}
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
					components={ImgOrVideo}
				/>
			)}
		</div>
	)
}
