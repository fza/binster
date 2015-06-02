'use strict';

function thr(ErrorClass, format) {
  var i = 2, args = arguments, arg;
  if (typeof ErrorClass === 'string') {
    i = 1;
    format = ErrorClass;
  }

  // Poor man's sprintf() that only knows %s and %d
  function nextArgToString() {
    arg = args[i++];
    return arg === null || arg === undefined ? '' : (typeof arg === 'function'
      ? '[' + (arg.name ? 'function ' + arg.name : 'anonymous function') + ']'
      : '' + arg
    );
  }

  var str = '', match = true;
  while (match) {
    match = format.match(/^([^%]*)(%[sd])/);
    if (match) {
      str += match[1] + nextArgToString();
      format = format.substr(match[0].length);
    }
  }

  throw new Error(str + format);
}

function thrType() {
  thr.apply(null, [TypeError].concat([].slice.call(arguments)));
}

var LITTLE_ENDIAN_PLATFORM = (function () {
  var buf = new ArrayBuffer(2);
  new DataView(buf).setInt16(0, 256, true);
  return (new Int16Array(buf))[0] === 256;
}());
var DEFAULT_OVERALLOCATE_FACTOR = 0;
var DEFAULT_EXPONENTIAL_GROWTH_FACTOR = 2;

var nullBuffer = new ArrayBuffer(0);
var nullByteArray = new Uint8Array(nullBuffer);

var defineProp = Object.defineProperty;
var defineProps = Object.defineProperties;
var slice = [].slice;
var objToString = {}.toString;

var typedArrayTags = [
  '[object Uint8Array]',
  '[object Uint8ClampedArray]',
  '[object Int8Array]',
  '[object Uint16Array]',
  '[object Int16Array]',
  '[object Uint32Array]',
  '[object Int32Array]',
  '[object Float32Array]',
  '[object Float64Array]'
];

function isTypedArray(val) {
  return typedArrayTags.indexOf(objToString.call(val)) !== -1;
}

function validateOverAllocateFactor(factor) {
  if (typeof factor !== 'number' || factor < 0) {
    thrType('overAllocateFactor must be an integer greater than or equal zero');
  }
}

function validateExponentialGrowthFactor(factor) {
  if (typeof factor !== 'number' || factor <= 1) {
    thrType('exponentialGrowthFactor must be an integer greater than one');
  }
}

var FrankensteinPeek;

/**
 * @param {number|ArrayBuffer|Uint8Array|Uint8ClampedArray|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|Float32Array|Float64Array|DataView|Frankenstein} src
 * @param {object} [options] Options
 * @constructor
 */
