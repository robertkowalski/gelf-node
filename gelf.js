var dgram = require('dgram'),
    EventEmitter = require('events').EventEmitter;

var Gelf = function(config) {
  if (!config) {
    this.config = {
      graylogStdPort: 12201,
      graylogStdHost: '127.0.0.1',
      connection: 'wan'

    };
  } else {
    this.config = config;
  }
};

Gelf.prototype.__proto__ = EventEmitter.prototype;

Gelf.prototype.sendMessage = function(message) {
  var client = dgram.createSocket('udp4'),
      message = new Buffer(message);

  client.send(message, 0, message.length, this.config.graylogStdPort, this.config.graylogStdHost, function(err, bytes) {
    client.close();
  });
};


module.exports = Gelf;