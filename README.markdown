[![build status](https://secure.travis-ci.org/robertkowalski/gelf-node.png)](http://travis-ci.org/robertkowalski/gelf-node)
# gelf-node
## gelf-node is a full implementation for sending messages in GELF (Graylog Extended Log Format) from node.js

# Install
```
npm install gelf
```

# Example Usage

## Initialize with defaults
```javascript
var Gelf = require('gelf');
gelf = new Gelf(); // with default config
```

## Initialize with custom config
```javascript
var Gelf = require('gelf');
gelf = new Gelf({
  graylogPort: 12201,
  graylogHostname: '127.0.0.1',
  connection: 'wan',
  maxChunkSizeWan: 1420,
  maxChunkSizeLan: 8154
});
```
## sending Messages

```javascript
//send just a shortmessage
gelf.emit('log', 'myshortmessage');

//send a full message
var message = {
  "version": "1.0",
  "host": "www1",
  "short_message": "Short message",
  "full_message": "Backtrace here\n\nmore stuff",
  "timestamp": 1291899928.412,
  "level": 1,
  "facility": "payment-backend",
  "file": "/var/www/somefile.rb",
  "line": 356,
  "_user_id": 42,
  "_something_else": "foo"
};

gelf.emit('log', message);
```


# Tests

```
make
```
