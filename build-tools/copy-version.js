// not needed .. can be done by "web-ext" CLI from moz
"use strict";

var jsonfile = require('jsonfile')

// take package.json version info and transfere it to the manifest.json
// so in the command line we can use "npm version patch" ...

var fManifest = './assets/manifest.json',
	fPackage = "./package.json"

var pkg = jsonfile.readFileSync(fPackage);
var manifest = jsonfile.readFileSync(fManifest);

manifest.version = pkg.version;

jsonfile.writeFileSync(fManifest, manifest, {spaces: 2});
