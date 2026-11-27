/**
 * Copyright reelyActive 2015-2020
 * We believe in an open Internet of Things
 */


const header = require('../../lib/advdata.js');
const assert = require ('assert');


// Input data for the scenario
const INPUT_DATA_INVALID_LENGTH = 'ff0000';
const INPUT_DATA_MULTIPLE_UUIDS = '0503edfeaafe050433221100';
const INPUT_DATA_MULTIPLE_SERVICE_DATA = '0516aafe12340516edfeabcd';
const INPUT_DATA_MULTIPLE_MANUFACTURER_DATA = '06ff4c00a441e507ff8305c0deb10e';


// Expected outputs for the scenario
const EXPECTED_DATA_INVALID_INPUT = null;
const EXPECTED_DATA_MULTIPLE_UUIDS = {
    uuids: [ 'feed', 'feaa', '00112233' ]
};
const EXPECTED_DATA_MULTIPLE_SERVICE_DATA = {
    serviceData: [
        { uuid: "feaa", data: "1234" }, { uuid: "feed", data: "abcd" }
    ]
};
const EXPECTED_DATA_MULTIPLE_MANUFACTURER_DATA = {
    manufacturerSpecificData: [
        { companyCode: 0x004c, data: "a441e5" },
        { companyCode: 0x0583, data: "c0deb10e" }
    ]
};


// Describe the scenario
describe('advData', function() {

  // Test the process function with no input data
  it('should handle no input data', function() {
    assert.deepEqual(header.process(), EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with invalid length
  it('should handle an invalid length', function() {
    assert.deepEqual(header.process(INPUT_DATA_INVALID_LENGTH),
                     EXPECTED_DATA_INVALID_INPUT);
  });

  // Test the process function with multiple UUIDs
  it('should handle multiple UUIDs', function() {
    assert.deepEqual(header.process(INPUT_DATA_MULTIPLE_UUIDS),
                     EXPECTED_DATA_MULTIPLE_UUIDS);
  });

  // Test the process function with multiple service data
  it('should handle multiple service data', function() {
    assert.deepEqual(header.process(INPUT_DATA_MULTIPLE_SERVICE_DATA),
                     EXPECTED_DATA_MULTIPLE_SERVICE_DATA);
  });

  // Test the process function with multiple manufacturer data
  it('should handle multiple manufacturer data', function() {
    assert.deepEqual(header.process(INPUT_DATA_MULTIPLE_MANUFACTURER_DATA),
                     EXPECTED_DATA_MULTIPLE_MANUFACTURER_DATA);
  });

});