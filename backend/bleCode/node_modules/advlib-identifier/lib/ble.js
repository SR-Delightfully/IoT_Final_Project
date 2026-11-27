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
  let header = packet.substr(0,4);
  let advertiserAddress = packet.substr(14,2) +
                          packet.substr(12,2) +
                          packet.substr(10,2) +
                          packet.substr(8,2) +
                          packet.substr(6,2) +
                          packet.substr(4,2);
  let identifierType = identifiers.TYPE_EUI48;
  let txAddFlag = ((parseInt(header,16) & 0x4000) === 0x4000);

  if(txAddFlag) { // Advertiser address is random rather than public
    identifierType = identifiers.TYPE_RND48;
  }

  return {
      identifier: advertiserAddress,
      identifierType: identifierType
  }
}


module.exports.extractIdentifier = extractIdentifier;
