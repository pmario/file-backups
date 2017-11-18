var zipdir = require('zip-dir');

zipdir('addon', { saveTo: 'ready_for_signing/addon.zip' }, function (err, buffer) {
  // `buffer` is the buffer of the zipped file
  // And the buffer was saved to `~/myzip.zip`
});

