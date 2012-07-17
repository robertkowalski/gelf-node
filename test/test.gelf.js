var expect = require('chai').expect,
    Gelf = require('../Gelf');

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
    gelf.sendMessage('bar');
  });


});