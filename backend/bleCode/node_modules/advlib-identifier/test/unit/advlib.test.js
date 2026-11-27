/**
 * Copyright reelyActive 2018
 * We believe in an open Internet of Things
 */

const advlib = require('../../lib/advlib');
const identifiers = require('../../lib/identifiers');
const assert = require ('assert');


// Inputs for the scenario
const INPUT_DATA_BLE_PUBLIC =
    '061b9e5ed0f7b13402010611074449555520657669746341796c656572';
const INPUT_DATA_BLE_RANDOM = '400dc3dc80ee20e40201060303edfe';
const INPUT_DATA_REELYACTIVE = '1234567c';


// Expected outputs for the scenario
const EXPECTED_DATA_BLE_PUBLIC = {
    identifier: "34b1f7d05e9e",
    identifierType: identifiers.TYPE_EUI48
};
const EXPECTED_DATA_BLE_RANDOM = {
    identifier: "e420ee80dcc3",
    identifierType: identifiers.TYPE_RND48
};
const EXPECTED_DATA_REELYACTIVE = {
    identifier: "001bc50941234567",
    identifierType: identifiers.TYPE_EUI64
};


// Describe the scenario
describe('raddec', function() {

  // Test BLE public
  it('should extract a BLE public identifier', function() {
    assert.deepEqual(advlib.ble.extractIdentifier(INPUT_DATA_BLE_PUBLIC),
                     EXPECTED_DATA_BLE_PUBLIC);
  });

  // Test BLE random
  it('should extract a BLE random identifier', function() {
    assert.deepEqual(advlib.ble.extractIdentifier(INPUT_DATA_BLE_RANDOM),
                     EXPECTED_DATA_BLE_RANDOM);
  });

  // Test reelyActive
  it('should extract a reelyActive identifier', function() {
    assert.deepEqual(advlib.reelyactive.extractIdentifier(
                     INPUT_DATA_REELYACTIVE), EXPECTED_DATA_REELYACTIVE);
  });

});
