// Vadodara Flood Archives - Main Application Logic
// Author: Civic Tech Initiative | Zero Hallucination Policy

// Global State
let map;
let markers = [];
let userLocationMarker = null;
let currentMode = 'ARCHIVE'; // 'ARCHIVE' | 'RELIEF'
let sheltersVisible = false;
let mapInitialized = false;

const COMMUNITY_REPORTS_URL = 'https://docs.google.com/spreadsheets/d/1dbaWwodlJAyFcPc9JI9jBH3thcnfptlCKjPkiuFQImY/export?format=csv';
const SOS_FEED_URL = 'https://docs.google.com/spreadsheets/d/1tLWWsCaB-AmLJwTX1JhgFTWqfZ-u04qqVmcCNaO4sfo/export?format=csv';

const REQUEST_PRESENTATION = Object.freeze({
    RESCUE: { label: 'Rescue', color: '#ef4444', marker: '\u{1F6A8}' },
    FOOD: { label: 'Food', color: '#f59e0b', marker: '\u{1F372}' },
    MEDS: { label: 'Medical', color: '#3b82f6', marker: '\u{1F48A}' },
    SHELTER: { label: 'Shelter', color: '#10b981', marker: '\u{1F3E0}' },
    DEFAULT: { label: 'Urgent', color: '#ef4444', marker: '\u{1F198}' }
});

const EMERGENCY_CONTACTS = Object.freeze([
    { label: 'Fire', tel: '101', display: '101', copyValue: '101' },
    { label: 'Ambulance', tel: '108', display: '108', copyValue: '108' },
    { label: 'Police', tel: '100', display: '100', copyValue: '100' },
    { label: 'NDRF', tel: '02652424888', display: '0265-2424888', copyValue: '02652424888' }
]);

// Initialize Application
document.addEventListener('DOMContentLoaded', function () {
    // Show disclaimer modal on first load
    showDisclaimerModal();

    // Event Listeners
    document.getElementById('acceptDisclaimer').addEventListener('click', acceptDisclaimer);
    document.getElementById('aboutBtn').addEventListener('click', showAboutModal);
    document.getElementById('closeAbout').addEventListener('click', closeAboutModal);
    document.getElementById('disclaimerLink').addEventListener('click', (e) => {
        e.preventDefault();
        showDisclaimerModal();
    });

    // NEW: Mode Toggle Listener
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleMode);
    }

    // Community Layer Toggle
    const commToggle = document.getElementById('community-toggle');
    if (commToggle) {
        commToggle.addEventListener('click', toggleCommunityLayer);
    }

    // Updated Language Toggle logic (if needed) -> Removed
    // const langToggle = document.getElementById('langToggle');
    // if (langToggle) {
    //    langToggle.addEventListener('click', toggleLanguage);
    // }

    // Tab Switching (Segmented Control)
    document.getElementById('tab-1').addEventListener('change', () => switchTab('simulator'));
    document.getElementById('tab-2').addEventListener('change', () => switchTab('analysis'));

    // Simulator Controls
    document.getElementById('ajwaLevel').addEventListener('input', updateAjwaValue);
    document.getElementById('localRain').addEventListener('input', updateRainValue);
    document.getElementById('runSimulation').addEventListener('click', runSimulation);

    // Event Listeners for NEW Menu Buttons
    const safetyBtn = document.getElementById('safety-btn');
    if (safetyBtn) safetyBtn.addEventListener('click', checkUserSafety);

    const menuReportBtn = document.getElementById('menu-report-btn');
    if (menuReportBtn) menuReportBtn.addEventListener('click', openReportModal);

    // Close modal on overlay click
    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target.id === 'report-modal') closeReportModal();
        });

        // Close on 'x' button
        const closeBtn = reportModal.querySelector('.close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeReportModal);
    }

    // Old Report Logic (Cleanup if needed, but keeping for safety)
    const reportBtn = document.getElementById('report-btn');
    if (reportBtn) reportBtn.addEventListener('click', openReportModal);
});

// "Am I Safe?" Geolocation Logic
function checkUserSafety() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    const btn = document.getElementById('safety-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>&#9203;</span> Locating...';
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            // 1. Fly to user
            map.flyTo([lat, lng], 15, { duration: 1.5 });

            // 2. Add User Marker
            if (userLocationMarker) map.removeLayer(userLocationMarker);
            userLocationMarker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #3b82f6;"></div>',
                    iconSize: [20, 20]
                })
            }).addTo(map);

            // 3. Check Risk Proximity (Nearest Zone)
            let nearestDist = Infinity;
            let nearestZone = null;

            floodZones.forEach(zone => {
                const dist = map.distance([lat, lng], zone.coords); // Leaflet distance in meters
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestZone = zone;
                }
            });

            // Convert to km
            const distKm = (nearestDist / 1000).toFixed(2);

            // 4. Determine Status
            let statusHtml = '';
            if (nearestDist < 500) { // Closer than 500m
                // Get risk data
                const ledgerData = evidenceLedger.zones[nearestZone.id];
                // Calculate current risk if possible, else use default high
                statusHtml = `
                    <div style="text-align: center; min-width: 200px;">
                        <strong style="color: #ef4444; font-size: 1.1rem;">&#9888;&#xFE0F; BE CAREFUL</strong><br>
                        <p style="margin: 8px 0; font-size: 0.9rem;">
                            You are <strong>${(nearestDist).toFixed(0)}m</strong> from a known flood zone:<br>
                            <u>${ledgerData.location}</u>
                        </p>
                        <button onclick="shareZone('${nearestZone.id}', '${ledgerData.location}', window.location.href)" 
                            style="margin-top: 5px; padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px;">
                            Check Zone Details
                        </button>
                    </div>
                `;
            } else {
                statusHtml = `
                    <div style="text-align: center; min-width: 200px;">
                        <strong style="color: #10b981; font-size: 1.1rem;">&#9989; YOU SEEM SAFE</strong><br>
                        <p style="margin: 8px 0; font-size: 0.9rem;">
                            No verified flood archives found within 500m of your location.
                        </p>
                        <small style="color: #aaa;">Nearest zone: ${distKm}km away</small>
                    </div>
                `;
            }

            // Open Popup
            userLocationMarker.bindPopup(statusHtml).openPopup();

            // Reset Button
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        (error) => {
            console.error(error);
            alert('Unable to retrieve your location. Please check GPS settings.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}


// Tab Switching Function
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`panel-${tabName}`).classList.add('active');

    // Generate zone cards when Analysis tab is opened
    if (tabName === 'analysis') {
        generateZoneCards();
    }

    // Expand sidebar when switching tabs on mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('collapsed')) {
        sidebar.classList.remove('collapsed');
    }
}

// DRAGGABLE BOTTOM SHEET LOGIC (3-Step Physics)
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const dragHandle = document.getElementById('drag-handle-area');

    // Fallback/Safety check
    if (!sidebar || !dragHandle) return;

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;

    // 1. TOUCH START
    dragHandle.addEventListener('touchstart', (e) => {
        isDragging = true;
        startY = e.touches[0].clientY;

        // Get current visual height (in pixels)
        startHeight = sidebar.getBoundingClientRect().height;

        // Disable animation while dragging
        sidebar.classList.add('is-dragging');
    }, { passive: false });

    // 2. TOUCH MOVE (The Drag)
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;

        // Prevent default scrolling of the page
        if (e.cancelable) e.preventDefault();

        const currentY = e.touches[0].clientY;
        const deltaY = startY - currentY; // Up is positive

        // Calculate new height (px)
        const newHeight = startHeight + deltaY;

        // Apply new height instantly
        sidebar.style.height = `${newHeight}px`;
    }, { passive: false });

    // 3. TOUCH END (The Snap)
    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        sidebar.classList.remove('is-dragging');

        // Get final height to decide where to snap
        const finalHeight = sidebar.getBoundingClientRect().height;
        const windowHeight = window.innerHeight;

        // Logic: Where should it snap?
        if (finalHeight > windowHeight * 0.6) {
            // Snap to FULL (90vh)
            sidebar.style.height = '90vh';
            sidebar.classList.add('sheet-expanded');
            sidebar.classList.remove('sheet-collapsed');
        } else if (finalHeight < windowHeight * 0.25) {
            // Snap to MINIMIZED (12vh)
            sidebar.style.height = '12vh';
            sidebar.classList.add('sheet-collapsed');
            sidebar.classList.remove('sheet-expanded');
        } else {
            // Snap to DEFAULT (40vh)
            sidebar.style.height = '40vh';
            sidebar.classList.remove('sheet-expanded');
            sidebar.classList.remove('sheet-collapsed');
        }
    });

    // 4. CLICK TO TOGGLE (For tap interaction)
    dragHandle.addEventListener('click', () => {
        // Simple logic: if small, open. If big, close.
        const h = sidebar.getBoundingClientRect().height;
        const isSmall = h < window.innerHeight * 0.3;

        if (isSmall) {
            sidebar.style.height = '40vh'; // Open
            sidebar.classList.remove('sheet-collapsed');
        } else {
            sidebar.style.height = '12vh'; // Close
            sidebar.classList.add('sheet-collapsed');
            sidebar.classList.remove('sheet-expanded');
        }
    });
});



