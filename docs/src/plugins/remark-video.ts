import type { Root } from 'mdast'
import type { MdxJsxAttributeValueExpression } from 'mdast-util-mdx-jsx'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// Allow videos to be inserted as ![my video](myvideo.mp4)
// Note that a custom MDXComponents.tsx "swizzle" also works but generates build-time errors,
//   because Docusaurus can't find the width/height attributes of videos.
// This remark function has to be run **before** the default remark plugins to avoid that problem.
const remarkVideo: Plugin<[], Root> = () => (tree: Root) => {
	visit(tree, 'image', (node, index, parent) => {
		const isVideo = node.url?.match(/\.(mp4|webm|ogg)$/i)
		if (!isVideo) return
		if (index === undefined || index === null || !parent) return

		const ext = isVideo[1].toLowerCase()

		// docusaurus requires relative paths to start with './' in HTML elements, i.e. './myvid.mp4' not 'myvid.mp4'.
		// but standard ![]() images, allows the either way, so here we just fix it for compatibility.
		const url =
			node.url.startsWith('./') || node.url.startsWith('../') || node.url.startsWith('/') ? node.url : `./${node.url}`

		// we use the "require()" syntax here to allow relative pathnames in the generated <video><source> elements
		const requireExpression: MdxJsxAttributeValueExpression = {
			type: 'mdxJsxAttributeValueExpression',
			value: `require(${JSON.stringify(url)}).default`,
			data: {
				estree: {
					type: 'Program',
					body: [
						{
							type: 'ExpressionStatement',
							expression: {
								type: 'MemberExpression',
								object: {
									type: 'CallExpression',
									callee: { type: 'Identifier', name: 'require' },
									arguments: [{ type: 'Literal', value: url, raw: JSON.stringify(url) }],
									optional: false,
								},
								property: { type: 'Identifier', name: 'default' },
								computed: false,
								optional: false,
							},
						},
					],
					sourceType: 'module',
					comments: [],
				},
			},
		}

		parent.children[index] = {
			type: 'mdxJsxFlowElement',
			name: 'video',
			attributes: [
				{ type: 'mdxJsxAttribute', name: 'controls', value: null },
				{ type: 'mdxJsxAttribute', name: 'muted', value: null },
				{ type: 'mdxJsxAttribute', name: 'preload', value: 'metadata' },
				{ type: 'mdxJsxAttribute', name: 'aria-label', value: node.alt ?? 'Video content' },
			],
			children: [
				{
					type: 'mdxJsxTextElement',
					name: 'source',
					attributes: [
						{ type: 'mdxJsxAttribute', name: 'src', value: requireExpression },
						{ type: 'mdxJsxAttribute', name: 'type', value: `video/${ext}` },
					],
					children: [],
				},
				{
					type: 'text',
					value: 'Your browser does not support the video tag.',
				},
			],
		} as any // avoid TS errors on nesting mdxJsxTextElement inside mdxJsxFlowElement
	})
}

export default remarkVideo
