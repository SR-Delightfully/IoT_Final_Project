const Barnowl = require('barnowl'); //librarry
const BarnowlHci = require('barnowl-hci'); //listener plugin that feeds local Bluetooth Low Energy (BLE) data
const advlibBLE = require('advlib-ble'); //decode ambient BLE data into JSON

const BLE_LIBRARIES = [
    require('advlib-ble-services'),
    require('advlib-ble-manufacturers')
];

//sensor's MAC address.
const TARGET_MAC = "C30000455DA7";

const barnowl = new Barnowl({
    enableMixing: true
});

//listens using the Raspberry Pi's Bluetooth adapter.
barnowl.addListener(
    BarnowlHci,
    {},
    BarnowlHci.SocketListener,
    {}
);

//process Bluetooth detections.
barnowl.on('raddec', (raddec) => {

    //ignores other Bluetooth devices.
    if (raddec.transmitterId.toUpperCase() !== TARGET_MAC) {
        return;
    }

    console.log("Target sensor detected!");

    //decodes data received from the Bluetooth device (only temperature needed)
    raddec.packets.forEach((packet) => {

        try {

            const decoded = advlibBLE.process(
                packet,
                BLE_LIBRARIES
            );

            console.log("Sensor information:");

            console.log("Temperature: ", decoded.temperature);

            console.log("Humidity: ", decoded.relativeHumidity);

            console.log("Motion: ", decoded.isMotionDetected);

            console.log("Battery: ", decoded.batteryPercentage);

        } catch (error) {

            console.error("Packet decoding failed: ", error);

        }

    });

});
