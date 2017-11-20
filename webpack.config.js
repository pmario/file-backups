var webpack = require("webpack");
const path = require("path");
const banner = require("./banner");

module.exports = {
	entry: {
		background_scripts: "./background_scripts/background.js",
		content_scripts: "./content_scripts/ContentScript.js",
		popup: "./popup/main-popup.js",
		settings: "./settings/settings.js"
	},
	output: {
		path: path.resolve(__dirname, "addon"),
		filename: "[name]/index.js"
	},
	plugins: [
		new webpack.BannerPlugin(banner)
	]
};
