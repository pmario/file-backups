var webpack = require("webpack");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require("path");
const banner = require("./banner");

module.exports = {
	entry: {
		background_scripts: "./background_scripts/background.js",
		content_scripts: "./content_scripts/contentScript.js",
		popup: "./popup/defaultPopup.js",
		settings: "./settings/settings.js"
	},
	output: {
		path: path.resolve(__dirname, "addon"),
		filename: "[name]/index.js"
	},
	plugins: [
		new webpack.BannerPlugin(banner),
		new CopyWebpackPlugin([
			// {output}/to/file.txt
			{ from: 'README.md', to: '../docs/[name].[ext]'},

			// Copy glob results, relative to context
			{
				context: 'assets',
				from: '**/*', to: './'
			},
			// UI will be copied as is
			{
				context: 'extUI',
				from: '**/*', to: './'
			}

		], {
			ignore: [
			    // Doesn't copy any files with a txt extension
				// .js files will be compressed
			    //'*.js',

			    // Doesn't copy any file, even if they start with a dot
//			    '**/*',

			    // Doesn't copy any file, except if they start with a dot
//			    { glob: '**/*', dot: false }
			]//,

			// By default, we only copy modified files during
			// a watch or webpack-dev-server build. Setting this
			// to `true` copies all files.
//			copyUnmodified: true
		})
	]
};
