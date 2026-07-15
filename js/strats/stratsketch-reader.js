export class StratSketchReader {
  constructor(buffer, offset = 0, length = buffer.byteLength) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset + offset, length);
    this.index = 0;
    this.length = length;
  }

  get remaining() {
    return this.length - this.index;
  }

  readUInt8() {
    const value = this.view.getUint8(this.index);
    this.index += 1;
    return value;
  }

  readUInt16() {
    const value = this.view.getUint16(this.index, true);
    this.index += 2;
    return value;
  }

  readInt32() {
    const value = this.view.getInt32(this.index, true);
    this.index += 4;
    return value;
  }

  readFloat() {
    const value = this.view.getFloat32(this.index, true);
    this.index += 4;
    return value;
  }

  readBoolean() {
    return this.readUInt8() !== 0;
  }

  readVarInt() {
    let result = 0;
    let shift = 0;
    while (this.remaining > 0) {
      const byte = this.readUInt8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  }

  readString() {
    const length = this.readVarInt();
    const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.index, length);
    this.index += length;
    return new TextDecoder().decode(bytes);
  }

  readNullableString() {
    if (this.readBoolean()) return this.readString();
    return null;
  }

  readGuid() {
    const parts = [];
    for (let i = 0; i < 16; i += 1) {
      parts.push(this.readUInt8().toString(16).padStart(2, "0"));
    }
    return `${parts.slice(0, 4).join("")}-${parts.slice(4, 6).join("")}-${parts.slice(6, 8).join("")}-${parts.slice(8, 10).join("")}-${parts.slice(10).join("")}`;
  }

  readVector() {
    return { x: this.readFloat(), y: this.readFloat() };
  }

  readColor() {
    return {
      r: this.readUInt8(),
      g: this.readUInt8(),
      b: this.readUInt8(),
    };
  }
}
