import fs from 'fs/promises'
import path from 'path'
import ts from 'typescript'

let allEvents = new Map()

const ignoreUses = new Set([
	'rest_get',
	'rest',
	'rest_put',
	'rest_poll',
	'rest_poll_get',
	'rest_poll_destroy',
	'instance_actions',
	'variable_parse',
	'osc_send',
	'log',
	'mode', // toggl-track hiding some rest calls
])

const possibleModuleFolders = await fs.readdir('./node_modules')
await Promise.all(
	possibleModuleFolders.map(async (folder) => {
		if (folder.match(/companion-module-/)) {
			let outputStr = `Found module "${folder}"\n`
			if (folder === 'companion-module-bitfocus-companion') return

			const basePath = path.join('./node_modules', folder)

			let foundFiles = []
			const scanDir = async (dirPath) => {
				// Find the contents of the dir
				const contents = await fs.readdir(dirPath)
				await Promise.all(
					contents.map(async (name) => {
						// console.log(name)
						if (name === '.' || name === '..' || name === 'node_modules') {
							return
						}

						const fullname = path.join(dirPath, name)
						const info = await fs.stat(fullname)
						if (info.isFile()) {
							// Only consider files which we know are code
							if (fullname.endsWith('.ts') || fullname.endsWith('.js')) {
								foundFiles.push(fullname)
							} else {
								// console.log('ignoring', fullname)
							}
						} else if (info.isDirectory()) {
							await scanDir(fullname)
						}
					})
				)
			}
			await scanDir(basePath)

			outputStr += `Scanning ${foundFiles.length} files\n`

			const usedCalls = new Map()

			await Promise.all(
				foundFiles.map(async (filePath) => {
					try {
						// console.log(filePath)
						const src = await fs.readFile(filePath)
						const file = ts.createSourceFile(filePath, src.toString(), undefined, true)

						const processNode = (node) => {
							if (!node) return

							if (ts.isCallExpression(node) && node.arguments.length > 1) {
								const text = node.expression.getText()
								if (text.includes('system.emit') || text.includes('system.on')) {
									// console.log(node.getText())
									// console.log(node)

									const n = node.arguments[0].text
									if (ignoreUses.has(n)) return

									{
										const oldVal = usedCalls.get(n)
										usedCalls.set(n, (oldVal ? oldVal : 0) + 1)
									}

									{
										const oldVal = allEvents.get(n)
										allEvents.set(n, (oldVal ? oldVal : 0) + 1)
									}
								}
							}

							for (const ch of node.getChildren()) {
								processNode(ch)
							}
						}

						processNode(file)
					} catch (e) {
						console.warn(`Failed to scan file: ${e}`)
						console.log(e.stack)
					}
				})
			)

			outputStr += `Found calls for: ${Array.from(usedCalls.keys()).join(', ')}\n`

			// console.log(outputStr)
			let csvStr = folder
			for (const [name, count] of usedCalls.entries()) {
				csvStr += `,${name},${count}`
			}
			if (usedCalls.size > 0) console.log(csvStr)
		}
	})
)

console.log('\n\n')
console.log('Summary:')
for (const [name, count] of allEvents.entries()) {
	console.log(`${name},${count}`)
}
