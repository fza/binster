# frankenstein

> Fluent binary parser for node.js and the browser. Feed it like Frankenstein.

## Installation

```shell
npm i frankenstein
```

## Examples

```javascript
var Frankenstein = require('frankenstein');

// Can be an ArrayBuffer, TypedArray, node Buffer or whatever
var someSource = getSomeSourceData();
var data = new Frankenstein(someSource);

// Fluent interface
var str = data.from(15).write.uint8(123).read.at(-5).string(5);

// Read/write structs as objects
var structDef = [
  ['foo', 'uint8'],
  ['bar', 'string', 5],
  ['baz', 'array', 10, 'uint8']
];
var obj = data.from(123).struct(structDef);

// Use peek to read/write at arbitrary offsets without moving data.offset
data.from(100).write.uint16(4567);
console.log(data.offset); // 102
var peek = data.peek.from(100).uint16(); // 4567
console.log(peek.offset); // 102
peek.read.uint8();
console.log(peek.offset); // 103
console.log(data.offset); // still 102

// Create a 1000 byte buffer
var newData = new Frankenstein(1000);
newData.from(100).int32(-123456); // Auto write mode
console.log(newData.offset); // 104
console.log(newData.dataLength); // 104 (points to the last written byte)
var buf = newData.toArrayBuffer();
console.log(buf.byteLength); // 104 (returns data up to the last written byte)

// Auto grow
var anotherData = new Frankenstein(20);
anotherData.from(18).uint32(123);
console.log(anotherData.byteLength); // 40
```

## API

TBD

## License

Copyright (c) 2015 [Felix Zandanel](http://felix.zandanel.me)  
Licensed under the MIT license.

See LICENSE for more info.
