const Gelf = require('./gelf')

const gelf = new Gelf(null)

gelf.emit('gelf.log', 'wahwah')
