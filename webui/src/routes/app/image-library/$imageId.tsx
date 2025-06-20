import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react'
import { faImage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React, { useContext } from 'react'
import { ImageLibraryEditor } from '~/ImageLibrary/ImageLibraryEditor.js'
import { MyErrorBoundary, useComputed } from '~/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

const RouteComponent = observer(function RouteComponent() {
	const { imageId } = Route.useParams()

	const navigate = useNavigate({ from: '/image-library/$imageId' })
	const { imageLibrary } = useContext(RootAppStoreContext)

	// Ensure the selected image is valid
	useComputed(() => {
		if (imageId && !imageLibrary.getImage(imageId)) {
			void navigate({ to: `/image-library` })
		}
	}, [navigate, imageLibrary, imageId])

	const handleDeleteImage = (deletedImageId: string) => {
		if (deletedImageId === imageId) {
			void navigate({ to: `/image-library` })
		}
	}

	const handleImageIdChanged = (oldId: string, newId: string) => {
		if (oldId === imageId) {
			void navigate({ to: `/image-library/${newId}` })
		}
	}

	return (
		<>
			<CNav variant="tabs" role="tablist">
				<CNavItem>
					<CNavLink active>
						<FontAwesomeIcon icon={faImage} /> Edit Image
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane data-tab="edit" visible>
					<MyErrorBoundary>
						<ImageLibraryEditor
							key={imageId}
							selectedImageId={imageId}
							onDeleteImage={handleDeleteImage}
							onImageIdChanged={handleImageIdChanged}
						/>
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
})

export const Route = createFileRoute('/_app/image-library/$imageId')({
	component: RouteComponent,
})
