/**
 * Utility functions for data conversion and verification
 */

/**
 * Converts a hex string to an ASCII string.
 * Supports both spaced and unspaced hex.
 */
export function hexToAscii(hex: string): string {
  const cleanHex = hex.replace(/\s+/g, '');
  if (cleanHex.length % 2 !== 0) return '';
  
  let str = '';
  for (let i = 0; i < cleanHex.length; i += 2) {
    const charCode = parseInt(cleanHex.substring(i, i + 2), 16);
    if (!isNaN(charCode)) {
      str += String.fromCharCode(charCode);
    }
  }
  return str;
}

/**
 * Converts an ASCII string to a hex string.
 */
export function asciiToHex(ascii: string, spaced: boolean = true): string {
  let hex = '';
  for (let i = 0; i < ascii.length; i++) {
    const h = ascii.charCodeAt(i).toString(16).toUpperCase().padStart(2, '0');
    hex += h + (spaced ? ' ' : '');
  }
  return hex.trim();
}

/**
 * CRC Algorithms
 */

/**
 * CRC-16/MODBUS
 * Polynomial: 0x8005 (reversed: 0xA001)
 * Initial: 0xFFFF
 */
export function crc16modbus(buffer: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

/**
 * CRC-16/XMODEM
 * Polynomial: 0x1021
 * Initial: 0x0000
 */
export function crc16xmodem(buffer: Uint8Array): number {
  let crc = 0x0000;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= (buffer[i] << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc;
}

/**
 * CRC-32
 * Polynomial: 0x04C11DB7 (reversed: 0xEDB88320)
 * Initial: 0xFFFFFFFF
 */
export function crc32(buffer: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 1) !== 0) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc >>>= 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Converts a hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/\s+/g, '').replace(/^0x/i, '');
  if (cleanHex.length % 2 !== 0) return new Uint8Array(0);
  
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}