function Frankenstein(src, options) {
  options = options || {};

  var overAllocateFactor = options.overAllocateFactor || DEFAULT_OVERALLOCATE_FACTOR;
  validateOverAllocateFactor(overAllocateFactor);

  var exponentialGrowthFactor = options.exponentialGrowthFactor ||
    DEFAULT_EXPONENTIAL_GROWTH_FACTOR;
  validateExponentialGrowthFactor(exponentialGrowthFactor);

  var srcIsNumber = typeof src === 'number';
  if (!srcIsNumber && options.copySource) {
    src = (src instanceof Frankenstein ? src : new Frankenstein(src)).toByteArray(true, true);
  }

  var arrayBuffer;
  var srcIsDataView = false, srcIsByteArray = false, isNew = false;

  if (srcIsNumber) {
    if (src <= 0) {
      thrType('Cannot create a Frankenstein with a new buffer whose length is less than 1 byte');
    } else if (src === 0) {
      arrayBuffer = nullBuffer;
    } else {
      arrayBuffer = new ArrayBuffer(src);
    }
    isNew = true;
  } else if (src instanceof ArrayBuffer) {
    arrayBuffer = src;
  } else if (src instanceof Frankenstein || src instanceof FrankensteinPeek) {
    arrayBuffer = src.arrayBuffer;
  } else if (isTypedArray(src)) {
    arrayBuffer = src.buffer;
    srcIsByteArray = true;
  } else if (src.constructor && src.constructor.name === 'Buffer') {
    src = new Uint8Array(src);
    srcIsByteArray = true;
  } else if (src instanceof DataView) {
    arrayBuffer = src.buffer;
    srcIsDataView = true;
  //} else if (Blob && src instanceof Blob) { // TODO Figure out how to do this synchronously
    //var fileReader = new FileReader();
    //fileReader.onload = function () {
    //  src = this.result;
    //};
    //fileReader.readAsArrayBuffer(src);
  } else {
    thrType(
      'src must be an integer or an instance of ArrayBuffer, DataView, Frankenstein,' +
      'or any TypedArray constructor'
    );
  }

  defineProps.call(null, this, {
    stream: {
      value: this
    },

    extensible: {
      writable: true,
      value: isNew
    },

    exponentialGrowth: {
      writable: true,
      value: options.exponentialGrowth !== false
    },

    exponentialGrowthFactor: {
      get: function () {
        return exponentialGrowthFactor;
      },
      set: function (factor) {
        validateOverAllocateFactor(factor);
        exponentialGrowthFactor = factor;
      }
    },

    overAllocateFactor: {
      get: function () {
        return overAllocateFactor;
      },
      set: function (factor) {
        validateExponentialGrowthFactor(factor);
        overAllocateFactor = factor;
      }
    },

    littleEndian: {
      value: !!options.littleEndian // Frankenstein defaults to big endian mode
    },

    _buffer: {
      writable: true,
      value: arrayBuffer
    },

    _bytes: {
      writable: true,
      value: srcIsByteArray ? src : new Uint8Array(arrayBuffer)
    },

    _view: {
      writable: true,
      value: srcIsDataView ? src : new DataView(arrayBuffer)
    },

    _offset: {
      writable: true,
      value: 0
    },

    _lastSkippedBytes: {
      writable: true,
      value: 0
    },

    _frozen: {
      writable: true,
      value: !isNew
    },

    _initialByteLength: {
      value: arrayBuffer.byteLength
    },

    _dataLength: {
      writable: true,
      value: isNew ? 0 : arrayBuffer.byteLength
    },

    _writing: {
      writable: true,
      value: isNew
    }
  });
}

defineProps(Frankenstein, {
  DEFAULT_OVERALLOCATE_FACTOR: {
    enumerable: true,
    get: function () {
      return DEFAULT_OVERALLOCATE_FACTOR;
    },
    set: function (factor) {
      validateOverAllocateFactor(factor);
      DEFAULT_OVERALLOCATE_FACTOR = factor;
    }
  },

  DEFAULT_EXPONENTIAL_GROWTH_FACTOR: {
    enumerable: true,
    get: function () {
      return DEFAULT_EXPONENTIAL_GROWTH_FACTOR;
    },
    set: function (factor) {
      validateExponentialGrowthFactor(factor);
      DEFAULT_EXPONENTIAL_GROWTH_FACTOR = factor;
    }
  },

  LITTLE_ENDIAN_PLATFORM: {
    enumerable: true,
    value: LITTLE_ENDIAN_PLATFORM
  },

  types: {
    enumerable: true,
    value: {}
  }
});

var FrankensteinProto = Frankenstein.prototype;

FrankensteinProto.grow = function (minAllocateBytes) {
  if (!this.extensible) {
    thr('Cannot grow a non-extensible data stream');
  } else if (this._frozen) {
    thr('Cannot grow a frozen data stream');
  }

  minAllocateBytes = +minAllocateBytes || 0;

  var newByteArray, newArrayBuffer;
  var currentByteLength = this.byteLength;
  var allocateBytes = Math.max(
    currentByteLength + Math.ceil(minAllocateBytes + minAllocateBytes * this.overAllocateFactor),
    this.exponentialGrowth
      ? currentByteLength * this.exponentialGrowthFactor
      : currentByteLength + this._initialByteLength
  );

  newByteArray = new Uint8Array(allocateBytes);
  newByteArray.set(this._bytes, 0);
  this._bytes = newByteArray;
  newArrayBuffer = this._buffer = newByteArray.buffer;
  this._view = new DataView(newArrayBuffer);
};

FrankensteinProto.freeze = function () {
  this._frozen = true;
  this._writing = false;
  return this;
};

FrankensteinProto.unfreeze = function () {
  this._frozen = false;
  return this;
};

FrankensteinProto.toArrayBuffer = function (copy, dataLengthOnly) {
  dataLengthOnly = dataLengthOnly !== false;

  if (copy) {
    return this.toByteArray(true, dataLengthOnly).buffer;
  }

  this.freeze();
  return this.buffer.slice(0, !dataLengthOnly ? this.byteLength : this._dataLength);
};

