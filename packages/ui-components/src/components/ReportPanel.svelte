<script lang="ts">
    import { fromStore } from 'svelte/store';
    import type { PrinterSession } from '../printer/session';
    import { globalSettings as settings, PRINTER_PROFILES } from '../stores/settings.svelte';
    import Icon from './Icon.svelte';
    import {
        buildGitHubIssueUrl,
        buildReportMarkdown,
        collectCoarseEnvironment,
        collectWebCapabilities,
        type AutomaticDiagnostics,
        type DiagnosticReportContext,
        type HumanDetails,
        type PrintReportContext,
        type ReportKind
    } from '../reporting/report';

    interface Props {
        kind: ReportKind;
        session: PrinterSession;
        build?: string;
        runtime?: string;
        printContext?: PrintReportContext;
        diagnosticContext?: DiagnosticReportContext;
        onkindchange?: (kind: ReportKind) => void;
    }

    let {
        kind,
        session,
        build = 'development',
        runtime = 'web',
        printContext,
        diagnosticContext,
        onkindchange
    }: Props = $props();

    // svelte-ignore state_referenced_locally -- session identity is stable.
    const printer = fromStore(session);
    const environment = collectCoarseEnvironment();
    const webCapabilities = collectWebCapabilities();

    const selectedProfile = $derived(PRINTER_PROFILES.find(profile => profile.id === settings.defaultPrinter));
    const snap = $derived(printer.current);

    let brand = $state('');
    let model = $state('');
    let advertisedName = $state('');
    let firmware = $state('');
    let hardware = $state('');
    let serviceUuids = $state('');
    let diagnosticLog = $state('');
    let problemCategory = $state('');
    let whatHappened = $state('');
    let expectedResult = $state('');
    let note = $state('');
    let reviewed = $state(false);
    let copied = $state(false);
    let profileSeeded = $state(false);
    let nameSeeded = $state(false);
    let firmwareSeeded = $state(false);
    let hardwareSeeded = $state(false);
    let servicesSeeded = $state(false);
    let reportDetailsSeeded = $state(false);

    $effect(() => {
        if (kind !== 'missing-printer' && selectedProfile && !profileSeeded) {
            brand = selectedProfile.rebadgeOnly ? '' : selectedProfile.brand;
            model = selectedProfile.model;
            profileSeeded = true;
        }
    });

    $effect(() => {
        const identity = snap.status?.identity;
        const name = diagnosticContext?.advertisedName ?? identity?.deviceName ?? snap.deviceName;
        const firmwareVersion = diagnosticContext?.firmwareVersion ?? identity?.firmwareVersion;
        const hardwareVersion = diagnosticContext?.hardwareVersion ?? identity?.hardwareVersion;
        const uuids = diagnosticContext?.serviceUuids ?? snap.serviceUuids;
        if (!nameSeeded && !advertisedName && name) {
            advertisedName = name?.slice(0, 200) ?? '';
            nameSeeded = true;
        }
        if (!firmwareSeeded && !firmware && firmwareVersion) {
            firmware = firmwareVersion?.slice(0, 200) ?? '';
            firmwareSeeded = true;
        }
        if (!hardwareSeeded && !hardware && hardwareVersion) {
            hardware = hardwareVersion?.slice(0, 200) ?? '';
            hardwareSeeded = true;
        }
        if (!servicesSeeded && !serviceUuids && uuids?.length) {
            serviceUuids = uuids?.join('\n') ?? '';
            servicesSeeded = true;
        }
    });

    $effect(() => {
        if (reportDetailsSeeded) return;
        diagnosticLog = session.getDiagnosticLog().join('\n');
        if (diagnosticContext?.whatHappened) {
            whatHappened = diagnosticContext.whatHappened;
        } else if (kind === 'print-problem') {
            whatHappened = printContext?.printResult === 'failed'
                ? 'OpenTLP Studio could not complete the print.'
                : 'The print was sent, but the physical output was not correct.';
        } else if (kind === 'print-success' && printContext) {
            const transport = diagnosticContext?.transportType ?? snap.transportType ?? snap.transportKind ?? 'the connected transport';
            const driver = diagnosticContext?.driverName ?? snap.driverName ?? 'the selected driver';
            note = `Printed ${printContext.printCopies} ${printContext.printCopies === 1 ? 'copy' : 'copies'} at ${printContext.pageWidthMm.toFixed(1)} x ${printContext.pageHeightMm.toFixed(1)} mm using ${driver} over ${transport}.`;
        }
        reportDetailsSeeded = true;
    });

    const automatic = $derived.by((): AutomaticDiagnostics => {
        const caps = snap.capabilities;
        return {
            build,
            runtime,
            ...environment,
            ...webCapabilities,
            connectionState: snap.state,
            profileId: kind === 'missing-printer' ? undefined : selectedProfile?.id,
            hardwareId: kind === 'missing-printer' ? undefined : (selectedProfile?.tohId ?? selectedProfile?.id),
            profileBrand: kind === 'missing-printer' ? undefined : selectedProfile?.brand,
            profileModel: kind === 'missing-printer' ? undefined : selectedProfile?.model,
            transportKind: diagnosticContext?.transportKind ?? snap.transportKind,
            transportType: diagnosticContext?.transportType ?? snap.transportType,
            driverName: diagnosticContext?.driverName ?? snap.driverName,
            maxDensity: caps?.maxDensity,
            canvasHeightPx: caps?.canvasHeightPx,
            supportsSpeedMode: caps?.supportsSpeedMode,
            colorType: caps?.colorSupport.type,
            colorChannels: caps?.colorSupport.channels ?? (caps ? 1 : undefined),
            dpmm: caps?.dpmm,
            errorCode: snap.lastError?.code,
            pageWidthPx: printContext?.pageWidthPx,
            pageHeightPx: printContext?.pageHeightPx,
            pageWidthMm: printContext?.pageWidthMm,
            pageHeightMm: printContext?.pageHeightMm,
            mediaWidthMm: printContext?.mediaWidthMm,
            paperType: printContext?.paperType,
            printDensity: printContext?.printDensity,
            printCopies: printContext?.printCopies,
            printSpeed: printContext?.printSpeed,
            printResult: printContext?.printResult,
            diagnosticCandidates: diagnosticContext?.candidateDrivers
        };
    });

    const human = $derived<HumanDetails>({
        brand,
        model,
        advertisedName,
        firmware,
        hardware,
        serviceUuids: serviceUuids.split(/[\s,]+/).filter(Boolean),
        diagnosticLog,
        problemCategory: kind === 'print-problem' ? problemCategory : undefined,
        whatHappened: kind === 'print-problem' || kind === 'missing-printer' ? whatHappened : undefined,
        expectedResult: kind === 'print-problem' ? expectedResult : undefined,
        note: kind === 'print-problem' ? undefined : note
    });
    const preview = $derived(buildReportMarkdown(kind, human, automatic));
    const issueUrl = $derived(buildGitHubIssueUrl(kind, human, automatic));
    const canContinue = $derived(
        brand.trim().length > 0
        && model.trim().length > 0
        && reviewed
        && (kind !== 'print-problem' || (problemCategory.length > 0 && whatHappened.trim().length > 0))
    );

    function chooseKind(next: ReportKind): void {
        if (next === kind) return;
        if (next === 'missing-printer' && kind !== 'missing-printer') {
            brand = '';
            model = '';
            profileSeeded = false;
        }
        problemCategory = '';
        whatHappened = '';
        expectedResult = '';
        note = '';
        reportDetailsSeeded = false;
        reviewed = false;
        copied = false;
        onkindchange?.(next);
    }

    function continueToGitHub(): void {
        if (!canContinue) return;
        window.open(issueUrl, '_blank', 'noopener,noreferrer');
    }

    async function copyReport(): Promise<void> {
        try {
            await navigator.clipboard.writeText(preview);
            copied = true;
        } catch {
            copied = false;
        }
    }
