<script lang="ts">
    /**
     * Printer connection UI.
     *
     * Users think in terms of:
     * 1. Which printer they have (e.g. Marklife P12, Munbyn L13, or Automatic).
     * 2. Wireless (Bluetooth) vs Wired (USB).
     *
     * Transports are visually classified into:
     * - (Recommended): highlighted, primary choice for that platform.
     * - Alternative: requires extra manual steps (e.g. OS Bluetooth pairing).
     * - Discouraged: known broken on the platform (e.g. Web Bluetooth on Linux),
     *   greyed out, with an explicit warning and a "Proceed anyway" prompt.
     */
    import { fromStore } from 'svelte/store';
    import { onDestroy, untrack } from 'svelte';
    import { PrinterSession, DUMMY_PROFILES } from '../printer/session';
    import type { TransportOption } from '../printer/transports';
    import PrinterMark from './PrinterMark.svelte';
    import PrinterStatusView from './PrinterStatusView.svelte';
    import Icon from './Icon.svelte';
    import { artworkForDevice } from '../data/artwork';
    import { toPrinterError, type DeviceDiagnostic, type IDeviceTransport } from 'universal-label-core';
    import { errorText, canRetry } from '../printer/messages';
    import { globalSettings as settings, PRINTER_PROFILES } from '../stores/settings.svelte';
    import PrinterModelPicker from './PrinterModelPicker.svelte';
    import {
        detectPlatform,
        getTransportGuidance,
        resolvePrinterProfile,
        type GuidanceTier,
        type PlatformInfo
    } from '../printer/connection-guide';
    import type { DiagnosticReportContext } from '../reporting/report';

    interface Props {
        session: PrinterSession;
        transports: TransportOption[];
        showModelBar?: boolean;
        onreportmissing?: (context?: DiagnosticReportContext) => void;
    }
    let { session, transports, showModelBar = true, onreportmissing }: Props = $props();

    // svelte-ignore state_referenced_locally -- session identity is stable.
    const printer = fromStore(session);
    let dummyProfileIdx = $state(0);
    let driverOverride = $state('');
    let connectError = $state('');
    let refreshing = $state(false);
    let busyId = $state<string | null>(null);
    let lastTransportId = $state<string | null>(null);
    let lastTransportType = $state<string | null>(null);

    let diagnosticResult = $state<DeviceDiagnostic | null>(null);
    let diagnosticTransport = $state<IDeviceTransport | null>(null);
    let isDiagnosing = $state(false);

    let isPickingPrinter = $state(false);
    const platform: PlatformInfo = detectPlatform();
    let allowedAnyway = $state<Record<string, boolean>>({});

    onDestroy(() => {
        const transport = diagnosticTransport;
        diagnosticTransport = null;
        if (transport?.isConnected()) {
            void transport.disconnect().catch(() => {
                // Best effort during teardown; there is no UI left to report into.
            });
        }
    });

    const selectedPrinterModel = $derived(settings.defaultPrinter || '');

    const currentModelProfile = $derived(
        resolvePrinterProfile(selectedPrinterModel) ?? PRINTER_PROFILES.find(p => p.id === selectedPrinterModel)
    );
    const modelReady = $derived(!!selectedPrinterModel && selectedPrinterModel !== 'none');

    function chooseModel(id: string): void {
        settings.defaultPrinter = id;
        settings.save();
        isPickingPrinter = false;
    }

    const visibleTransports = $derived.by(() => {
        return transports.filter(t => {
            if (t.isDummy || t.id === 'dummy') {
                return settings.showVirtualPrinter;
            }
            return true;
        });
    });

    const sortedTransports = $derived.by(() => {
        const tierRank: Record<GuidanceTier, number> = {
            recommended: 0,
            alternative: 1,
            discouraged: 2
        };
        return [...visibleTransports].sort((a, b) => {
            if (a.available !== b.available) {
                return a.available ? -1 : 1;
            }
            const guideA = getTransportGuidance(a.id, platform, currentModelProfile || selectedPrinterModel, a.available);
            const guideB = getTransportGuidance(b.id, platform, currentModelProfile || selectedPrinterModel, b.available);
            const rankDiff = tierRank[guideA.tier] - tierRank[guideB.tier];
            if (rankDiff !== 0) return rankDiff;
            return 0;
        });
    });

    async function closeDiagnostics(): Promise<void> {
        if (diagnosticTransport && diagnosticTransport.isConnected()) {
            try {
                await diagnosticTransport.disconnect();
            } catch (e) {
                console.warn('Error disconnecting diagnostic transport:', e);
            }
        }
        diagnosticTransport = null;
        diagnosticResult = null;
    }

    async function tryDriverWithDiagnostic(driverName: string): Promise<void> {
        if (!diagnosticTransport) return;
        connectError = '';
        busyId = 'diagnostic-connect';
        try {
            const transport = diagnosticTransport;
            diagnosticResult = null;
            diagnosticTransport = null;
            await session.connectWithTransport(
                transport,
                driverName,
                selectedPrinterModel || undefined,
                lastTransportId ?? transport.type
            );
            if (selectedPrinterModel.startsWith('auto:')) {
                const detected = session.getActiveModelProfile();
                if (detected && detected.id && !detected.id.startsWith('auto:')) {
                    settings.defaultPrinter = detected.id;
                    settings.save();
                }
            }
        } catch (err) {
            const e = toPrinterError(err);
            connectError = errorText(e);
        } finally {
            busyId = null;
        }
    }

    async function runDiagnostics(option?: TransportOption): Promise<void> {
        const targetOption = option ?? transports.find(t => t.id === lastTransportId) ?? transports[0];
        if (!targetOption) return;
        connectError = '';
        isDiagnosing = true;
        busyId = 'diagnose';
        try {
            const transport = targetOption.create();
            lastTransportId = targetOption.id;
            lastTransportType = transport.type;
            const result = await session.diagnose(transport);
            diagnosticTransport = transport;
            diagnosticResult = result;
        } catch (err) {
            const e = toPrinterError(err);
            connectError = e.code === 'cancelled' ? '' : errorText(e);
        } finally {
            isDiagnosing = false;
            busyId = null;
        }
    }

    function reportMissing(whatHappened: string, includeDiagnostic = false): void {
        const result = includeDiagnostic ? diagnosticResult : null;
        onreportmissing?.({
            advertisedName: result?.deviceName ?? snap.status?.identity.deviceName ?? snap.deviceName,
            firmwareVersion: snap.status?.identity.firmwareVersion,
            hardwareVersion: snap.status?.identity.hardwareVersion,
            transportKind: lastTransportId ?? snap.transportKind,
            transportType: result?.transportType ?? lastTransportType ?? snap.transportType,
            driverName: result?.suggestedDriver ?? (driverOverride || snap.driverName),
            whatHappened,
            serviceUuids: result?.discoveredServices ?? snap.serviceUuids ?? [],
            candidateDrivers: result?.candidates.map(candidate => ({
                name: candidate.driverName,
                matchedBy: candidate.matchedBy
            })) ?? []
        });
    }

    async function connect(option: TransportOption): Promise<void> {
        if (!modelReady) {
            connectError = 'Choose your exact printer model first, or use Unknown / Not in list for a safe diagnostic probe.';
            return;
        }
        connectError = '';
        busyId = option.id;
        lastTransportId = option.id;
        const transport = option.create();
        lastTransportType = transport.type;

        if (selectedPrinterModel === 'unknown') {
            isDiagnosing = true;
            try {
                const result = await session.diagnose(transport);
                diagnosticTransport = transport;
                diagnosticResult = result;
            } catch (err) {
                const e = toPrinterError(err);
                connectError = e.code === 'cancelled' ? '' : errorText(e);
            } finally {
                isDiagnosing = false;
                busyId = null;
            }
            return;
        }

        try {
            await session.connect(
                transport,
                option.isDummy ? DUMMY_PROFILES[dummyProfileIdx] : undefined,
                option.isDummy ? undefined : driverOverride || undefined,
                option.isDummy ? undefined : selectedPrinterModel || undefined,
                option.id
            );
            if (selectedPrinterModel.startsWith('auto:')) {
                const detected = session.getActiveModelProfile();
                if (detected && detected.id && !detected.id.startsWith('auto:')) {
                    settings.defaultPrinter = detected.id;
                    settings.save();
                }
            }
        } catch (err) {
            const e = toPrinterError(err);
            // Cancelling the device chooser is a choice, not a failure. Showing
            // it in red is how an app teaches people that pressing Escape broke
            // something.
            connectError = e.code === 'cancelled' ? '' : errorText(e);
        } finally {
            busyId = null;
        }
    }

    async function disconnect(): Promise<void> {
        connectError = '';
        try {
            await session.disconnect();
        } catch (err) {
            connectError = errorText(toPrinterError(err));
        }
    }

    async function refresh(): Promise<void> {
        refreshing = true;
        try {
            await session.refreshStatus();
        } finally {
            refreshing = false;
        }
    }

    const snap = $derived(printer.current);

    // Clear stale errors when the connection state transitions.
    $effect(() => {
        if (snap.state === 'connected') connectError = '';
    });

    const driverChoices = untrack(() => session.getDriverChoices());

    /**
     * The drawing for what actually answered, once something has. Deliberately
     * not shown while choosing a transport: at that point nobody knows which
     * printer is on the other end, and a picture of one would be a guess
     * dressed up as information.
     */
    const artwork = $derived(artworkForDevice(snap.deviceName, snap.capabilities?.driverName));