FrankensteinProto.toByteArray = function (copy, dataLengthOnly) {
  dataLengthOnly = dataLengthOnly !== false;

  if (copy) {
    this.freeze();
    var byteLength = !dataLengthOnly ? this.byteLength : this._dataLength;
    var newByteArray = new Uint8Array(byteLength);
    for (var i = 0; i < byteLength; ++i) {
      newByteArray[i] = this._byteArray[i];
    }

    return newByteArray;
  }

  return new Uint8Array(this.toArrayBuffer(false, dataLengthOnly));
};

FrankensteinProto.clone = function () {
  var wasFrozen = this.frozen;
  var clonedFrankenstein = new Frankenstein(this.toByteArray(true, false));

  if (!wasFrozen) {
    this.unfreeze();
  }

  return clonedFrankenstein;
};

FrankensteinProto.toString = function () {
  return '[object Frankenstein byteLength=' + this.byteLength + ' offset=' + this._offset + ']';
};

/**
 * @param {Frankenstein} stream Frankenstein, whose buffer to peek at
 * @param {number} [streamOffset] Absolute byte offset, defaults to frankenstein's current offset
 * @param {?boolean} [writingMode] Explicit mode of the FrankensteinPeek, defaults to the mode of
 *   the wrapped Frankenstein instance
 * @constructor
 */
FrankensteinPeek = function FrankensteinPeek(stream, streamOffset, writingMode) {
  if (!(stream instanceof Frankenstein)) {
    thrType('stream must be a Frankenstein');
  }

  streamOffset = typeof streamOffset === 'number' ? streamOffset : stream._offset;

  if (streamOffset < 0) {
    thrType('streamOffset must be greater than or equal zero');
  } else if (streamOffset > stream.byteLength) {
    thrType('Cannot peek beyond buffer size');
  }

  defineProps.call(null, this, {
    stream: {
      enumerable: true,
      value: stream
    },

    _offset: {
      writable: true,
      value: streamOffset
    },

    _lastSkippedBytes: {
      writable: true,
      value: 0
    },

    _writing: {
      writable: true,
      value: typeof writingMode === 'boolean' ? writingMode : stream.writing
    }
  });
};

Frankenstein.FrankensteinPeek = FrankensteinPeek;
var FrankensteinPeekProto = FrankensteinPeek.prototype;

defineProps.call(null, FrankensteinPeekProto, {
  extensible: {
    enumerable: true,
    get: function () {
      return this.stream.extensible;
    }
  },

  exponentialGrowth: {
    enumerable: true,
    get: function () {
      return this.stream.exponentialGrowth;
    }
  },

  exponentialGrowthFactor: {
    enumerable: true,
    get: function () {
      return this.stream.exponentialGrowthFactor;
    }
  },

  overAllocateFactor: {
    enumerable: true,
    get: function () {
      return this.stream.overAllocateFactor;
    }
  },

  littleEndian: {
    enumerable: true,
    get: function () {
      return this.stream.littleEndian;
    }
  }
});

FrankensteinPeekProto.toString = function () {
  return '[object FrankensteinPeek byteLength=' + this.byteLength + ' offset=' + this._offset + ']';
};

[FrankensteinPeekProto, FrankensteinProto].forEach(function (proto) {
  defineProps.call(null, proto, {
    arrayBuffer: {
      enumerable: true,
      get: function () {
        return this.stream._buffer;
      }
    },

    bytes: {
      enumerable: true,
      get: function () {
        return this.stream._bytes;
      }
    },

    view: {
      enumerable: true,
      get: function () {
        return this.stream._view;
      }
    },

    byteLength: {
      enumerable: true,
      get: function () {
        return this.arrayBuffer.byteLength;
      }
    },

    length: {
      enumerable: true,
      get: function () {
        return this.byteLength;
      }
    },

    dataLength: {
      enumerable: true,
      get: function () {
        return this.stream._dataLength;
      }
    },

    offset: {
      enumerable: true,
      get: function () {
        return this._offset;
      }
    },

    lastSkippedBytes: {
      enumerable: true,
      get: function () {
        return this._lastSkippedBytes;
      }
    },

    frozen: {
      enumerable: true,
      get: function () {
        return this.stream._frozen;
      }
    },

    finished: {
      enumerable: true,
      get: function () {
        return this._offset === this.stream.byteLength;
      }
    },

    reading: {
      enumerable: true,
      get: function () {
        return !this._writing;
      }
    },

    writing: {
      enumerable: true,
      get: function () {
        return this._writing;
      }
    },

    read: {
      enumerable: true,
      get: function () {
        this._writing = false;
        return this;
      }
    },

    write: {
      enumerable: true,
      get: function () {
        if (this._frozen) {
          thr('Cannot write to a frozen data stream');
        }

        this._writing = true;
        return this;
      }
    },

    peek: {
      enumerable: true,
      get: function () {
        return new FrankensteinPeek(this.stream, this._offset, this._writing);
      }
    }
  });
});

