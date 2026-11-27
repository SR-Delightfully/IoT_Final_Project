/**
 * Copyright reelyActive 2015-2024
 * We believe in an open Internet of Things
 */


const advData = require('./advdata');
const header = require('./header');
const utils = require('./utils');


const MIN_PACKET_LENGTH_BYTES = 8;


/**
 * Process a raw Bluetooth Low Energy radio packet data unit (PDU) into
 * semantically meaningful information.
 * @param {Object} data The raw PDU as a hexadecimal-string or Buffer.
 * @param {Array} libraries Optional ordered list of processing libraries.
 * @param {Object} options Optional processing options.
 * @return {Object} The processed PDU as JSON.
 */
function process(data, libraries, options) {
  options = options || {};

  // The data is a protocol-specific data Object
  if(utils.isProtocolSpecificData(data)) {
    return processProtocolSpecificData(data, libraries, options);
  }

  let buf = utils.convertToBuffer(data);
  if((buf === null) || (buf.length < MIN_PACKET_LENGTH_BYTES)) {
    return null;
  }

  // The data is a raw PDU, converted to Buffer
  let processedPacket = {};
  let isPayloadOnly = (options.isPayloadOnly === true);

  if(isPayloadOnly) {
    processedPacket = advData.process(buf, 0, libraries, options);

    if(!processedPacket.hasOwnProperty('uri')) {
      processedPacket.uri = 'https://sniffypedia.org/Product/Any_BLE-Device/';
    }

    return processedPacket;
  }

  let headerProperties = header.process(buf.subarray(0, 2));
  let advA;
  let includeProtocolOverhead = (options.ignoreProtocolOverhead !== true);

  if(includeProtocolOverhead) {
    Object.assign(processedPacket, headerProperties);
  }

  // Process the packet based on its type (Bluetooth Core, Vol 6, Part B, 2.3)
  switch(headerProperties.type) {
    case 'ADV_IND':
    case 'ADV_NONCONN_IND':
    case 'ADV_SCAN_IND':
    case 'SCAN_RSP':
    case 'ADV_SCAN_IND':
      if(includeProtocolOverhead) {
        processedPacket.advA = utils.parseAddress(buf.subarray(2, 8));
      }
      let advDataProperties = advData.process(buf.subarray(8), 0, libraries,
                                              options);
      Object.assign(processedPacket, advDataProperties);
      break;
    case 'ADV_DIRECT_IND':
      let targetA = utils.parseAddress(buf.subarray(8, 14));
      if(includeProtocolOverhead) {
        processedPacket.advA = utils.parseAddress(buf.subarray(2, 8));
        processedPacket.targetA = targetA;
      }
      // TODO: include targetA in nearest?
      break;
    case 'SCAN_REQ':
      advA = utils.parseAddress(buf.subarray(8, 14));
      if(includeProtocolOverhead) {
        processedPacket.scanA = utils.parseAddress(buf.subarray(2, 8));
        processedPacket.advA = advA;
      }
      processedPacket.uri = 'https://sniffypedia.org/Product/Any_Curious-Device/';
      // TODO: include advA in nearest?
      break;
    case 'CONNECT_IND':
      advA = utils.parseAddress(buf.subarray(8, 14));
      if(includeProtocolOverhead) {
        processedPacket.initA = utils.parseAddress(buf.subarray(2, 8));
        processedPacket.advA = advA;
        // TODO: parse llData
      }
      // TODO: include advA in nearest?
      break;
    case 'ADV_EXT_IND':
      // TODO: Common Extended Advertising Payload Format
      break;
  }

  if(!processedPacket.hasOwnProperty('uri')) {
    processedPacket.uri = 'https://sniffypedia.org/Product/Any_BLE-Device/';
  }

  return processedPacket;
}


/**
 * Process protocol-specific data.
 * @param {Object} data The protocol-specific data value.
 * @param {Array} libraries Optional ordered list of processing libraries.
 * @param {Object} options Optional processing options.
 * @return {Object} The processed protocol-specific data as JSON.
 */
function processProtocolSpecificData(data, libraries, options) {
  let hasLibraries = (Array.isArray(libraries) && (libraries.length > 0));

  if(hasLibraries) {
    for(let cLibrary = 0; cLibrary < libraries.length; cLibrary++) {
      let library = libraries[cLibrary];
      if(utils.hasFunction(library, 'processProtocolSpecificData')) {
        let processedData = library.processProtocolSpecificData(data);

        if(processedData !== null) {
          return processedData;
        }
      }
    }
  }

  return null;
}


module.exports.process = process;
module.exports.header = header;
