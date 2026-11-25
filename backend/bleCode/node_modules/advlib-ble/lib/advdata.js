/**
 * Copyright reelyActive 2015-2022
 * We believe in an open Internet of Things
 */


const advDataTypes = require('./advdatatypes');
const utils = require('./utils');


/**
 * Process a raw Bluetooth Low Energy advertising packet's advData.
 * @param {Buffer} data The advData.
 * @param {Number} offset The optional offset into the buffer.
 * @param {Array} libraries Optional ordered list of processing libraries.
 * @param {Object} options Optional processing options.
 * @return {Object} The processed advData.
 */
function process(data, offset, libraries, options) {
  offset = offset || 0;
  options = options || {};

  let buf = utils.convertToBuffer(data);
  if((buf === null) || (buf.length < (offset + 1))) {
    return null;
  }

  let advDataProperties = {};
  let dataTypeIndex = offset || 0;
  let isAnotherDataType = (dataTypeIndex < buf.length);

  // Iterate over each data type present in the advData
  while(isAnotherDataType) {
    let dataTypeProperties = advDataTypes.process(buf, dataTypeIndex,
                                                  libraries, options);

    if(dataTypeProperties !== null) {
      mergeProperties(advDataProperties, dataTypeProperties);
    }

    let length = buf.readUInt8(dataTypeIndex);
    dataTypeIndex += length + 1;
    isAnotherDataType = (dataTypeIndex < buf.length);
  }

  let isValidDataTypesLength = (dataTypeIndex === buf.length);
  if(!isValidDataTypesLength) {
    return null;
  }

  return advDataProperties;
}


/**
 * Merge the properties of the source object into the target object, handling
 * duplicate properties appropriately.
 * @param {Object} target The target properties.
 * @param {Object} source The source properties.
 */
function mergeProperties(target, source) {
  for(property in source) {
    let isDuplicateProperty = target.hasOwnProperty(property);

    if(isDuplicateProperty) {
      switch(property) {
        case 'uuids':
        case 'deviceIds':
        case 'serviceData':
        case 'manufacturerSpecificData':
          source[property].forEach(function(item) {
            let isDuplicate = target[property].includes(item);
            if(!isDuplicate) {
              target[property].push(item);
            }
          }); 
          break;         
      }
    }
    else {
      target[property] = source[property];
    }
  }
}


module.exports.process = process;
