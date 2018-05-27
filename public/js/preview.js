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

	toexport.dataToButtonImage = dataToButtonImage;
})(window);
