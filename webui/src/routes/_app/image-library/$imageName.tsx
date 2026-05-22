import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useContext } from 'react'
import { ImageLibraryEditor } from '~/ImageLibrary/ImageLibraryEditor.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

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
		<div className="secondary-panel-simple-body">
			<MyErrorBoundary>
				<ImageLibraryEditor
					key={imageName}
					selectedImageName={imageName}
					onDeleteImage={handleDeleteImage}
					onImageNameChanged={handleImageNameChanged}
				/>
			</MyErrorBoundary>
		</div>
	)
})

export const Route = createFileRoute('/_app/image-library/$imageName')({
	component: RouteComponent,
})
