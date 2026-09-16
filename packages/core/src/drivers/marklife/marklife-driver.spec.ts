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

        // Auto dialect yields legacy L11 models to legacy driver
        expect(driver.isCompatible('L13_81E0')).toBe(false);
        expect(driver.isCompatible('DP-L13')).toBe(false);
        expect(driver.isCompatible('LP90')).toBe(false);
        expect(driver.isCompatible('Silvercrest')).toBe(false);
        expect(driver.isCompatible('LuckP_L80_1234')).toBe(false);
        expect(driver.isCompatible('DP_L80_ABCD')).toBe(false);
        expect(driver.isCompatible('L12_81E0')).toBe(false);
        expect(driver.isCompatible('P15_AB12_BLE')).toBe(false);
        expect(driver.isCompatible('P15')).toBe(false);
        expect(driver.isCompatible('P11')).toBe(false);
        expect(driver.isCompatible('P7')).toBe(false);
        expect(driver.isCompatible('LP15')).toBe(false);

        const legacyDriver = new MarklifeDriver('0x10ff');
        expect(legacyDriver.isCompatible('L13_81E0')).toBe(true);
        expect(legacyDriver.isCompatible('L13_81E0_BLE')).toBe(true);
        expect(legacyDriver.isCompatible('DP-L13')).toBe(true);
        expect(legacyDriver.isCompatible('LP90')).toBe(true);
        expect(legacyDriver.isCompatible('Silvercrest Thermo Label Printer')).toBe(true);
        expect(legacyDriver.isCompatible('MUNBYN L13')).toBe(true);
        expect(legacyDriver.isCompatible('Luckjingle')).toBe(true);
        expect(legacyDriver.isCompatible('LuckP_L80_1234')).toBe(true);
        expect(legacyDriver.isCompatible('DP_L80_ABCD')).toBe(true);
        expect(legacyDriver.isCompatible('APL82_5678')).toBe(true);
        expect(legacyDriver.isCompatible('L12_81E0')).toBe(true);
        expect(legacyDriver.isCompatible('MPL11_0000')).toBe(true);
        expect(legacyDriver.isCompatible('P15_AB12_BLE')).toBe(true);
        expect(legacyDriver.isCompatible('P15')).toBe(true);
        expect(legacyDriver.isCompatible('P11')).toBe(true);
        expect(legacyDriver.isCompatible('P7')).toBe(true);
        expect(legacyDriver.isCompatible('LP15')).toBe(true);
        expect(legacyDriver.isCompatible('P12_PRO')).toBe(false);
        expect(legacyDriver.isCompatible('P50')).toBe(false);
    });

    it('scopes supported models between standard and legacy dialects', () => {
        const legacyDriver = new MarklifeDriver('0x10ff');
        expect(legacyDriver.supportedModels.some(m => m.id === 'marklife_p15')).toBe(true);
        expect(legacyDriver.supportedModels.some(m => m.id === 'marklife_p12')).toBe(false);

        const standardDriver = new MarklifeDriver('0x1f');
        expect(standardDriver.supportedModels.some(m => m.id === 'marklife_p15')).toBe(false);
        expect(standardDriver.supportedModels.some(m => m.id === 'marklife_p12')).toBe(true);
    });

    it('configures model-specific capabilities via setModel', async () => {
        const legacyDriver = new MarklifeDriver('0x10ff');
        legacyDriver.setModel('marklife_l13');
        const transport = new MockTransport('/dev/rfcomm0');
        await legacyDriver.bindTransport(transport);
        expect(legacyDriver.getCapabilities()).toMatchObject({
            canvasHeightPx: 96,
            driverName: 'Marklife (0x10FF)'
        });
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
            driverName: 'Marklife (0x10FF)'
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
            driverName: 'Marklife (0x10FF)'
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
        const legacyDriver = new MarklifeDriver('0x10ff');
        await legacyDriver.bindTransport(serialTransport);

        expect(legacyDriver.getCapabilities().driverName).toBe('Marklife (0x10FF)');

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

    it('automatically resolves DP-L13 / L13 via deviceName on serial without sending probe commands', async () => {
        class MockNamedSerialTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
            type = "Serial-WebSerial";
            filterType = "none" as const;
            public writes: Uint8Array[] = [];
            isConnected() { return true; }
            getDeviceName() { return "L13_81E0"; }
            async connect() {}
            async disconnect() {}
            async startNotifications() {}
            async write(data: Uint8Array) {
                this.writes.push(new Uint8Array(data));
            }
        }

        const serialTransport = new MockNamedSerialTransport();
        const autoDriver = new MarklifeDriver('auto');
        await autoDriver.bindTransport(serialTransport);

        // No probe bytes should be sent during bindTransport
        expect(serialTransport.writes).toHaveLength(0);

        // Capabilities should have automatically resolved to L13 (96px, 0x10FF)
        expect(autoDriver.getCapabilities()).toMatchObject({
            canvasHeightPx: 96,
            driverName: 'Marklife (0x10FF)'
        });
    });

    it('driver with legacy dialect forces L11 framing even on generic names', async () => {
        const legacyDriver = new MarklifeDriver('0x10ff');
        const genericTransport = new MockTransport('Unknown Serial Printer');
        await legacyDriver.bindTransport(genericTransport);

        expect(legacyDriver.getCapabilities()).toMatchObject({
            driverName: 'Marklife (0x10FF)'
        });
        expect(legacyDriver.name).toBe('Marklife-0x10FF');
    });

    it('drives Marklife P15 through the 0x10FF job framing with 0x02 enable byte', async () => {
        const transport = new MockTransport('P15_AB12_BLE');
        const legacyDriver = new MarklifeDriver('0x10ff');
        await legacyDriver.bindTransport(transport);

        expect(legacyDriver.getCapabilities()).toMatchObject({
            canvasHeightPx: 96,
            driverName: 'Marklife (0x10FF)'
        });

        await legacyDriver.printInit({
            density: 8,
            copies: 1,
            paper: { id: 'gap-12x30', name: '12x30 Gap', type: 'gap', tapeWidthMm: 12, labelLengthMm: 30 }
        });
        expect([...transport.writes[0]]).toEqual([0x10, 0xff, 0x10, 0x00, 0x06]);
        transport.clearWrites();

        const image = { data: new Uint8Array(2 * 96 * 4).fill(255), width: 2, height: 96 };
        await legacyDriver.printPage(monoPage(image));
        await legacyDriver.printEnd();

        // Check that a job was written and starts with legacy wake-up (15 zeroes) + 10 FF F1 02
        expect(transport.writes.length).toBeGreaterThan(0);
        const job = transport.writes[0];
        expect([...job.slice(0, 15)]).toEqual(new Array(15).fill(0x00));
        expect([...job.slice(15, 19)]).toEqual([0x10, 0xff, 0xf1, 0x02]);
        // And closes with 10 FF F1 45
        const endBytes = job.slice(job.length - 4);
        expect([...endBytes]).toEqual([0x10, 0xff, 0xf1, 0x45]);
    });

    it('reads battery, name, serial, firmware and hardware over the INFO service', async () => {
        // The P15 answers the 10 FF INFO query family on the ISSC notify
        // characteristic (49535343-1e4d...). This guards the regression where a
        // write-without-response to the command characteristic was silently
        // dropped, leaving every status field empty even though the printer
        // had answered.
        const INFO_NOTIFY = '49535343-1e4d-4bd9-ba61-23c647249616';
        const enc = (s: string) => Array.from(new TextEncoder().encode(s));
        // The real device answers each query with a short reply whose second
        // byte carries the value (battery percent) or whose body is the text
        // value verbatim -- no command-echo header, matching what BleWebler's
        // parsers expect (parseBattery reads buf[1]; parseText decodes the body).
        const responses = new Map<string, Uint8Array>([
            ['10ff50f1', new Uint8Array([0x50, 87])],            // battery 87%
            ['10ff40', new Uint8Array([0x40, 0x00])],          // paper present
            ['10ff20ef', new Uint8Array(enc('HW1.0'))],
            ['10ff20f0', new Uint8Array(enc('P15_90DD'))],
            ['10ff20f1', new Uint8Array(enc('FW2.3'))],
            ['10ff20f2', new Uint8Array(enc('SN123456'))]
        ]);

        class InfoRespondingTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
            type = "Mock";
            filterType = 'bluetooth-le' as const;
            public writes: { data: Uint8Array; writeUUID: string }[] = [];
            constructor(private readonly deviceName: string) { super(); }
            async connect() {}
            async disconnect() {}
            isConnected() { return true; }
            getDeviceName() { return this.deviceName; }
            async write(data: Uint8Array, info?: { serviceUUID: string; writeUUID: string }) {
                this.writes.push({ data: new Uint8Array(data), writeUUID: info?.writeUUID ?? '' });
                const key = [...data].map(b => b.toString(16).padStart(2, '0')).join('');
                // Match on the leading query bytes only (payload may carry trailing args).
                const reply = [...responses.entries()].find(([k]) => key.startsWith(k));
                if (reply) {
                    setTimeout(() => this.emit('data', new Uint8Array(reply[1]), INFO_NOTIFY), 0);
                }
            }
            async startNotifications() {}
        }

        const transport = new InfoRespondingTransport('P15_90DD_BLE');
        const legacyDriver = new MarklifeDriver('0x10ff');
        await legacyDriver.bindTransport(transport);

        const status = await legacyDriver.getStatus();

        // Every INFO query must have been written to the ISSC command char.
        expect(transport.writes.some(w => w.writeUUID === '49535343-8841-43f4-a8d4-ecbe34729bb3')).toBe(true);
        expect(status.battery?.level).toBeCloseTo(0.87);
        expect(status.identity.deviceName).toBe('P15_90DD');
        expect(status.identity.serialNumber).toBe('SN123456');
        expect(status.identity.firmwareVersion).toBe('FW2.3');
        expect(status.identity.hardwareVersion).toBe('HW1.0');
    });
});
