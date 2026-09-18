import { afterEach, describe, expect, it, vi } from 'vitest';
import { UniversalBluetoothTransport } from './bluetooth-transport';

describe('UniversalBluetoothTransport', () => {
    afterEach(() => vi.unstubAllGlobals());

    async function connectedTransport(writeChar: object) {
        let connected = true;
        const service = {
            uuid: '0000ff00-0000-1000-8000-00805f9b34fb',
            getCharacteristic: vi.fn(async () => writeChar)
        };
        const server = {
            get connected() { return connected; },
            getPrimaryServices: vi.fn(async () => [service]),
            getPrimaryService: vi.fn(async () => service)
        };
        const gatt = {
            get connected() { return connected; },
            connect: vi.fn(async () => server),
            disconnect: vi.fn(() => { connected = false; })
        };
        vi.stubGlobal('navigator', {
            bluetooth: {
                requestDevice: vi.fn(async () => ({ name: 'P12', gatt, addEventListener: vi.fn() }))
            }
        });
        const transport = new UniversalBluetoothTransport();
        await transport.connect();
        return { transport, info: {
            serviceUUID: service.uuid,
            writeUUID: '0000ff02-0000-1000-8000-00805f9b34fb',
            writeMode: 'without-response' as const
        } };
    }

    it('runs P12 writes one at a time and advances after a failed write', async () => {
        let releaseFirst!: () => void;
        const firstWrite = new Promise<void>(resolve => { releaseFirst = resolve; });
        let active = false;
        const writeChar = {
            properties: { write: false, writeWithoutResponse: true },
            writeValueWithoutResponse: vi.fn(async (data: Uint8Array) => {
                if (active) throw new Error('GATT operation already in progress');
                active = true;
                if (data[0] === 1) await firstWrite;
                active = false;
                if (data[0] === 2) throw new Error('second write failed');
            })
        };
        const { transport, info } = await connectedTransport(writeChar);
        const first = transport.write(new Uint8Array([1]), info);
        const second = transport.write(new Uint8Array([2]), info);
        const secondResult = expect(second).rejects.toThrow('second write failed');
        const third = transport.write(new Uint8Array([3]), info);

        await vi.waitFor(() => expect(writeChar.writeValueWithoutResponse).toHaveBeenCalledTimes(1));
        releaseFirst();
        await first;
        await secondResult;
        await third;
        expect(writeChar.writeValueWithoutResponse.mock.calls.map(call => call[0][0])).toEqual([1, 2, 3]);
    });

    it('rejects queued P12 writes when the connection closes', async () => {
        let releaseFirst!: () => void;
        const firstWrite = new Promise<void>(resolve => { releaseFirst = resolve; });
        const writeChar = {
            properties: { write: false, writeWithoutResponse: true },
            writeValueWithoutResponse: vi.fn(async () => { await firstWrite; })
        };
        const { transport, info } = await connectedTransport(writeChar);
        const firstResult = expect(transport.write(new Uint8Array([1]), info)).rejects.toMatchObject({ name: 'NetworkError' });
        const secondResult = expect(transport.write(new Uint8Array([2]), info)).rejects.toMatchObject({ name: 'NetworkError' });
        await vi.waitFor(() => expect(writeChar.writeValueWithoutResponse).toHaveBeenCalledTimes(1));

        await transport.disconnect();
        await firstResult;
        await secondResult;
        releaseFirst();
        expect(writeChar.writeValueWithoutResponse).toHaveBeenCalledTimes(1);
    });

    it('reconnects once when initial GATT service discovery drops', async () => {
        let connected = false;
        const service = { uuid: '0000fee0-0000-1000-8000-00805f9b34fb' };
        const firstServer = {
            get connected() { return connected; },
            getPrimaryServices: vi.fn(async () => {
                connected = false;
                throw new DOMException('GATT Server is disconnected.', 'NetworkError');
            })
        };
        const secondServer = {
            get connected() { return connected; },
            getPrimaryServices: vi.fn(async () => [service])
        };
        const gatt = {
            get connected() { return connected; },
            connect: vi.fn(async () => {
                connected = true;
                return gatt.connect.mock.calls.length === 1 ? firstServer : secondServer;
            }),
            disconnect: vi.fn(() => { connected = false; })
        };
        const device = {
            name: 'NIIMBOT D11_H',
            gatt,
            addEventListener: vi.fn()
        };
        vi.stubGlobal('navigator', {
            bluetooth: { requestDevice: vi.fn(async () => device) }
        });

        const transport = new UniversalBluetoothTransport();
        await transport.connect([{ services: [service.uuid] }]);

        expect(gatt.connect).toHaveBeenCalledTimes(2);
        await expect(transport.getPrimaryServices()).resolves.toEqual([service.uuid]);
        expect(secondServer.getPrimaryServices).toHaveBeenCalledOnce();
    });

    it('does not hide a disconnected GATT server as an empty service list', async () => {
        let connected = true;
        const server = {
            get connected() { return connected; },
            getPrimaryServices: vi.fn(async () => [])
        };
        const gatt = {
            get connected() { return connected; },
            connect: vi.fn(async () => server),
            disconnect: vi.fn(() => { connected = false; })
        };
        vi.stubGlobal('navigator', {
            bluetooth: {
                requestDevice: vi.fn(async () => ({
                    name: 'NIIMBOT D11_H', gatt, addEventListener: vi.fn()
                }))
            }
        });

        const transport = new UniversalBluetoothTransport();
        await transport.connect();
        connected = false;

        await expect(transport.getPrimaryServices()).rejects.toMatchObject({ name: 'NetworkError' });
    });

    it('writes without response when the characteristic supports both write modes (prefers performance)', async () => {
        const writeChar = {
            properties: { write: true, writeWithoutResponse: true },
            writeValueWithResponse: vi.fn(async () => {}),
            writeValueWithoutResponse: vi.fn(async () => {})
        };
        const service = {
            uuid: '000018f0-0000-1000-8000-00805f9b34fb',
            getCharacteristic: vi.fn(async () => writeChar)
        };
        const server = {
            get connected() { return true; },
            getPrimaryServices: vi.fn(async () => [service]),
            getPrimaryService: vi.fn(async () => service)
        };
        const gatt = {
            get connected() { return true; },
            connect: vi.fn(async () => server),
            disconnect: vi.fn()
        };
        vi.stubGlobal('navigator', {
            bluetooth: {
                requestDevice: vi.fn(async () => ({ name: 'Test', gatt, addEventListener: vi.fn() }))
            }
        });

        const transport = new UniversalBluetoothTransport();
        await transport.connect();

        const data = new Uint8Array([1, 2, 3, 4]);
        await transport.write(data, {
            serviceUUID: service.uuid,
            writeUUID: '00002af0-0000-1000-8000-00805f9b34fb'
        });

        expect(writeChar.writeValueWithoutResponse).toHaveBeenCalledOnce();
        expect(writeChar.writeValueWithResponse).not.toHaveBeenCalled();
    });

    it('falls back to writeValueWithoutResponse when the characteristic only supports writeWithoutResponse', async () => {
        const writeChar = {
            properties: { write: false, writeWithoutResponse: true },
            writeValueWithResponse: vi.fn(async () => {}),
            writeValueWithoutResponse: vi.fn(async () => {})
        };
        const service = {
            uuid: '000018f0-0000-1000-8000-00805f9b34fb',
            getCharacteristic: vi.fn(async () => writeChar)
        };
        const server = {
            get connected() { return true; },
            getPrimaryServices: vi.fn(async () => [service]),
            getPrimaryService: vi.fn(async () => service)
        };
        const gatt = {
            get connected() { return true; },
            connect: vi.fn(async () => server),
            disconnect: vi.fn()
        };
        vi.stubGlobal('navigator', {
            bluetooth: {
                requestDevice: vi.fn(async () => ({ name: 'Test', gatt, addEventListener: vi.fn() }))
            }
        });

        const transport = new UniversalBluetoothTransport();
        await transport.connect();

        const data = new Uint8Array([1, 2, 3, 4]);
        await transport.write(data, {
            serviceUUID: service.uuid,
            writeUUID: '00002af0-0000-1000-8000-00805f9b34fb'
        });

        expect(writeChar.writeValueWithoutResponse).toHaveBeenCalledOnce();
        expect(writeChar.writeValueWithResponse).not.toHaveBeenCalled();
    });

    it('falls back to writeValueWithResponse when the characteristic only supports write-with-response', async () => {
        const writeChar = {
            properties: { write: true, writeWithoutResponse: false },
            writeValueWithResponse: vi.fn(async () => {}),
            writeValueWithoutResponse: vi.fn(async () => {})
        };
        const service = {
            uuid: '000018f0-0000-1000-8000-00805f9b34fb',
            getCharacteristic: vi.fn(async () => writeChar)
        };
        const server = {
            get connected() { return true; },
            getPrimaryServices: vi.fn(async () => [service]),
            getPrimaryService: vi.fn(async () => service)
        };
        const gatt = {
            get connected() { return true; },
            connect: vi.fn(async () => server),
            disconnect: vi.fn()
        };
        vi.stubGlobal('navigator', {
            bluetooth: {
                requestDevice: vi.fn(async () => ({ name: 'Test', gatt, addEventListener: vi.fn() }))
            }
        });

        const transport = new UniversalBluetoothTransport();
        await transport.connect();

        const data = new Uint8Array([1, 2, 3, 4]);
        await transport.write(data, {
            serviceUUID: service.uuid,
            writeUUID: '00002af0-0000-1000-8000-00805f9b34fb'
        });

        expect(writeChar.writeValueWithResponse).toHaveBeenCalledOnce();
        expect(writeChar.writeValueWithoutResponse).not.toHaveBeenCalled();
    });
});
