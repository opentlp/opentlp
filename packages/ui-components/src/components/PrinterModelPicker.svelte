<script lang="ts">
    import { PrintManager, type PrinterKind } from 'universal-label-core';
    import { PRINTER_PROFILES, AUTO_APP_PROFILES } from '../stores/settings.svelte';
    import { KNOWN_COMPANION_APPS, type CompanionAppInfo } from '../data/app-directory';
    import { artworkFor } from '../data/artwork';
    import {
        matchOpenTlpDevice,
        getOpenTlpSearchTerms,
        OPENTLP_CATALOGUE_URL,
        OPENTLP_SNAPSHOT,
    } from '../data/opentlp-catalogue';
    import PrinterMark from './PrinterMark.svelte';
    import Icon from './Icon.svelte';

    interface Props {
        selectedId?: string;
        mode?: 'both' | 'apps-only' | 'models-only';
        selectedApp?: string;
        onselect: (id: string) => void;
        onappselect?: (app: string) => void;
        onback?: () => void;
        onbrowseall?: () => void;
    }

    let {
        selectedId,
        mode = 'both',
        selectedApp = '',
        onselect,
        onappselect,
        onback,
        onbrowseall
    }: Props = $props();

    const pm = new PrintManager();

    let appSearchQuery = $state('');
    let modelSearchQuery = $state('');
    // svelte-ignore state_referenced_locally
    let selectedAppFilter = $state<string>(
        mode === 'models-only' ? (selectedApp || '__all__') : (selectedApp || 'all')
    );
    let selectedKindFilter = $state<string>('all');

    $effect(() => {
        if (mode === 'models-only' && selectedApp) {
            selectedAppFilter = selectedApp;
        }
    });

    const isNone = $derived(!selectedId || selectedId === 'none');
    const isUnknown = $derived(selectedId === 'unknown');

    const DEVICE_LABELS: Record<string, string> = {
        pocket: 'Pocket Printer',
        label: 'Label Printer',
        receipt: 'Receipt Printer',
    };

    function isLightColor(hex?: string): boolean {
        if (!hex) return false;
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16) || 0;
        const g = parseInt(h.substring(2, 4), 16) || 0;
        const b = parseInt(h.substring(4, 6), 16) || 0;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.8;
    }

    function getBadgeBackground(palette: string[] | undefined, fallback: string): string {
        if (!palette || palette.length === 0) return fallback;
        if (isLightColor(palette[0])) return palette[0];
        if (palette.length === 1) return palette[0];
        if (palette.length === 2) {
            return `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)`;
        }
        if (palette.length === 3) {
            return `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 55%, ${palette[2]} 100%)`;
        }
        return `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 35%, ${palette[2]} 70%, ${palette[3]} 100%)`;
    }

    function getBadgeTextColor(palette: string[] | undefined, fallback: string): string {
        if (!palette || palette.length === 0) return '#ffffff';
        if (isLightColor(palette[0])) {
            return palette[1] || fallback;
        }
        return '#ffffff';
    }

    const profileEntries = $derived.by(() => {
        const seen = new Set<string>();
        const list: Array<{ profile: (typeof PRINTER_PROFILES)[number]; opentlp: ReturnType<typeof matchOpenTlpDevice> }> = [];
        for (const p of PRINTER_PROFILES) {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                list.push({
                    profile: p,
                    opentlp: matchOpenTlpDevice(p),
                });
            }
        }
        return list;
    });

    const currentSelectedProfile = $derived.by(() => {
        if (!selectedId || selectedId === 'none' || selectedId === 'unknown') return undefined;
        return PRINTER_PROFILES.find(p => p.id === selectedId) ?? AUTO_APP_PROFILES.find(a => a.id === selectedId);
    });

    const currentSelectedApp = $derived(currentSelectedProfile?.app);

    const uniqueApps = $derived.by(() => {
        const apps = new Set<string>();
        for (const app of pm.getReplacedApps()) {
            if (app) apps.add(app);
        }
        for (const { profile, opentlp } of profileEntries) {
            const app = profile.app ?? opentlp?.app;
            if (app) apps.add(app);
            if (profile.replacesApps) {
                for (const a of profile.replacesApps) apps.add(a);
            }
            if (opentlp?.replacesApps) {
                for (const a of opentlp.replacesApps) apps.add(a);
            }
        }
        for (const auto of AUTO_APP_PROFILES) {
            if (auto.app) apps.add(auto.app);
            if (auto.replacesApps) {
                for (const a of auto.replacesApps) apps.add(a);
            }
        }
        return Array.from(apps).sort((a, b) => a.localeCompare(b));
    });

    const appDirectoryEntries = $derived.by(() => {
        const list: CompanionAppInfo[] = [...KNOWN_COMPANION_APPS];
        const knownNames = new Set(list.flatMap(a => [a.name.toLowerCase(), ...(a.replacesApps ?? []).map(r => r.toLowerCase())]));

        for (const app of uniqueApps) {
            if (!knownNames.has(app.toLowerCase())) {
                list.push({
                    id: app.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    name: app,
                    developer: 'Third-party app',
                    brandColor: '#475569',
                    brandPalette: ['#475569', '#64748b'],
                    badgeLetter: app.charAt(0).toUpperCase(),
                    popularModels: [],
                    summary: `Printers supported by the ${app} mobile app.`,
                    replacesApps: [app]
                });
                knownNames.add(app.toLowerCase());
            }
        }
        return list;
    });

    const filteredAppEntries = $derived.by(() => {
        const q = appSearchQuery.trim().toLowerCase();
        if (!q) return appDirectoryEntries;
        const tokens = q.split(/\s+/).filter(Boolean);

        return appDirectoryEntries.filter(app => {
            const haystackParts = [
                app.name,
                app.developer,
                app.summary,
                ...(app.replacesApps ?? []),
                ...(app.popularModels ?? [])
            ];
            for (const { profile, opentlp } of profileEntries) {
                const matchesApp =
                    profile.app === app.name ||
                    profile.replacesApps?.includes(app.name) ||
                    opentlp?.app === app.name ||
                    opentlp?.replacesApps?.includes(app.name) ||
                    (app.replacesApps && (
                        app.replacesApps.includes(profile.app ?? '') ||
                        app.replacesApps.some(r => profile.replacesApps?.includes(r))
                    ));
                if (matchesApp) {
                    haystackParts.push(profile.model, profile.brand, ...(profile.aliases ?? []));
                }
            }
            const haystack = haystackParts.join(' ').toLowerCase();
            return tokens.every(t => haystack.includes(t));
        });
    });

    const activeAppInfo = $derived.by(() => {
        if (selectedAppFilter === 'all' || selectedAppFilter === '__all__') return undefined;
        return appDirectoryEntries.find(a =>
            a.name.toLowerCase() === selectedAppFilter.toLowerCase() ||
            a.replacesApps?.some(r => r.toLowerCase() === selectedAppFilter.toLowerCase())
        );
    });

    const availableKindsForSelectedApp = $derived.by(() => {
        if (selectedAppFilter === 'all' || selectedAppFilter === '__all__') return [];
        const kinds = new Set<string>();
        for (const k of pm.getKindsForApp(selectedAppFilter)) {
            kinds.add(k);
        }
        for (const auto of AUTO_APP_PROFILES) {
            const matches = auto.app === selectedAppFilter || auto.replacesApps?.includes(selectedAppFilter);
            if (matches && auto.kind) {
                kinds.add(auto.kind);
            }
        }
        for (const { profile, opentlp } of profileEntries) {
            const matches =
                profile.app === selectedAppFilter ||
                profile.replacesApps?.includes(selectedAppFilter) ||
                opentlp?.app === selectedAppFilter ||
                opentlp?.replacesApps?.includes(selectedAppFilter);
            if (matches) {
                const k = profile.kind ?? opentlp?.kind;
                if (k) kinds.add(k);
            }
        }
        const order = ['pocket', 'label', 'receipt'];
        return Array.from(kinds).sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    });

    $effect(() => {
        if (selectedKindFilter !== 'all' && !availableKindsForSelectedApp.includes(selectedKindFilter)) {
            selectedKindFilter = 'all';
        }
    });

    const matchingAutoProfiles = $derived.by(() => {
        const q = modelSearchQuery.trim().toLowerCase();
        const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

        return AUTO_APP_PROFILES.filter((auto) => {
            if (selectedAppFilter !== 'all' && selectedAppFilter !== '__all__') {
                const matches =
                    auto.app === selectedAppFilter ||
                    auto.replacesApps?.includes(selectedAppFilter) ||
                    (activeAppInfo?.replacesApps && auto.app && activeAppInfo.replacesApps.includes(auto.app));
                if (!matches) return false;
            }
            if (selectedKindFilter !== 'all' && auto.kind !== selectedKindFilter) {
                return false;
            }
            if (tokens.length === 0) return true;
            const haystack = `${auto.app} ${auto.model} ${auto.kind} ${auto.notes ?? ''} ${auto.replacesApps?.join(' ') ?? ''}`.toLowerCase();
            return tokens.every((token) => haystack.includes(token));
        });
    });

    const filteredProfiles = $derived.by(() => {
        const q = modelSearchQuery.trim().toLowerCase();
        const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

        return profileEntries.filter(({ profile, opentlp }) => {
            if (selectedAppFilter !== 'all' && selectedAppFilter !== '__all__') {
                const appMatches =
                    profile.app === selectedAppFilter ||
                    profile.replacesApps?.includes(selectedAppFilter) ||
                    opentlp?.app === selectedAppFilter ||
                    opentlp?.replacesApps?.includes(selectedAppFilter) ||
                    (activeAppInfo?.replacesApps && (
                        activeAppInfo.replacesApps.includes(profile.app ?? '') ||
                        activeAppInfo.replacesApps.some(r => profile.replacesApps?.includes(r)) ||
                        activeAppInfo.replacesApps.includes(opentlp?.app ?? '') ||
                        activeAppInfo.replacesApps.some(r => opentlp?.replacesApps?.includes(r))
                    ));
                if (!appMatches) return false;
            }

            const kind = profile.kind ?? opentlp?.kind;
            if (selectedKindFilter !== 'all' && kind !== selectedKindFilter) {
                return false;
            }

            if (tokens.length === 0) return true;
            const haystack = getOpenTlpSearchTerms(profile, opentlp).join(' ').toLowerCase();
            return tokens.every((token) => haystack.includes(token));
        });
    });