// Generate Zone Cards for Analysis Tab (All 50 Zones)
function generateZoneCards() {
    const container = document.getElementById('zonesContainer');
    const countEl = document.getElementById('zoneCount');
    if (!container || !evidenceLedger) return;

    // Clear existing
    container.innerHTML = '';

    // Calculate risk for all zones and sort by score (highest first)
    const zonesWithRisk = [];

    Object.keys(evidenceLedger.zones).forEach(zoneId => {
        const zone = evidenceLedger.zones[zoneId];
        const history = zone.history || {};

        // Calculate risk score using same algorithm as markers
        let score = 0;

        // Year Weights: Recent flooding (2024-2025) weighted highest (35 each = 70% if both flooded)
        // Historical baseline (2019) also significant (20%) as it was a major event
        // Mid-years (2020-2023) given lower weight (2.5 each) for temporal decay
        // Total possible if all years critical: 100 points
        const weights = {
            '2025': 35,  // Current year (most relevant)
            '2024': 35,  // Last year (recent pattern)
            '2023': 2.5, // Temporal decay begins
            '2022': 2.5,
            '2021': 2.5,
            '2020': 2.5,
            '2019': 20   // Baseline year (major flood event)
        };

        const getSeverity = (status) => {
            if (!status || status.toLowerCase() === 'safe') return 0;
            const critical = ['submerged', 'waist', 'chest', 'neck', 'roof', 'marooned', 'evacuated', 'flooded', 'first floor', 'washed away'];
            if (critical.some(k => status.toLowerCase().includes(k))) return 1.0;
            const moderate = ['knee', 'waterlogged', 'accumulated', 'alert', 'warning', 'road logging', 'parking', 'overflow'];
            if (moderate.some(k => status.toLowerCase().includes(k))) return 0.5;
            return 0;
        };

        Object.keys(weights).forEach(year => {
            if (history[year]) {
                score += weights[year] * getSeverity(history[year]);
            }
        });

        let tier = 'low';
        if (score >= 70) tier = 'critical';
        else if (score >= 40) tier = 'high';
        else if (score >= 15) tier = 'moderate';

        // Find coordinates from floodZones
        const spatial = floodZones.find(z => z.id === zoneId);

        zonesWithRisk.push({
            id: zoneId,
            name: zone.location,
            score: Math.round(score),
            tier: tier,
            coords: spatial ? spatial.coords : null
        });
    });

    // Sort by score descending
    zonesWithRisk.sort((a, b) => b.score - a.score);

    // Generate HTML
    zonesWithRisk.forEach(zone => {
        const card = document.createElement('div');
        card.className = 'zone-card';
        card.setAttribute('data-zone-id', zone.id);
        card.innerHTML = `
            <span class="zone-name">${zone.name}</span>
            <span class="zone-score ${zone.tier}">${zone.score}</span>
        `;
        card.addEventListener('click', () => flyToZone(zone.id, zone.coords));
        container.appendChild(card);
    });

    countEl.textContent = `${zonesWithRisk.length} verified zones (Jan 2026)`;
}

// Filter Zones in Analysis Tab
function filterZones() {
    const input = document.getElementById('zoneSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.zone-card');
    let visible = 0;

    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        const match = text.includes(input);
        card.style.display = match ? 'flex' : 'none';
        if (match) visible++;
    });

    document.getElementById('zoneCount').textContent = `${visible} zones shown`;
}

// Fly to Zone on Map when Card is Clicked
function flyToZone(zoneId, coords) {
    if (!coords || !map) return;

    // Switch to Simulator tab first (to see map better)
    document.getElementById('tab-1').checked = true;
    switchTab('simulator');

    // Fly to the zone
    map.flyTo(coords, 15, { duration: 1 });

    // Find and open the marker popup
    setTimeout(() => {
        markers.forEach(m => {
            if (m.zone && m.zone.location_id === zoneId) {
                m.marker.openPopup();
            }
        });
    }, 1000);
}



// Disclaimer Modal Functions
function showDisclaimerModal() {
    document.getElementById('disclaimerModal').classList.remove('hidden');
}

function acceptDisclaimer() {
    document.getElementById('disclaimerModal').classList.add('hidden');
    document.getElementById('app').classList.remove('app-hidden');
    ensureMapInitialized();
}

function showAboutModal() {
    document.getElementById('aboutModal').classList.remove('hidden');
}

function closeAboutModal() {
    document.getElementById('aboutModal').classList.add('hidden');
}

function ensureMapInitialized() {
    if (mapInitialized && map) {
        map.invalidateSize();
        return map;
    }

    return initializeMap();
}

// Map Initialization
function initializeMap() {
    if (mapInitialized && map) {
        map.invalidateSize();
        return map;
    }
    // Initialize Leaflet map centered on Vadodara
    // Initialize Leaflet map centered on Vadodara
    // Optimization: Disable zoomAnimation ONLY on mobile to prevent popup jitter
    // Keep it enabled on desktop for smooth feel
    const isMobile = L.Browser.mobile;

    map = L.map('map', {
        // Mobile: Disable animations & fractional zoom for stability (prevents jitter)
        // Desktop: Enable animations & fractional zoom for smoothness
        zoomAnimation: !isMobile,
        markerZoomAnimation: !isMobile,
        fadeAnimation: true,

        // Zoom Snapping & Sensitivity
        zoomSnap: isMobile ? 1 : 0.25,     // Mobile: Integer steps (1) prevents micro-stutter. Desktop: Smooth (0.25)
        zoomDelta: isMobile ? 1 : 0.25,    // Mobile: Big steps. Desktop: Small steps.
        wheelPxPerZoomLevel: 60            // Reset to default (was 120) for standard sensitivity
    }).setView([22.3072, 73.1812], 12);
    mapInitialized = true;

    // Base Layer Options
    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    // Add default layer
    darkLayer.addTo(map);

    // Layer Control
    const baseMaps = {
        'Night basemap': darkLayer,
        'Satellite imagery': satelliteLayer,
        'Street map': streetLayer
    };

    L.control.layers(baseMaps, null, {
        position: 'topright',
        collapsed: true
    }).addTo(map);

    // Add Vishwamitri River Path (Context Layer)
    addRiverPath();

    // Add flood zone markers
    addFloodZoneMarkers();

    // Load community reports layer (crowdsourced data)
    loadCommunityReports();

    // FIX: Force map redraw to prevent gray screen on first load
    // This handles the race condition where CSS may not be fully loaded
    setTimeout(function () {
        if (map) map.invalidateSize();
    }, 200);

    // Extra safety: Redraw again when the window is fully loaded (fixes slow connections)
    window.addEventListener('load', function () {
        setTimeout(function () {
            if (map) map.invalidateSize();
        }, 500);
    });
}

// Add Vishwamitri River Path as Context Layer
function addRiverPath() {
    // Approximate coordinates for Vishwamitri River through Vadodara
    // From North (Harni area) to South (Vadsar area)
    const riverCoords = [
        [22.3600, 73.1850], // North - near Vemali
        [22.3500, 73.1900], // Harni area
        [22.3400, 73.1950], // Sama area
        [22.3350, 73.1920], // Agora/Siddharth
        [22.3300, 73.1900], // Near Fatehgunj
        [22.3200, 73.1880], // Karelibaug
        [22.3100, 73.1850], // Sayajigunj
        [22.3050, 73.1820], // Parshuram Bhatta
        [22.3000, 73.1800], // Kala Ghoda
        [22.2950, 73.1780], // Vishwamitri Station
        [22.2900, 73.1760], // Mujmahuda
        [22.2800, 73.1750], // Akota
        [22.2700, 73.1780], // Manjalpur
        [22.2600, 73.1820], // Vadsar Entry
        [22.2500, 73.1850], // Koteshwar
        [22.2400, 73.1900]  // South - past Vadsar
    ];

    // Draw the river as thick transparent "flood plain" effect
    L.polyline(riverCoords, {
        color: '#00BFFF',       // Deep Sky Blue
        weight: 18,             // Thick line (mimics river width)
        opacity: 0.25,          // Transparent (so markers show through)
        lineCap: 'round',       // Smooth ends
        lineJoin: 'round',
        className: 'river-flow'
    }).addTo(map).bindTooltip('Vishwamitri River', {
        permanent: false,
        direction: 'center',
        className: 'river-label'
    });
}

