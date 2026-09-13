import { describe, expect, it } from 'vitest';
import EventEmitter from 'eventemitter3';
import { PrinterSession } from './session';
import type { IDeviceTransport, TransportEventMap, BluetoothLEScanFilter } from 'universal-label-core';

class MockTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
    readonly type = 'Bluetooth';
    private conn = false;

    constructor(private readonly name: string, private readonly services: string[] = []) {
        super();
    }

    async connect(_filters?: BluetoothLEScanFilter[]): Promise<void> {
        this.conn = true;
        this.emit('connected');
    }

    async disconnect(): Promise<void> {
        this.conn = false;
        this.emit('disconnected');
    }

    async write(): Promise<void> {}

    isConnected(): boolean {
        return this.conn;
    }

    getDeviceName(): string | undefined {
        return this.name;
    }

    async getPrimaryServices(): Promise<string[]> {
        return this.services;
    }
}

describe('PrinterSession', () => {
    it('runs diagnosis through session.diagnose', async () => {
        const session = new PrinterSession();
        const transport = new MockTransport('P12_B8F0', ['0000ff00-0000-1000-8000-00805f9b34fb']);

        const diag = await session.diagnose(transport);
        expect(diag.deviceName).toBe('P12_B8F0');
        expect(diag.transportType).toBe('Bluetooth');
        expect(diag.candidates.length).toBeGreaterThan(0);
        expect(diag.candidates.some(c => c.driverName === 'Marklife-Protocol-0x1F')).toBe(true);
        expect(diag.suggestedDriver).toBe('Marklife-Protocol-0x1F');
    });

    it('connects with an already established transport via connectWithTransport', async () => {
        const session = new PrinterSession();
        const transport = new MockTransport('P12_B8F0', ['0000ff00-0000-1000-8000-00805f9b34fb']);
        await transport.connect();

        await session.connectWithTransport(transport, 'Marklife-Protocol-0x1F', 'marklife_p12', 'web-bluetooth');
        expect(session.current.state).toBe('connected');
        expect(session.current.deviceName).toBe('P12_B8F0');
        expect(session.current.transportKind).toBe('web-bluetooth');
        expect(session.current.transportType).toBe('Bluetooth');
        expect(session.current.driverName).toBe('Marklife-Protocol-0x1F');
        expect(session.current.capabilities?.driverName).toBe('Marklife (Protocol 0x1F)');
        expect(session.current.serviceUuids).toContain('0000ff00-0000-1000-8000-00805f9b34fb');
        expect(session.getDiagnosticLog().join('\n')).toContain('connection established');

        await session.disconnect();
        expect(session.current.state).toBe('disconnected');
    });
});