var commonMethods = {
  tell: function () {
    return this._offset;
  },

  seek: function (offset) {
    offset = +offset || 0;
    if (offset < 0) {
      thrType('offset must be greater than or equal zero');
    } else if (offset > this.byteLength) {
      thrType('Cannot seek to an offset beyond buffer length');
    }
    this._offset = offset;
    return this;
  },

  at: function (relativeOffset) {
    return this.seek(this._offset + (+relativeOffset || 0));
  },

  skip: function (byteLength) {
    byteLength = +byteLength || 0;
    if (byteLength === 0) {
      this._lastSkippedBytes = 0;
      return this;
    }
    var overflow = (this._offset + byteLength) - this.byteLength;
    if (overflow > 0) {
      if (this._writing) {
        this.stream.grow(overflow);
      } else {
        thr('Cannot skip to an offset beyond buffer length');
      }
    }
    this._offset += (this._lastSkippedBytes = byteLength);
    return this;
  },

  skipMod: function (mod) {
    var rest = (this._offset % mod);
    return this.skip(rest > 0 ? mod - rest : 0);
  }
};

[2, 4, 8, 16, 32, 64].forEach(function (mod) {
  commonMethods['skipMod' + mod] = commonMethods['pad' + mod] = function () {
    return this.skipMod(mod);
  };
});

commonMethods.from = commonMethods.seek;
commonMethods.pad = commonMethods.skipMod;

Object.keys(commonMethods).forEach(function (key) {
  FrankensteinProto[key] = FrankensteinPeekProto[key] = commonMethods[key];
});

function createExtendingGetter(derivedTypeDef, baseGetter) {
  derivedTypeDef._ownGet = derivedTypeDef.get;

  return function (stream, offset, arg1, arg2) {
    var val, args;

    if (arguments.length < 5) {
      val = baseGetter(stream, offset, arg1, arg2);
      return derivedTypeDef._ownGet(stream, offset, val, arg1, arg2);
    }

    args = slice.call(arguments, 2);
    val = baseGetter.apply(null, [stream, offset].concat(args));
    return derivedTypeDef._ownGet.apply(derivedTypeDef, [stream, offset, val].concat(args));
  };
}

function createExtendingSetter(derivedTypeDef, baseSetter) {
  derivedTypeDef._ownSet = derivedTypeDef.set;

  return function (stream, offset, val, arg1, arg2) {
    if (arguments.length < 6) {
      val = derivedTypeDef._ownSet(stream, offset, val, arg1, arg2);
      baseSetter(stream, offset, val, arg1, arg2);
    } else {
      var args = slice.call(arguments, 3);
      val = derivedTypeDef._ownSet.apply(derivedTypeDef, [stream, offset, val].concat(args));
      baseSetter.apply(null, [stream, offset, val].concat(args));
    }
  };
}

function extendDataType(derivedTypeDef, baseTypeDef) {
  var getter, setter, baseGetter, baseSetter;

  if (baseTypeDef.onExtend) {
    var baseGetterSetter = baseTypeDef.onExtend(derivedTypeDef);
    baseGetter = baseGetterSetter.get;
    baseSetter = baseGetterSetter.set;
  } else {
    baseGetter = baseTypeDef.get;
    baseSetter = baseTypeDef.set;
  }
  baseGetter = baseGetter ? baseGetter.bind(baseTypeDef) : null;
  baseSetter = baseSetter ? baseSetter.bind(baseTypeDef) : null;

  if (derivedTypeDef.get && baseGetter) {
    getter = createExtendingGetter(derivedTypeDef, baseGetter);
  } else if (baseGetter) {
    getter = baseGetter;
  }
  derivedTypeDef.get = getter;

  if (derivedTypeDef.set && baseSetter) {
    setter = createExtendingSetter(derivedTypeDef, baseSetter);
  } else if (baseSetter) {
    setter = baseSetter;
  }
  derivedTypeDef.set = setter;

  return derivedTypeDef;
}

