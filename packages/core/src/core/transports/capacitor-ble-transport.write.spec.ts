import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { CapacitorBleTransport } from './capacitor-ble-transport';

vi.mock('@capacitor-community/bluetooth-le', () => ({
    BleClient: {
        writeWithoutResponse: vi.fn(),
        write: vi.fn(),
        disconnect: vi.fn()
    }
}));

const info = {
    serviceUUID: '0000ff00-0000-1000-8000-00805f9b34fb',
    writeUUID: '0000ff02-0000-1000-8000-00805f9b34fb',
    writeMode: 'without-response' as const
};

function connectedTransport() {
    const transport = new CapacitorBleTransport();
    Object.assign(transport, { deviceId: 'p12' });
    return transport;
}

describe('CapacitorBleTransport write queue', () => {
    beforeEach(() => {
        vi.mocked(BleClient.writeWithoutResponse).mockReset();
        vi.mocked(BleClient.write).mockReset();
        vi.mocked(BleClient.disconnect).mockReset().mockResolvedValue();
    });

    it('runs P12 writes one at a time', async () => {
        let releaseFirst!: () => void;
        const firstWrite = new Promise<void>(resolve => { releaseFirst = resolve; });
        let active = false;
        const sent: number[] = [];
        vi.mocked(BleClient.writeWithoutResponse).mockImplementation(async (_device, _service, _characteristic, data) => {
            if (active) throw new Error('GATT operation already in progress');
            active = true;
            sent.push(data.getUint8(0));
            if (sent.length === 1) await firstWrite;
            active = false;
        });
        const transport = connectedTransport();
        const first = transport.write(new Uint8Array([1]), info);
        const second = transport.write(new Uint8Array([2]), info);
        const third = transport.write(new Uint8Array([3]), info);

        await vi.waitFor(() => expect(sent).toEqual([1]));
        releaseFirst();
        await Promise.all([first, second, third]);
        expect(sent).toEqual([1, 2, 3]);
        expect(BleClient.write).not.toHaveBeenCalled();
    });

    it('rejects queued writes on disconnect', async () => {
        let releaseFirst!: () => void;
        const firstWrite = new Promise<void>(resolve => { releaseFirst = resolve; });
        vi.mocked(BleClient.writeWithoutResponse).mockImplementation(async () => { await firstWrite; });
        const transport = connectedTransport();
        const firstResult = expect(transport.write(new Uint8Array([1]), info)).rejects.toThrow('Bluetooth disconnected');
        const secondResult = expect(transport.write(new Uint8Array([2]), info)).rejects.toThrow('Bluetooth disconnected');
        await vi.waitFor(() => expect(BleClient.writeWithoutResponse).toHaveBeenCalledTimes(1));

        await transport.disconnect();
        await firstResult;
        await secondResult;
        releaseFirst();
        expect(BleClient.writeWithoutResponse).toHaveBeenCalledTimes(1);
    });
});
