var deflate = require('zlib').deflate,
    dgram = require('dgram'),
    EventEmitter = require('events').EventEmitter;

var Gelf = function(config) {
  var self = this;

  if (!config) {
    self.config = {
      graylogStdPort: 12201,
      graylogStdHost: '127.0.0.1',
      connection: 'wan'

    };
  } else {
    self.config = config;
  }

  self.on('gelf.message', function(json) {
    var message = JSON.stringify(json);
    self.compress(message, function(buffer) {
      self.sendMessage(buffer);
    });
  });

  self.on('gelf.log', function() {

  });
};

Gelf.prototype.__proto__ = EventEmitter.prototype;

Gelf.prototype.compress = function(message, callback) {
  deflate(message, function(err, buf) {
    if (err) {
      throw err;
    }        
    callback && callback(buf);
  });
};

Gelf.prototype.sendMessage = function(message) {
  var self = this,
      client = dgram.createSocket('udp4');

  client.send(message, 0, message.length, self.config.graylogStdPort, self.config.graylogStdHost, function(err, bytes) {
    if (err) {
      throw err;
    }   
    client.close();
  });
};


module.exports = Gelf;