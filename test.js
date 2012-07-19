Gelf = require('./gelf');

var gelf = new Gelf(null);


gelf.emit('gelf.log', "wahwah");