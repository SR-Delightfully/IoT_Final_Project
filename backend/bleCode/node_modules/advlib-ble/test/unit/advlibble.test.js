/**
 * Copyright reelyActive 2015-2022
 * We believe in an open Internet of Things
 */


const advlib = require('../../lib/advlibble.js');
const assert = require ('assert');


// Input data for the scenario
const INPUT_DATA_INVALID_HEX_STRING = 'xyz';
const INPUT_DATA_TOO_SHORT_BUFFER = Buffer.from('000f', 'hex');
const INPUT_DATA_VALID_HEX_STRING = '4006ab8967452301';
const INPUT_DATA_ADV_NONCONN_IND =
                       'c219ab89674523011216aafe109f027265656c7961637469766507';
const INPUT_DATA_ADV_DIRECT_IND = 'c10cab8967452301ffeeddccbbaa';
const INPUT_DATA_SCAN_REQ = 'c30cab8967452301ffeeddccbbaa';
const INPUT_DATA_CONNECT_IND = 'c50cab8967452301ffeeddccbbaa';
const INPUT_DATA_ADV_EXT_IND = 'c706ab8967452301';
const INPUT_DATA_PAYLOAD_ONLY = INPUT_DATA_ADV_NONCONN_IND.substring(16);
const INPUT_DATA_OPTIONS_IGNORE_PROTOCOL_OVERHEAD = {
    ignoreProtocolOverhead: true
};
const INPUT_DATA_OPTIONS_PAYLOAD_ONLY = { isPayloadOnly: true };


// Expected outputs for the scenario
const EXPECTED_DATA_INVALID_INPUT = null;
const EXPECTED_DATA_VALID_INPUT = {
    rxAdd: "public",
    txAdd: "random",
    type: "ADV_IND",
    length: 6,
    advA: "0123456789ab",
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};
const EXPECTED_DATA_ADV_NONCONN_IND = {
    rxAdd: "random",
    txAdd: "random",
    type: "ADV_NONCONN_IND",
    length: 25,
    advA: "0123456789ab",
    serviceData: [ { uuid: "feaa", data: "109f027265656c7961637469766507" } ],
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};
const EXPECTED_DATA_ADV_DIRECT_IND = {
    rxAdd: "random",
    txAdd: "random",
    type: "ADV_DIRECT_IND",
    length: 12,
    advA: "0123456789ab",
    targetA: "aabbccddeeff",
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};
const EXPECTED_DATA_SCAN_REQ = {
    rxAdd: "random",
    txAdd: "random",
    type: "SCAN_REQ",
    length: 12,
    scanA: "0123456789ab",
    advA: "aabbccddeeff",
    uri: "https://sniffypedia.org/Product/Any_Curious-Device/"
};
const EXPECTED_DATA_CONNECT_IND = {
    rxAdd: "random",
    txAdd: "random",
    type: "CONNECT_IND",
    length: 12,
    initA: "0123456789ab",
    advA: "aabbccddeeff",
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};
const EXPECTED_DATA_ADV_EXT_IND = {
    rxAdd: "random",
    txAdd: "random",
    type: "ADV_EXT_IND",
    length: 6,
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};
const EXPECTED_DATA_NO_PROTOCOL_OVERHEAD = {
    serviceData: [ { uuid: "feaa", data: "109f027265656c7961637469766507" } ],
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};
const EXPECTED_DATA_PAYLOAD_ONLY = {
    serviceData: [ { uuid: "feaa", data: "109f027265656c7961637469766507" } ],
    uri: "https://sniffypedia.org/Product/Any_BLE-Device/"
};


// Describe the scenario
describe('advlib-ble', function() {

  // Test the process function with no input data
  it('should handle no input data', function() {
    assert.deepEqual(advlib.process(), EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with an invalid hex string
  it('should handle an invalid hex string as input', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_INVALID_HEX_STRING),
                     EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with a buffer that is too short
  it('should handle a too short buffer as input', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_TOO_SHORT_BUFFER),
                     EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with a valid hex string
  it('should handle a valid hex string as input', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_VALID_HEX_STRING),
                     EXPECTED_DATA_VALID_INPUT);
  });

  // Test the process function with an ADV_NONCONN_IND packet
  it('should handle an ADV_NONCONN_IND packet', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_ADV_NONCONN_IND),
                     EXPECTED_DATA_ADV_NONCONN_IND);
  });

  // Test the process function with an ADV_DIRECT_IND packet
  it('should handle an ADV_DIRECT_IND packet', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_ADV_DIRECT_IND),
                     EXPECTED_DATA_ADV_DIRECT_IND);
  });

  // Test the process function with a SCAN_REQ packet
  it('should handle a SCAN_REQ packet', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_SCAN_REQ),
                     EXPECTED_DATA_SCAN_REQ);
  });

  // Test the process function with a CONNECT_IND packet
  it('should handle a CONNECT_IND packet', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_CONNECT_IND),
                     EXPECTED_DATA_CONNECT_IND);
  });

  // Test the process function with an ADV_EXT_IND packet
  it('should handle an ADV_EXT_IND packet', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_ADV_EXT_IND),
                     EXPECTED_DATA_ADV_EXT_IND);
  });

  // Test the process function with no protocol overhead
  it('should handle the ignore protocol overhead option', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_ADV_NONCONN_IND, null,
                                  INPUT_DATA_OPTIONS_IGNORE_PROTOCOL_OVERHEAD),
                     EXPECTED_DATA_NO_PROTOCOL_OVERHEAD);
  });

  // Test the process function with payload only
  it('should handle the payload only option', function() {
    assert.deepEqual(advlib.process(INPUT_DATA_PAYLOAD_ONLY, null,
                                    INPUT_DATA_OPTIONS_PAYLOAD_ONLY),
                     EXPECTED_DATA_PAYLOAD_ONLY);
  });

});