// Add Flood Zone Markers to Map
function addFloodZoneMarkers() {
    // Iterate over the spatial zones (skeleton)
    floodZones.forEach(zone => {
        // Retrieve content (flesh) from ledger
        const ledgerData = evidenceLedger.zones[zone.id];
        if (!ledgerData) return; // Skip if no data

        // WEIGHTED SCORING ALGORITHM
        // Risk calculation using year weights and severity multipliers
        function calculateRisk(history) {
            let score = 0;

            // 1. Define Point Values for Years (Recency Bias)
            const weights = {
                '2025': 35,  // Most relevant (last monsoon)
                '2024': 35,  // Critical benchmark (major disaster)
                '2023': 2.5,
                '2022': 2.5,
                '2021': 2.5,
                '2020': 2.5,
                '2019': 20   // Historic flood reference
            };

            // 2. Define Severity Logic (The "Parser")
            const getSeverity = (status) => {
                if (!status || status.toLowerCase() === 'safe') return 0;

                // Keywords for HIGH severity (Multiplier 1.0)
                const criticalKeywords = ['submerged', 'waist', 'chest', 'neck', 'roof', 'marooned',
                    'evacuated', 'flooded', 'first floor', 'washed away',
                    'rescued', 'ground floor', 'basement', '5ft', '12ft', '15ft'];
                if (criticalKeywords.some(k => status.toLowerCase().includes(k))) return 1.0;

                // Keywords for MEDIUM severity (Multiplier 0.5)
                const moderateKeywords = ['knee', 'waterlogged', 'accumulated', 'alert', 'warning',
                    'road logging', 'parking', 'overflow', 'closed', 'passable',
                    'tracks', 'platform', 'road blocked'];
                if (moderateKeywords.some(k => status.toLowerCase().includes(k))) return 0.5;

                return 0; // Default safe
            };

            // 3. Calculate Total Score
            Object.keys(weights).forEach(year => {
                const status = history[year];
                if (status) {
                    score += weights[year] * getSeverity(status);
                }
            });

            // 4. Assign Color Tier
            if (score >= 70) return { color: '#ff3b3b', label: 'CRITICAL', score: Math.round(score) };
            if (score >= 40) return { color: '#ff8c42', label: 'HIGH', score: Math.round(score) };
            if (score >= 15) return { color: '#ffd23f', label: 'MODERATE', score: Math.round(score) };
            return { color: '#06d6a0', label: 'LOW', score: Math.round(score) };
        }

        // Calculate risk using the algorithm
        const history = ledgerData.history || {};
        const riskResult = calculateRisk(history);

        const markerColor = riskResult.color;
        const calculatedRisk = riskResult.label;
        const riskScore = riskResult.score;

        // DYNAMIC RADIUS: Size = Risk (Critical bigger, Low smaller)
        let markerSize = 16; // Default
        if (calculatedRisk === 'CRITICAL') markerSize = 24;
        else if (calculatedRisk === 'HIGH') markerSize = 20;
        else if (calculatedRisk === 'MODERATE') markerSize = 14;
        else markerSize = 10; // LOW

        // Pulse animation class for critical zones
        const pulseClass = calculatedRisk === 'CRITICAL' ? 'marker-critical' : '';

        // Create custom marker icon with dynamic size
        const customIcon = L.divIcon({
            className: `custom-marker ${pulseClass}`,
            html: `<div style="
                background: ${markerColor};
                width: ${markerSize}px;
                height: ${markerSize}px;
                border-radius: 50%;
                border: 2px solid rgba(0,0,0,0.8);
                box-shadow: 0 0 ${Math.floor(markerSize / 2)}px ${markerColor};
                opacity: 0.85;
            "></div>`,
            iconSize: [markerSize, markerSize],
            iconAnchor: [markerSize / 2, markerSize / 2]
        });

        // Create marker (zIndexOffset for layering: Critical on top)
        const zOffset = calculatedRisk === 'CRITICAL' ? 1000 :
            calculatedRisk === 'HIGH' ? 500 :
                calculatedRisk === 'MODERATE' ? 100 : 0;
        const marker = L.marker(zone.coords, { icon: customIcon, zIndexOffset: zOffset }).addTo(map);

        // Create detailed popup
        const zoneForPopup = {
            location_id: zone.id,
            name: ledgerData.location,
            calculated_risk: calculatedRisk,
            risk_score: riskScore // Pass calculated score for popup
        };

        const popupContent = createPopupContent(zoneForPopup);
        marker.bindPopup(popupContent, {
            maxWidth: 320,
            className: 'custom-popup'
        });

        markers.push({ marker, zone: zoneForPopup });
    });
}

// Helper function for evidence icons
function getIcon(type) {
    const icons = {
        'SATELLITE': 'SAT',
        'GOVT': 'GOV',
        'VIDEO': 'VID',
        'NEWS': 'SRC'
    };
    return icons[type] || 'REF';
}

