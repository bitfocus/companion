declare module '*.md' {
	const content: string
	export default content
}

// Fix fontsource css imports
declare module '@fontsource/*' {}
declare module '@fontsource-variable/*' {}
