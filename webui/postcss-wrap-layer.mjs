import postcss from 'postcss'

/**
 * Assigns each app CSS file to a cascade layer by path, so Tailwind utilities (which live in the
 * `utilities` layer, declared last in tailwind.css) win over app styles without needing `!important`.
 *
 * The layer *order* is declared once in tailwind.css; this plugin only decides which layer a given
 * file's rules land in. Changing the mapping here is the single place to retune the architecture — no
 * CSS file or import has to move.
 *
 *   app-base    Global app chrome / resets that anything else may override.
 *   components  Reusable design-system components (src/Components/**).
 *   features    Everything else — page/feature CSS. Sits above `components` so a page can override a
 *               shared component's defaults in-context without specificity fights.
 *
 * Deliberately NOT wrapped (return null → left unlayered, i.e. above every layer during migration):
 *   - tailwind.css / utilities.css        manage their own layering (or must stay on top).
 *   - base.css / layout-grid.css          already imported into their own layers by tailwind.css.
 *   - breakpoints.css                     only @custom-media definitions, no rules.
 *   - *.module.css                        CSS Modules are scoped; no collision with utilities.
 *   - anything that isn't a plain .css    (images, etc.) — left untouched.
 */

const APP_BASE = new Set([
	'common.css',
	'nav.css',
	'layout.css',
	'flex-layout.css',
	'transitions.css',
	'loading.css',
	'App.css',
	// Split out of layout.css into a file co-located with the component, but must stay in the layer
	// it always sat in — page CSS (features) relies on being able to override it (see Layout/SplitPanels.css).
	'Layout/SplitPanels.css',
])

// Files that must not be wrapped, keyed by basename.
const EXCLUDE = new Set(['tailwind.css', 'utilities.css', 'breakpoints.css', 'base.css', 'layout-grid.css'])

// At-rules that must stay at the top level of the file rather than being nested inside @layer.
const HOIST = new Set(['charset', 'import', 'namespace', 'layer', 'custom-media', 'custom-selector'])

/** @param {string | undefined} from */
function resolveLayer(from) {
	if (!from) return null
	const path = from.split('?')[0].replace(/\\/g, '/')

	// lastIndexOf, not indexOf: a checkout path may contain an earlier `/src/` segment, and we want the
	// app's own `webui/src/` root so the `Components/` and app-base checks below match.
	const srcIdx = path.lastIndexOf('/src/')
	if (srcIdx === -1) return null // only app source under webui/src
	const rel = path.slice(srcIdx + '/src/'.length)

	if (!rel.endsWith('.css')) return null // only plain .css files
	if (rel.endsWith('.module.css')) return null

	const base = rel.slice(rel.lastIndexOf('/') + 1)
	if (EXCLUDE.has(base)) return null

	if (rel.startsWith('Components/')) return 'components'
	if (APP_BASE.has(rel)) return 'app-base'
	return 'features'
}

/** @returns {import('postcss').Plugin} */
export default function postcssWrapLayer() {
	return {
		postcssPlugin: 'wrap-css-layers',
		Once(root, { result }) {
			const layer = resolveLayer(result.opts.from)
			if (!layer) return

			const toMove = []
			root.each((node) => {
				if (node.type === 'atrule' && HOIST.has(node.name.toLowerCase())) return
				toMove.push(node)
			})
			if (toMove.length === 0) return // nothing to wrap (e.g. already a single @layer block)

			const layerRule = postcss.atRule({ name: 'layer', params: layer })
			for (const node of toMove) layerRule.append(node.clone())
			for (const node of toMove) node.remove()
			root.append(layerRule)
		},
	}
}

postcssWrapLayer.postcss = true
