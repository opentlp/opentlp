import EventEmitter from "eventemitter3";
import { IDeviceTransport } from "./transports/transport.interface";
import { IPrinterDriver, UniversalPrintOptions, PrinterModelProfile } from "../drivers/driver.interface";
import type { LoadedMedia, PrinterStatus, StatusField } from "../drivers/printer-status";
import { PrinterError, toPrinterError } from "../drivers/printer-error";
import type { UniversalPage } from "../types/ink";
import { reduceToChannels } from "../types/ink";

import { MarklifeDriver } from "../drivers/marklife";
import { NiimbotDriver } from "../drivers/niimbot";
import { CatPrinterDriver } from "../drivers/catprinter-tiny";
import { CatPrinterMxw01Driver } from "../drivers/catprinter-mxw01";
import { CatPrinterV5gDriver } from "../drivers/catprinter-v5g";
import { CatPrinterV5cDriver } from "../drivers/catprinter-v5c";
import { FunnyLxDriver } from "../drivers/catprinter-funny-lx";
import { PhomemoDqDriver } from "../drivers/phomemo-dq";
import { PhomemoM110Driver } from "../drivers/phomemo-m110";
import { PhomemoM02Driver } from "../drivers/phomemo-m02";
import { PhomemoMSeriesDriver } from "../drivers/phomemo-m-series";
import { PhomemoP12Driver } from "../drivers/phomemo-p12";
import { PhomemoM04Driver } from "../drivers/phomemo-m04";
import { PhomemoTsplDriver } from "../drivers/phomemo-tspl";
import { OrgstaS001Driver } from "../drivers/yk";
import { PeriPageDriver } from "../drivers/peripage";
import { DummyDriver } from "../drivers/dummy";

export interface PrintManagerEvents {
    connected: (driver: IPrinterDriver) => void;
    disconnected: () => void;
    printing: () => void;
    idle: () => void;
    error: (error: Error) => void;
}

/** Diagnostic sink for the PrintManager. Defaults to silent; inject one to observe. */
export type DiagnosticLogger = (level: 'info' | 'warn', message: string) => void;

export interface PrinterDriverChoice {
    /** Stable selection key accepted by connect/connectWithTransport. */
    name: string;
    /** Number of model profiles explicitly associated with the driver. */
    modelCount: number;
}

export interface CandidateDriverInfo {
    driverName: string;
    matchedBy: 'name' | 'service' | 'both' | 'prefix-hint';
    reasons: string[];
    supportedModels: PrinterModelProfile[];
}

export interface DeviceDiagnostic {
    deviceName?: string;
    transportType: string;
    discoveredServices: string[];
    candidates: CandidateDriverInfo[];
    suggestedDriver?: string;
    markdownReport: string;
}

/**
 * PrintManager acts as the central spooler orchestrating Transports and Drivers.
 * UI integrations will interface primarily with this class.
 */
export class PrintManager extends EventEmitter<PrintManagerEvents> {
    private activeTransport?: IDeviceTransport;
    private activeDriver?: IPrinterDriver;
    private registeredDrivers: IPrinterDriver[] = [];

    private isPrinting: boolean = false;
    private readonly logger: DiagnosticLogger;

    constructor(logger?: DiagnosticLogger) {
        super();
        this.logger = logger ?? (() => {});
        this.registerDriver(new MarklifeDriver('auto'));
        this.registerDriver(new MarklifeDriver('legacy'));
        this.registerDriver(new NiimbotDriver());
        this.registerDriver(new CatPrinterDriver('standard'));
        this.registerDriver(new CatPrinterDriver('prefixed'));
        this.registerDriver(new CatPrinterMxw01Driver());
        this.registerDriver(new CatPrinterV5gDriver());
        this.registerDriver(new CatPrinterV5cDriver());
        this.registerDriver(new FunnyLxDriver());
        this.registerDriver(new PhomemoDqDriver());
        this.registerDriver(new PhomemoM110Driver());
        this.registerDriver(new PhomemoM02Driver());
        this.registerDriver(new PhomemoMSeriesDriver());
        this.registerDriver(new PhomemoP12Driver());
        this.registerDriver(new PhomemoM04Driver());
        this.registerDriver(new PhomemoTsplDriver());
        this.registerDriver(new OrgstaS001Driver());
        this.registerDriver(new PeriPageDriver());
        // Dummy is intentionally last because it accepts any virtual device.
        this.registerDriver(new DummyDriver());
    }

