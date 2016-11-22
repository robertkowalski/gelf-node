var deflate = require('zlib').deflate,
    dgram = require('dgram'),
    EventEmitter = require('events').EventEmitter,
    os = require('os'),
    crypto = require('crypto');

var Gelf = function(config) {
  var self = this;

  if (!config) {
    self.config = {
      graylogPort: 12201,
      graylogHostname: '127.0.0.1',
      connection: 'wan',
      maxChunkSizeWan: 1420,
      maxChunkSizeLan: 8154
    };
  } else {
    self.config = config;
  }

  /* test self.config */
  if (!self.config
      || !self.config.graylogPort
      || !self.config.graylogHostname
      || !self.config.connection
      || !self.config.maxChunkSizeWan
      || !self.config.maxChunkSizeLan) {
    throw new Error('config in constructor is missing values');
  }

  self.on('gelf.message', function(message, callback) {
    self.compress(message, function(buffer) {
      self.processMessage(buffer, callback);
    });
  });

  self.on('gelf.log', function(input, callback) {
    var message,
        json;

    if (!input) {
      json = {};
    } else if (typeof input === 'string') {
      json = {};
      json.short_message = input;
    } else {
      json = input;
    }

    if (json._id) {
      return self.emitError(Error('_id is not allowed'));
    }

    if (!json.version) {
      json.version = '1.0';
    }
    if (!json.host) {
      json.host = os.hostname();
    }
    if (!json.timestamp) {
      json.timestamp = new Date().getTime() / 1000;
    }
    if (!json.facility) {
      json.facility = 'node.js';
    }
    if (!json.short_message) {
      json.short_message = 'Gelf Shortmessage';
    }
    message = JSON.stringify(json);

    self.emit('gelf.message', message, callback);
  });
};

Gelf.prototype = Object.create(EventEmitter.prototype, {
  constructor: {value: Gelf}
});

Gelf.prototype.compress = function(message, callback) {
  var self = this;
  deflate(message, function(err, buf) {
    if (err) {
      return self.emitError(err);
    }
    callback && callback(buf);
  });
};

Gelf.prototype.sendMessage = function(message, callback) {
  var self = this,
      client = dgram.createSocket('udp4');

  client.send(message, 0, message.length, self.config.graylogPort, self.config.graylogHostname, function(err/*, bytes*/) {
    if (err) {
      callback && callback(err);
      return self.emitError(err);
    }
    callback && callback();
    client.close();
  });
};

Gelf.prototype.processMessage = function(buffer, callback) {
  var self = this,
      config = self.config,
      chunkSize = buffer.length;

  if (config.connection === 'wan') {
    if (chunkSize > config.maxChunkSizeWan) {
      self.processMultipleChunks(buffer, config.maxChunkSizeWan, callback);
      return;
    }
  } else if (self.config.connection === 'lan') {
    if (chunkSize > config.maxChunkSizeLan) {
      self.processMultipleChunks(buffer, config.maxChunkSizeLan, callback);
      return;
    }
  }
  process.nextTick(function() {
    self.sendMessage(buffer, callback);
  });
};

Gelf.prototype.processMultipleChunks = function(buffer, chunkSize, callback) {
  var self = this,
      chunkArray,
      datagrams;

  chunkArray = self.prepareMultipleChunks(buffer, chunkSize);

  self.prepareDatagrams(chunkArray, function(err, datagrams) {
    if (err) {
      callback && callback(err);
      return self.emitError(err);
    }
    process.nextTick(function() {
      self.sendMultipleMessages(datagrams, callback);
    });
  });
};

Gelf.prototype.prepareMultipleChunks = function(buffer, chunkSize) {
  var chunkArray = [],
      index;

  for (index = 0; index < buffer.length; index += chunkSize) {
    chunkArray.push(Array.prototype.slice.call(buffer, index, index + chunkSize));
  }

  return chunkArray;
};

Gelf.prototype.prepareDatagrams = function(chunkArray, callback) {
  var self = this,
      count = chunkArray.length,
      gelfMagicNumber = [0x1e, 0x0f],
      datagrams = [];

  var createDatagramArray = function(msgId) {
    chunkArray.forEach(function(chunk, index) {
      datagrams[index] = new Buffer(gelfMagicNumber.concat(msgId, index, count, chunk));
    });
    callback && callback(null, datagrams);
  };

  var randomBytesCallback = function(ex, buf) {
    if (ex) {
      return self.emitError(ex);
    }
    createDatagramArray(Array.prototype.slice.call(buf));
  };

  var getRandomBytes = function() {
    crypto.randomBytes(8, randomBytesCallback);
  };
  getRandomBytes();
};

Gelf.prototype.sendMultipleMessages = function(datagrams, callback) {
  var self = this;

  var len = datagrams.length;
  var error;
  var i=0;
  var cb = function (err) {
    if(err)
      error=err;
    i++;
    if(i == len) {
      callback && callback(error);
    }
  };

  datagrams.forEach(function(buffer) {
    self.sendMessage(buffer, cb);
  });
};

Gelf.prototype.emitError = function(error) {
  this.emit('error', error);
};

module.exports = Gelf;