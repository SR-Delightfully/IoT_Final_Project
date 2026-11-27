/**
 * Copyright reelyActive 2015-2020
 * We believe in an open Internet of Things
 */


const utils = require('./utils');


const RANDOM_RX_MASK = 0x8000;
const RANDOM_TX_MASK = 0x4000;
const TYPE_MASK = 0x0f00;
const LENGTH_MASK = 0x00ff;


/**
 * Process a raw Bluetooth Low Energy advertising packet header.
 * @param {Buffer} data The header.
 * @return {Object} The processed header.
 */
function process(data) {
  let buf = utils.convertToBuffer(data);
  if(buf === null) {
    return null;
  }

  let header = buf.readUInt16BE();

  let isRandomRx = (header & RANDOM_RX_MASK);
  let isRandomTx = (header & RANDOM_TX_MASK);
  let rxAdd = (isRandomRx ? 'random' : 'public');
  let txAdd = (isRandomTx ? 'random' : 'public');
  let type = determineType((header & TYPE_MASK) >> 8);
  let length = header & LENGTH_MASK;

  return { rxAdd: rxAdd, txAdd: txAdd, type: type, length: length };
}


/**
 * Determine the packet type from its type code.
 * NOTE: assumes Primary Advertising physical channel only.
 * @param {Number} type The type as an integer between 0-7.
 * @return {String} The packet type as a string.
 */
function determineType(type) {
  switch(type) {
    case 0:
      return 'ADV_IND';
    case 1:
      return 'ADV_DIRECT_IND';
    case 2:
      return 'ADV_NONCONN_IND';
    case 3:
      return 'SCAN_REQ';
    case 4:
      return 'SCAN_RSP';
    case 5:
      return 'CONNECT_IND';
    case 6:
      return 'ADV_SCAN_IND';
    case 7:
      return 'ADV_EXT_IND';
    default:
      return 'RFU';
  }
}


module.exports.process = process;