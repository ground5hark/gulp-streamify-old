var Stream = require('stream')
  , gutil = require('gulp-util')
  , Duplexer = require('plexer')
;

const PLUGIN_NAME = 'gulp-streamify-old';

// Plugin function
function streamifyGulp(pluginStream) {

  var inputStream = new Stream.Transform({objectMode: true})
    , outputStream = new Stream.Transform({objectMode: true})
    , duplex = new Duplexer({objectMode: true}, inputStream, outputStream)
  ;

  // Accepting functions returning streams
  if('function' == typeof pluginStream) {
    pluginStream = pluginStream();
  }

  // Change files contents from stream to buffer and write to the plugin stream
  inputStream._transform = function(file, unused, cb) {
    // Buffering the file stream
    var originalStream, buf, bufstream;
    if(!file || (file.contents === null) || gutil.isBuffer(file.contents)) {
      inputStream.push(file);
      return cb();
    }
    file.wasStream = true;
    originalStream = file.contents;
    buf = new Buffer(0);
    bufstream = new Stream.Writable();

    // Buffer the stream
    bufstream._write = function(chunk, encoding, cb) {
      buf = Buffer.concat([buf, chunk], buf.length + chunk.length);
      cb();
    };

    // When buffered
    bufstream.once('finish', function() {
      // Send the buffer wrapped in a file
      file.contents = buf;
      inputStream.push(file);
      cb();
    });

    originalStream.pipe(bufstream);

  };

  // Change files contents from buffer to stream and write to the output stream
  outputStream._transform = function(file, unused, cb) {
    var buf, newStream;
    if(!file || (file.contents === null) || !file.wasStream) {
      outputStream.push(file);
      return cb();
    }
    delete file.wasStream;
    // Get the transformed buffer
    buf = file.contents;
    newStream = new Stream.Readable();
    // Write the buffer only when datas are needed
    newStream._read = function() {
      // Write the content back to the stream
      newStream.push(buf);
      newStream.push(null);
    };
    // Pass the file out
    file.contents = newStream;
    outputStream.push(file);
    cb();
  };
  outputStream._flush = function(cb) {
    cb();
    // Old streams WTF
    if(!pluginStream._readableState) {
      outputStream.emit('end');
      duplex.emit('end');
    }
  };

  inputStream
    .pipe(pluginStream)
    .pipe(outputStream);

  return duplex;

}

// Export the plugin main function
module.exports = streamifyGulp;

