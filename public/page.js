var page_info = {};

$(function() {

	var pageUpdate = function() {
		var $cb = $('#page_title');
		$cb.val('pn:'+page_info[page].name);
	};

	// when page name is changed from the input field
	$('#elgatobuttons').on('keyup', "#page_title", function() {
		var str = $('#page_title').val().substr(0,11);
		page_info[page].name = str !== "" ? str : "PAGE";
		socket.emit('set_page', page, page_info[page]);
	});

	// when server updates the entire page array
	socket.on('get_page_all', function(config) {
		page_info = config;
		pageUpdate();
	});

	// when other browsers update page
	socket.on('set_page', function(key, value) {
		page[key]=value;
		pageUpdate();
	});

	// ask for the entire config
	socket.emit('get_page_all');


});
