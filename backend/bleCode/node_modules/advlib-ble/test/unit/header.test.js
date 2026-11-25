/**
 * Copyright reelyActive 2015-2020
 * We believe in an open Internet of Things
 */


const header = require('../../lib/header.js');
const assert = require ('assert');


// Input data for the scenario
const INPUT_DATA_PUBLIC_TX_RX = '000f';
const INPUT_DATA_RANDOM_TX_RX = 'c00f';
const INPUT_DATA_RFU_TYPE = '090f';
const INPUT_DATA_MAX_LENGTH = '07ff';


// Expected outputs for the scenario
const EXPECTED_DATA_INVALID_INPUT = null;
const EXPECTED_DATA_PUBLIC_TX_RX = {
    rxAdd: "public",
    txAdd: "public",
    type: "ADV_IND",
    length: 15
};
const EXPECTED_DATA_RANDOM_TX_RX = {
    rxAdd: "random",
    txAdd: "random",
    type: "ADV_IND",
    length: 15
};
const EXPECTED_DATA_RFU_TYPE = {
    rxAdd: "public",
    txAdd: "public",
    type: "RFU",
    length: 15
};
const EXPECTED_DATA_MAX_LENGTH = {
    rxAdd: "public",
    txAdd: "public",
    type: "ADV_EXT_IND",
    length: 255
};


// Describe the scenario
describe('header', function() {

  // Test the process function with no input data
  it('should handle no input data', function() {
    assert.deepEqual(header.process(), EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with public Tx and Rx
  it('should handle public Tx and Rx', function() {
    assert.deepEqual(header.process(INPUT_DATA_PUBLIC_TX_RX),
                     EXPECTED_DATA_PUBLIC_TX_RX);
  });

  // Test the process function with random Tx and Rx
  it('should handle random Tx and Rx', function() {
    assert.deepEqual(header.process(INPUT_DATA_RANDOM_TX_RX),
                     EXPECTED_DATA_RANDOM_TX_RX);
  });

  // Test the process function with reserved for future use type
  it('should handle RFU type', function() {
    assert.deepEqual(header.process(INPUT_DATA_RFU_TYPE),
                     EXPECTED_DATA_RFU_TYPE);
  });

  // Test the process function with maximum data length
  it('should handle max length', function() {
    assert.deepEqual(header.process(INPUT_DATA_MAX_LENGTH),
                     EXPECTED_DATA_MAX_LENGTH);
  });

});