// Create Popup Content for Markers (History Table Card)
function createPopupContent(zone) {
    // 1. FALLOUT CATCH: Check if ledger data exists for this location_id
    const data = typeof evidenceLedger !== 'undefined' ? evidenceLedger.zones[zone.location_id] : null;

    // If spatial point exists but ledger is missing (Safety Net)
    if (!data) {
        return `
            <div class="dossier-card">
                <div class="dossier-header">
                    <strong>${zone.name || 'Unknown Zone'}</strong>
                    <span class="risk-tag moderate">PENDING</span>
                </div>
                <div style="padding: 12px; color: #aaa; font-style: italic;">
                    Detailed verification data pending for this zone.
                </div>
            </div>
        `;
    }

    // 2. BUILD HISTORY TABLE
    const years = ['2025', '2024', '2023', '2022', '2021', '2020', '2019'];
    let historyRows = '';
    years.forEach(year => {
        const status = data.history[year] || 'No Data';
        const isSafe = status.toLowerCase() === 'safe';
        const statusColor = isSafe ? '#06d6a0' : '#ff8c42';
        historyRows += `
            <tr>
                <td style="padding: 4px 8px; border-bottom: 1px solid #333; font-weight: 600;">${year}</td>
                <td style="padding: 4px 8px; border-bottom: 1px solid #333; color: ${statusColor};">${status}</td>
            </tr>
        `;
    });

    // 3. CREATE CARD
    const baseUrl = window.location.protocol === 'file:'
        ? 'https://vadodara-flood-archives.org'
        : window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?zone=${zone.location_id}`;

    return `
        <div class="dossier-card">
            <div class="dossier-header">
                <strong>${data.location}</strong>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="risk-tag ${(zone.calculated_risk || data.risk_level).toLowerCase()}">${zone.calculated_risk || data.risk_level}</span>
                    ${zone.risk_score !== undefined ? `<span style="font-size: 0.7rem; color: #888;">(${zone.risk_score}/100)</span>` : ''}
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 8px;">
                <thead>
                    <tr style="color: #888; text-transform: uppercase; font-size: 0.7rem;">
                        <th style="text-align: left; padding: 4px 8px;">Year</th>
                        <th style="text-align: left; padding: 4px 8px;">Flood Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyRows}
                </tbody>
            </table>

            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333;">
                <a href="${data.source_url}" target="_blank" rel="noopener noreferrer" 
                   style="color: #4a90e2; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                    View verified source
                </a>
            </div>

            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333;">
                <button onclick="shareZone('${zone.location_id}', '${data.location.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${shareUrl}')" 
                        style="width: 100%; padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    Share this zone
                </button>
            </div>
        </div>
    `;
}

function safeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).replace(/\s+/g, ' ').trim();
    return normalized || fallback;
}

function safeHttpUrl(value) {
    const candidate = safeText(value);
    if (!candidate) return null;

    try {
        const url = new URL(candidate);
        return url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

function safeCoords(latValue, lngValue) {
    const lat = parseFloat(latValue);
    const lng = parseFloat(lngValue);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return [lat, lng];
}

function createFeedStatusMessage(message) {
    const el = document.createElement('div');
    el.className = 'feed-status';
    el.textContent = safeText(message, 'No data available.');
    return el;
}

function renderFeedMessage(message) {
    const feedContainer = document.getElementById('live-feed-list');
    if (!feedContainer) return;
    feedContainer.replaceChildren(createFeedStatusMessage(message));
}

function setCommunityFeedStatus(message, state = 'idle') {
    const statusEl = document.getElementById('community-status');
    if (!statusEl) return;
    statusEl.textContent = safeText(message, 'Live community reports unavailable.');
    statusEl.dataset.state = state;
}

function focusMapLocation(coords, zoom = 16) {
    if (!map || !coords) return;
    map.flyTo(coords, zoom, { duration: 1 });
}

function createPopupStat(label, value) {
    const container = document.createElement('div');
    container.style.cssText = 'background: rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';

    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-bottom: 2px;';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.style.cssText = 'font-size: 0.9rem; font-weight: 600; color: #e2e8f0;';
    valueEl.textContent = safeText(value, 'Unknown');

    container.appendChild(labelEl);
    container.appendChild(valueEl);
    return container;
}

// Note: "Am I Safe?" geolocation feature has been removed as requested

// ========================================
// LIVE COMMUNITY LAYER (Crowdsourced Reports)
// ========================================

let communityMarkers = []; // Track community markers for toggle
let communityLayerVisible = true;

/**
 * Load and display community flood reports from Google Sheets
 * Reports are submitted via Tally form -> Google Sheets -> published CSV
 */
async function loadCommunityReports() {
    if (!mapInitialized) {
        return;
    }

    setCommunityFeedStatus('Syncing live community reports...', 'loading');
    clearCommunityMarkers();

    try {
        const response = await fetch(COMMUNITY_REPORTS_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const csvData = await response.text();
        const reports = parseCSV(csvData);
        let plottedCount = 0;

        reports.forEach((report) => {
            if (!isValidReport(report) || !isApproved(report)) {
                return;
            }

            const marker = plotCommunityMarker(report);
            if (marker) {
                plottedCount++;
            }
        });

        if (plottedCount === 0) {
            setCommunityFeedStatus('No verified community reports right now.', 'idle');
            return;
        }

        setCommunityFeedStatus(`${plottedCount} live community reports`, 'success');
    } catch (error) {
        clearCommunityMarkers();
        setCommunityFeedStatus('Live community reports unavailable.', 'error');
        console.warn('Community reports unavailable:', error.message);
    }
}


function parseCSV(csv) {
    const rows = parseCSVToStringArray(csv);

    if (rows.length < 2) return []; // Need header + at least 1 row

    // Clean headers: remove newlines, quotes, extra spaces, and lowercase
    const headers = rows[0].map(h => h.replace(/[\r\n"]+/g, ' ').trim().toLowerCase());


    const reports = [];

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
        const values = rows[i];

        // Skip empty rows
        if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

        const report = {};
        headers.forEach((header, index) => {
            // Map value to header, handle missing values
            report[header] = values[index] ? values[index].trim() : '';
        });

        reports.push(report);
    }

    return reports;
}

/**
 * Robust CSV Line Parser (State Machine)
 * Correctly handles quoted fields containing newlines and commas
 */
function parseCSVToStringArray(text) {
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let insideQuotes = false;

    // Normalize newlines
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped quote ("") -> become single quote
                currentValue += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            // End of field
            currentRow.push(currentValue);
            currentValue = '';
        } else if (char === '\n' && !insideQuotes) {
            // End of row
            currentRow.push(currentValue);
            rows.push(currentRow);
            currentRow = [];
            currentValue = '';
        } else {
            // Regular character
            currentValue += char;
        }
    }

    // Handle last row if exists
    if (currentValue || currentRow.length > 0) {
        currentRow.push(currentValue);
        rows.push(currentRow);
    }

    return rows;
}

/**
 * Validate report has minimum required fields
 */
function isValidReport(report) {
    return !!safeCoords(report.latitude || report.lat, report.longitude || report.lng);
}

/**
 * Check if report is admin-approved
 */
function isApproved(report) {
    const approvalField = safeText(report.approved || '');
    const normalized = approvalField.toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

/**
 * Plot a community report as a purple marker
 */
function plotCommunityMarker(report) {
    const coords = safeCoords(report.latitude || report.lat, report.longitude || report.lng);
    if (!coords || !map) return null;

    const severity = safeText(report['water level'] || report.severity, 'Not specified');
    const timestamp = safeText(report['submitted at'] || report.timestamp || report.date, 'Unknown');
    const photoUrl = safeHttpUrl(report['upload photo/video'] || report.photo);
    const locationName = safeText(report['current location'] || report.location, 'Community Report');

    const marker = L.circleMarker(coords, {
        radius: 8,
        fillColor: '#a855f7',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.8
    });

    const popupRoot = document.createElement('div');
    popupRoot.style.cssText = "font-family: 'Inter', system-ui, -apple-system, sans-serif; color: white;";

    const header = document.createElement('div');
    header.style.cssText = 'padding: 16px 20px 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative;';

    const accent = document.createElement('div');
    accent.style.cssText = 'position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #a855f7; box-shadow: 0 0 10px #a855f7;';

    const eyebrow = document.createElement('div');
    eyebrow.style.cssText = 'font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.6); margin-bottom: 4px;';
    eyebrow.textContent = 'Community Report';

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 1.1rem; font-weight: 700; color: #ffffff;';
    title.textContent = locationName;

    header.appendChild(accent);
    header.appendChild(eyebrow);
    header.appendChild(title);

    const body = document.createElement('div');
    body.style.cssText = 'padding: 16px 20px;';

    const stats = document.createElement('div');
    stats.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;';
    stats.appendChild(createPopupStat('Water Level', severity));
    stats.appendChild(createPopupStat('Reported', formatTimestamp(timestamp)));
    body.appendChild(stats);

    if (photoUrl) {
        const media = document.createElement('div');
        media.style.cssText = 'position: relative; border-radius: 12px; overflow: hidden; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.3);';

        const image = document.createElement('img');
        image.src = photoUrl;
        image.alt = 'Flood evidence';
        image.loading = 'lazy';
        image.style.cssText = 'display: block; width: 100%; height: 160px; object-fit: cover;';
        image.addEventListener('error', () => media.remove());

        const caption = document.createElement('div');
        caption.style.cssText = 'position: absolute; bottom: 0; left: 0; width: 100%; padding: 8px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); font-size: 0.7rem; color: rgba(255,255,255,0.8);';
        caption.textContent = 'Visual Evidence';

        media.appendChild(image);
        media.appendChild(caption);
        body.appendChild(media);
    }

    const verified = document.createElement('div');
    verified.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 10px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px;';

    const verifiedDot = document.createElement('div');
    verifiedDot.style.cssText = 'width: 16px; height: 16px; background: #a855f7; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(168, 85, 247, 0.5); color: white; font-size: 0.7rem; font-weight: 700;';
    verifiedDot.textContent = 'OK';

    const verifiedText = document.createElement('div');

    const verifiedTitle = document.createElement('div');
    verifiedTitle.style.cssText = 'font-size: 0.75rem; font-weight: 700; color: #d8b4fe;';
    verifiedTitle.textContent = 'Verified Submission';

    const verifiedMeta = document.createElement('div');
    verifiedMeta.style.cssText = 'font-size: 0.65rem; color: rgba(255,255,255,0.6);';
    verifiedMeta.textContent = 'Approved by Vadodara Risk Intel';

    verifiedText.appendChild(verifiedTitle);
    verifiedText.appendChild(verifiedMeta);
    verified.appendChild(verifiedDot);
    verified.appendChild(verifiedText);
    body.appendChild(verified);

    popupRoot.appendChild(header);
    popupRoot.appendChild(body);

    marker.bindPopup(popupRoot, {
        maxWidth: 320,
        className: 'community-popup'
    });

    if (communityLayerVisible) {
        marker.addTo(map);
    }

    communityMarkers.push(marker);
    return marker;
}


function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp; // Invalid date, return as-is

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
        return timestamp;
    }
}

/**
 * Clear all community markers from map
 */
function clearCommunityMarkers() {
    communityMarkers.forEach(marker => {
        if (map && map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    communityMarkers = [];
}



/**
 * Auto-refresh community reports every 30 minutes (reduced from 5 to prevent rate limiting)
 */
setInterval(() => {
    if (mapInitialized) {
        loadCommunityReports();
    }
}, 1800000); // 30 minutes

// ========================================
// END COMMUNITY LAYER
// ========================================




// Debounce Helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Simulator - Update Display Values
function updateAjwaValue(e) {
    document.getElementById('ajwaValue').textContent = e.target.value + ' ft';
}

function updateRainValue(e) {
    document.getElementById('rainValue').textContent = e.target.value + ' inches';
}

// Run Flood Risk Simulation
function runSimulation() {
    const ajwaLevel = parseFloat(document.getElementById('ajwaLevel').value);
    const localRain = parseFloat(document.getElementById('localRain').value);
    const dhadharStatus = document.getElementById('dhadharStatus').value;

    // Calculate predictions using algorithm from data.js
    const predictions = calculateFloodRisk(ajwaLevel, localRain, dhadharStatus);

    // Display results
    displayPredictionResults(predictions);

    // Update map markers with prediction colors
    updateMarkersWithPredictions(predictions);
}

// Display Prediction Results
function displayPredictionResults(predictions) {
    const resultsContainer = document.getElementById('resultsList');
    const resultsSection = document.getElementById('predictionResults');

    resultsSection.classList.remove('hidden');

    let resultsHTML = '';
    predictions.forEach(pred => {
        if (pred.riskLevel !== 'LOW') {
            resultsHTML += `
                <div class="result-item ${pred.riskLevel}">
                    <div class="result-zone">${pred.zone}</div>
                    <div class="result-risk">
                        <strong>Risk Level:</strong> ${pred.riskLevel}
                    </div>
                    <div class="result-confidence">
                        Confidence: ${pred.confidence}%
                    </div>
                    <div class="result-reasoning">
                        ${pred.reasoning}
                    </div>
                </div>
            `;
        }
    });

    if (resultsHTML === '') {
        resultsHTML = `
            <div class="result-item LOW">
                <div class="result-zone">All zones currently low risk</div>
                <div class="result-reasoning">
                    Based on current conditions, no zones show elevated flood risk.
                    Continue monitoring during heavy rainfall.
                </div>
            </div>
        `;
    }

    resultsContainer.innerHTML = resultsHTML;

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Update Map Markers with Prediction Results
function updateMarkersWithPredictions(predictions) {
    predictions.forEach(pred => {
        const markerObj = markers.find(m => m.zone.location_id === pred.location_id);
        if (markerObj) {
            let predictionColor;
            switch (pred.riskLevel) {
                case 'SEVERE':
                    predictionColor = '#ff0000';
                    break;
                case 'HIGH':
                    predictionColor = '#ff8c42';
                    break;
                case 'MODERATE':
                    predictionColor = '#ffd23f';
                    break;
                default:
                    predictionColor = '#06d6a0';
            }

            // Update marker icon
            const updatedIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background: ${predictionColor};
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 3px solid rgba(0,0,0,0.9);
                    box-shadow: 0 0 15px ${predictionColor};
                    animation: pulse 1.5s infinite;
                "></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            markerObj.marker.setIcon(updatedIcon);
        }
    });
}

// CSS Animation for Pulsing Markers
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.1);
            opacity: 0.8;
        }
    }
`;
document.head.appendChild(style);

