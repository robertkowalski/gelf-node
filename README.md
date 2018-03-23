[![build status](https://secure.travis-ci.org/robertkowalski/gelf-node.png)](http://travis-ci.org/robertkowalski/gelf-node)

# gelf-node

## gelf-node is a full implementation for sending messages in GELF (Graylog Extended Log Format) from node.js

## Install

```
npm install gelf
```

## Example Usage

### Initialize with defaults

```js
const Gelf = require('gelf')
const gelf = new Gelf() // with default config

gelf.on('error', (err) => {
  console.log('ouch!', err)
})
```

### Initialize with custom config

```js
const Gelf = require('gelf')
const gelf = new Gelf({
  graylogPort: 12201,
  graylogHostname: '127.0.0.1',
  connection: 'wan',
  maxChunkSizeWan: 1420,
  maxChunkSizeLan: 8154
})
```

### sending Messages

```js
// send just a shortmessage
gelf.emit('gelf.log', 'myshortmessage')

// send a full message
const message = {
  "version": "1.0",
  "host": "www1",
  "short_message": "Short message",
  "full_message": "Backtrace here\n\nmore stuff",
  "timestamp": Date.now() / 1000,
  "level": 1,
  "facility": "payment-backend",
  "file": "/var/www/somefile.rb",
  "line": 356,
  "_user_id": 42,
  "_something_else": "foo"
}

gelf.emit('gelf.log', message);
```

## Events

### 'error'

Emitted for errors

### 'gelf.log'

Logs a short or full message

## Methods

### closeSocket

Closes the UDP Socket

### openSocket

Opens the Socket

## Tests

```
npm run test
```
