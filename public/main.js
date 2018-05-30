$(function() {

	socket.on('skeleton-info', function(hash) {
		console.log("skeleton-info", hash);
		$("#versiontext").text(hash.appVersion);
	});

});