    /**
     * Register a new printer profile (Driver/Filter) into the system.
     */
    registerDriver(driver: IPrinterDriver) {
        this.registeredDrivers.push(driver);
    }

    /** Driver families a user can select when automatic detection is inconclusive. */
    getAvailableDriverChoices(): PrinterDriverChoice[] {
        return this.registeredDrivers
            .filter(driver => driver.driverType === 'hardware')
            .map(driver => ({ name: driver.name, modelCount: driver.supportedModels?.length ?? 0 }));
    }

    /**
     * Get a flattened list of all printer models explicitly supported by registered drivers.
     * This allows the UI to build a "Default Printer" selection without needing a hardcoded registry.
     */
    getAvailablePrinterProfiles(): PrinterModelProfile[] {
        const seen = new Set<string>();
        const uniqueProfiles: PrinterModelProfile[] = [];
        for (const driver of this.registeredDrivers) {
            for (const profile of driver.supportedModels || []) {
                if (!seen.has(profile.id)) {
                    seen.add(profile.id);
                    const mergedProfile: PrinterModelProfile = profile.connectionHints
                        ? profile
                        : driver.connectionHints
                        ? { ...profile, connectionHints: driver.connectionHints }
                        : profile;
                    uniqueProfiles.push(mergedProfile);
                }
            }
        }
        
        // Sort alphabetically by brand, then model
        return uniqueProfiles.sort((a, b) => {
            if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
            return a.model.localeCompare(b.model);
        });
    }

    /**
     * Finds a registered driver that explicitly supports the given model ID or model name.
     */
    getDriverForModel(modelId: string): IPrinterDriver | undefined {
        const idLower = modelId.toLowerCase();
        const cleanId = idLower.replace(/[^a-z0-9]/g, '');
        return this.registeredDrivers.find(driver =>
            driver.supportedModels?.some(m =>
                m.id.toLowerCase() === idLower ||
                m.id.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanId ||
                m.model.toLowerCase() === idLower ||
                m.model.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanId ||
                (m.aliases && m.aliases.some(alias => {
                    const aliasLower = alias.toLowerCase();
                    const cleanAlias = aliasLower.replace(/[^a-z0-9]/g, '');
                    return aliasLower.includes(idLower) ||
                        idLower.includes(aliasLower) ||
                        cleanAlias.includes(cleanId) ||
                        cleanId.includes(cleanAlias);
                }))
            )
        );
    }

    /**
     * Connects to a printer utilizing the provided transport.
     * The Manager aggregates connection requirements from all registered drivers
     * so that any supported printer can be discovered.
     */
    async connect(transport: IDeviceTransport, preferredDriverName?: string, modelId?: string): Promise<void> {
        if (this.activeTransport && this.activeTransport.isConnected()) {
            await this.disconnect();
        }

        this.activeTransport = transport;

        // Aggregate All Services from all drivers to request proper BLE permissions
        // and name prefixes for discovery hints
        const allServices = new Set<string>();
        const allPrefixes = new Set<string>();
        const preferredDriver = preferredDriverName
            ? this.registeredDrivers.find(driver => driver.name === preferredDriverName)
            : undefined;
        if (preferredDriverName && !preferredDriver) {
            throw new Error(`Unknown printer driver: ${preferredDriverName}`);
        }
        const discoveryDrivers = preferredDriver ? [preferredDriver] : this.registeredDrivers;
        for (const driver of discoveryDrivers) {
            for (const service of driver.connectionRequirements.services) {
                allServices.add(service);
            }
            if (driver.connectionRequirements.namePrefixes) {
                for (const prefix of driver.connectionRequirements.namePrefixes) {
                    allPrefixes.add(prefix);
                }
            }
        }

        const filters = [];
        if (allPrefixes.size > 0) {
            for (const prefix of allPrefixes) {
                filters.push({
                    namePrefix: prefix,
                    services: Array.from(allServices)
                });
            }
        } else {
            filters.push({
                services: Array.from(allServices)
            });
        }

        try {
            // Initiate connection prompt
            await this.activeTransport.connect(
                this.activeTransport.filterType === 'usb' ? undefined : filters
            );
            await this.bindDriver(preferredDriverName, modelId);
        } catch (error: any) {
            this.activeTransport = undefined;
            this.emit("error", error);
            throw error;
        }
    }

