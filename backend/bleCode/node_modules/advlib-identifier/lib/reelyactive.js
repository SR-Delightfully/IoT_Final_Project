/**
 * Copyright reelyActive 2015-2018
 * We believe in an open Internet of Things
 */


const identifiers = require('./identifiers');


/**
 * Extract the identifier from the given source packet.
 * @param {String} packet The source packet as a hexadecimal string.
 * @return {Object} The identifier and its type.
 */
function extractIdentifier(packet) {
  let identifier = identifiers.REELYACTIVE_OUI36 + packet.substr(0,7);

  return {
      identifier: identifier,
      identifierType: identifiers.TYPE_EUI64
  }
}


module.exports.extractIdentifier = extractIdentifier;