// Share Zone Functionality (Global function for popup buttons)
function shareZone(zoneId, zoneName, shareUrl) {
    const shareText = `Flood archive alert: ${zoneName}\n\nReview verified flood history: ${shareUrl}\n\nVadodara Flood Archives | Evidence-based risk assessment`;

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('\u2705 Link copied to clipboard!');
        }).catch(() => {
            // Fallback: show the URL for manual copy
            prompt('Copy this link to share:', shareUrl);
        });
    } else {
        // Fallback for older browsers
        prompt('Copy this link to share:', shareUrl);
    }
}

// Make shareZone globally accessible
window.shareZone = shareZone;

// Console Message - Developer Credits
console.log('%cVadodara Flood Archives', 'font-size: 20px; font-weight: bold; color: #4a90e2;');
console.log('%cZero Hallucination Policy | All data verified from ISRO/VMC sources', 'font-size: 12px; color: #a0a0a0;');
console.log('%cBuilt for civic awareness | Open Source Initiative', 'font-size: 12px; color: #06d6a0;');

// REPORT MODAL LOGIC (Live Reporting) - Mode Aware
function openReportModal() {
    const modal = document.getElementById('report-modal');
    if (!modal) return;

    const iframeContainer = document.getElementById('report-iframe-container');
    const sosIframeContainer = document.getElementById('sos-iframe-container');
    const modalTitle = document.querySelector('#report-modal h3');
    const modalCopy = document.getElementById('report-modal-copy');

    if (typeof currentMode !== 'undefined' && currentMode === 'RELIEF') {
        if (iframeContainer) iframeContainer.style.display = 'none';
        if (sosIframeContainer) sosIframeContainer.style.display = 'block';
        if (modalTitle) modalTitle.innerHTML = '&#x1F6A8; Request Urgent Help';
        if (modalCopy) modalCopy.textContent = 'Use this SOS form to request rescue, medical support, food, or shelter.';
    } else {
        if (iframeContainer) iframeContainer.style.display = 'block';
        if (sosIframeContainer) sosIframeContainer.style.display = 'none';
        if (modalTitle) modalTitle.innerHTML = '&#x1F4E2; Submit Live Report';
        if (modalCopy) modalCopy.textContent = 'Your report will be verified and added to the map.';
    }

    modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// MODE SWITCHING LOGIC (Archive vs Relief)
// ========================================

// ========================================
// STATE MACHINE: SIDEBAR & MODE MANAGER
// ========================================

// Global State for Modes
let reliefUnsubscribe = null; // Store the listener to kill it later
let currentReliefMockData = []; // Store raw data for filtering

function toggleMode(targetMode) {
    // Check if targetMode is an event object or undefined/null
    if (!targetMode || typeof targetMode !== 'string') {
        // Toggle if no specific string argument provided
        targetMode = currentMode === 'ARCHIVE' ? 'RELIEF' : 'ARCHIVE';
    }

    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    // A. CLEANUP (Stop previous mode processes)
    if (currentMode === 'RELIEF' && reliefUnsubscribe) {
        // reliefUnsubscribe(); // Real Firebase would need this
        reliefUnsubscribe = null;
    }

    // B. SWAP HTML & RE-HYDRATE
    if (targetMode === 'ARCHIVE') {
        // 1. Inject HTML
        sidebar.innerHTML = getArchiveSidebarHTML();
        // 2. Re-attach Sliders/Charts logic
        initArchiveListeners();
    }
    else if (targetMode === 'RELIEF') {
        // 1. Inject HTML
        sidebar.innerHTML = getReliefSidebarHTML();
        // 2. Re-attach SOS Button logic
        initReliefListeners();
    }

    currentMode = targetMode;
    console.log(`State Machine: Switched to ${targetMode}`);

    // Update Global UI (Header/Map)
    updateGlobalUI(targetMode);

    // Refresh Map Data
    refreshMapData();
}

function updateGlobalUI(mode) {
    const body = document.body;
    const pillIcon = document.querySelector('.mode-toggle-pill .mode-icon');
    const pillLabel = document.querySelector('.mode-toggle-pill .mode-label');
    const reportBtn = document.getElementById('menu-report-btn');

    if (mode === 'RELIEF') {
        body.classList.add('mode-relief');
        if (pillIcon) pillIcon.textContent = '\u{1F6A8}';
        if (pillLabel) pillLabel.textContent = 'RELIEF';
        if (reportBtn) reportBtn.innerHTML = '<span>&#x1F198;</span> SOS &mdash; Request Help';
    } else {
        body.classList.remove('mode-relief');
        if (pillIcon) pillIcon.textContent = '\u{1F3DB}\uFE0F';
        if (pillLabel) pillLabel.textContent = 'ARCHIVE';
        if (reportBtn) reportBtn.innerHTML = '<span>&#x1F4E2;</span> Report';
    }
}



// --- 2. HTML TEMPLATES (The View) ---

function getArchiveSidebarHTML() {
    return                                                 `
        <div class="sidebar-header">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div>
                    <h1 data-i18n="appTitle" id="app-title-text">Vadodara | Flood Archive &amp; Relief</h1>
                    <p data-i18n="appSubtitle" id="app-subtitle-text">The Flood Archive</p>
                </div>

                <div class="mode-toggle-pill" id="modeToggle">
                    <span class="mode-icon">&#x1F3DB;&#xFE0F;</span>
                    <span class="mode-label">ARCHIVE</span>
                </div>
            </div>
        </div>

        <div class="action-row" style="display: flex; gap: 10px; margin-bottom: 1rem;">
            <button id="safety-btn" class="btn-action btn-safe">
                <span>&#x1F4CD;</span> Am I Safe?
            </button>
            <button id="menu-report-btn" class="btn-action btn-report">
                <span>&#x1F4E2;</span> Report
            </button>
        </div>

        <div class="segmented-control">
            <input type="radio" name="tab" id="tab-1" checked>
            <label for="tab-1" data-i18n="tabSimulator">&#9889; Simulator</label>

            <input type="radio" name="tab" id="tab-2">
            <label for="tab-2" data-i18n="tabAnalysis">&#x1F4CA; Analysis</label>

            <div class="glider"></div>
        </div>

        <div id="panel-simulator" class="tab-content active">
            <div class="slider-group">
                <div class="slider-label">
                    <span>Ajwa Dam Level</span>
                    <span class="slider-value" id="ajwaValue">212.0 ft</span>
                </div>
                <input type="range" id="ajwaLevel" min="210" max="215" step="0.5" value="212">
            </div>

            <div class="slider-group">
                <div class="slider-label">
                    <span>Rainfall (24hr)</span>
                    <span class="slider-value" id="rainValue">0 in</span>
                </div>
                <input type="range" id="localRain" min="0" max="10" step="0.5" value="0">
            </div>

            <div class="slider-group">
                <div class="slider-label"><span>Dhadhar River</span></div>
                <select id="dhadharStatus" class="status-select">
                    <option value="NORMAL">Normal Flow</option>
                    <option value="HIGH">High (Backflow Risk)</option>
                </select>
            </div>

            <button id="runSimulation" class="btn-simulate">&#9889; Run Forecast</button>

            <div id="predictionResults" class="prediction-results hidden">
                <h3>Results</h3>
                <div id="resultsList"></div>
            </div>
        </div>

        <div id="panel-analysis" class="tab-content">
            <div class="zone-search-container">
                <input type="text" id="zoneSearch" class="zone-search-input"
                    placeholder="&#x1F50D; Search zones (e.g., Vadsar)..." oninput="filterZones()">
            </div>
            <div id="zonesContainer" class="zones-container"></div>
            <div id="zoneCount" class="zone-count"></div>
        </div>

        <div class="sidebar-footer">
            <a href="#" id="disclaimerLink">Disclaimer</a> &middot; <a href="#" id="aboutBtn">About</a>
        </div>
    `;
}

function getReliefSidebarHTML() {
    return `
        <div class="sidebar-header">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div>
                    <h1 id="app-title-text">SewaSetu</h1>
                    <p id="app-subtitle-text">Powered by Vadodara | Flood Archive &amp; Relief</p>
                </div>

                <div class="mode-toggle-pill" id="modeToggle">
                    <span class="mode-icon">&#x1F6A8;</span>
                    <span class="mode-label">RELIEF</span>
                </div>
            </div>
        </div>

        <div class="relief-container">
            <div class="action-row" style="display: flex; gap: 10px; margin-bottom: 1rem;">
                <button id="menu-report-btn" class="btn-action btn-report" style="width: 100%; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444;">
                    <span>&#x1F198;</span> SOS &mdash; Request Help
                </button>
            </div>

            <div class="zone-search-container" style="margin-bottom: 12px;">
                <input type="text" id="reliefSearch" class="zone-search-input"
                    placeholder="Search requests..." oninput="filterReliefSearch()">
            </div>

            <div class="filter-row">
                <div class="chip active" data-filter="ALL">All</div>
                <div class="chip" data-filter="RESCUE">&#x1F6A8; Rescue</div>
                <div class="chip" data-filter="MEDS">&#x1F48A; Medical</div>
                <div class="chip" data-filter="FOOD">&#x1F372; Food</div>
            </div>

            <div class="action-row-v2">
                <button id="btn-shelters" class="btn-action btn-glass-accent"><span>&#x1F3E0;</span> Find Shelters</button>
                <button id="btn-contacts" class="btn-action btn-glass-danger"><span>&#x1F4DE;</span> Emergency No.</button>
            </div>

            <div class="section-title">Live Needs</div>
            <div id="live-feed-list" class="scroll-feed">
                <div class="loading-spinner" style="color: #666; font-size: 0.8rem; text-align: center; padding: 20px;">
                    Connecting to SewaSetu Network...
                </div>
            </div>
        </div>

        <div class="sidebar-footer sidebar-footer--relief">
            <a href="#" id="disclaimerLink">Disclaimer</a> &middot; <a href="#" id="aboutBtn">About</a>
        </div>
    `;
}

// --- 3. LISTENER MANAGERS (The Controllers) ---

function initArchiveListeners() {
    // 1. Re-attach Global Toggles (Header)
    document.getElementById('modeToggle').addEventListener('click', () => toggleMode('RELIEF'));
    // document.getElementById('langToggle').addEventListener('click', toggleLanguage); // Removed

    // 2. Re-attach Menu Buttons
    document.getElementById('safety-btn').addEventListener('click', checkUserSafety);
    document.getElementById('menu-report-btn').addEventListener('click', openReportModal);

    // 3. Re-attach Tabs
    document.getElementById('tab-1').addEventListener('change', () => switchTab('simulator'));
    document.getElementById('tab-2').addEventListener('change', () => switchTab('analysis')); // This will trigger generateZoneCards

    // 4. Re-attach Simulator Controls
    document.getElementById('ajwaLevel').addEventListener('input', updateAjwaValue);
    document.getElementById('localRain').addEventListener('input', updateRainValue);
    document.getElementById('runSimulation').addEventListener('click', runSimulation);

    // 5. Re-attach Footer Links
    document.getElementById('disclaimerLink').addEventListener('click', (e) => {
        e.preventDefault();
        showDisclaimerModal();
    });
    document.getElementById('aboutBtn').addEventListener('click', showAboutModal);

    // 6. Force Tab Init (if needed)
    // switchTab('simulator'); 
}

function initReliefListeners() {
    // 1. Re-attach Global Toggles
    document.getElementById('modeToggle').addEventListener('click', () => toggleMode('ARCHIVE'));
    // document.getElementById('langToggle').addEventListener('click', toggleLanguage); // Removed

    // 2. Filter Chips Logic
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            // Remove active from all
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            // Add to clicked
            e.target.classList.add('active');
            // Filter
            filterFeed(e.target.dataset.filter);
        });
    });

    // 3. Action Buttons
    document.getElementById('btn-shelters').addEventListener('click', () => {
        showSheltersToggle();
    });

    document.getElementById('btn-contacts').addEventListener('click', openEmergencyContactsOverlay);

    // 4. Wire SOS Button
    const sosBtn = document.getElementById('menu-report-btn');
    if (sosBtn) sosBtn.addEventListener('click', openReportModal);

    // 5. Start Live Feed
    reliefUnsubscribe = subscribeToLiveRequests();
}

