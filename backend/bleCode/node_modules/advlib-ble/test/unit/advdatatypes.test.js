/**
 * Copyright reelyActive 2015-2021
 * We believe in an open Internet of Things
 */


const advDataTypes = require("../../lib/advdatatypes.js");
const assert = require ('assert');


// Input data for the scenario
const INPUT_DATA_FLAGS = '020106';
const INPUT_DATA_16BIT_UUID = '0302edfe';
const INPUT_DATA_16BIT_UUIDS = '0503edfeaafe';
const INPUT_DATA_32BIT_UUID = '050433221100';
const INPUT_DATA_32BIT_UUIDS = '090533221100ddccbbaa';
const INPUT_DATA_128BIT_UUID = '1106ffeeddccbbaa99887766554433221100';
const INPUT_DATA_128BIT_UUIDS =
         '2107ffeeddccbbaa9988776655443322110000112233445566778899aabbccddeeff';
const INPUT_DATA_SHORTENED_NAME = '07086164766c6962';
const INPUT_DATA_COMPLETE_NAME = '16096164766c6962206279207265656c79416374697665';
const INPUT_DATA_TX_POWER = '020af4';
const INPUT_DATA_APPEARANCE = '03193412';
const INPUT_DATA_16BIT_SERVICE = '1216aafe109f027265656c7961637469766507';
const INPUT_DATA_32BIT_SERVICE = '092067452301aabbccdd';
const INPUT_DATA_128BIT_SERVICE = '1221ffeeddccbbaa9988776655443322110069';
const INPUT_DATA_SERVICE_LIBRARIES = [
    { processServiceData: function(uuid, data) { return { isLibrary: true } } }
];
const INPUT_DATA_URI = '1524172f2f7777772e626c7565746f6f74682e636f6d';
const INPUT_DATA_MANUFACTURER_SPECIFIC = '0bff4c0009060202c0a8006a';
const INPUT_DATA_MANUFACTURER_LIBRARIES = [
    { processManufacturerSpecificData: function(companyCode, data) {
                                                 return { isLibrary: true } } }
];
const INPUT_DATA_OPTIONS_INDICES = {
    indices: [
        { lookup: function(id, options) {
                   return 'https://sniffypedia.org/Organization/Apple_Inc/' } }
    ]
};


// Expected outputs for the scenario
const EXPECTED_DATA_INVALID_INPUT = null;
const EXPECTED_DATA_FLAGS = { flags: [ 1, 2 ] };
const EXPECTED_DATA_16BIT_UUID = { uuids: [ 'feed' ] };
const EXPECTED_DATA_16BIT_UUIDS = { uuids: [ 'feed', 'feaa' ] };
const EXPECTED_DATA_32BIT_UUID = { uuids: [ '00112233' ] };
const EXPECTED_DATA_32BIT_UUIDS = { uuids: [ '00112233', 'aabbccdd' ] };
const EXPECTED_DATA_128BIT_UUID = {
    uuids: [ '00112233445566778899aabbccddeeff' ]
};
const EXPECTED_DATA_128BIT_UUIDS = {
    uuids: [ '00112233445566778899aabbccddeeff',
             'ffeeddccbbaa99887766554433221100' ]
};
const EXPECTED_DATA_SHORTENED_NAME = { name: "advlib" };
const EXPECTED_DATA_COMPLETE_NAME = { name: "advlib by reelyActive" };
const EXPECTED_DATA_TX_POWER = { txPower: -12 };
const EXPECTED_DATA_APPEARANCE = { appearance: 0x1234 };
const EXPECTED_DATA_16BIT_SERVICE = {
    serviceData: [ { uuid: "feaa", data: "109f027265656c7961637469766507" } ]
};
const EXPECTED_DATA_32BIT_SERVICE = {
    serviceData: [ { uuid: "01234567", data: "aabbccdd" } ]
};
const EXPECTED_DATA_128BIT_SERVICE = {
    serviceData: [ { uuid: "00112233445566778899aabbccddeeff", data: "69" } ]
};
const EXPECTED_DATA_SERVICE_LIBRARIES = {
    isLibrary: true
};
const EXPECTED_DATA_URI = { uri: "https://www.bluetooth.com" };
const EXPECTED_DATA_MANUFACTURER_SPECIFIC = {
    manufacturerSpecificData: [ { companyCode: 76, data: "09060202c0a8006a" } ]
};
const EXPECTED_DATA_MANUFACTURER_LIBRARIES = {
    isLibrary: true
};
const EXPECTED_DATA_MANUFACTURER_LIBRARIES_INDICES = {
    isLibrary: true,
    uri: 'https://sniffypedia.org/Organization/Apple_Inc/'
};


