import { createFileRoute } from '@tanstack/react-router'
import { ImageLibraryPage } from '~/ImageLibrary/index.js'

export const Route = createFileRoute('/_app/image-library')({
	component: ImageLibraryPage,
})
