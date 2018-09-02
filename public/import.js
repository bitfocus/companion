/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

var import_page = 1;
var import_bank = undefined;

$(function() {
	var $pagenav = $("#import_pagenav");
	var $pagebank = $("#import_pagebank");

	for (var x = 1; x <= 12; x++) {
		var $b = $("<div class='bank col-lg-3'><div class='border'>x</div></div>");
		$pagebank.append($b);
	}
});
