import { describe, expect, it } from 'vitest';
import EventEmitter from 'eventemitter3';
import type { IDeviceTransport, TransportEventMap } from '../../core/transports/transport.interface';
import { monoPage } from '../../types/ink';
import {
    NelkoP21Driver,
    NELKO_P21_MODELS,
} from './nelko-p21-driver';
import { NELKO_P21_PROFILE } from './nelko-p21-protocol';

class MockTransport extends EventEmitter<TransportEventMap> implements IDeviceTransport {
    readonly type = 'Mock Classic';
    readonly writes: Uint8Array[] = [];
    private connected = true;
    private readonly deviceName: string;
    constructor(deviceName = 'Nelko P21') {
        super();
        this.deviceName = deviceName;
    }
    getDeviceName(): string { return this.deviceName; }
    isConnected(): boolean { return this.connected; }
    async connect(): Promise<void> { this.connected = true; }
    async disconnect(): Promise<void> { this.connected = false; }
    async write(data: Uint8Array): Promise<void> { this.writes.push(new Uint8Array(data)); }
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('NelkoP21Driver', () => {
    it('implements IPrinterDriver with stable id and hardware type', () => {
        const driver = new NelkoP21Driver();
        expect(driver.id).toBe('nelko-p21');
        expect(driver.name).toBe('Nelko P21 (TSPL2)');
        expect(driver.driverType).toBe('hardware');
        expect(driver.supportedModels).toBe(NELKO_P21_MODELS);
        expect(driver.connectionRequirements.services).toEqual([]);
        expect(driver.connectionRequirements.namePrefixes).toContain('Nelko');
    });

    it('exposes the 96-dot 8-dpmm capabilities', () => {
        const driver = new NelkoP21Driver();
        const caps = driver.getCapabilities();
        expect(caps.canvasHeightPx).toBe(96);
        expect(caps.dpmm).toBe(8);
        expect(caps.maxDensity).toBe(15);
        expect(caps.driverId).toBe('nelko-p21');
    });

    it('matches the Nelko P21 by name and rejects unrelated devices', () => {
        const driver = new NelkoP21Driver();
        expect(driver.isCompatible('Nelko P21')).toBe(true);
        expect(driver.isCompatible('PeriPage A6')).toBe(false);
    });

    it('emits a complete TSPL2 job in order', async () => {
        const driver = new NelkoP21Driver();
        const transport = new MockTransport();
        await driver.bindTransport(transport);
        await driver.printInit({
            density: 8,
            copies: 1,
            paper: { id: '12x40', name: '12x40', type: 'gap', tapeWidthMm: 12, labelLengthMm: 40, gapMm: 2 },
        });
        await driver.printPage(monoPage({ width: 1, height: 96, data: new Uint8Array(96 * 4).fill(255) }));
        await driver.printEnd();

        expect(text(transport.writes[0])).toBe('\u001b!o');
        expect(text(transport.writes[1])).toBe('SIZE 12 mm,40 mm\r\n');
        expect(text(transport.writes[2])).toBe('GAP 2 mm,0 mm\r\n');
        expect(text(transport.writes[3])).toBe('DIRECTION 1,1\r\n');
        expect(text(transport.writes[4])).toBe('DENSITY 8\r\n');
        expect(text(transport.writes[5])).toBe('CLS\r\n');
        expect(text(transport.writes[6])).toBe('BITMAP 0,0,12,1,1,');
        expect(transport.writes[7]).toEqual(new Uint8Array(12));
        expect(text(transport.writes[8])).toBe('\r\n');
        expect(text(transport.writes.at(-1)!)).toBe('PRINT 1\r\n');
    });

    it('derives SIZE and GAP from the raster when no paper profile is supplied', async () => {
        const driver = new NelkoP21Driver();
        const transport = new MockTransport();
        await driver.bindTransport(transport);
        await driver.printInit({ density: 8, copies: 2 });
        await driver.printPage(monoPage({ width: 2, height: 96, data: new Uint8Array(2 * 96 * 4).fill(255) }));
        await driver.printEnd();

        // 12-byte row = 96 dots = 12 mm at 8 dpmm; 2 rows = 0.25 mm, floored to 40 mm default.
        expect(text(transport.writes[1])).toBe('SIZE 12 mm,40 mm\r\n');
        expect(text(transport.writes[2])).toBe('GAP 2 mm,0 mm\r\n');
        expect(text(transport.writes.at(-1)!)).toBe('PRINT 2\r\n');
    });

    it('clamps density into the 0..15 range', async () => {
        const driver = new NelkoP21Driver();
        const transport = new MockTransport();
        await driver.bindTransport(transport);
        await driver.printInit({ density: 99, copies: 1 });
        await driver.printPage(monoPage({ width: 1, height: 96, data: new Uint8Array(96 * 4).fill(255) }));
        await driver.printEnd();
        expect(text(transport.writes[4])).toBe('DENSITY 15\r\n');
    });

    it('supports profile selection and rejects foreign profiles', () => {
        const driver = new NelkoP21Driver();
        expect(driver.getProfile()).toEqual(NELKO_P21_PROFILE);
        driver.setProfile(NELKO_P21_PROFILE);
        expect(driver.getProfile().id).toBe('nelko_p21');
        const foreign = { ...NELKO_P21_PROFILE, id: 'peripage_p21_203' };
        expect(() => driver.setProfile(foreign)).toThrow(/not supported by the Nelko P21/);
    });

    it('throws when sending without a bound transport', async () => {
        const driver = new NelkoP21Driver();
        await expect(driver.printInit({ density: 8, copies: 1 })).resolves.not.toThrow();
        await expect(driver.printPage(monoPage({ width: 1, height: 96, data: new Uint8Array(96 * 4).fill(255) })))
            .rejects.toThrow(/transport is not bound/);
    });
});