// Describe the scenario
describe('advDataTypes', function() {

  // Test the process function with no input data
  it('should handle no input data', function() {
    assert.deepEqual(advDataTypes.process(), EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with flags
  it('should handle flags', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_FLAGS),
                     EXPECTED_DATA_FLAGS);
  });

  // Test the process function with a 16-bit UUID
  it('should handle a 16-bit UUID', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_16BIT_UUID),
                     EXPECTED_DATA_16BIT_UUID);
  });

  // Test the process function with multiple 16-bit UUIDs
  it('should handle multiple 16-bit UUIDs', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_16BIT_UUIDS),
                     EXPECTED_DATA_16BIT_UUIDS);
  });

  // Test the process function with a 32-bit UUID
  it('should handle a 32-bit UUID', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_32BIT_UUID),
                     EXPECTED_DATA_32BIT_UUID);
  });

  // Test the process function with multiple 32-bit UUIDs
  it('should handle multiple 32-bit UUIDs', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_32BIT_UUIDS),
                     EXPECTED_DATA_32BIT_UUIDS);
  });

  // Test the process function with a 128-bit UUID
  it('should handle a 128-bit UUID', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_128BIT_UUID),
                     EXPECTED_DATA_128BIT_UUID);
  });

  // Test the process function with multiple 128-bit UUIDs
  it('should handle multiple 128-bit UUIDs', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_128BIT_UUIDS),
                     EXPECTED_DATA_128BIT_UUIDS);
  });

  // Test the process function with shortened name
  it('should handle shortened local name', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_SHORTENED_NAME),
                     EXPECTED_DATA_SHORTENED_NAME);
  });

  // Test the process function with complete name
  it('should handle complete local name', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_COMPLETE_NAME),
                     EXPECTED_DATA_COMPLETE_NAME);
  });

  // Test the process function with Tx Power
  it('should handle Tx Power', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_TX_POWER),
                     EXPECTED_DATA_TX_POWER);
  });

  // Test the process function with appearance
  it('should handle appearance', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_APPEARANCE),
                     EXPECTED_DATA_APPEARANCE);
  });

  // Test the process function with 16-bit service data
  it('should handle 16-bit service data', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_16BIT_SERVICE),
                     EXPECTED_DATA_16BIT_SERVICE);
  });

  // Test the process function with 32-bit service data
  it('should handle 32-bit service data', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_32BIT_SERVICE),
                     EXPECTED_DATA_32BIT_SERVICE);
  });

  // Test the process function with 128-bit service data
  it('should handle 128-bit service data', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_128BIT_SERVICE),
                     EXPECTED_DATA_128BIT_SERVICE);
  });

  // Test the process function with service data libraries
  it('should handle service data from libraries', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_16BIT_SERVICE, 0,
                                          INPUT_DATA_SERVICE_LIBRARIES),
                     EXPECTED_DATA_SERVICE_LIBRARIES);
  });

  // Test the process function with URI
  it('should handle URI', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_URI), EXPECTED_DATA_URI);
  });

  // Test the process function with manufacturer specific data
  it('should handle manufacturer specific data', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_MANUFACTURER_SPECIFIC),
                     EXPECTED_DATA_MANUFACTURER_SPECIFIC);
  });

  // Test the process function with manufacturer specific data libraries
  it('should handle manufacturer specific data from libraries', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_MANUFACTURER_SPECIFIC, 0,
                                          INPUT_DATA_MANUFACTURER_LIBRARIES),
                     EXPECTED_DATA_MANUFACTURER_LIBRARIES);
  });

  // Test the process function with manufacturer specific data indices
  it('should handle manufacturer specific data with indices', function() {
    assert.deepEqual(advDataTypes.process(INPUT_DATA_MANUFACTURER_SPECIFIC, 0,
                                          INPUT_DATA_MANUFACTURER_LIBRARIES,
                                          INPUT_DATA_OPTIONS_INDICES),
                     EXPECTED_DATA_MANUFACTURER_LIBRARIES_INDICES);
  });

});