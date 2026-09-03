const { generateCaretakerDigest } = require('./src/aws/bedrockDigest');

generateCaretakerDigest('cam1', Date.now())
  .then(digest => console.log('Digest generated:\n', digest))
  .catch(err => console.error('Error:', err));