Frankenstein.addDataType = function (name, def) {
  if (FrankensteinProto[name]) {
    thr('Disallowing redefininition of data type %s', name);
  }

  if (def.extend) {
    var baseFn = FrankensteinProto[def.extend];
    if (!baseFn || !baseFn.typeDef) {
      thr('Cannot use unknown data type %s as base for data type %s', def.extend, name);
    }
    def = extendDataType(def, baseFn.typeDef);
  }

  var size = def.size;
  var typeofSize = typeof size;
  var sizeIsCb = typeofSize === 'function';
  var complexType = !sizeIsCb && typeofSize !== 'number';

  if (!complexType && !sizeIsCb && size < 0) {
    thr('Simple data types need an explicit size definition greater than or equal zero: %s', name);
  }

  var handler = FrankensteinProto[name] = FrankensteinPeekProto[name] = function (arg1, arg2) {
    var stream = this.stream;
    var offset = this._offset;
    var write = this._writing;
    var val, byteLength, overflow;
    var argsLength = arguments.length;
    var args = argsLength > 2 ? slice.call(arguments) : null;
    var fn = write ? 'set' : 'get';
    //console.log(this.constructor.name, write ? 'set' : 'get', name, offset);
    if (!def[fn]) {
      thr('Cannot %s %s: %s not defined', write ? 'write' : 'read', name, write ? 'setter' : 'getter');
    }

    if (write && !complexType) {
      byteLength = !sizeIsCb ? size : def.size(arg1, arg2);
      if (stream.frozen) {
        thr('Attempt to write %d bytes to a frozen buffer', byteLength);
      }

      overflow = (offset + byteLength) - stream.byteLength;
      if (overflow > 0) {
        if (!stream.extensible) {
          thr('Attempt to write %d more bytes to a non-extensible buffer', overflow);
        }
        stream.grow(overflow);
      }
    }

    if (argsLength === 0) {
      val = def[fn](this, offset);
    } else if (argsLength === 1) {
      val = def[fn](this, offset, arg1);
    } else if (argsLength === 2) {
      val = def[fn](this, offset, arg1, arg2);
    } else {
      val = def[fn].apply(def, [this, offset].concat(args));
    }

    if (!complexType) {
      if (!write) {
        byteLength = !sizeIsCb ? size : def.size(val, arg1, arg2);
      }

      offset = (this._offset += byteLength);

      if (write) {
        stream._dataLength = Math.max(offset, stream._dataLength);
      }
    }

    return write ? this : val;
  };

  handler.typeName = def.typeName = name;

  defineProp.call(null, Frankenstein.types, name, {
    enumerable: true,
    value: def
  });

  defineProp.call(null, handler, 'typeDef', {
    enumerable: true,
    value: def
  });

  return def;
};

var addAlias = Frankenstein.addAlias = function (alias, dataType) {
  if (FrankensteinProto[alias]) {
    thr('Cannot add alias %s: A data type or alias of the same name already exists', alias);
  }

  FrankensteinProto[alias] = FrankensteinPeekProto[alias] = FrankensteinProto[dataType];
};

function getByteLengthOfObject(obj) {
  return obj.byteLength;
}

