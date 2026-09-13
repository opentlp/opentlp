/**
 * Platform detection and printer connection guidance.
 *
 * Users should not need to understand transport internals (Web Bluetooth vs Web Serial).
 * This module classifies connection methods into recommendations, alternatives,
 * and discouraged options based on the user's OS, app environment, and printer model.
 */

export type OSKind = 'linux' | 'windows' | 'macos' | 'android' | 'ios' | 'unknown';
export type EnvironmentKind = 'electron' | 'browser' | 'capacitor';
export type GuidanceTier = 'recommended' | 'alternative' | 'discouraged';

export interface PlatformInfo {
    os: OSKind;
    osName: string;
    environment: EnvironmentKind;
    isSecure: boolean;
}

export interface TransportGuidance {
    tier: GuidanceTier;
    badge: string;
    warning?: string;
    hints?: string;
    steps?: string[];
    discouragedReason?: string;
}

/**
 * Detect the current operating system and runtime environment.
 */
export function detectPlatform(userAgentOverride?: string): PlatformInfo {
    const ua = userAgentOverride ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    const isElectron = typeof window !== 'undefined' && (
        'electronAPI' in window || (window as unknown as { process?: { versions?: { electron?: string } } })?.process?.versions?.electron !== undefined
    );
    const isCapacitor = typeof window !== 'undefined' && (
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })?.Capacitor?.isNativePlatform?.() ?? false
    );

    const environment: EnvironmentKind = isCapacitor
        ? 'capacitor'
        : isElectron
        ? 'electron'
        : 'browser';

    let os: OSKind = 'unknown';
    let osName = 'Operating System';

    if (/Android/i.test(ua)) {
        os = 'android';
        osName = 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
        os = 'ios';
        osName = 'iOS';
    } else if (/Windows|Win32|Win64/i.test(ua)) {
        os = 'windows';
        osName = 'Windows';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
        os = 'macos';
        osName = 'macOS';
    } else if (/Linux/i.test(ua)) {
        os = 'linux';
        osName = 'Linux';
    }

    const isSecure = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : true;

    return { os, osName, environment, isSecure };
}

/**
 * Determine the guidance tier, instructions, and warnings for a transport option.
 */
export function getTransportGuidance(
    transportId: string,
    platform: PlatformInfo,
    printerModelId?: string
): TransportGuidance {
    const id = transportId.toLowerCase();
    const isBle = id.includes('ble') || id === 'bluetooth' || id === 'web-bluetooth';
    const isSerial = id.includes('serial') || id.includes('classic');
    const isUsb = id === 'usb' || id === 'web-usb' || id === 'capacitor-usb';
    const isDummy = id === 'dummy';

    const normalizedModel = (printerModelId ?? '').toLowerCase();
    const isP12 = normalizedModel.includes('p12');
    const isL13 = normalizedModel.includes('l13');

    // 1. DUMMY / SIMULATOR
    if (isDummy) {
        return {
            tier: 'alternative',
            badge: 'Virtual Simulation',
            hints: 'Generates a bitmap preview without requiring physical hardware.'
        };
    }

    // 2. BLUETOOTH BLE (Direct Web Bluetooth / Capacitor BLE)
    if (isBle) {
        // Linux: Web Bluetooth is notoriously unreliable / dropping GATT connections
        if (platform.os === 'linux') {
            return {
                tier: 'discouraged',
                badge: 'Not recommended on Linux',
                discouragedReason: 'Web Bluetooth on Linux is often blocked or fails GATT pairing. Bluetooth Serial below is much more reliable.',
                warning: 'Web Bluetooth on Linux typically drops connection or fails to pair with label printers. We strongly recommend Bluetooth Serial instead.'
            };
        }

        // L13: BLE often prints blanks or fails on several firmware revisions
        if (isL13) {
            return {
                tier: 'alternative',
                badge: 'Alternative (Serial recommended for L13)',
                warning: 'Do NOT pair in your OS Bluetooth settings first. (Note: Many L13 printers require the Bluetooth Serial path below to print correctly).'
            };
        }

        // Windows, Android, macOS: Direct BLE is the most convenient recommended path
        return {
            tier: 'recommended',
            badge: 'Recommended',
            warning: 'Do NOT pair this printer in your OS Bluetooth menu! Direct Bluetooth only works when the device is not paired in OS settings.',
            hints: 'Turn on your printer, click Connect, and select the device (often named ' + (isP12 ? 'P12_... or P12_..._BLE' : 'with your printer model or _BLE') + ') in the popup list.'
        };
    }

    // 3. BLUETOOTH SERIAL / CLASSIC (RFCOMM / SPP)
    if (isSerial) {
        const isRecommended = platform.os === 'linux' || isL13;

        const steps: string[] = [
            `Open your ${platform.osName} Bluetooth settings (${platform.os === 'windows' ? 'Settings > Bluetooth & devices' : platform.os === 'linux' ? 'Settings > Bluetooth' : 'Bluetooth Settings'}).`,
            'Turn on your printer and click "Add device" or "Pair".'
        ];

        if (isP12 && platform.os === 'windows') {
            steps.push('Important for Windows: The P12 appears as "SPP Slave" in the Bluetooth list. Select "SPP Slave" to pair (PIN is 0000 or 1234 if prompted).');
        } else if (isP12) {
            steps.push('Select your printer (e.g. "P12_..."). Do NOT select the entry ending in "_BLE".');
        } else if (isL13) {
            steps.push('Select the entry starting with "L13_" (do NOT select "L13_..._BLE").');
        } else {
            steps.push('Select your printer name. Do NOT select the entry ending in "_BLE".');
        }

        steps.push('Once paired in your operating system, return here, click Connect, and choose your paired printer from the list.');

        return {
            tier: isRecommended ? 'recommended' : 'alternative',
            badge: isRecommended
                ? (isL13 ? 'Recommended for L13' : 'Recommended on Linux')
                : 'Alternative (Requires OS pairing)',
            hints: 'Requires pairing in your computer/phone Bluetooth settings first.',
            steps
        };
    }

    // 4. USB (WebUSB / USB-Serial)
    if (isUsb) {
        return {
            tier: 'recommended',
            badge: 'Wired Connection',
            hints: platform.os === 'windows'
                ? 'Plug in via USB. (WebUSB on Windows may require a one-time WinUSB driver setup with Zadig).'
                : platform.os === 'linux'
                ? 'Plug in via USB. (Ensure your user account has serial/USB permissions in group dialout).'
                : 'Plug in via USB cable and click Connect.'
        };
    }

    // Fallback
    return {
        tier: 'alternative',
        badge: 'Standard'
    };
}
