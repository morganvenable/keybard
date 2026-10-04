"""Sval RawHID client. Never writes persistent keymap or tap-dance storage."""
import secrets
import struct
import time


class SimulatedDevice:
    def __init__(self):
        self.active_layer = None
        self.layer_count = 16
        self.transaction = 0
        self.events = []

    def replace_layer(self, layer):
        if layer is not None and (type(layer) is not int or not 0 <= layer < self.layer_count):
            raise ValueError('Layer exceeds keyboard layer count')
        self.active_layer = layer
        self.transaction += 1
        self.events.append(('replace_layer', layer))

    def renew(self):
        self.events.append(('renew', self.transaction))

    def clear(self):
        self.active_layer = None
        self.events.append(('clear',))

    def close(self):
        self.clear()


class HidDevice:
    @staticmethod
    def discover():
        import hid
        return [d for d in hid.enumerate() if
                (d.get('usage_page'), d.get('usage')) in ((0xff61, 0x62), (0xff60, 0x61), (0xff60, 0x62))
                and str(d.get('serial_number', '')).lower().startswith(('sval:', 'viable:'))]

    def __init__(self, info):
        import hid
        self.handle = hid.device()
        self.client_id = 0
        self.client_expiry = 0
        self.transaction = 0
        self._next_transaction = secrets.randbelow(65534) + 1
        try:
            self.handle.open_path(info['path'])
            self._bootstrap()
            info_response = self._command(0)
            if not info_response[14] & 0x20:
                raise RuntimeError('This firmware lacks context layers. Flash the context-enabled firmware first.')
            status = self._command(0x27)
            self._ok(status)
            if status[3] != 1:
                raise RuntimeError('Unsupported context protocol version')
            self.layer_count = status[4]
            if not 0 < self.layer_count <= 32:
                raise RuntimeError('Invalid context layer count response')
            self.clear()
        except Exception:
            self.handle.close()
            raise

    def _write(self, report):
        if len(report) > 32:
            raise ValueError('HID report too large')
        result = self.handle.write(bytes([0]) + report.ljust(32, b'\0'))
        if result < 0:
            raise OSError('Keyboard write failed')

    def _read_until(self, accept):
        deadline = time.monotonic() + 0.75
        while time.monotonic() < deadline:
            data = bytes(self.handle.read(32, 100))
            if len(data) == 32 and accept(data):
                return data
        raise TimeoutError('Keyboard did not acknowledge the command; reconnect and enable again')

    def _bootstrap(self):
        nonce = secrets.token_bytes(20)
        self._write(b'\xdd' + bytes(4) + nonce)
        answer = self._read_until(lambda d: d[:5] == b'\xdd' + bytes(4) and d[5:25] == nonce)
        self.client_id = int.from_bytes(answer[25:29], 'little')
        if not self.client_id:
            raise RuntimeError('Keyboard refused a client connection')
        self.client_expiry = time.monotonic() + 50

    def _command(self, command, payload=b''):
        if time.monotonic() >= self.client_expiry:
            self._bootstrap()
        prefix = b'\xdd' + self.client_id.to_bytes(4, 'little')
        self._write(prefix + bytes([0xdf, command]) + payload)
        response = self._read_until(lambda d: d[:5] == prefix and
                                    (d[5] == 0xff or (d[5] == 0xdf and d[6] == command)))
        if response[5] == 0xff:
            self.client_expiry = 0
            raise RuntimeError(f'Keyboard rejected client request (code {response[6]}); reconnect')
        return response[5:]

    @staticmethod
    def _ok(response):
        if response[2]:
            raise RuntimeError(f'Keyboard rejected context command (status {response[2]})')

    def replace_layer(self, layer):
        if layer is None:
            self.clear()
            return
        if type(layer) is not int or not 0 <= layer < self.layer_count:
            raise ValueError(f'Layer must be 0..{self.layer_count - 1}')
        self._next_transaction = self._next_transaction % 65535 + 1
        transaction = self._next_transaction
        self._ok(self._command(0x26, struct.pack('<HB', transaction, layer)))
        self.transaction = transaction

    def renew(self):
        if self.transaction:
            self._ok(self._command(0x28, struct.pack('<H', self.transaction)))
            status = self._command(0x27)
            self._ok(status)
            if int.from_bytes(status[6:8], 'little') != self.transaction:
                raise RuntimeError('Keyboard context expired or another companion replaced it')

    def clear(self):
        self._ok(self._command(0x29))
        self.transaction = 0

    def close(self):
        try:
            self.clear()
        finally:
            self.handle.close()
