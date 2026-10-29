import fs from 'node:fs/promises'
import path from 'node:path'
import { format, resolveConfig } from 'prettier'
import { specs, specsDir } from './openapi-ts.config.mts'

for (const spec of specs) {
	const res = await fetch(spec.url)
	if (!res.ok) throw new Error(`Failed to download ${spec.url}: ${res.status} ${res.statusText}`)

	const filePath = path.join(specsDir, spec.file)
	const prettierConfig = await resolveConfig(filePath)
	await fs.writeFile(filePath, await format(await res.text(), { ...prettierConfig, filepath: filePath }))
	console.log(`Updated ${filePath}`)
}