</script>

<div class="picker-container">
    {#if mode === 'apps-only' || (mode === 'both' && selectedAppFilter === 'all')}
        <!-- STEP 1: CHOOSE COMPANION APP -->
        <div class="step-guide">
            <div class="step-guide-title">
                <span class="step-num">1</span>
                <strong>Choose your printer's companion app</strong>
            </div>
            <p class="step-guide-desc">
                Select the mobile app that came in the box or manual. OpenTLP will configure the right driver protocol and show compatible models.
            </p>
        </div>

        <div class="search-wrap">
            <span class="search-icon"><Icon name="search" size={15} /></span>
            <input
                type="search"
                class="search-input"
                placeholder="Search app, brand, or model (e.g. L13, P12, Silvercrest, Phomemo)..."
                bind:value={appSearchQuery}
                aria-label="Filter printer apps"
            />
            {#if appSearchQuery}
                <button
                    type="button"
                    class="clear-btn"
                    onclick={() => (appSearchQuery = '')}
                    aria-label="Clear search"
                >
                    &times;
                </button>
            {/if}
        </div>

        {#if currentSelectedProfile && currentSelectedApp}
            <div class="current-selection-banner">
                <div class="current-info">
                    <span class="current-label">Currently active:</span>
                    <strong class="current-name">{currentSelectedProfile.brand} {currentSelectedProfile.model}</strong>
                </div>
                <button
                    type="button"
                    class="current-jump-btn"
                    onclick={() => {
                        selectedAppFilter = currentSelectedApp;
                        modelSearchQuery = '';
                        selectedKindFilter = 'all';
                        onappselect?.(currentSelectedApp);
                    }}
                >
                    <span>View {currentSelectedApp} &rarr;</span>
                </button>
            </div>
        {/if}

        <div class="app-grid">
            {#each filteredAppEntries as app (app.id)}
                {@const modelCount = profileEntries.filter(({ profile, opentlp }) =>
                    profile.app === app.name ||
                    profile.replacesApps?.includes(app.name) ||
                    opentlp?.app === app.name ||
                    opentlp?.replacesApps?.includes(app.name) ||
                    (app.replacesApps && (
                        app.replacesApps.includes(profile.app ?? '') ||
                        app.replacesApps.some(r => profile.replacesApps?.includes(r))
                    ))
                ).length}
                <div
                    class="app-card"
                    role="button"
                    tabindex="0"
                    style:--app-brand={app.brandColor}
                    onclick={() => {
                        selectedAppFilter = app.name;
                        modelSearchQuery = '';
                        selectedKindFilter = 'all';
                        onappselect?.(app.name);
                    }}
                    onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectedAppFilter = app.name;
                            modelSearchQuery = '';
                            selectedKindFilter = 'all';
                            onappselect?.(app.name);
                        }
                    }}
                >
                    <div class="app-card-top">
                        <div
                            class="app-badge"
                            class:light-bg={isLightColor(app.brandPalette?.[0])}
                            style:background={getBadgeBackground(app.brandPalette, app.brandColor)}
                            style:color={getBadgeTextColor(app.brandPalette, app.brandColor)}
                        >
                            <span>{app.badgeLetter}</span>
                        </div>
                        <div class="app-header-text">
                            <strong class="app-name">{app.name}</strong>
                            <span class="app-dev">{app.developer}</span>
                        </div>
                    </div>
                    {#if app.playStoreUrl || app.appStoreUrl}
                        <div class="app-store-links">
                            {#if app.playStoreUrl}
                                <a
                                    href={app.playStoreUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="store-link-chip"
                                    title={`Open ${app.name} on Google Play Store`}
                                    onclick={(e) => e.stopPropagation()}
                                    onkeydown={(e) => e.stopPropagation()}
                                >
                                    <Icon name="external-link" size={10} />
                                    <span>Play Store</span>
                                </a>
                            {/if}
                            {#if app.appStoreUrl}
                                <a
                                    href={app.appStoreUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="store-link-chip"
                                    title={`Open ${app.name} on Apple App Store`}
                                    onclick={(e) => e.stopPropagation()}
                                    onkeydown={(e) => e.stopPropagation()}
                                >
                                    <Icon name="external-link" size={10} />
                                    <span>App Store</span>
                                </a>
                            {/if}
                        </div>
                    {/if}
                    <div class="app-card-footer">
                        <span class="app-count">{modelCount > 0 ? `${modelCount} models` : 'Auto-detect'}</span>
                        <span class="app-action">Select &rarr;</span>
                    </div>
                </div>
            {/each}
        </div>

        {#if filteredAppEntries.length === 0}
            <div class="empty-state">
                <span class="empty-icon"><Icon name="search" size={24} /></span>
                <p class="empty-title">No matching companion apps</p>
                <p class="empty-hint">Try searching for the model name directly, or use Diagnostic Mode below.</p>
                {#if appSearchQuery}
                    <button type="button" class="reset-search-btn" onclick={() => (appSearchQuery = '')}>
                        Clear search
                    </button>
                {/if}
            </div>
        {/if}

        <div class="fallback-section">
            <span class="fallback-title">Don't know the app or have an unlisted printer?</span>
            <div class="fallback-grid">
                <button
                    type="button"
                    class="fallback-card diagnostic-fallback"
                    class:on={isUnknown}
                    onclick={() => onselect('unknown')}
                >
                    <span class="fallback-icon"><Icon name="info" size={22} /></span>
                    <div class="fallback-content">
                        <strong>Unknown / Not in list</strong>
                        <span>Safe diagnostic probe mode: identifies device without printing</span>
                    </div>
                </button>
                <button
                    type="button"
                    class="fallback-card"
                    class:on={isNone && !isUnknown}
                    onclick={() => onselect('none')}
                >
                    <span class="fallback-icon"><Icon name="printer" size={22} /></span>
                    <div class="fallback-content">
                        <strong>Raw continuous</strong>
                        <span>Generic unprofiled ESC/POS continuous stream</span>
                    </div>
                </button>
            </div>
            <div class="browse-all-row">
                <button
                    type="button"
                    class="browse-all-btn"
                    onclick={() => {
                        selectedAppFilter = '__all__';
                        modelSearchQuery = '';
                        selectedKindFilter = 'all';
                        if (onbrowseall) onbrowseall();
                        else onappselect?.('__all__');
                    }}
                >
                    Browse all {profileEntries.length} printer models directly &rarr;
                </button>
            </div>
        </div>

    {:else}
        <!-- STEP 2: APP SELECTED (OR BROWSE ALL) -->
        <div class="app-nav-bar">
            <button
                type="button"
                class="back-to-apps-btn"
                onclick={() => {
                    if (mode === 'models-only' && onback) {
                        onback();
                    } else {
                        selectedAppFilter = 'all';
                        modelSearchQuery = '';
                        selectedKindFilter = 'all';
                        onback?.();
                    }
                }}
            >
                <Icon name="arrow-left" size={14} />
                <span>All Apps</span>
            </button>
            <div class="active-app-heading">
                {#if activeAppInfo}
                    <span
                        class="mini-app-badge"
                        class:light-bg={isLightColor(activeAppInfo.brandPalette?.[0])}
                        style:background={getBadgeBackground(activeAppInfo.brandPalette, activeAppInfo.brandColor)}
                        style:color={getBadgeTextColor(activeAppInfo.brandPalette, activeAppInfo.brandColor)}
                    >
                        {activeAppInfo.badgeLetter}
                    </span>
                    <strong>{activeAppInfo.name}</strong>
                    <span class="active-app-dev">({activeAppInfo.developer})</span>
                    {#if activeAppInfo.playStoreUrl || activeAppInfo.appStoreUrl}
                        <div class="active-store-links">
                            {#if activeAppInfo.playStoreUrl}
                                <a
                                    href={activeAppInfo.playStoreUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="store-link-chip"
                                    title={`Open ${activeAppInfo.name} on Google Play Store`}
                                >
                                    <Icon name="external-link" size={10} />
                                    <span>Play Store</span>
                                </a>
                            {/if}
                            {#if activeAppInfo.appStoreUrl}
                                <a
                                    href={activeAppInfo.appStoreUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="store-link-chip"
                                    title={`Open ${activeAppInfo.name} on Apple App Store`}
                                >
                                    <Icon name="external-link" size={10} />
                                    <span>App Store</span>
                                </a>
                            {/if}
                        </div>
                    {/if}
                {:else if selectedAppFilter === '__all__'}
                    <strong>All Supported Printers</strong>
                    <span class="active-app-dev">({profileEntries.length} models)</span>
                {:else}
                    <strong>{selectedAppFilter}</strong>
                {/if}
            </div>
        </div>

        <div class="search-and-filters">
            <div class="search-wrap">
                <span class="search-icon"><Icon name="search" size={15} /></span>
                <input
                    type="search"
                    class="search-input"
                    placeholder={selectedAppFilter === '__all__' ? 'Search all models, brands, protocols...' : `Search ${selectedAppFilter} models...`}
                    bind:value={modelSearchQuery}
                    aria-label="Filter models"
                />
                {#if modelSearchQuery}
                    <button
                        type="button"
                        class="clear-btn"
                        onclick={() => (modelSearchQuery = '')}
                        aria-label="Clear search"
                    >
                        &times;
                    </button>
                {/if}
            </div>

            {#if availableKindsForSelectedApp.length > 1}
                <div class="filters-row">
                    <div class="filter-item">
                        <label for="device-select" class="filter-label">Device:</label>
                        <select id="device-select" class="filter-select" bind:value={selectedKindFilter}>
                            <option value="all">All devices</option>
                            {#each availableKindsForSelectedApp as kind}
                                <option value={kind}>{DEVICE_LABELS[kind] ?? kind}</option>
                            {/each}
                        </select>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Auto-Detect Cards -->
        {#if matchingAutoProfiles.length > 0}
            <div class="section-label">
                <span>⚡ Auto-Detect for {selectedAppFilter === '__all__' ? 'App' : selectedAppFilter}</span>
            </div>
            <div class="printer-grid auto-grid">
                {#each matchingAutoProfiles as auto (auto.id)}
                    {@const isSelected = selectedId === auto.id}
                    <button
                        type="button"
                        class="printer-card auto-card"
                        class:on={isSelected}
                        aria-pressed={isSelected}
                        aria-label="{auto.brand} - {auto.model}"
                        onclick={() => onselect(auto.id)}
                    >
                        <span class="card-icon auto-icon"><Icon name="search" size={30} /></span>
                        <span class="card-name auto-badge">{auto.app}</span>
                        <strong class="card-model">{auto.model.replace('Auto-detect ', '')}</strong>
                        <span class="card-desc">{auto.notes ?? (DEVICE_LABELS[auto.kind ?? ''] ?? auto.kind)}</span>
                    </button>
                {/each}
            </div>
        {/if}

        <!-- Specific Models Grid -->
        <div class="section-label">
            <span>Specific Models ({filteredProfiles.length})</span>
        </div>
        {#if filteredProfiles.length === 0}
            <div class="empty-state">
                <span class="empty-icon"><Icon name="search" size={24} /></span>
                <p class="empty-title">No matching models found</p>
                <p class="empty-hint">Try adjusting your search query, or use Auto-detect above.</p>
                {#if modelSearchQuery}
                    <button type="button" class="reset-search-btn" onclick={() => (modelSearchQuery = '')}>
                        Clear search
                    </button>
                {/if}
            </div>
        {:else}
            <div class="printer-grid">
                {#each filteredProfiles as { profile: p, opentlp } (p.id)}
                    {@const art = artworkFor(p)}
                    {@const brandLabel = p.rebadgeOnly ? `${p.brand}-compatible` : p.brand}
                    {@const isSelected = !isNone && !isUnknown && selectedId === p.id}
                    {@const appName = p.app ?? opentlp?.app}
                    {@const kindName = p.kind ?? opentlp?.kind}
                    <button
                        type="button"
                        class="printer-card"
                        class:on={isSelected}
                        aria-pressed={isSelected}
                        aria-label="{brandLabel} {p.model}{opentlp?.family ? ` (${opentlp.family})` : ''}"
                        onclick={() => onselect(p.id)}
                    >
                        {#if art}
                            <PrinterMark artwork={art} size={72} strokePx={0.8} title={p.model} />
                        {:else}
                            <span class="card-icon"><Icon name="printer" size={36} /></span>
                        {/if}
                        <span class="card-name">{brandLabel}</span>
                        <strong class="card-model">{p.model}</strong>
                        <span class="card-meta">
                            {#if appName}
                                <span class="meta-tag meta-app">{appName}</span>
                            {/if}
                            {#if kindName}
                                <span class="meta-tag meta-kind">{DEVICE_LABELS[kindName] ?? kindName}</span>
                            {/if}
                            {#if opentlp && opentlp.family}
                                <span class="meta-tag">{opentlp.family}</span>
                            {/if}
                            {#if opentlp && opentlp.status}
                                <span
                                    class="meta-status status-{opentlp.status}"
                                    title="OpenTLP catalogue status"
                                >OpenTLP: {opentlp.status}</span>
                            {/if}
                        </span>
                    </button>
                {/each}
            </div>
        {/if}
    {/if}

    <div class="catalogue-bar">
        <span class="catalogue-hint">OpenTLP-supported models &bull; hardware catalogue {OPENTLP_SNAPSHOT.generated}</span>
        <a
            href={OPENTLP_CATALOGUE_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="catalogue-link"
            title="Browse full Open Thermal Label Printer catalogue"
        >
            <span>OpenTLP catalogue</span>
            <Icon name="external-link" size={12} />
        </a>
    </div>
</div>

<style>
    .picker-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .step-guide {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 2px 0;
    }
    .step-guide-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text);
    }
    .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--accent);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
    }
    .step-guide-desc {
        font-size: 12px;
        color: var(--muted);
        margin: 0;
        line-height: 1.4;
    }
    .search-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text);
        transition: border-color 0.15s ease;
    }
    .search-wrap:focus-within {
        border-color: var(--accent);
        box-shadow: inset 3px 0 0 var(--accent);
    }
    .search-icon {
        display: inline-flex;
        align-items: center;
        color: var(--muted);
        flex-shrink: 0;
    }
    .search-input {
        appearance: none;
        -webkit-appearance: none;
        flex: 1;
        min-width: 0;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: inherit;
        font: inherit;
        font-size: 13px;
        outline: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
    }
    .search-input:focus {
        border: 0 !important;
        outline: 0 !important;
        box-shadow: none !important;
    }
    .search-input::placeholder {
        color: var(--muted);
    }
    .clear-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border: none;
        background: var(--border);
        color: var(--muted);
        border-radius: 2px;
        cursor: pointer;
        font-size: 13px;
        line-height: 1;
        padding: 0;
    }
    .clear-btn:hover {
        color: var(--text);
    }
    .current-selection-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 12px;
        background: color-mix(in srgb, var(--accent) 8%, var(--panel-2));
        border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
        border-radius: 4px;
        font-size: 12px;
    }
    .current-info {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }
    .current-label {
        color: var(--muted);
    }
    .current-name {
        color: var(--text);
    }
    .current-jump-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        background: var(--accent);
        color: #fff;
        border: none;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
    }
    .app-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
        gap: 10px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .app-card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 8px;
        padding: 12px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        color: inherit;
        font: inherit;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
        transition: border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
    }
    .app-card:hover,
    .app-card:focus-visible {
        border-color: var(--app-brand, var(--accent));
        transform: translateY(-1px);
        box-shadow: 0 3px 12px color-mix(in srgb, var(--app-brand, var(--accent)) 16%, transparent);
        outline: none;
    }
    .app-card-top {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .app-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 16px;
        flex-shrink: 0;
        border: 1px solid transparent;
    }
    .app-badge.light-bg {
        border-color: var(--border);
    }
    .app-header-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
        overflow: hidden;
    }
    .app-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        width: 100%;
    }
    .app-dev {
        font-size: 11px;
        color: var(--muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        width: 100%;
    }
    .app-store-links {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .active-store-links {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: 6px;
        flex-wrap: wrap;
    }
    .store-link-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--muted);
        text-decoration: none;
        padding: 2px 6px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--panel) 70%, var(--border));
        border: 1px solid var(--border);
        transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        white-space: nowrap;
        box-sizing: border-box;
    }
    .store-link-chip:hover {
        color: var(--accent);
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 10%, var(--panel));
        text-decoration: none;
    }
    .app-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        font-size: 11px;
        padding-top: 6px;
        border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .app-count {
        color: var(--muted);
        white-space: nowrap;
    }
    .app-action {
        color: var(--accent);
        font-weight: 600;
        white-space: nowrap;
        margin-left: auto;
    }
    .fallback-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
        padding-top: 12px;
        border-top: 1px solid var(--border);
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .fallback-title {
        font-size: 11px;
        font-weight: 600;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .fallback-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));
        gap: 8px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .fallback-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        cursor: pointer;
        text-align: left;
        color: inherit;
        font: inherit;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        overflow: hidden;
        transition: border-color 0.15s ease;
    }
    .fallback-card:hover {
        border-color: var(--accent);
    }
    .fallback-card.on {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, var(--panel-2));
    }
    .fallback-icon {
        color: var(--muted);
        flex-shrink: 0;
    }
    .fallback-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
        overflow: hidden;
    }
    .fallback-content strong {
        font-size: 12px;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .fallback-content span {
        font-size: 10px;
        color: var(--muted);
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .browse-all-row {
        display: flex;
        justify-content: center;
        padding-top: 4px;
    }
    .browse-all-btn {
        background: none;
        border: none;
        color: var(--accent);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        padding: 4px 8px;
    }
    .browse-all-btn:hover {
        text-decoration: underline;
    }
    .app-nav-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 4px;
        flex-wrap: wrap;
    }
    .back-to-apps-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 3px;
        color: var(--text);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s ease;
    }
    .back-to-apps-btn:hover {
        border-color: var(--accent);
        color: var(--accent);
    }
    .active-app-heading {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text);
    }
    .mini-app-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        border: 1px solid transparent;
    }
    .mini-app-badge.light-bg {
        border-color: var(--border);
    }
    .active-app-dev {
        font-size: 11px;
        color: var(--muted);
    }
    .search-and-filters {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .filters-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    .filter-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
    }
    .filter-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--muted);
    }
    .filter-select {
        padding: 3px 6px;
        font-size: 11px;
        background: var(--panel-2);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
    }
    .filter-select:focus {
        border-color: var(--accent);
    }
    .catalogue-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 11px;
        color: var(--muted);
        padding: 0 2px;
    }
    .catalogue-hint {
        line-height: 1.4;
    }
    .catalogue-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--accent);
        text-decoration: none;
        font-weight: 500;
        font-size: 11px;
        white-space: nowrap;
    }
    .catalogue-link:hover {
        text-decoration: underline;
    }
    .printer-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 10px;
    }
    .printer-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 12px 8px;
        background: var(--panel-2);
        border: 1px solid var(--border);
        border-radius: 2px;
        cursor: pointer;
        color: inherit;
        font: inherit;
        text-align: center;
        box-shadow: none;
        transition: border-color 0.15s ease, background 0.15s ease;
    }
    .printer-card:hover {
        border-color: var(--accent);
    }
    .section-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted);
        margin-top: 4px;
        margin-bottom: -2px;
    }
    .auto-grid {
        margin-bottom: 4px;
    }
    .printer-card.auto-card {
        border-style: dashed;
        border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
        background: color-mix(in srgb, var(--accent) 3%, var(--panel-2));
    }
    .printer-card.auto-card:hover {
        border-style: solid;
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, var(--panel-2));
    }
    .printer-card.auto-card.on {
        border-style: solid;
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 14%, var(--panel-2));
    }
    .auto-icon {
        color: var(--accent);
    }
    .auto-badge {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--accent);
        letter-spacing: 0.05em;
    }
    .card-desc {
        font-size: 11px;
        color: var(--muted);
        margin-top: 2px;
    }
    .printer-card.on {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, var(--panel-2));
        box-shadow: inset 0 3px 0 var(--accent);
    }
    .card-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 72px;
        color: var(--muted);
    }
    .card-name {
        font-size: 11px;
        color: var(--muted);
    }
    .card-model {
        font-size: 13px;
        color: var(--text);
    }
    .card-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 3px;
        margin-top: 2px;
        max-width: 100%;
    }
    .meta-tag,
    .meta-status {
        font-size: 10px;
        font-weight: 500;
        line-height: 1.2;
        padding: 1px 4px;
        border-radius: 2px;
        background: var(--panel);
        color: var(--muted);
        border: 1px solid var(--border);
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .meta-status {
        text-transform: capitalize;
    }
    .meta-status.status-verified {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
    }
    .meta-tag.meta-app {
        color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, var(--panel));
        border-color: color-mix(in srgb, var(--accent) 25%, var(--border));
    }
    .meta-tag.meta-kind {
        color: var(--muted);
    }
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 32px 16px;
        text-align: center;
        background: var(--panel-2);
        border: 1px dashed var(--border);
        border-radius: 3px;
        color: var(--muted);
    }
    .empty-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--muted);
        margin-bottom: 2px;
    }
    .empty-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
    }
    .empty-hint {
        margin: 0;
        font-size: 12px;
        max-width: 320px;
        line-height: 1.4;
    }
    .reset-search-btn {
        margin-top: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 2px;
        background: var(--panel);
        border: 1px solid var(--border);
        color: var(--text);
        cursor: pointer;
    }
    .reset-search-btn:hover {
        border-color: var(--accent);
        color: var(--accent);
    }
    @media (max-width: 420px) {
        .app-grid,
        .fallback-grid {
            grid-template-columns: 1fr;
        }
        .printer-grid {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .catalogue-bar {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
        }
    }
</style>
