advlib-identifier
=================

Library for extracting the wireless device identifier from a transmitted packet.  We believe in an open Internet of Things.


Bluetooth Low Energy (BLE)
--------------------------

Extract the identifier (and its type) from a BLE Packet Data Unit (PDU) represented as a hexadecimal string.  For example:

```javascript
const advlib = require('advlib-identifier');

let packet = '400dc3dc80ee20e40201060303edfe';
let identifier = advlib.ble.extractIdentifier(packet);

console.log(identifier);
// {
//     identifier: "e420ee80dcc3",
//     identifierType: 3
// }
```


reelyActive (Sub-GHz Active RFID)
---------------------------------

Extract the identifier (and its type) from a packet represented as a hexadecimal string.  For example:

```javascript
const advlib = require('advlib-identifier');

let packet = '1234567c';
let identifier = advlib.reelyactive.extractIdentifier(packet);

console.log(identifier);
// {
//     identifier: "001bc50941234567",
//     identifierType: 1
// }
```


Identifiers
-----------

Identifier types are encoded as numbers.  The following identifier types are currently supported.

| identifierType | Reference    | Description                         |
|----------------|--------------|-------------------------------------|
| 0              | TYPE_UNKNOWN | Unknown identifier                  |
| 1              | TYPE_EUI64   | EUI-64                              |
| 2              | TYPE_EUI48   | EUI-48 (BLE public address)         |
| 3              | TYPE_RND48   | Random 48-bits (BLE random address) |

```javascript
const advlib = require('advlib-identifier');

let identifierType = 3;

if(identifierType === advlib.identifiers.TYPE_RND48) {
  console.log('The identifier is a BLE random address');
}
// -> The identifier is a BLE random address
```

License
-------

MIT License

Copyright (c) 2018 [reelyActive](https://www.reelyactive.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
THE SOFTWARE.