</script>

<div class="panel">
    {#if snap.state === 'disconnected' || snap.state === 'connecting'}
        {#if showModelBar}
            <!-- Printer Model Bar & Searchable Visual Picker -->
            <div class="printer-model-bar">
                <div class="model-summary">
                    <span class="model-icon"><Icon name="printer" size={20} /></span>
                    <div class="model-info">
                        <span class="model-label">{currentModelProfile?.app ? `App: ${currentModelProfile.app}` : 'Your printer model'}</span>
                        <strong class="model-name">
                            {#if currentModelProfile}
                                {currentModelProfile.rebadgeOnly ? `${currentModelProfile.brand}-compatible` : currentModelProfile.brand} {currentModelProfile.model}
                            {:else if selectedPrinterModel === 'unknown'}
                                Unknown / Not in list (Diagnostic mode)
                            {:else}
                                Select companion app &amp; model
                            {/if}
                        </strong>
                    </div>
                </div>
                <button
                    type="button"
                    class="ghost toggle-picker-btn"
                    onclick={() => (isPickingPrinter = !isPickingPrinter)}
                    disabled={snap.state === 'connecting' || isDiagnosing}
                >
                    {isPickingPrinter ? 'Done' : (!selectedPrinterModel || selectedPrinterModel === 'none' ? 'Choose model' : 'Change model')}
                </button>
            </div>

            {#if isPickingPrinter || (!selectedPrinterModel || selectedPrinterModel === 'none')}
                <div class="picker-dropdown-panel">
                    <PrinterModelPicker
                        selectedId={selectedPrinterModel}
                        onselect={chooseModel}
                    />
                </div>
            {/if}
        {/if}

        <div class="model-safety" role="note">
            <Icon name="info" size={17} />
            <div>
                <strong>Choose the exact model before connecting</strong>
                <span>OpenTLP uses it to select the right command set. Similar-looking printers can use incompatible feed or heat commands, which may stress the mechanism. If you are unsure, choose <em>Unknown / Not in list</em> so Studio probes without printing.</span>
            </div>
        </div>

        {#if diagnosticResult}
            <div class="diagnostic-panel">
                <div class="diagnostic-header">
                    <div class="diagnostic-title">
                        <span class="diagnostic-icon"><Icon name="info" size={18} /></span>
                        <strong>Hardware Diagnostic Findings</strong>
                    </div>
                    <button type="button" class="ghost close-btn" onclick={closeDiagnostics}>Close</button>
                </div>

                <div class="diagnostic-facts">
                    <div class="fact-item">
                        <span class="fact-label">Advertised name:</span>
                        <code class="fact-value">{diagnosticResult.deviceName || 'Unknown / Unreported'}</code>
                    </div>
                    <div class="fact-item">
                        <span class="fact-label">Transport type:</span>
                        <span class="fact-value">{diagnosticResult.transportType}</span>
                    </div>
                    <div class="fact-item">
                        <span class="fact-label">Primary services:</span>
                        {#if diagnosticResult.discoveredServices.length > 0}
                            <div class="service-list">
                                {#each diagnosticResult.discoveredServices as s}
                                    <code>{s}</code>
                                {/each}
                            </div>
                        {:else}
                            <span class="fact-value muted">None discovered or not accessible</span>
                        {/if}
                    </div>
                </div>

                <!-- Clues / Candidate Drivers -->
                <div class="diagnostic-section">
                    <span class="section-title">Driver Clues &amp; Recommendations</span>
                    {#if diagnosticResult.candidates.length > 0}
                        <div class="candidates-list">
                            {#each diagnosticResult.candidates as candidate}
                                <div class="candidate-card">
                                    <div class="candidate-info">
                                        <div class="candidate-title-line">
                                            <strong class="candidate-name">{candidate.driverName}</strong>
                                            <span class="candidate-match">matched by: {candidate.matchedBy}</span>
                                        </div>
                                        <ul class="candidate-reasons">
                                            {#each candidate.reasons as reason}
                                                <li>{reason}</li>
                                            {/each}
                                        </ul>
                                    </div>
                                    <button
                                        type="button"
                                        class="primary try-driver-btn"
                                        onclick={() => tryDriverWithDiagnostic(candidate.driverName)}
                                        disabled={busyId !== null}
                                    >
                                        {busyId === 'diagnostic-connect' ? 'Connecting…' : `Try ${candidate.driverName}`}
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <p class="no-candidates">
                            No standard driver matched the advertised name or service UUIDs directly.
                            You can force a driver family using the protocol override below.
                        </p>
                    {/if}
                </div>

                <!-- The guided reporter owns privacy review and GitHub formatting. -->
                <div class="diagnostic-section">
                    <span class="section-title">Share with OpenTLP</span>
                    <p class="escalate-desc">
                        The guided report fills the name, service UUIDs and candidate drivers above
                        automatically. You can remove any of them before opening GitHub.
                    </p>
                    {#if onreportmissing}
                        <button type="button" class="primary diagnostic-report-btn" onclick={() => reportMissing('Studio probed the printer but did not identify a confirmed working driver.', true)}>
                            <Icon name="flag" size={15} /> Review privacy-safe report
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        <details class="advanced-protocol">
            <summary>Advanced: protocol override ({driverOverride || 'Automatic'})</summary>
            <div class="protocol-content">
                <label>
                    <span>Force driver family:</span>
                    <select bind:value={driverOverride} disabled={snap.state === 'connecting' || isDiagnosing}>
                        <option value="">Automatic (Auto-detect by device name)</option>
                        {#each driverChoices as driver (driver.name)}
                            <option value={driver.name}>{driver.name}</option>
                        {/each}
                    </select>
                </label>
                <small class="desc">Only change if your printer is an unbranded rebadge that needs a specific driver.</small>
            </div>
        </details>

        <div class="options">
            {#each sortedTransports as option (option.id)}
                {@const guidance = getTransportGuidance(option.id, platform, currentModelProfile || selectedPrinterModel, option.available)}
                {@const isDiscouraged = guidance.tier === 'discouraged'}
                {@const isUnlocked = !isDiscouraged || allowedAnyway[option.id]}
                <div
                    class="option"
                    class:tier-recommended={guidance.tier === 'recommended'}
                    class:tier-alternative={guidance.tier === 'alternative'}
                    class:tier-discouraged={isDiscouraged}
                    class:disabled={!option.available}
                >
                    <div class="row">
                        <div class="text">
                            <div class="title-line">
                                <strong>{option.label}</strong>
                                <span class="badge badge-{guidance.tier}">{guidance.badge}</span>
                            </div>
                            {#if option.description}<span class="desc">{option.description}</span>{/if}
                            {#if !option.available && option.unavailableReason}
                                <span class="desc warn">{option.unavailableReason}</span>
                            {/if}
                            {#if option.isDummy}
                                <label class="profile">
                                    Simulate:
                                    <select
                                        onchange={e => (dummyProfileIdx = Number(e.currentTarget.value))}
                                    >
                                        {#each DUMMY_PROFILES as p, i (p.label)}
                                            <option value={i} selected={i === dummyProfileIdx}>{p.label}</option>
                                        {/each}
                                    </select>
                                </label>
                            {/if}
                        </div>
                        {#if isDiscouraged && !isUnlocked}
                            <button
                                type="button"
                                class="warn-btn"
                                onclick={() => (allowedAnyway[option.id] = true)}
                                title="Not recommended on {platform.osName}"
                            >
                                Proceed anyway
                            </button>
                        {:else}
                            <button
                                class="primary"
                                class:discouraged-btn={isDiscouraged}
                                disabled={!option.available || !modelReady || snap.state === 'connecting' || isDiagnosing}
                                onclick={() => connect(option)}
                            >
                                {#if busyId === option.id && isDiagnosing}
                                    Probing device…
                                {:else if busyId === option.id && snap.state === 'connecting'}
                                    Connecting…
                                {:else if selectedPrinterModel === 'unknown'}
                                    Probe &amp; Diagnose
                                {:else if !modelReady}
                                    Choose printer first
                                {:else if isDiscouraged}
                                    Connect anyway
                                {:else}
                                    Connect
                                {/if}
                            </button>
                        {/if}
                    </div>

                    <!-- Prominent warnings (e.g. Do NOT pair in OS Bluetooth menu for Web Bluetooth) -->
                    {#if guidance.warning}
                        <div class="guidance-warning">
                            <strong>Note:</strong> {guidance.warning}
                        </div>
                    {/if}

                    <!-- Discouraged explanation banner -->
                    {#if isDiscouraged && guidance.discouragedReason}
                        <div class="guidance-discouraged-note">
                            ⚠️ {guidance.discouragedReason}
                        </div>
                    {/if}

                    <!-- USB Cable connection guidance -->
                    {#if guidance.usbHint}
                        <div class="guidance-usb-note">
                            <span class="note-label">🔌 USB Cable:</span> {guidance.usbHint}
                        </div>
                    {/if}

                    <!-- Step-by-step instructions (e.g. for Bluetooth Serial / Classic) -->
                    {#if guidance.steps && guidance.steps.length > 0}
                        <div class="guidance-steps">
                            <strong>📶 Bluetooth setup steps for {platform.osName}:</strong>
                            <ol>
                                {#each guidance.steps as step}
                                    <li>{step}</li>
                                {/each}
                            </ol>
                        </div>
                    {:else if guidance.hints}
                        <div class="guidance-hint">{guidance.hints}</div>
                    {/if}

                    <!-- One-time setup / driver help (e.g. Zadig for WebUSB on Windows) -->
                    {#if option.help}
                        <details class="setup-help">
                            <summary>{option.help.summary}</summary>
                            <ol>
                                {#each option.help.steps as step}
                                    <li>{@html step}</li>
                                {/each}
                            </ol>
                            {#if option.help.link}
                                <a class="desc" href={option.help.link.url} target="_blank" rel="noopener noreferrer">
                                    {option.help.link.label}
                                </a>
                            {/if}
                        </details>
                    {/if}
                </div>
            {/each}
        </div>
        {#if onreportmissing}
            <button type="button" class="missing-printer" onclick={() => reportMissing('My printer model is not listed in OpenTLP Studio.')}>
                <Icon name="flag" size={14} /> My printer is missing
            </button>
        {/if}
    {:else}
        <div class="connected">
            {#if artwork}
                <!-- Blue is "connected" on this hardware, per the driver, so
                     the drawing shows the same light the machine on the desk
                     is showing. -->
                <PrinterMark
                    {artwork}
                    size={76}
                    led={artwork.ledStates?.blue ? 'blue' : 'off'}
                    strokePx={0.8}
                    hoverAnimation
                />
            {:else}
                <span class="mark-fallback"><Icon name="printer" size={24} /></span>
            {/if}
            <div class="text">
                <strong>{snap.deviceName ?? 'Unknown device'}</strong>
                {#if snap.capabilities}
                    <span class="desc">
                        {snap.capabilities.driverName ?? 'driver'} ·
                        {snap.capabilities.canvasHeightPx}px head ·
                        {snap.capabilities.dpmm} dpmm ·
                        density 1–{snap.capabilities.maxDensity}
                    </span>
                {/if}
                <PrinterStatusView status={snap.status} reports={snap.reports} />
            </div>
            <div class="actions">
                {#if snap.reports.length}
                    <!-- Battery and media go stale; identity does not. Offered
                         only where the driver can answer at all. -->
                    <button class="ghost" onclick={refresh} disabled={refreshing}>
                        {refreshing ? 'Reading…' : 'Refresh'}
                    </button>
                {/if}
                <button onclick={disconnect}>{snap.state === 'printing' ? 'Cancel / Disconnect' : 'Disconnect'}</button>
            </div>
        </div>
    {/if}

    {#if connectError || snap.lastError}
        <div class="error">
            <span class="error-msg">{connectError || (snap.lastError ? errorText(snap.lastError) : '')}</span>
            <div class="error-actions">
                {#if snap.lastError && canRetry(snap.lastError) && snap.state === 'disconnected'}
                    <!-- Offered from the error's own `retryable`, so a retry never
                         appears on something retrying cannot fix. -->
                    <button class="ghost" onclick={() => {
                        const last = transports.find(t => t.id === lastTransportId);
                        connect(last ?? transports[0]);
                    }}>Try again</button>
                {/if}
                <button class="ghost" onclick={() => runDiagnostics()}>Run diagnostics</button>
                {#if onreportmissing}
                    <button class="ghost" onclick={() => reportMissing('OpenTLP Studio could not connect to my printer using the selected connection method.')}>Report this connection problem</button>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .printer-model-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 3px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .model-summary {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }
    .model-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--accent);
        flex-shrink: 0;
    }
    .model-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .model-label {
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .model-name {
        font-size: 13px;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .toggle-picker-btn {
        flex-shrink: 0;
        font-size: 12px;
        padding: 4px 10px;
    }
    .picker-dropdown-panel {
        padding: 12px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 3px;
        max-height: 420px;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .model-safety {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        padding: 9px 11px;
        border-left: 3px solid var(--warn, #b35900);
        background: color-mix(in srgb, var(--warn, #b35900) 7%, var(--panel));
        color: var(--text);
        font-size: 12px;
        line-height: 1.4;
    }
    .model-safety :global(.icon) { flex: none; margin-top: 1px; color: var(--warn, #b35900); }
    .model-safety strong { display: block; margin-bottom: 2px; }
    .model-safety span { color: var(--muted); }
    .advanced-protocol summary {
        font-size: 11px;
        color: var(--muted);
        cursor: pointer;
        user-select: none;
        padding: 2px 4px;
    }
    .advanced-protocol summary:hover {
        color: var(--text);
    }
    .protocol-content {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 6px;
        padding: 8px 10px;
        background: var(--panel-2);
        border-radius: 2px;
    }
    .protocol-content label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
    }
    .options {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .missing-printer {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        width: fit-content;
        padding: 4px 2px;
        border: 0;
        background: transparent;
        color: var(--muted);
        box-shadow: none;
        font-size: 12px;
        cursor: pointer;
    }
    .missing-printer:hover {
        color: var(--accent);
        transform: none;
        box-shadow: none;
    }
    .option {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--panel);
        border-radius: 3px;
        border: 1px solid var(--border);
        transition: opacity 0.15s ease, border-color 0.15s ease;
    }
    .option.tier-recommended {
        border-left: 3px solid var(--accent, #0f5c9c);
    }
    .option.tier-discouraged {
        opacity: 0.65;
        border-style: dashed;
        background: color-mix(in srgb, var(--panel) 80%, transparent);
    }
    .option.tier-discouraged:hover,
    .option.tier-discouraged:focus-within {
        opacity: 0.95;
    }
    .option .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .title-line {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    .badge {
        display: inline-block;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 600;
        border-radius: 2px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        line-height: 1.2;
    }
    .badge-recommended {
        background: color-mix(in srgb, var(--accent, #0f5c9c) 14%, transparent);
        color: var(--accent, #0f5c9c);
        border: 1px solid color-mix(in srgb, var(--accent, #0f5c9c) 30%, transparent);
    }
    .badge-alternative {
        background: var(--panel-2);
        color: var(--muted);
        border: 1px solid var(--border);
    }
    .badge-discouraged {
        background: color-mix(in srgb, var(--warn, #b35900) 15%, transparent);
        color: var(--warn, #b35900);
        border: 1px solid color-mix(in srgb, var(--warn, #b35900) 35%, transparent);
    }
    .guidance-warning {
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.4;
        border-radius: 2px;
        background: color-mix(in srgb, var(--warn, #e67e22) 12%, var(--panel));
        border-left: 3px solid var(--warn, #e67e22);
        color: var(--text);
    }
    .guidance-discouraged-note {
        padding: 6px 10px;
        font-size: 12px;
        line-height: 1.4;
        border-radius: 2px;
        background: color-mix(in srgb, var(--danger, #e74c3c) 10%, var(--panel));
        border-left: 3px solid var(--danger, #e74c3c);
        color: var(--text);
    }
    .guidance-usb-note {
        padding: 7px 10px;
        font-size: 12px;
        line-height: 1.45;
        background: var(--panel-2);
        border-radius: 2px;
        border: 1px solid var(--border);
        color: var(--text);
    }
    .guidance-usb-note .note-label {
        font-weight: 600;
    }
    .guidance-steps {
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.45;
        background: var(--panel-2);
        border-radius: 2px;
        border: 1px solid var(--border);
        color: var(--text);
    }
    .guidance-steps ol {
        margin: 6px 0 2px;
        padding-left: 18px;
    }
    .guidance-steps li + li {
        margin-top: 4px;
    }
    .guidance-hint {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.4;
    }
    .warn-btn {
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        border-radius: 2px;
        background: transparent;
        border: 1px solid var(--warn, #b35900);
        color: var(--warn, #b35900);
        cursor: pointer;
        white-space: nowrap;
    }
    .warn-btn:hover {
        background: color-mix(in srgb, var(--warn, #b35900) 14%, transparent);
    }
    .discouraged-btn {
        background: var(--muted) !important;
    }
    .connected {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px;
        background: var(--panel);
        border-radius: 2px;
    }
    .option.disabled {
        opacity: 0.5;
    }
    .text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }
    .connected .text {
        flex: 1;
    }
    .mark-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        flex: none;
        color: var(--muted);
    }
    .desc {
        color: var(--muted);
        font-size: 12px;
    }
    .desc.warn {
        color: var(--warn);
    }
    .profile {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        margin-top: 4px;
    }
    .setup-help {
        border-top: 1px solid var(--border);
        padding-top: 6px;
    }
    .setup-help summary {
        font-size: 12px;
        color: var(--muted);
        cursor: pointer;
        user-select: none;
    }
    .setup-help summary:hover {
        color: var(--text);
    }
    .setup-help ol {
        margin: 8px 0 4px;
        padding-left: 20px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
    }
    .setup-help li + li {
        margin-top: 4px;
    }
    .setup-help a {
        display: inline-block;
        margin-top: 4px;
    }
    .error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: var(--danger);
        font-size: 13px;
        padding: 6px 10px;
        background: var(--panel);
        border-radius: 2px;
    }
    .diagnostic-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        background: var(--panel-2);
        border: 1px solid var(--accent);
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }
    .diagnostic-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 8px;
    }
    .diagnostic-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text);
        font-size: 14px;
    }
    .diagnostic-icon {
        display: inline-flex;
        color: var(--accent);
    }
    .close-btn {
        padding: 2px 8px;
        font-size: 11px;
    }
    .diagnostic-facts {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
    }
    .fact-item {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
    }
    .fact-label {
        color: var(--muted);
        min-width: 120px;
        font-weight: 500;
    }
    .fact-value {
        color: var(--text);
    }
    .service-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .diagnostic-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-top: 1px solid var(--border);
        padding-top: 10px;
    }
    .section-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .candidates-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .candidate-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 2px;
    }
    .candidate-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
    .candidate-title-line {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .candidate-name {
        font-size: 13px;
        color: var(--text);
    }
    .candidate-match {
        font-size: 11px;
        color: var(--accent);
        font-weight: 500;
    }
    .candidate-reasons {
        margin: 0;
        padding-left: 16px;
        font-size: 11px;
        color: var(--muted);
    }
    .try-driver-btn {
        flex-shrink: 0;
        font-size: 12px;
        padding: 5px 12px;
    }
    .no-candidates {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
    }
    .escalate-desc {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
    }
    .diagnostic-report-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: fit-content;
        font-size: 12px;
        padding: 7px 11px;
    }
    .error-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }
    .error-msg {
        flex: 1;
        min-width: 0;
    }
    .actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: none;
    }
    @media (max-width: 520px) {
        .option .row,
        .connected,
        .printer-model-bar {
            align-items: flex-start;
            flex-wrap: wrap;
        }
        .option .row .text { flex: 1 1 190px; }
        .connected .text { flex: 1 1 calc(100% - 90px); }
        .actions {
            width: 100%;
            justify-content: flex-end;
        }
    }
</style>
