import { describe, expect, it } from 'vitest';
import { detectPlatform, getTransportGuidance, type PlatformInfo } from './connection-guide';

describe('connection-guide', () => {
    describe('detectPlatform', () => {
        it('detects Linux from userAgent', () => {
            const linux = detectPlatform('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
            expect(linux.os).toBe('linux');
            expect(linux.osName).toBe('Linux');
        });

        it('detects Windows from userAgent', () => {
            const win = detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            expect(win.os).toBe('windows');
            expect(win.osName).toBe('Windows');
        });

        it('detects Android from userAgent', () => {
            const android = detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36');
            expect(android.os).toBe('android');
            expect(android.osName).toBe('Android');
        });

        it('detects macOS from userAgent', () => {
            const mac = detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
            expect(mac.os).toBe('macos');
            expect(mac.osName).toBe('macOS');
        });
    });

    describe('getTransportGuidance', () => {
        const linuxPlatform: PlatformInfo = {
            os: 'linux',
            osName: 'Linux',
            environment: 'electron',
            isSecure: true
        };

        const windowsPlatform: PlatformInfo = {
            os: 'windows',
            osName: 'Windows',
            environment: 'electron',
            isSecure: true
        };

        it('discourages Web Bluetooth on Linux and recommends Bluetooth Serial', () => {
            const bleGuide = getTransportGuidance('bluetooth', linuxPlatform);
            expect(bleGuide.tier).toBe('discouraged');
            expect(bleGuide.badge).toContain('Not recommended on Linux');
            expect(bleGuide.discouragedReason).toBeTruthy();

            const serialGuide = getTransportGuidance('serial', linuxPlatform);
            expect(serialGuide.tier).toBe('recommended');
            expect(serialGuide.badge).toContain('Recommended on Linux');
            expect(serialGuide.steps).toBeDefined();
        });

        it('recommends Web Bluetooth on Windows and sets Serial as alternative with SPP Slave hint for P12', () => {
            const bleGuide = getTransportGuidance('bluetooth', windowsPlatform, 'marklife_p12');
            expect(bleGuide.tier).toBe('recommended');
            expect(bleGuide.warning).toContain('Do NOT pair this printer in your OS Bluetooth menu');

            const serialGuide = getTransportGuidance('serial', windowsPlatform, 'marklife_p12');
            expect(serialGuide.tier).toBe('alternative');
            expect(serialGuide.steps?.some(s => s.includes('SPP Slave'))).toBe(true);
        });

        it('recommends Serial for L13 even on Windows or generic platforms', () => {
            const bleGuide = getTransportGuidance('bluetooth', windowsPlatform, 'munbyn_l13');
            expect(bleGuide.tier).toBe('alternative');

            const serialGuide = getTransportGuidance('serial', windowsPlatform, 'munbyn_l13');
            expect(serialGuide.tier).toBe('recommended');
            expect(serialGuide.steps?.some(s => s.includes('L13_') && s.includes('do NOT select'))).toBe(true);
        });

        it('provides step-by-step pairing instructions for Serial on Linux', () => {
            const serialGuide = getTransportGuidance('web-serial', linuxPlatform, 'marklife_p12');
            expect(serialGuide.tier).toBe('recommended');
            expect(serialGuide.steps?.length).toBeGreaterThanOrEqual(3);
            expect(serialGuide.steps?.some(s => s.includes('Linux Bluetooth settings'))).toBe(true);
        });

        it('discourages USB on Linux with explicit warning and advice to use Serial', () => {
            const usbGuide = getTransportGuidance('usb', linuxPlatform);
            expect(usbGuide.tier).toBe('discouraged');
            expect(usbGuide.badge).toContain('Not recommended on Linux');
            expect(usbGuide.discouragedReason).toContain('WebUSB on Linux');
        });

        it('uses Direct USB badge instead of Wired Connection on Windows and others', () => {
            const usbGuide = getTransportGuidance('usb', windowsPlatform);
            expect(usbGuide.badge).toBe('Direct USB');
            expect(usbGuide.badge).not.toContain('Wired Connection');
        });

        it('customizes setup steps according to driver families', () => {
            const niimbotGuide = getTransportGuidance('serial', linuxPlatform, 'niimbot_d11');
            expect(niimbotGuide.steps?.some(s => s.includes('Niimbot'))).toBe(true);

            const phomemoGuide = getTransportGuidance('serial', linuxPlatform, 'phomemo_m110');
            expect(phomemoGuide.steps?.some(s => s.includes('Phomemo'))).toBe(true);

            const genericGuide = getTransportGuidance('serial', linuxPlatform, '');
            expect(genericGuide.steps?.some(s => s.includes('Select your printer name'))).toBe(true);
        });

        it('provides usbHint for Serial covering wired USB cable on Linux and Windows', () => {
            const linuxSerial = getTransportGuidance('serial', linuxPlatform);
            expect(linuxSerial.usbHint).toBeDefined();
            expect(linuxSerial.usbHint).toContain('dialout');
            expect(linuxSerial.usbHint).toContain('USB cable');

            const winSerial = getTransportGuidance('serial', windowsPlatform);
            expect(winSerial.usbHint).toBeDefined();
            expect(winSerial.usbHint).toContain('COM');
        });
    });
});
