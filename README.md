# frankenstein

> Fluent binary parser for node.js and the browser. [Feed it like Frankenstein.](https://www.tape.tv/alice-cooper/videos/feed-my-frankenstein)

## Installation

```shell
npm i frankenstein
```

## Examples

```javascript
var FrankensteinsMonster = require('frankenstein');

// Can be an ArrayBuffer, TypedArray, node Buffer or whatever
var someSource = getSomeSourceData();
var monster = new FrankensteinsMonster(someSource);

// Fluent interface
var str = monster.from(15).write.uint8(123).read.at(-5).string(5);

// Read/write structs as objects
var structDef = [
  ['foo', 'uint8'],
  ['bar', 'string', 5],
  ['baz', 'array', 10, 'uint8']
];
var obj = monster.from(123).struct(structDef);

// Use peek to read/write at arbitrary offsets without moving data.offset
monster.from(100).write.uint16(4567);
console.log(monster.offset); // 102
var peek = monster.peek.from(100).uint16(); // 4567
console.log(peek.offset); // 102
peek.read.uint8();
console.log(peek.offset); // 103
console.log(monster.offset); // still 102

// Create a monster with a 1000 byte brain
var newMonster = new FrankensteinsMonster(1000);
newMonster.from(100).int32(-123456); // Auto write mode
console.log(newMonster.offset); // 104
console.log(newMonster.dataLength); // 104 (points to the last written byte)
var buf = newMonster.toArrayBuffer();
console.log(buf.byteLength); // 104 (returns data up to the last written byte)

// Auto grow
var anotherMonster = new FrankensteinsMonster(20);
anotherMonster.from(18).uint32(123);
console.log(anotherMonster.byteLength); // 40
```

## API

TBD

## License

Copyright (c) 2015 [Felix Zandanel](http://felix.zandanel.me)  
Licensed under the MIT license.

See LICENSE for more info.