    /**
     * Like `connect()`, but the transport is already connected to a device.
     * Skips BLE scanning and goes straight to driver matching.
     *
     * Use this when you have manually called `transport.connectByDeviceId()` or
     * otherwise established the transport connection yourself.
     */
    async connectWithTransport(transport: IDeviceTransport, preferredDriverName?: string, modelId?: string): Promise<void> {
        if (!transport.isConnected()) {
            throw new Error("connectWithTransport() requires an already-connected transport.");
        }

        if (this.activeTransport && this.activeTransport.isConnected()) {
            await this.disconnect();
        }

        this.activeTransport = transport;

        try {
            await this.bindDriver(preferredDriverName, modelId);
        } catch (error: any) {
            this.activeTransport = undefined;
            this.emit("error", error);
            throw error;
        }
    }

    /** Internal: wire up event listeners and match a driver for the active transport. */
    private async bindDriver(preferredDriverName?: string, modelId?: string): Promise<void> {
        if (!this.activeTransport) throw new Error("No active transport.");

        this.activeTransport.on("disconnected", this.handleDisconnect);
        this.activeTransport.on("error", this.handleError);

        const deviceName = this.activeTransport.getDeviceName();
        this.logger('info', `[PrintManager] Device connected. Name: ${deviceName || 'Unknown'}`);

        if (preferredDriverName) {
            const preferred = this.registeredDrivers.find(driver => driver.name === preferredDriverName);
            if (!preferred) throw new Error(`Unknown printer driver: ${preferredDriverName}`);
            await this.bindMatchedDriver(preferred, modelId);
            return;
        }

        const nameMatches = deviceName
            ? this.registeredDrivers.filter(driver => driver.isCompatible(deviceName))
            : [];

        let serviceMatches: IPrinterDriver[] = [];
        if (this.activeTransport.getPrimaryServices) {
            try {
                const discoveredServices = await this.activeTransport.getPrimaryServices();
                const discovered = new Set(discoveredServices.map(normalizeUuid));
                serviceMatches = this.registeredDrivers.filter(driver =>
                    driver.connectionRequirements.services.some(service =>
                        discovered.has(normalizeUuid(service))));
            } catch (e) {
                this.logger('warn', `[PrintManager] Failed to discover services for matching: ${e}`);
            }
        }

        const modelDriver = (modelId && modelId !== 'none' && modelId !== 'unknown')
            ? this.getDriverForModel(modelId)
            : undefined;

        let matchedDriver = chooseDriver(nameMatches, serviceMatches, deviceName, modelDriver);

        if (!matchedDriver && modelDriver) {
            matchedDriver = modelDriver;
            this.logger('info', `[PrintManager] Device name/services inconclusive, matched driver by modelId '${modelId}': ${matchedDriver.name}`);
        }

        if (!matchedDriver) {
            // Fallback: If name is missing and only one hardware driver is registered, use it.
            const hardwareDrivers = this.registeredDrivers.filter(d => d.driverType === 'hardware');
            if (hardwareDrivers.length === 1) {
                const onlyDriver = hardwareDrivers[0];
                this.logger('info', `[PrintManager] Still no match, but only one hardware driver registered (${onlyDriver.name}). Using fallback.`);
                await this.bindMatchedDriver(onlyDriver, modelId);
                return;
            }
        }

        if (!matchedDriver) {
            throw new Error(`Connected to ${deviceName || 'Unknown device'} but no compatible driver was found. Please select your printer protocol manually.`);
        }

        await this.bindMatchedDriver(matchedDriver, modelId);
    }