var baseTypes = {
  buffer: {
    size: getByteLengthOfObject,
    get: function (stream, offset, byteLength) {
      if (byteLength < 0) {
        thrType('byteLength must be greater than or equal zero');
      } else if (byteLength === 0) {
        return nullBuffer;
      } else if (offset === 0 && (!byteLength || byteLength === stream.byteLength)) {
        return stream.arrayBuffer;
      }

      return stream.arrayBuffer.slice(offset, byteLength ? offset + byteLength : null);
    },
    set: function (stream, offset, buf) {
      stream.bytes.set(new Uint8Array(buf), offset);
    }
  },

  byteArray: {
    size: getByteLengthOfObject,
    get: function (stream, offset, byteLength) {
      if (byteLength < 0) {
        thrType('byteLength must be greater than or equal zero');
      } else if (byteLength === 0) {
        return nullByteArray;
      } else if (offset === 0 && (!byteLength || byteLength === stream.byteLength)) {
        return stream.bytes;
      }

      return new Uint8Array(baseTypes.buffer.get(stream, offset, byteLength));
    },
    set: function (stream, offset, byteArray) {
      stream.bytes.set(byteArray, offset);
    }
  },

  stream: {
    size: getByteLengthOfObject,
    get: function (stream, offset, byteLength) {
      var arrayBuf;
      if (byteLength < 0) {
        thrType('byteLength must be greater than or equal zero');
      } else if (byteLength === 0) {
        arrayBuf = nullBuffer;
      } else if (offset === 0 && (!byteLength || byteLength === stream.byteLength)) {
        arrayBuf = stream.arrayBuffer;
      } else {
        arrayBuf = baseTypes.buffer.get(stream, offset, byteLength);
      }

      return new Frankenstein(arrayBuf);
    },
    set: function (stream, offset, srcStream) {
      stream.bytes.set(srcStream.toByteArray(), offset);
    }
  },

  uint8: {
    size: 1,
    get: function (stream, offset) {
      return stream.view.getUint8(offset);
    },
    set: function (stream, offset, val) {
      stream.view.setUint8(offset, val);
    }
  },

  int8: {
    size: 1,
    get: function (stream, offset) {
      return stream.view.getInt8(offset);
    },
    set: function (stream, offset, val) {
      stream.view.setInt8(offset, val);
    }
  },

  uint16: {
    size: 2,
    get: function (stream, offset) {
      return stream.view.getUint16(offset, stream.littleEndian);
    },
    set: function (stream, offset, val) {
      stream.view.setUint16(offset, val, stream.littleEndian);
    }
  },

  int16: {
    size: 2,
    get: function (stream, offset) {
      return stream.view.getInt16(offset, stream.littleEndian);
    },
    set: function (stream, offset, val) {
      stream.view.setInt16(offset, val, stream.littleEndian);
    }
  },

  uint32: {
    size: 4,
    get: function (stream, offset) {
      return stream.view.getUint32(offset, stream.littleEndian);
    },
    set: function (stream, offset, val) {
      stream.view.setUint32(offset, val, stream.littleEndian);
    }
  },

  int32: {
    size: 4,
    get: function (stream, offset) {
      return stream.view.getInt32(offset, stream.littleEndian);
    },
    set: function (stream, offset, val) {
      stream.view.setInt32(offset, val, stream.littleEndian);
    }
  },

  float32: {
    size: 4,
    get: function (stream, offset) {
      return stream.view.getFloat32(offset, stream.littleEndian);
    },
    set: function (stream, offset, val) {
      stream.view.setFloat32(offset, val, stream.littleEndian);
    }
  },

  float64: {
    size: 8,
    get: function (stream, offset) {
      return stream.view.getFloat64(offset, stream.littleEndian);
    },
    set: function (stream, offset, val) {
      stream.view.setFloat64(offset, val, stream.littleEndian);
    }
  },

  // Plain 7-bit ASCII or 8-bit byte-to-charcode ("raw" mode)l
  string: {
    size: function (str, raw) {
      return str.length;
    },
    get: function (stream, offset, byteLength, raw) {
      if (byteLength < 0) {
        thrType('byteLength must be greater than or equal zero');
      } else if (byteLength === 0) {
        return '';
      } else if (offset === 0 && (!byteLength || byteLength === stream.byteLength)) {
        byteLength = stream.byteLength;
      }

      var str = '';
      for (var i = 0, byteVal; i < byteLength; ++i) {
        byteVal = stream.view.getUint8(offset++);
        str += String.fromCharCode(raw ? byteVal : byteVal & 0x7f);
      }
      return str;
    },
    set: function (stream, offset, str, raw) {
      var byteLength = str.length;
      for (var i = 0, charCode; i < byteLength; ++i) {
        charCode = str.charCodeAt(i);
        stream.view.setUint8(offset++, raw ? charCode : charCode & 0x7f);
      }
    }
  },

  array: {
    typedArrayMap: {
      uint8: Uint8Array,
      int8: Int8Array
    },
    platformDependentTypedArrayMap: {
      uint16: Uint16Array,
      int16: Int16Array,
      uint32: Uint32Array,
      int32: Int32Array
    },
    get: function (stream, offset, length, type, arg1, arg2) {
      if (!type || !stream[type]) {
        thrType('type must be a valid data type');
      }

      var ByteArrayType = this.typedArrayMap[type];
      if (ByteArrayType) {
        return new ByteArrayType(stream.buffer(
          length * ByteArrayType.BYTES_PER_ELEMENT
        ));
      }

      ByteArrayType = this.platformDependentTypedArrayMap[type];
      if (ByteArrayType && stream.littleEndian === Frankenstein.LITTLE_ENDIAN_PLATFORM) {
        return new ByteArrayType(stream.buffer(
          length * ByteArrayType.BYTES_PER_ELEMENT
        ));
      }

      var arr = new Array(length);
      var argsLength = arguments.length - 4;
      var i = 0;
      if (argsLength === 0) {
        for (; i < length; ++i) {
          arr[i] = stream[type]();
        }
      } else if (argsLength === 1) {
        for (; i < length; ++i) {
          arr[i] = stream[type](arg1);
        }
      } else if (argsLength === 2) {
        for (; i < length; ++i) {
          arr[i] = stream[type](arg1, arg2);
        }
      } else {
        var args = slice.call(arguments, 4);
        for (; i < length; ++i) {
          arr[i] = stream[type].apply(stream, args);
        }
      }

      return arr;
    },
    set: function (stream, offset, arr, type, arg1, arg2) {
      var length = arr.length;
      var argsLength = arguments.length - 4;
      var i = 0, args;
      if (argsLength === 0) {
        for (; i < length; ++i) {
          stream[type](arr[i]);
        }
      } else if (argsLength === 1) {
        for (; i < length; ++i) {
          stream[type](arr[i], arg1);
        }
      } else if (argsLength === 2) {
        for (; i < length; ++i) {
          stream[type](arr[i], arg1, arg2);
        }
      } else {
        args = [null].concat(slice.call(arguments, 4));
        for (; i < length; ++i) {
          stream[type].apply(stream, (args[0] = arr[i], args));
        }
      }
    }
  },

  struct: {
    get: function (stream, offset, struct) {
      var obj = {};
      var structLength = struct.length;
      var itemDef, key, type, argsLength;
      for (var i = 0; i < structLength; ++i) {
        itemDef = struct[i];
        type = itemDef[1];

        if (type === 'skip' && itemDef[2] > 0) {
          stream.skip(itemDef[2]);
          continue;
        }

        key = itemDef[0];
        argsLength = itemDef.length - 2;
        if (argsLength === 0) {
          obj[key] = stream[type]();
        } else if (argsLength === 1) {
          obj[key] = stream[type](itemDef[2]);
        } else if (argsLength === 2) {
          obj[key] = stream[type](itemDef[2], itemDef[3]);
        } else {
          obj[key] = stream[type].apply(stream, itemDef.slice(2));
        }
      }

      return obj;
    },
    set: function (stream, offset, obj, struct) {
      var structLength = struct.length;
      var itemDef, type, val;
      for (var i = 0; i < structLength; ++i) {
        itemDef = struct[i];
        type = itemDef[1];

        if (type === 'skip') {
          var skipByteVal = +itemDef[3] || 0;
          for (var j = 0; j < itemDef[2]; ++j) {
            stream.uint8(skipByteVal);
          }
          continue;
        }

        val = obj[itemDef[0]];
        if (val === undefined) {
          thr('Unable to write struct: field "%s" not found in source object', itemDef[0]);
        }

        var argsLength = itemDef - 2;
        if (argsLength === 0) {
          stream[type](val);
        } else if (argsLength === 1) {
          stream[type](val, itemDef[2]);
        } else if (itemDef.length < 5) {
          stream[type](val, itemDef[2], itemDef[3]);
        } else {
          stream[type].apply(stream, [val].concat(itemDef.slice(2)));
        }
      }

      return obj;
    },
    onExtend: function (derivedTypeDef) {
      if (!derivedTypeDef.struct) {
        thr(
          'Cannot extend the struct data type without a struct definition in the derived type %s',
          derivedTypeDef.typeName
        );
      }

      // Derived struct types must not have any size definition
      derivedTypeDef.size = null;

      var self = this;
      var struct = derivedTypeDef.struct;
      return {
        get: function (stream, offset) {
          return self.get(stream, offset, struct);
        },
        set: function (stream, offset, obj) {
          self.set(stream, offset, obj, struct);
        }
      };
    }
  }
};

Object.keys(baseTypes).forEach(function (name) {
  Frankenstein.addDataType(name, baseTypes[name]);
});

addAlias('frankenstein', 'stream');
addAlias('float', 'float32');
addAlias('double', 'float64');
addAlias('object', 'struct');

module.exports = Frankenstein;
