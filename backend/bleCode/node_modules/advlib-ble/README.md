advlib-ble
==========

Wireless advertising packet decoding library for Bluetooth Low Energy.  __advlib-ble__ can be used standalone or, more commonly, as a processor module of the protocol-agnostic [advlib](https://github.com/reelyactive/advlib) library.

![Overview of advlib-ble](https://reelyactive.github.io/advlib-ble/images/overview.png)

__advlib-ble__ is a lightweight [Node.js package](https://www.npmjs.com/package/advlib-ble) that implements the Core Bluetooth Specification and can be extended with libraries to decode service data and manufacturer-specific data outside of this specification.

| Library | Decodes |
|:--------|:--------|
| [advlib-ble-services](https://github.com/reelyactive/advlib-ble-services) | Service Data |
| [advlib-ble-manufacturers](https://github.com/reelyactive/advlib-ble-manufacturers) | Manufacturer-Specific Data |
| [advlib-ble-gatt](https://github.com/reelyactive/advlib-ble-gatt) | GATT Protocol-Specific Data |


Installation
------------

    npm install advlib-ble


Hello advlib-ble!
-----------------

```javascript
const advlib = require('advlib-ble');

const LIBRARIES = [ require('advlib-ble-services'),
                    require('advlib-ble-manufacturers'),
                    require('advlib-ble-gatt' ];

let packet = 'c21d04acbe55daba16096164766c6962206279207265656c79416374697665';
let processedPacket = advlib.process(packet, LIBRARIES);

console.log(processedPacket);
```

Which should yield the following console output:

    { rxAdd: "random",
      txAdd: "random",
      type: "ADV_NONCONN_IND",
      length: 29,
      advA: "bada55beac04",
      name: "advlib by reelyActive" }


Options
-------

__advlib-ble__ supports the following options for its process function:

| Property               | Default | Description                         | 
|:-----------------------|:--------|:------------------------------------|
| ignoreProtocolOverhead | false   | Ignore BLE-specific properties (txAdd, length, type, advA, etc.) |
| isPayloadOnly          | false   | Interpret data as the optional PDU payload only (i.e. without header or advertiser address) |
| indices                | []      | URI-lookup indices such as Sniffypedia |

For example, to ignore the Bluetooth Low Energy protocol overhead:

```javascript
let packet = 'c21d04acbe55daba16096164766c6962206279207265656c79416374697665';
let options = { ignoreProtocolOverhead: true };
let processedPacket = advlib.process(packet, [], options);
```

Which should yield the following console output:

    { name: "advlib by reelyActive" }

If only the payload is available, the example above would be handled as follows:

```javascript
let payload = '16096164766c6962206279207265656c79416374697665';
let options = { isPayloadOnly: true };
let processedPayload = advlib.process(packet, [], options);
```

Which should again yield the following console output:

    { name: "advlib by reelyActive" }

For example, to append implicit URIs using the Sniffypedia index:

```javascript
let packet = '401490a3a947507b02011a0aff4c0010050a10b4f1e2';
let options = { indices: [ require('sniffypedia') ] };
let processedPacket = advlib.process(packet, [], options);
```

Which should yield the following console output:

    { uri: "https://sniffypedia.org/Organization/Apple_Inc/" }


Contributing
------------

Discover [how to contribute](CONTRIBUTING.md) to this open source project which upholds a standard [code of conduct](CODE_OF_CONDUCT.md).


Security
--------

Consult our [security policy](SECURITY.md) for best practices using this open source software and to report vulnerabilities.


License
-------

MIT License

Copyright (c) 2015-2025 [reelyActive](https://www.reelyactive.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
THE SOFTWARE.