    private async bindMatchedDriver(driver: IPrinterDriver, modelId?: string): Promise<void> {
        if (!this.activeTransport) throw new Error("No active transport.");
        if (modelId && driver.setModel) {
            driver.setModel(modelId);
        }
        this.activeDriver = driver;
        await driver.bindTransport(this.activeTransport);
        this.emit("connected", driver);
    }


    async disconnect(): Promise<void> {
        this.isPrinting = false;
        if (this.activeTransport) {
            try {
                await this.activeTransport.disconnect();
            } catch (e) {
                this.logger('warn', `[PrintManager] Error during transport disconnect: ${e}`);
            }
        }
        await this.handleDisconnect();
    }

    /**
     * Retrieves the capabilities of the currently connected printer.
     */
    getCapabilities() {
        if (!this.activeDriver) {
            throw new Error("No printer currently connected.");
        }
        return this.activeDriver.getCapabilities();
    }

    /**
     * Retrieves the connected device's name, if any.
     */
    public getConnectedDeviceName(): string | undefined {
        return this.activeTransport?.getDeviceName();
    }

    /**
     * What the active driver can report, without asking the printer.
     *
     * Empty when nothing is connected or the driver reports nothing — the same
     * answer, because a UI treats both the same way: show no status slots.
     */
    public getReportedFields(): readonly StatusField[] {
        return this.activeDriver?.reports ?? [];
    }

    /**
     * Read the connected printer's state, or `null` if this driver cannot ask.
     *
     * `null` rather than an empty status, so a caller can tell "this printer
     * says nothing" from "this printer says everything is fine". Failures of
     * the read itself surface as a thrown {@link PrinterError}.
     */
    public async getStatus(): Promise<PrinterStatus | null> {
        if (!this.activeDriver) {
            throw new PrinterError('not-connected', 'No printer currently connected.');
        }
        if (!this.activeDriver.getStatus) return null;
        try {
            return await this.activeDriver.getStatus();
        } catch (err) {
            throw toPrinterError(err, 'protocol');
        }
    }

    /** Let the active driver resolve manufacturer-specific media catalogue data. */
    public async resolveMedia(media: LoadedMedia): Promise<LoadedMedia> {
        if (!this.activeDriver) {
            throw new PrinterError('not-connected', 'No printer currently connected.');
        }
        return this.activeDriver.resolveMedia?.(media) ?? media;
    }

