interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream;
  writable: WritableStream;
}

interface Navigator {
  serial: {
    requestPort(): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  };
}
