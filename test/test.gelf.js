var expect = require('chai').expect,
    sinon = require('sinon'),
    Gelf = require('../Gelf'),
    inflate = require('zlib').inflate,
    os = require('os');

describe('Gelf', function(done) {

  it('should be an instance of EventEmitter', function() {
    var gelf = new Gelf(null);
    var EventEmitter = require('events').EventEmitter;

    expect(gelf instanceof EventEmitter).to.equal(true);
  });

  it('should send message buffers by udp', function(done) {
    var graylogStdPort = 12201;
    var graylogStdHost = 'localhost';

    var dgram = require('dgram');
    var server = dgram.createSocket('udp4');

    server.on('message', function (msg, rinfo) {
      /* Expect a message arrives at the server */
      expect(msg.toString()).to.equal('bar');
      done();
    });
    server.bind(graylogStdPort);

    var gelf = new Gelf(null);
    gelf.sendMessage(new Buffer('bar'));
  });

  it('should emit and receive events with attached event listeners', function(done) {
    var gelf = new Gelf(null);

    gelf.on('graylogmessage', function(message) {
      expect(message).to.equal('meh');
      done();
    });

    gelf.emit('graylogmessage', 'meh');
  });

  it('should deflate strings and call the callback afterwards', function(done) {
    var gelf = new Gelf(null);

    var callback = function(buffer) {
      inflate(buffer, function(err, buf) {
        expect(buf.toString()).to.equal('bla');
        done();
      });
    };

    gelf.compress('bla', callback);
  });

  it('should add missing properties to the gelf-json', function(done) {
    var gelf = new Gelf(null);

    var stub = sinon.stub(gelf, 'compress', function(message) {
      var json = JSON.parse(message);
      expect(json.version).to.equal('1.0');
      expect(json.host).to.equal(os.hostname());
      expect(json.facility).to.equal('node.js');
      expect(json.short_message).to.equal('Gelf Shortmessage');

      done();
    });

    gelf.emit('gelf.log', null);
  });

  it('should handle a string as shortmessage', function(done) {
    var gelf = new Gelf(null);

    var stub = sinon.stub(gelf, 'compress', function(message) {
      var json = JSON.parse(message);

      expect(json.short_message).to.equal('Mr. Lampe has left the building.');

      done();
    });

    gelf.emit('gelf.log', 'Mr. Lampe has left the building.');
  });

});