</script>

<div class="report-panel">
    <div class="kind-switch" aria-label="Report type">
        <button type="button" class:active={kind === 'missing-printer'} onclick={() => chooseKind('missing-printer')}>
            Missing printer
        </button>
        <button type="button" class:active={kind === 'print-success'} onclick={() => chooseKind('print-success')}>
            Print worked
        </button>
        <button type="button" class:active={kind === 'print-problem'} onclick={() => chooseKind('print-problem')}>
            Print problem
        </button>
    </div>

    <header>
        <span class="report-mark" aria-hidden="true"><Icon name="flag" size={22} /></span>
        <div>
            {#if kind === 'missing-printer'}
                <h2>Tell us which printer is missing</h2>
                <p>We will use the model and connection details to research support.</p>
            {:else if kind === 'print-success'}
                <h2>Confirm a printer that works</h2>
                <p>A real-world success report helps us promote untested models to verified support.</p>
            {:else}
                <h2>Show us what went wrong</h2>
                <p>The technical context from your latest attempt is added automatically.</p>
            {/if}
        </div>
    </header>

    <form onsubmit={(event) => { event.preventDefault(); continueToGitHub(); }}>
        <fieldset class="identity">
            <legend>Printer</legend>
            <label>
                <span>Brand <b aria-hidden="true">*</b></span>
                <input bind:value={brand} maxlength="200" required autocomplete="organization" placeholder="e.g. PeriPage" />
            </label>
            <label>
                <span>Model <b aria-hidden="true">*</b></span>
                <input bind:value={model} maxlength="200" required placeholder="e.g. P21" />
            </label>
            <label>
                <span>Firmware <small>optional</small></span>
                <input bind:value={firmware} oninput={() => (firmwareSeeded = true)} maxlength="200" placeholder="Filled when the driver can read it" />
            </label>
            <label>
                <span>Hardware revision <small>optional</small></span>
                <input bind:value={hardware} oninput={() => (hardwareSeeded = true)} maxlength="200" placeholder="Filled when the driver can read it" />
            </label>
            <label class="identity-wide">
                <span>Device / Bluetooth name <small>optional</small></span>
                <input bind:value={advertisedName} oninput={() => (nameSeeded = true)} maxlength="200" placeholder="Filled when the transport or driver exposes it" />
                <small class="field-help">Studio fills this automatically when available. Remove it if it contains a serial number or anything you do not want public.</small>
            </label>
        </fieldset>

        <fieldset>
            <legend>Technical facts</legend>
            <div class="automatic-facts">
                <span><strong>Transport option</strong>{automatic.transportKind ?? 'Not recorded'}</span>
                <span><strong>Transport implementation</strong>{automatic.transportType ?? 'Not recorded'}</span>
                <span><strong>Driver</strong>{automatic.driverName ?? 'Not identified'}</span>
            </div>
            <label>
                <span>Service UUIDs <small>optional</small></span>
                <textarea bind:value={serviceUuids} oninput={() => (servicesSeeded = true)} maxlength="2200" rows="3" placeholder="Filled from the driver or diagnostic probe when available"></textarea>
                <small class="field-help">These describe the printer protocol. You can remove individual UUIDs or clear the field.</small>
            </label>
            <label>
                <span>OpenTLP diagnostic activity <small>optional</small></span>
                <textarea bind:value={diagnosticLog} maxlength="8000" rows="5" placeholder="No diagnostic events recorded"></textarea>
                <small class="field-help">A bounded OpenTLP activity log—not the browser's full console. It excludes label content, images, raw device identifiers and raw errors. Review or clear it before continuing.</small>
            </label>
        </fieldset>

        {#if kind === 'print-problem'}
            <fieldset>
                <legend>Problem</legend>
                <label>
                    <span>What kind of problem? <b aria-hidden="true">*</b></span>
                    <select bind:value={problemCategory} required>
                        <option value="" disabled>Choose the closest match</option>
                        <option>Nothing printed</option>
                        <option>Connection or error</option>
                        <option>Cropped or shifted</option>
                        <option>Rotated or mirrored</option>
                        <option>Wrong feed or cut position</option>
                        <option>Poor print quality</option>
                        <option>Wrong colours</option>
                        <option>Other</option>
                    </select>
                </label>
                <label>
                    <span>What happened? <b aria-hidden="true">*</b></span>
                    <textarea bind:value={whatHappened} maxlength="1500" required rows="4" placeholder="Describe what came out, or where printing stopped."></textarea>
                </label>
                <label>
                    <span>What did you expect? <small>optional</small></span>
                    <textarea bind:value={expectedResult} maxlength="1500" rows="3" placeholder="For example: the label should end at the cut line."></textarea>
                </label>
            </fieldset>
        {:else if kind === 'missing-printer'}
            <fieldset>
                <legend>What you tried</legend>
                <label>
                    <span>Where did you get stuck? <small>optional</small></span>
                    <textarea bind:value={whatHappened} maxlength="1500" rows="3" placeholder="For example: it appears in the chooser but does not connect."></textarea>
                </label>
                <label>
                    <span>Anything else that identifies the model? <small>optional</small></span>
                    <textarea bind:value={note} maxlength="1500" rows="3" placeholder="A public product or manual link is useful. Do not paste order details."></textarea>
                </label>
            </fieldset>
        {:else}
            <fieldset>
                <legend>Confirmation</legend>
                <label>
                    <span>What worked? <small>optional</small></span>
                    <textarea bind:value={note} maxlength="1500" rows="3" placeholder="For example: Bluetooth printing on 12 x 40 mm labels."></textarea>
                </label>
            </fieldset>
        {/if}

        <aside class="privacy-note">
            <Icon name="lock" size={18} />
            <div>
                <strong>Your label stays private</strong>
                <p>Studio never adds label text, images, barcodes, filenames, saved designs, dedicated serial-number or address fields, paper names, or the full browser identifier. Review the device name because some printers put a serial-like suffix in it.</p>
            </div>
        </aside>

        <details class="preview">
            <summary>Review exactly what will be shared</summary>
            <pre>{preview}</pre>
        </details>

        <label class="review-check">
            <input type="checkbox" bind:checked={reviewed} />
            <span>I reviewed the report above and removed personal information.</span>
        </label>

        <div class="submit-row">
            <button type="button" class="copy" onclick={copyReport}>
                <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copied' : 'Copy report'}
            </button>
            <button type="submit" class="primary" disabled={!canContinue}>
                Continue to GitHub <Icon name="external-link" size={15} />
            </button>
        </div>
        <p class="submit-help">Nothing is sent automatically. GitHub opens with this draft; you can edit it and choose whether to submit.</p>
    </form>
</div>

<style>
    .report-panel { display: flex; flex-direction: column; gap: 18px; }
    .kind-switch {
        display: flex;
        width: fit-content;
        max-width: 100%;
        gap: 3px;
        padding: 3px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: var(--panel-2);
    }
    .kind-switch button {
        padding: 7px 12px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--muted);
        box-shadow: none;
        font-size: 12px;
        cursor: pointer;
    }
    .kind-switch button:hover { color: var(--text); transform: none; box-shadow: none; }
    .kind-switch button.active { background: var(--panel); color: var(--text); box-shadow: 0 1px 3px color-mix(in srgb, #000 12%, transparent); }
    header { display: flex; gap: 12px; align-items: flex-start; }
    header h2 { margin: 0 0 3px; font-size: 20px; }
    header p, .privacy-note p, .submit-help { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
    .report-mark {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--accent) 14%, var(--panel));
        color: var(--accent);
        flex: none;
    }
    form { display: flex; flex-direction: column; gap: 14px; }
    fieldset {
        display: grid;
        gap: 12px;
        margin: 0;
        padding: 14px;
        border: 1px solid var(--border);
        border-radius: 3px;
        background: var(--panel);
    }
    fieldset.identity { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .identity-wide { grid-column: 1 / -1; }
    legend { padding: 0 6px; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    label { display: flex; flex-direction: column; gap: 5px; min-width: 0; color: var(--text); font-size: 13px; }
    label span { font-weight: 600; }
    label b { color: var(--danger); }
    label small { color: var(--muted); font-weight: 400; }
    input, select, textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 9px 10px;
        border: 1px solid var(--border);
        border-radius: 2px;
        background: var(--panel-2);
        color: var(--text);
        font: inherit;
    }
    textarea { resize: vertical; line-height: 1.45; }
    input:focus, select:focus, textarea:focus { outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent); outline-offset: 1px; border-color: var(--accent); }
    .field-help { line-height: 1.35; }
    .automatic-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .automatic-facts span { min-width: 0; padding: 8px 10px; border-left: 2px solid var(--accent); background: var(--panel-2); color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .automatic-facts strong { display: block; margin-bottom: 2px; color: var(--text); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .privacy-note {
        display: flex;
        gap: 10px;
        padding: 12px;
        border-left: 3px solid var(--ok);
        background: color-mix(in srgb, var(--ok) 7%, var(--panel));
    }
    .privacy-note :global(.icon) { color: var(--ok); margin-top: 1px; }
    .privacy-note strong { display: block; margin-bottom: 2px; }
    .preview { border-top: 1px solid var(--border); padding-top: 12px; }
    .preview summary { cursor: pointer; color: var(--text); font-size: 13px; font-weight: 600; }
    .preview pre { max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-word; padding: 12px; border: 1px solid var(--border); border-radius: 2px; background: var(--panel-2); color: var(--muted); font: 11px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .review-check { flex-direction: row; align-items: flex-start; gap: 9px; }
    .review-check input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); flex: none; }
    .review-check span { font-weight: 500; line-height: 1.4; }
    .submit-row { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .submit-row button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 13px; border-radius: 3px; cursor: pointer; }
    .submit-row .copy { border: 1px solid var(--border); background: var(--panel); color: var(--text); }
    .submit-row button:hover { transform: none; box-shadow: none; }
    .submit-row button:disabled { cursor: not-allowed; opacity: .5; }
    .submit-help { text-align: right; }
    @media (max-width: 620px) {
        .kind-switch { width: 100%; border-radius: 3px; }
        .kind-switch button { flex: 1; padding-inline: 7px; border-radius: 2px; }
        fieldset.identity { grid-template-columns: 1fr; }
        .identity-wide { grid-column: auto; }
        .automatic-facts { grid-template-columns: 1fr; }
        .submit-row { flex-direction: column-reverse; }
        .submit-row button { justify-content: center; width: 100%; }
        .submit-help { text-align: left; }
    }
</style>
