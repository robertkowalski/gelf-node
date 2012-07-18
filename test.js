Gelf = require('./gelf');

var gelf = new Gelf(null);

var message = {

};

gelf.emit('gelf.log', message);