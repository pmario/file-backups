const path = require("path");

module.exports = {
	entry: {
		background_scripts: "./background_scripts/background.js",
		content_scripts: "./content_scripts/ContentScript.js",
		popup: "./popup/left-pad.js",
		settings: "./settings/settings.js"
	},
	output: {
		path: path.resolve(__dirname, "addon"),
		filename: "[name]/index.js"
	}
};
