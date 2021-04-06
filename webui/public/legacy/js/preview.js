(function (toexport) {

	function dataToButtonImage(data) {
		var sourceData = new Uint8Array(data);
		var imageData  = new ImageData(72, 72);

		var si = 0, di = 0;
		for (var y = 0; y < 72; ++y) {
			for (var x = 0; x < 72; ++x) {
				imageData.data[di++] = sourceData[si++];
				imageData.data[di++] = sourceData[si++];
				imageData.data[di++] = sourceData[si++];
				imageData.data[di++] = 255;
			}
		}

		return imageData;
	}

	function imageResize(img, maxW, maxH) {
		var canvas = document.createElement('canvas');
		var width = img.width;
		var height = img.height;

		if (width >= height) {
			if (width > maxW) {
				height *= maxW / width;
				width = maxW;
			}
		} else if (width < height) {
			if (height > maxH) {
				width *= maxH / height;
				height = maxH;
			}
		}

		canvas.width = width;
		canvas.height = height;

		var ctx = canvas.getContext('2d');
		ctx.drawImage(img, 0, 0, width, height);
		return canvas.toDataURL();
	}

	function checkImageSize(image, minW, minH, maxW, maxH, cbOK, cbKO) {
			//check whether browser fully supports all File API
			if (window.File && window.FileReader && window.FileList && window.Blob) {
					if (!image.files[0] === undefined || image.files[0].type === undefined || !image.files[0].type == 'image/png') {
						alert('Sorry. Only proper PNG files are supported.');
						return;
					}

					var fr = new FileReader;
					fr.onload = function() { // file is loaded
							var img = new Image;

							img.onload = function() { // image is loaded; sizes are available
									if (img.height > maxH || img.width > maxW) {
										cbOK(imageResize(img, maxW, maxH));
									} else if (img.width < minW || img.height < minH || img.width > maxW || img.height > maxH){
											cbKO();
									}else{
											cbOK(fr.result);
									}
							};

							img.src = fr.result; // is the data URL because called with readAsDataURL
					};
					fr.readAsDataURL(image.files[0]);
			} else {
					alert('I am sorry, Companion requires a newer browser');
			}
	}

	toexport.dataToButtonImage = dataToButtonImage;
	toexport.checkImageSize = checkImageSize;
})(window);