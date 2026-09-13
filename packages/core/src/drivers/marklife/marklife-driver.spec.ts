import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventEmitter from 'eventemitter3';
import { MarklifeDriver } from './marklife-driver';
import type { IDeviceTransport, TransportEventMap } from '../../core/transports/transport.interface';
import { monoPage } from '../../types/ink';

class MockTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
    type = "Mock";
    public writeCount = 0;
    public writes: Uint8Array[] = [];
    constructor(private readonly deviceName = "P50_Test") { super(); }
    async connect() {}
    async disconnect() {}
    isConnected() { return true; }
    getDeviceName() { return this.deviceName; }
    async write(data: Uint8Array) {
        this.writeCount += data.length;
        this.writes.push(new Uint8Array(data));
        // Simulate the device granting more flow-control credits as it drains
        // each chunk (0x01, <count>), so the credit-gated sender can progress.
        queueMicrotask(() => this.grantCredits());
    }
    // Implement startNotifications to trigger flow-control path
    async startNotifications() {
        // The real device issues an initial credit grant shortly after the
        // notify characteristic is subscribed. Fire it after bind completes.
        setTimeout(() => this.grantCredits(), 0);
    }
    private grantCredits() {
        this.emit('data', new Uint8Array([0x01, 0x04]));
    }
    clearWrites() {
        this.writeCount = 0;
        this.writes = [];
    }
}

// Removing fake timers so real timeouts process properly

