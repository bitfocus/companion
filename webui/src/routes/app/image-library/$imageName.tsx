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
	const { imageName } = Route.useParams()

	const navigate = useNavigate({ from: '/image-library/$imageName' })
	const { imageLibrary } = useContext(RootAppStoreContext)

	// Ensure the selected image is valid
	useComputed(() => {
		if (imageName && !imageLibrary.getImage(imageName)) {
			void navigate({ to: `/image-library` })
		}
	}, [navigate, imageLibrary, imageName])

	const handleDeleteImage = (deletedImageName: string) => {
		if (deletedImageName === imageName) {
			void navigate({ to: `/image-library` })
		}
	}

	const handleImageNameChanged = (oldName: string, newName: string) => {
		if (oldName === imageName) {
			void navigate({ to: `/image-library/${newName}` })
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
							key={imageName}
							selectedImageName={imageName}
							onDeleteImage={handleDeleteImage}
							onImageNameChanged={handleImageNameChanged}
						/>
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
})

export const Route = createFileRoute('/_app/image-library/$imageName')({
	component: RouteComponent,
})
