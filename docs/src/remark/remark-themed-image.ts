import fs from 'node:fs'
import path from 'node:path'
import type { Image, Root } from 'mdast'
import type { MdxJsxAttribute } from 'mdast-util-mdx-jsx'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// The hashes marking an image as a generated screenshot
const SCREENSHOT_HASH = /#(themed-light|themed-dark|unthemed)$/

// Show a screenshot taken in both themes as the one matching the theme of the site.
// Write it as a normal image, ![my screenshot](images/my-screenshot.png), with the files named my-screenshot.light.png
// and my-screenshot.dark.png (as `yarn docs:screenshots` writes them). The image becomes a pair of images, one for
// each theme, which custom.css shows or hides by the hash added to their urls. A screenshot with one look is named
// my-screenshot.unthemed.png instead.
// This has to run **before** the default remark plugins, which turn the urls into the urls of the built images.
const remarkThemedImage: Plugin<[], Root> = () => (tree, file) => {
	if (!file.path) return
	const dir = path.dirname(file.path)

	visit(tree, 'image', (node, index, parent) => {
		if (index === undefined || !parent) return

		// Only a local png which doesn't exist itself
		const match = /^([^:#?]+)\.png$/i.exec(node.url)
		if (!match || fs.existsSync(path.join(dir, node.url))) return

		const base = match[1]
		if (fs.existsSync(path.join(dir, `${base}.unthemed.png`))) {
			node.url = `${base}.unthemed.png#unthemed`
			return
		}

		const themed = (theme: 'light' | 'dark'): Image => ({
			...node,
			url: `${base}.${theme}.png#themed-${theme}`,
		})
		if (!fs.existsSync(path.join(dir, `${base}.light.png`)) || !fs.existsSync(path.join(dir, `${base}.dark.png`)))
			return

		parent.children.splice(index, 1, themed('light'), themed('dark'))
		// Skip over the pair just inserted
		return index + 2
	})
}

export default remarkThemedImage

// The screenshots are taken at twice the size they are shown, to be sharp on high density screens, but the default
// remark plugins size an image by its pixels. Halve the size of each one marked by remarkThemedImage.
// This has to run **after** the default remark plugins.
export const remarkScreenshotSize: Plugin<[], Root> = () => (tree) => {
	visit(tree, 'mdxJsxTextElement', (node) => {
		if (node.name !== 'img') return

		const attrs = node.attributes.filter((attr): attr is MdxJsxAttribute => attr.type === 'mdxJsxAttribute')
		const src = attrs.find((attr) => attr.name === 'src')?.value
		const srcText = typeof src === 'string' ? src : src?.value
		// The hash is appended to the require of the image, as `+ '#themed-light'`
		if (!srcText || !SCREENSHOT_HASH.test(srcText.replace(/['"]$/, ''))) return

		for (const attr of attrs) {
			if ((attr.name === 'width' || attr.name === 'height') && typeof attr.value === 'string') {
				attr.value = String(Math.round(Number(attr.value) / 2))
			}
		}
	})
}