describe('MarklifeDriver', () => {
    let driver: MarklifeDriver;

    beforeEach(() => {
        driver = new MarklifeDriver();
    });

    it('should match marklife compatible names', () => {
        expect(driver.isCompatible('P50')).toBe(true);
        expect(driver.isCompatible('P12_PRO')).toBe(true);
        expect(driver.isCompatible('marklife')).toBe(true);
        expect(driver.isCompatible('Printer01')).toBe(false);
        expect(driver.isCompatible('Niimbot_D11')).toBe(false);
    });

    it('should correctly expose capabilities based on transport name', async () => {
        const transport = new MockTransport();
        await driver.bindTransport(transport);
        const caps = driver.getCapabilities();

        expect(caps.canvasHeightPx).toBe(384); // Because getDeviceName returns "P50_Test"
        expect(caps.supportsSpeedMode).toBe(true);
        expect(caps.maxDensity).toBe(15);
    });

    it('exposes LP90 as a 96-dot legacy device without speed control', async () => {
        const transport = new MockTransport('LP90_Test');
        await driver.bindTransport(transport);

        expect(driver.getCapabilities()).toMatchObject({
            canvasHeightPx: 96,
            supportsSpeedMode: false,
            driverName: 'Marklife (Legacy L11)'
        });
    });

    it('routes the L13 through the legacy path like the LP90', async () => {
        // The L13 is sold under the Silvercrest/MUNBYN/Luckjingle brands and
        // advertises an `L13_..._BLE` name. It must take the legacy job path,
        // not the standard `1F` path, which connects but prints nothing on some
        // firmware revisions.
        const transport = new MockTransport('L13_81E0_BLE');
        await driver.bindTransport(transport);

        expect(driver.getCapabilities()).toMatchObject({
            canvasHeightPx: 96,
            driverName: 'Marklife (Legacy L11)'
        });
    });

    it('should run printInit and send configuration commands', async () => {
        const transport = new MockTransport();
        vi.spyOn(transport, 'write');
        await driver.bindTransport(transport);
        
        const initPromise = driver.printInit({ paper: { id: 'test', name: 'test', type: 'gap', tapeWidthMm: 15 }, density: 10, speed: 2, copies: 1 });
        await initPromise;

        // Expect multiple writes: setPaperType, startJob, adjustPos, setDensity, setSpeed
        expect(transport.write).toHaveBeenCalledTimes(5);
    });

    it('should successfully run printPage without the dudu.js payload encoder crashing', async () => {
        const transport = new MockTransport();
        await driver.bindTransport(transport);

        // A tiny 2x2 white image
        const dummyImage = {
            data: new Uint8Array(16).fill(255),
            width: 2,
            height: 2
        };

        const pagePromise = driver.printPage(monoPage(dummyImage));
        await pagePromise;

        // Assuming dudu generated at least some payload bits
        expect(transport.writeCount).toBeGreaterThan(0);
    });

    it('assembles the L13 legacy job with the official-app enable byte', async () => {
        const transport = new MockTransport('L13_81E0_BLE');
        await driver.bindTransport(transport);
        await driver.printInit({
            paper: { id: 'continuous', name: 'Continuous', type: 'continuous', tapeWidthMm: 15 },
            density: 10,
            speed: 2,
            copies: 1,
            feedOverrides: { feedBeforeMm: 1, feedAfterMm: 2 }
        });

        expect([...transport.writes[0]]).toEqual([0x10, 0xff, 0x10, 0x00, 0x06]);
        transport.clearWrites();

        const image = { data: new Uint8Array(2 * 96 * 4).fill(255), width: 2, height: 96 };
        await driver.printPage(monoPage(image));

        expect(transport.writes).toHaveLength(1);
        const job = transport.writes[0];
        expect([...job.slice(0, 15)]).toEqual(new Array(15).fill(0));
        // The L13 enable byte is 0x03 (official Pocket Printer app), not the
        // 0x02 the LP90 and the original BleWebler use.
        expect([...job.slice(15, 19)]).toEqual([0x10, 0xff, 0xf1, 0x03]);
        expect([...job.slice(22, 30)]).toEqual([0x1d, 0x76, 0x30, 0x00, 0x0c, 0x00, 0x02, 0x00]);
        expect([...job.slice(-4)]).toEqual([0x10, 0xff, 0xf1, 0x45]);
    });

    it('feeds a default lead and tail on the L13 legacy path with no overrides', async () => {
        const transport = new MockTransport('L13_81E0_BLE');
        await driver.bindTransport(transport);
        await driver.printInit({
            paper: { id: 'continuous', name: 'Continuous', type: 'continuous', tapeWidthMm: 15 },
            density: 10,
            copies: 1
        });
        transport.clearWrites();

        const image = { data: new Uint8Array(2 * 96 * 4).fill(255), width: 2, height: 96 };
        await driver.printPage(monoPage(image));

        const job = transport.writes[0];
        // After wakeup(15) + startJob(4, enable=0x03) comes a default 40-dot
        // lead feed: 1B 4A 28.
        expect([...job.slice(15, 19)]).toEqual([0x10, 0xff, 0xf1, 0x03]);
        expect([...job.slice(19, 22)]).toEqual([0x1b, 0x4a, 0x28]);

        // printEnd sends a trailing tear-off purge (default 91 dots = 0x5B).
        transport.clearWrites();
        await driver.printEnd();
        const endWrite = transport.writes.find(w => w[0] === 0x1b && w[1] === 0x4a);
        expect(endWrite && endWrite[2]).toBe(0x5b);
    });

    it('assembles the LP90 legacy job and honours continuous feed overrides', async () => {
        const transport = new MockTransport('LP90_Test');
        await driver.bindTransport(transport);
        await driver.printInit({
            paper: { id: 'continuous', name: 'Continuous', type: 'continuous', tapeWidthMm: 15 },
            density: 10,
            speed: 2,
            copies: 1,
            feedOverrides: { feedBeforeMm: 1, feedAfterMm: 2 }
        });

        expect([...transport.writes[0]]).toEqual([0x10, 0xff, 0x10, 0x00, 0x06]);
        transport.clearWrites();

        const image = { data: new Uint8Array(2 * 96 * 4).fill(255), width: 2, height: 96 };
        await driver.printPage(monoPage(image));

        expect(transport.writes).toHaveLength(1);
        const job = transport.writes[0];
        expect([...job.slice(0, 15)]).toEqual(new Array(15).fill(0));
        expect([...job.slice(15, 19)]).toEqual([0x10, 0xff, 0xf1, 0x02]);
        expect([...job.slice(19, 22)]).toEqual([0x1b, 0x4a, 0x08]);
        expect([...job.slice(22, 30)]).toEqual([0x1d, 0x76, 0x30, 0x00, 0x0c, 0x00, 0x02, 0x00]);
        expect([...job.slice(-7, -4)]).toEqual([0x1b, 0x4a, 0x10]);
        expect([...job.slice(-4)]).toEqual([0x10, 0xff, 0xf1, 0x45]);
    });

    it('should run printEnd and trigger cut commands', async () => {
        const transport = new MockTransport();
        vi.spyOn(transport, 'write');
        await driver.bindTransport(transport);

        const endPromise = driver.printEnd();
        await endPromise;

        expect(transport.write).toHaveBeenCalledTimes(4); // purge, stop, alternate stop, auto pos
    });

    it('prints on Serial transport without waiting for flow-control credits', async () => {
        class MockSerialTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
            type = "Serial-WebSerial";
            filterType = "none" as const;
            public writes: Uint8Array[] = [];
            isConnected() { return true; }
            getDeviceName() { return "Serial Printer"; }
            async connect() {}
            async disconnect() {}
            async startNotifications() {} // starts reading, but yields no credit packets
            async write(data: Uint8Array) {
                this.writes.push(new Uint8Array(data));
            }
        }

        const serialTransport = new MockSerialTransport();
        const legacyDriver = new MarklifeDriver('legacy');
        await legacyDriver.bindTransport(serialTransport);

        expect(legacyDriver.getCapabilities().driverName).toBe('Marklife (Legacy L11)');

        await legacyDriver.printInit({
            paper: { id: 'continuous', name: 'Continuous', type: 'continuous', tapeWidthMm: 15 },
            density: 8,
            copies: 1
        });

        const image = { data: new Uint8Array(2 * 96 * 4).fill(255), width: 2, height: 96 };
        // Should resolve cleanly without hanging for credits
        await legacyDriver.printPage(monoPage(image));

        expect(serialTransport.writes.length).toBeGreaterThan(0);
        // Verify legacy framing was assembled
        const job = serialTransport.writes[serialTransport.writes.length - 1];
        expect([...job.slice(15, 19)]).toEqual([0x10, 0xff, 0xf1, 0x02]);
    });

    it('automatically detects DP-L13 via model probe on generic serial', async () => {
        class ProbingSerialTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
            type = "Serial-WebSerial";
            filterType = "none" as const;
            public writes: Uint8Array[] = [];
            isConnected() { return true; }
            getDeviceName() { return "Serial Printer"; }
            async connect() {}
            async disconnect() {}
            async startNotifications() {}
            async write(data: Uint8Array) {
                this.writes.push(new Uint8Array(data));
                // Reply to model query (10 FF 20 F0)
                if (data.length === 4 && data[0] === 0x10 && data[1] === 0xff && data[2] === 0x20 && data[3] === 0xf0) {
                    queueMicrotask(() => {
                        this.emit('data', new TextEncoder().encode("DP-L13\0"));
                    });
                }
            }
        }

        const probingSerial = new ProbingSerialTransport();
        const autoDriver = new MarklifeDriver('auto');
        await autoDriver.bindTransport(probingSerial);

        // Capabilities should have automatically resolved to L13 (96px, Legacy L11)
        expect(autoDriver.getCapabilities()).toMatchObject({
            canvasHeightPx: 96,
            driverName: 'Marklife (Legacy L11)'
        });
    });

    it('driver with legacy dialect forces L11 framing even on generic names', async () => {
        const legacyDriver = new MarklifeDriver('legacy');
        const genericTransport = new MockTransport('Unknown Serial Printer');
        await legacyDriver.bindTransport(genericTransport);

        expect(legacyDriver.getCapabilities()).toMatchObject({
            driverName: 'Marklife (Legacy L11)'
        });
        expect(legacyDriver.name).toBe('Marklife-Legacy-L11');
    });
});