/**
 * Load SOS requests from Google Sheets (Tally -> Sheets -> CSV)
 * Sheet ID: 1tLWWsCaB-AmLJwTX1JhgFTWqfZ-u04qqVmcCNaO4sfo
 */
async function subscribeToLiveRequests() {
    renderFeedMessage('Connecting to SewaSetu Network...');

    try {
        const response = await fetch(SOS_FEED_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const csvData = await response.text();
        const rows = parseCSV(csvData);
        currentReliefMockData = [];

        rows.forEach((row, index) => {
            const r = {};
            Object.keys(row).forEach((key) => {
                r[key.toLowerCase().trim()] = safeText(row[key]);
            });

            const approvalValue = safeText(r['approved'] || r['approve']).toLowerCase();
            if (!['true', 'yes', '1'].includes(approvalValue)) {
                return;
            }

            const coords = safeCoords(r['latitude'] || r['lat'], r['longitude'] || r['lng']);
            const needRaw = safeText(r['what do you need?'] || r['what do you need']).toLowerCase();
            let type = 'RESCUE';

            if (needRaw.includes('food') || needRaw.includes('water')) type = 'FOOD';
            if (needRaw.includes('medical') || needRaw.includes('medicine')) type = 'MEDS';
            if (needRaw.includes('boat') || needRaw.includes('rescue')) type = 'RESCUE';
            if (needRaw.includes('shelter')) type = 'SHELTER';

            const timeRaw = safeText(r['submitted at'] || r['timestamp']);
            const time = timeRaw ? formatSOSTime(timeRaw) : 'Just now';
            const location = safeText(r['current location'] || r['location'], 'Unknown');
            const details = safeText(r['describe the situation'] || r['details']);
            const people = safeText(r['how many people?'] || r['how many people'], '?');
            const title = details || `${safeText(needRaw, 'Assistance')} request for ${people} people`;

            currentReliefMockData.push({
                id: `sos_${index}`,
                type,
                title,
                location,
                dist: coords ? 'On Map' : location,
                time,
                lat: coords ? coords[0] : null,
                lng: coords ? coords[1] : null,
                people
            });
        });

        if (currentReliefMockData.length === 0) {
            renderFeedMessage('No SOS requests yet. Submit one using the SOS button above.');
        } else {
            renderFeed(currentReliefMockData);
        }

        if (currentMode === 'RELIEF') refreshMapData();
        return function () { };
    } catch (error) {
        currentReliefMockData = [];
        renderFeedMessage('Live SOS feed unavailable. Submit a fresh request from the SOS button above.');
        if (currentMode === 'RELIEF') refreshMapData();
        console.warn('SOS feed unavailable:', error.message);
        return function () { };
    }
}


function formatSOSTime(timestamp) {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    } catch (e) {
        return timestamp;
    }
}

