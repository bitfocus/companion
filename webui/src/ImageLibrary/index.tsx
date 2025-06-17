import { CCol, CRow } from '@coreui/react'
import React, { useCallback, useState } from 'react'
import { ImageLibraryGrid } from './ImageLibraryGrid'
import { ImageLibraryEditor } from './ImageLibraryEditor'
import { observer } from 'mobx-react-lite'
import { MyErrorBoundary } from '~/util.js'

export const ImageLibraryPage = observer(function ImageLibraryPage() {
	const [selectedImageId, setSelectedImageId] = useState<string | null>(null)

	const handleSelectImage = useCallback((imageId: string | null) => {
		setSelectedImageId(imageId)
	}, [])

	const handleDeleteImage = useCallback(
		(imageId: string) => {
			if (selectedImageId === imageId) {
				setSelectedImageId(null)
			}
		},
		[selectedImageId]
	)

	return (
		<CRow className="image-library-page split-panels">
			<CCol xs={12} xl={6} className="primary-panel">
				<MyErrorBoundary>
					<ImageLibraryGrid selectedImageId={selectedImageId} onSelectImage={handleSelectImage} />
				</MyErrorBoundary>
			</CCol>

			<CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-inner">
					<MyErrorBoundary>
						<ImageLibraryEditor selectedImageId={selectedImageId} onDeleteImage={handleDeleteImage} />
					</MyErrorBoundary>
				</div>
			</CCol>
		</CRow>
	)
})
