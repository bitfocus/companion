import { CCol, CRow } from '@coreui/react'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { MyErrorBoundary } from '~/Resources/Error'
import { ImageLibraryGrid } from './ImageLibraryGrid'

export const ImageLibraryPage = observer(function ImageLibraryPage() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/image-library/$imageName' })

	const navigate = useNavigate({ from: '/image-library' })

	const selectedImageName = routeMatch ? routeMatch.imageName : null

	const handleSelectImage = useCallback(
		(imageName: string | null) => {
			if (imageName === null) {
				void navigate({ to: '/image-library' })
			} else {
				void navigate({
					to: `/image-library/$imageName`,
					params: {
						imageName,
					},
				})
			}
		},
		[navigate]
	)

	return (
		<CRow className="image-library-page split-panels">
			<CCol xs={12} xl={6} className="primary-panel">
				<MyErrorBoundary>
					<ImageLibraryGrid selectedImageName={selectedImageName} onSelectImage={handleSelectImage} />
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})
