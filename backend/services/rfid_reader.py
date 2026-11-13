import os
import threading
import time

try:
    import serial
except ImportError:
    serial = None


class RFIDReader:
    PACKET_SIZE = 26
    HEADER = b"\x00\xCF"

    def __init__(self, port=None, baudrate=115200, timeout=0.1):
        self.port = port or os.getenv("RFID_PORT", "/dev/ttyUSB0")
        self.baudrate = baudrate
        self.timeout = timeout
        self.connection = None
        self.buffer = bytearray()
        self.running = False
        self.thread = None

    def connect(self):
        if serial is None:
            print("RFID reader unavailable: install pyserial first.")
            return False

        try:
            self.connection = serial.Serial(
                self.port,
                self.baudrate,
                timeout=self.timeout
            )
            self.buffer.clear()
            print(f"RFID reader connected on {self.port}")
            return True
        except (serial.SerialException, OSError) as error:
            print(f"RFID reader connection failed on {self.port}: {error}")
            self.connection = None
            return False

    def read_tags(self):
        if self.connection is None or not self.connection.is_open:
            return []

        data = self.connection.read(self.connection.in_waiting or 1)
        if not data:
            return []

        self.buffer.extend(data)
        tags = []

        while len(self.buffer) >= self.PACKET_SIZE:
            index = self.buffer.find(self.HEADER)

            if index == -1:
                self.buffer = self.buffer[-1:]
                break

            if index:
                del self.buffer[:index]

            if len(self.buffer) < self.PACKET_SIZE:
                break

            packet = self.buffer[:self.PACKET_SIZE]
            epc = packet[12:24].hex().upper()

            raw_rssi = packet[8]
            rssi = raw_rssi - 256 if raw_rssi > 127 else raw_rssi

            del self.buffer[:self.PACKET_SIZE]

            if epc:
                tags.append({"epc": epc, "rssi": rssi})

        return tags

    def start(self, callback):
        if self.running:
            return True

        if serial is None:
            print("RFID reader unavailable: install pyserial first.")
            return False

        self.running = True
        self.thread = threading.Thread(
            target=self._read_loop,
            args=(callback,),
            daemon=True
        )
        self.thread.start()
        return True

    def _read_loop(self, callback):
        while self.running:
            try:
                if self.connection is None or not self.connection.is_open:
                    if not self.connect():
                        time.sleep(3)
                        continue

                for tag in self.read_tags():
                    callback(tag["epc"], tag["rssi"])

            except Exception as error:
                print(f"RFID reader error: {error}")

                if self.connection and self.connection.is_open:
                    self.connection.close()

                self.connection = None
                time.sleep(0.5)

    def stop(self):
        self.running = False

        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1)

        if self.connection and self.connection.is_open:
            self.connection.close()

        self.connection = None
        print("RFID reader stopped")