function filterFeed(category) {
    if (category === 'ALL') {
        renderFeed(currentReliefMockData);
    } else {
        const filtered = currentReliefMockData.filter(item => item.type === category);
        renderFeed(filtered);
    }
}

function renderFeed(data) {
    const feedContainer = document.getElementById('live-feed-list');
    if (!feedContainer) return;

    feedContainer.replaceChildren();

    if (data.length === 0) {
        feedContainer.appendChild(createFeedStatusMessage('No requests found.'));
        return;
    }

    data.forEach(item => {
        feedContainer.appendChild(createSOSCard(item));
    });
}

function getRequestPresentation(type) {
    const normalized = safeText(type, 'REQUEST').toUpperCase();
    return REQUEST_PRESENTATION[normalized] || REQUEST_PRESENTATION.DEFAULT;
}

function formatRequestType(type) {
    return getRequestPresentation(type).label;
}

function setButtonContent(button, title, subtitle) {
    if (!button) return;

    button.textContent = '';

    const strong = document.createElement('strong');
    strong.textContent = title;

    const small = document.createElement('small');
    small.textContent = subtitle;

    button.appendChild(strong);
    button.appendChild(small);
}

function copyTextValue(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'readonly');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            const copied = document.execCommand('copy');
            textarea.remove();
            if (copied) {
                resolve();
                return;
            }
        } catch (error) {
            textarea.remove();
            reject(error);
            return;
        }

        textarea.remove();
        reject(new Error('Copy failed'));
    });
}

function createEmergencyContactRow(contact) {
    const row = document.createElement('div');
    row.className = 'contact-row';

    const link = document.createElement('a');
    link.className = 'contact-link';
    link.href = 'tel:' + contact.tel;

    const label = document.createElement('span');
    label.textContent = contact.label;

    const number = document.createElement('strong');
    number.textContent = contact.display;

    link.appendChild(label);
    link.appendChild(number);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'contact-copy';
    copyButton.textContent = 'Copy';
    copyButton.setAttribute('aria-label', 'Copy ' + contact.label + ' number');
    copyButton.addEventListener('click', async () => {
        try {
            await copyTextValue(contact.copyValue);
            copyButton.textContent = 'Copied';
            window.setTimeout(() => {
                copyButton.textContent = 'Copy';
            }, 1200);
        } catch (error) {
            copyButton.textContent = 'Retry';
            window.setTimeout(() => {
                copyButton.textContent = 'Copy';
            }, 1400);
        }
    });

    row.appendChild(link);
    row.appendChild(copyButton);
    return row;
}

