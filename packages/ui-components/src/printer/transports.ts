/**
 * Transport menu contract. The app shells know their platform (browser,
 * Capacitor, Electron) and hand the designer a list of options; the UI never
 * imports transports itself, so no shell pays for another platform's bindings.
 */
import type { IDeviceTransport } from 'universal-label-core';

export interface TransportHelp {
    /** One-line summary shown on the collapsed control. */
    summary: string;
    /** Ordered setup steps, rendered as a numbered list. */
    steps: string[];
    /** External reference for the driver/tool the steps require. */
    link?: { label: string; url: string };
}

export interface TransportOption {
    id: string;
    label: string;
    description?: string;
    /** False renders the option disabled with `unavailableReason`. */
    available: boolean;
    unavailableReason?: string;
    /** Shows the virtual-printer profile picker when true. */
    isDummy?: boolean;
    /**
     * Platform setup the user must do once before this transport can connect
     * (e.g. install WinUSB on Windows for WebUSB). Shown collapsed under the
     * option; absent when no setup is needed.
     */
    help?: TransportHelp;
    create(): IDeviceTransport;
}