    /**
     * Probes an unknown or ambiguous connected device to discover its advertised
     * name, transport type, and GATT primary service UUIDs. Compares observations
     * against registered printer drivers, ranks candidates, and builds a preformatted
     * diagnostic report ready for developer escalation.
     */
    public async diagnoseDevice(transport: IDeviceTransport): Promise<DeviceDiagnostic> {
        if (!transport.isConnected()) {
            const allServices = new Set<string>();
            for (const driver of this.registeredDrivers) {
                for (const service of driver.connectionRequirements.services) {
                    allServices.add(service);
                }
            }
            await transport.connect(
                transport.filterType === 'usb' ? undefined : [{ services: Array.from(allServices) }]
            );
        }

        const deviceName = transport.getDeviceName();
        const transportType = transport.type;
        let discoveredServices: string[] = [];
        if (transport.getPrimaryServices) {
            try {
                discoveredServices = await transport.getPrimaryServices();
            } catch (e) {
                this.logger('warn', `[PrintManager] Failed to discover services during diagnosis: ${e}`);
            }
        }

        const normDiscovered = new Set(discoveredServices.map(normalizeUuid));
        const candidates: CandidateDriverInfo[] = [];
        const hardwareDrivers = this.registeredDrivers.filter(d => d.driverType === 'hardware');

        for (const driver of hardwareDrivers) {
            const reasons: string[] = [];
            let nameMatched = false;
            let serviceMatched = false;

            if (deviceName && driver.isCompatible(deviceName)) {
                nameMatched = true;
                reasons.push(`Device name "${deviceName}" matches driver pattern`);
            }

            const matchedServices = driver.connectionRequirements.services.filter(s =>
                normDiscovered.has(normalizeUuid(s))
            );
            if (matchedServices.length > 0) {
                serviceMatched = true;
                reasons.push(`Advertises service UUID (${matchedServices.join(', ')})`);
            }

            let prefixHint = false;
            if (!nameMatched && deviceName && driver.connectionRequirements.namePrefixes) {
                const upperName = deviceName.toUpperCase();
                for (const p of driver.connectionRequirements.namePrefixes) {
                    if (upperName.includes(p.toUpperCase()) || p.toUpperCase().includes(upperName)) {
                        prefixHint = true;
                        reasons.push(`Device name contains prefix clue "${p}"`);
                        break;
                    }
                }
            }

            if (nameMatched || serviceMatched || prefixHint) {
                const matchedBy = (nameMatched && serviceMatched)
                    ? 'both'
                    : nameMatched
                    ? 'name'
                    : serviceMatched
                    ? 'service'
                    : 'prefix-hint';
                candidates.push({
                    driverName: driver.name,
                    matchedBy,
                    reasons,
                    supportedModels: driver.supportedModels || []
                });
            }
        }

        const rank = (c: CandidateDriverInfo) => {
            if (c.matchedBy === 'both') return 3;
            if (c.matchedBy === 'name') return 2;
            if (c.matchedBy === 'service') return 1;
            return 0;
        };
        candidates.sort((a, b) => rank(b) - rank(a));

        const suggestedDriver = candidates.length > 0 ? candidates[0].driverName : undefined;

        const reportLines: string[] = [
            '### OpenTLP Hardware Diagnostic Report',
            '',
            `- **Device Name**: \`${deviceName || 'Unknown / Unreported'}\``,
            `- **Transport**: \`${transportType}\``,
            `- **Discovered Services**: ${discoveredServices.length > 0 ? discoveredServices.map(s => `\`${s}\``).join(', ') : 'None reported / Not available'}`,
            '',
            '#### Candidate Drivers',
        ];

        if (candidates.length === 0) {
            reportLines.push('- No standard driver matched by advertised name or primary services.');
        } else {
            for (const c of candidates) {
                reportLines.push(`- **${c.driverName}** (matched by: ${c.matchedBy})`);
                for (const r of c.reasons) {
                    reportLines.push(`  - ${r}`);
                }
            }
        }

        const markdownReport = reportLines.join('\n');

        return {
            deviceName,
            transportType,
            discoveredServices,
            candidates,
            suggestedDriver,
            markdownReport
        };
    }


    /**
     * Commences a print job, handing the page over to the matched driver.
     *
     * Enforces the contract `printPage` relies on: the page arrives carrying no
     * more planes than the driver declared it accepts. Callers are expected to
     * have rasterised against the same budget (that is where 'merge' and 'drop'
     * are actually applied, while there is still a design to re-render); the
     * reduction here is the guarantee that a caller which did not cannot reach
     * the driver with a page it has no way to handle.
     *
     * @param page Separated planes or a full-gamut bitmap, with dimensions.
     * @param options Printing options like density and label type
     */
    async print(page: UniversalPage, options: UniversalPrintOptions): Promise<void> {
        if (!this.activeDriver) {
            throw new Error("Cannot print, no active printer driver.");
        }

        if (this.isPrinting) {
            throw new Error("Printer is currently busy.");
        }

        const channels = this.activeDriver.getCapabilities().colorSupport.channels ?? 1;
        const forDriver = reduceToChannels(page, channels);

        this.isPrinting = true;
        this.emit("printing");

        try {
            await this.activeDriver.printInit(options);
            await this.activeDriver.printPage(forDriver);
            await this.activeDriver.printEnd();
        } catch (error: any) {
            this.emit("error", error);
            throw error;
        } finally {
            this.isPrinting = false;
            this.emit("idle");
        }
    }

    private handleDisconnect = async () => {
        this.isPrinting = false;
        if (this.activeDriver) {
            try {
                await this.activeDriver.unbindTransport();
            } catch (e) {
                this.logger('warn', `[PrintManager] Error during driver unbindTransport: ${e}`);
            }
            this.activeDriver = undefined;
        }
        this.activeTransport?.removeAllListeners();
        this.activeTransport = undefined;
        this.emit("disconnected");
    }

    private handleError = (err: Error) => {
        this.emit("error", err);
    }
}

/** Bluetooth UUIDs compare by value, not by the spelling returned by a stack. */
function normalizeUuid(uuid: string): string {
    const clean = uuid.toLowerCase().replace(/-/g, '');
    if (clean.length === 4) return `0000${clean}00001000800000805f9b34fb`;
    if (clean.length === 8) return `${clean}00001000800000805f9b34fb`;
    return clean;
}

/**
 * Select only when the observations identify one driver.
 *
 * A name is useful but not authoritative: `Printer` is used by unrelated
 * ESC/POS and vendor-specific devices. A service is useful but not
 * authoritative either: common vendor services are shared by unrelated devices.
 * Their intersection is strong; either signal on its own is accepted only when
 * it names exactly one driver. Registration order must never decide which wire
 * protocol receives a print job.
 *
 * When an explicit `modelDriver` is provided (e.g. user selected their printer model),
 * it serves as the tiebreaker when multiple drivers match an ambiguous name or service.
 */
function chooseDriver(
    nameMatches: IPrinterDriver[],
    serviceMatches: IPrinterDriver[],
    deviceName?: string,
    modelDriver?: IPrinterDriver
): IPrinterDriver | undefined {
    if (nameMatches.length && serviceMatches.length) {
        const services = new Set(serviceMatches);
        const intersection = nameMatches.filter(driver => services.has(driver));
        if (intersection.length === 1) return intersection[0];
        if (intersection.length > 1) {
            if (modelDriver && intersection.includes(modelDriver)) {
                return modelDriver;
            }
            throw ambiguousDriverError(deviceName, intersection);
        }
        // A readable, specific name is more useful than a generic service list
        // which may include only the services the platform allowed us to see.
        if (nameMatches.length === 1) return nameMatches[0];
        if (modelDriver && nameMatches.includes(modelDriver)) {
            return modelDriver;
        }
        throw ambiguousDriverError(deviceName, nameMatches);
    }
    if (nameMatches.length === 1) return nameMatches[0];
    if (nameMatches.length > 1) {
        if (modelDriver && nameMatches.includes(modelDriver)) {
            return modelDriver;
        }
        throw ambiguousDriverError(deviceName, nameMatches);
    }
    if (serviceMatches.length === 1) return serviceMatches[0];
    if (serviceMatches.length > 1) {
        if (modelDriver && serviceMatches.includes(modelDriver)) {
            return modelDriver;
        }
        throw ambiguousDriverError(deviceName, serviceMatches);
    }
    if (modelDriver) {
        return modelDriver;
    }
    return undefined;
}

function ambiguousDriverError(deviceName: string | undefined, drivers: IPrinterDriver[]): Error {
    const candidates = [...new Set(drivers.map(driver => driver.name))].join(', ');
    return new Error(
        `Connected to ${deviceName || 'Unknown device'}, but its name and services match multiple drivers: ` +
        `${candidates}. Select the exact printer model instead of guessing the protocol.`
    );
}