function openEmergencyContactsOverlay() {
    const existingOverlay = document.getElementById('emergency-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'emergency-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
    overlay.innerHTML = `
        <div style="background:rgba(30,30,30,0.95);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:1.5rem;max-width:320px;width:90%;font-family:'Inter',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid rgba(255,255,255,0.1);">
                <h3 style="color:white;margin:0;font-size:1rem;font-weight:700;">&#x1F6A8; Emergency Contacts</h3>
                <button type="button" data-close-overlay style="background:none;border:none;color:#9ca3af;font-size:1.5rem;cursor:pointer;padding:0;line-height:1;">&times;</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;">
                    <a href="tel:101" style="flex:1;color:#d1d5db;text-decoration:none;font-size:0.9rem;">&#x1F692; Fire &mdash; <strong style="color:white;">101</strong></a>
                    <button type="button" data-copy-value="101" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);color:#9ca3af;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;">&#x1F4CB;</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;">
                    <a href="tel:108" style="flex:1;color:#d1d5db;text-decoration:none;font-size:0.9rem;">&#x1F691; Ambulance &mdash; <strong style="color:white;">108</strong></a>
                    <button type="button" data-copy-value="108" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);color:#9ca3af;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;">&#x1F4CB;</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;">
                    <a href="tel:100" style="flex:1;color:#d1d5db;text-decoration:none;font-size:0.9rem;">&#x1F46E; Police &mdash; <strong style="color:white;">100</strong></a>
                    <button type="button" data-copy-value="100" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);color:#9ca3af;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;">&#x1F4CB;</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;">
                    <a href="tel:02652424888" style="flex:1;color:#d1d5db;text-decoration:none;font-size:0.9rem;">&#x1F30A; NDRF &mdash; <strong style="color:white;">0265-2424888</strong></a>
                    <button type="button" data-copy-value="02652424888" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.1);color:#9ca3af;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:0.75rem;">&#x1F4CB;</button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay || event.target.closest('[data-close-overlay]')) {
            overlay.remove();
        }
    });

    overlay.querySelectorAll('[data-copy-value]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const original = button.innerHTML;
            try {
                await copyTextValue(button.getAttribute('data-copy-value') || '');
                button.innerHTML = '&#10003;';
            } catch (error) {
                button.innerHTML = 'Retry';
            }
            window.setTimeout(() => {
                button.innerHTML = original;
            }, 1000);
        });
    });

    document.body.appendChild(overlay);
}

function createSOSCard(data) {
    const presentation = getRequestPresentation(data.type);
    const coords = safeCoords(data.lat, data.lng);
    const card = document.createElement('div');
    card.className = 'sos-card';
    card.style.borderLeftColor = presentation.color;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; gap:12px; align-items:flex-start;';

    const title = document.createElement('h3');
    title.textContent = presentation.marker + ' ' + presentation.label;

    const time = document.createElement('span');
    time.style.cssText = 'color:#96a3b5; font-size:0.72rem; white-space:nowrap;';
    time.textContent = safeText(data.time, 'Now');

    header.appendChild(title);
    header.appendChild(time);

    const details = document.createElement('p');
    details.textContent = safeText(data.title, 'Assistance requested');

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px;';

    const location = document.createElement('span');
    location.style.cssText = 'font-size:0.75rem; color:#96a3b5;';
    location.textContent = '\u{1F4CD} ' + safeText(data.location || data.dist, 'Location unavailable');
    footer.appendChild(location);

    if (coords) {
        const focusCard = () => focusMapLocation(coords);

        card.classList.add('is-clickable');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.addEventListener('click', focusCard);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                focusCard();
            }
        });

        const locateButton = document.createElement('button');
        locateButton.type = 'button';
        locateButton.textContent = 'Locate';
        locateButton.addEventListener('click', (event) => {
            event.stopPropagation();
            focusCard();
        });
        footer.appendChild(locateButton);
    }

    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(footer);
    return card;
}


function filterReliefSearch() {
    const term = document.getElementById('reliefSearch').value.toLowerCase();
    const filtered = currentReliefMockData.filter(item =>
        item.title.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term) ||
        (item.location || '').toLowerCase().includes(term)
    );
    renderFeed(filtered);
}

// ----------------------------------------------------
// HELPER: DATA REFRESH (Existing logic wrapped)
// ----------------------------------------------------
function refreshMapData() {
    if (!map) return;

    markers.forEach(m => map.removeLayer(m.marker));
    markers = [];
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }

    if (currentMode === 'ARCHIVE') {
        addFloodZoneMarkers();
    } else {
        addSOSMarkers();
    }
}

function addSOSMarkers() {
    const requests = currentReliefMockData.filter(r => safeCoords(r.lat, r.lng));

    if (requests.length === 0) return;

    requests.forEach(req => {
        const coords = safeCoords(req.lat, req.lng);
        if (!coords) return;

        const presentation = getRequestPresentation(req.type);

        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: ${presentation.color};
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                font-size: 13px;
                font-weight: 700;
                letter-spacing: 0.04em;
                z-index: 1000;
            ">${presentation.marker}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker(coords, { icon: customIcon }).addTo(map);

        const popupRoot = document.createElement('div');
        popupRoot.style.cssText = "text-align: center; font-family: 'Inter', sans-serif;";

        const badge = document.createElement('div');
        badge.style.cssText = `background: ${presentation.color}; color: white; padding: 4px 8px; border-radius: 999px; font-size: 0.68rem; font-weight: 700; display: inline-block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em;`;
        badge.textContent = presentation.label.toUpperCase() + ' REQUEST';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;';
        title.textContent = safeText(req.title, 'Assistance requested');

        const location = document.createElement('div');
        location.style.cssText = 'font-size: 0.8rem; color: #666;';
        location.textContent = '\u{1F4CD} ' + safeText(req.location, 'Unknown');

        const time = document.createElement('div');
        time.style.cssText = 'font-size: 0.75rem; color: #999;';
        time.textContent = safeText(req.time, 'Now');

        popupRoot.appendChild(badge);
        popupRoot.appendChild(title);
        popupRoot.appendChild(location);
        popupRoot.appendChild(time);

        marker.bindPopup(popupRoot);
        markers.push({ marker, data: req });
    });
}


// UI Helper: Toggle Legend
function toggleLegendBox() {
    const legend = document.getElementById('mapLegend');
    const chevron = document.getElementById('legendChevron');
    if (legend) {
        legend.classList.toggle('collapsed');
        if (legend.classList.contains('collapsed')) {
            // chevron.innerHTML = 'v'; 
            if (chevron) chevron.style.transform = 'rotate(-90deg)';
        } else {
            // chevron.innerHTML = 'v';
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }
}

// Global Toggle for Community Layer
function toggleCommunityLayer() {
    communityLayerVisible = !communityLayerVisible;
    const btn = document.getElementById('community-toggle');

    communityMarkers.forEach(marker => {
        if (communityLayerVisible) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });

    if (btn) {
        btn.innerHTML = communityLayerVisible ? '&#x1F465; Hide' : '&#x1F465; Show';
        btn.style.opacity = communityLayerVisible ? '1' : '0.7';
        btn.setAttribute('aria-pressed', communityLayerVisible ? 'true' : 'false');
    }
}

// Show Shelters Function (Mock Data)
function showSheltersOnMap() {
    refreshMapData();
    markers.forEach(m => map.removeLayer(m.marker));
    markers = [];

    const shelters = [
        { title: "Atladara School Shelter", lat: 22.2700, lng: 73.1500, cap: 500, status: "Open", type: "SHELTER" },
        { title: "Sama Sports Complex", lat: 22.3400, lng: 73.1900, cap: 1200, status: "Full", type: "SHELTER" },
        { title: "Gotri Community Hall", lat: 22.3100, lng: 73.1400, cap: 300, status: "Open", type: "SHELTER" },
        { title: "Manjalpur Gymkhana", lat: 22.2600, lng: 73.1950, cap: 600, status: "Open", type: "SHELTER" }
    ];

    shelters.forEach(s => {
        const icon = L.divIcon({
            className: 'shelter-marker',
            html: `<div style="background: #10b981; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 16px;">&#x1F3E0;</div>`,
            iconSize: [32, 32]
        });

        const marker = L.marker([s.lat, s.lng], { icon: icon }).addTo(map);

        const popup = `
            <div style="text-align: center; font-family: 'Inter', sans-serif;">
                <h3 style="margin: 0 0 5px 0; color: #10b981;">${s.title}</h3>
                <div style="font-size: 0.8rem; margin-bottom: 5px;">Capacity: <strong>${s.cap} people</strong></div>
                <div style="display: inline-block; padding: 2px 8px; background: ${s.status === 'Open' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${s.status === 'Open' ? '#10b981' : '#ef4444'}; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">
                    ${s.status.toUpperCase()}
                </div>
                <button onclick="window.open('https://maps.google.com/?q=${s.lat},${s.lng}')" 
                    style="display: block; width: 100%; margin-top: 8px; padding: 6px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Navigate
                </button>
            </div>
        `;
        marker.bindPopup(popup).openPopup();
        markers.push({ marker, data: s });
    });

    const group = new L.featureGroup(markers.map(m => m.marker));
    map.fitBounds(group.getBounds(), { padding: [50, 50] });

    renderFeed(shelters.map((s, i) => ({
        id: `shelter_${i}`,
        type: "SHELTER",
        title: s.title,
        dist: "Nearby",
        time: "Now",
        lat: s.lat,
        lng: s.lng
    })));
}


// Show Shelters Function (Toggle - Final)
function showSheltersToggle() {
    const btn = document.getElementById('btn-shelters');

    if (sheltersVisible) {
        // TOGGLE OFF
        refreshMapData();
        renderFeed(currentReliefMockData);
        sheltersVisible = false;

        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<span>&#x1F3E0;</span> Find Shelters';
            btn.style.background = '';
        }
        return;
    }

    // TOGGLE ON
    refreshMapData();
    markers.forEach(m => map.removeLayer(m.marker));
    markers = [];

    const shelters = [
        { title: "Atladara School Shelter", lat: 22.2700, lng: 73.1500, cap: 500, status: "Open", type: "SHELTER" },
        { title: "Sama Sports Complex", lat: 22.3400, lng: 73.1900, cap: 1200, status: "Full", type: "SHELTER" },
        { title: "Gotri Community Hall", lat: 22.3100, lng: 73.1400, cap: 300, status: "Open", type: "SHELTER" },
        { title: "Manjalpur Gymkhana", lat: 22.2600, lng: 73.1950, cap: 600, status: "Open", type: "SHELTER" }
    ];

    shelters.forEach(s => {
        const icon = L.divIcon({
            className: 'shelter-marker',
            html: `<div style="background: #10b981; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 16px;">&#x1F3E0;</div>`,
            iconSize: [32, 32]
        });

        const marker = L.marker([s.lat, s.lng], { icon: icon }).addTo(map);

        const popup = `
            <div style="text-align: center; font-family: 'Inter', sans-serif;">
                <h3 style="margin: 0 0 5px 0; color: #10b981;">${s.title}</h3>
                <div style="font-size: 0.8rem; margin-bottom: 5px;">Capacity: <strong>${s.cap} people</strong></div>
                <div style="display: inline-block; padding: 2px 8px; background: ${s.status === 'Open' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${s.status === 'Open' ? '#10b981' : '#ef4444'}; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">
                    ${s.status.toUpperCase()}
                </div>
                <button onclick="window.open('https://maps.google.com/?q=${s.lat},${s.lng}')" 
                    style="display: block; width: 100%; margin-top: 8px; padding: 6px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Navigate
                </button>
            </div>
        `;
        marker.bindPopup(popup).openPopup();
        markers.push({ marker, data: s });
    });

    const group = new L.featureGroup(markers.map(m => m.marker));
    map.fitBounds(group.getBounds(), { padding: [50, 50] });

    renderFeed(shelters.map((s, i) => ({
        id: `shelter_${i}`,
        type: "SHELTER",
        title: s.title,
        dist: "Nearby",
        time: "Now",
        lat: s.lat,
        lng: s.lng
    })));

    // Update Button
    if (btn) {
        btn.classList.add('active');
        btn.innerHTML = '<span>&#10060;</span> Hide Shelters';
        btn.style.background = 'rgba(16, 185, 129, 0.2)';
        sheltersVisible = true;
    }
}


