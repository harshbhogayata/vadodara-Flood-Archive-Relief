// Vadodara Flood Archives - Main Application Logic
// Author: Civic Tech Initiative | Zero Hallucination Policy

// Global State
let map;
let markers = [];
let userLocationMarker = null;

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
    btn.innerHTML = '<span>⏳</span> Locating...';

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
                        <strong style="color: #ef4444; font-size: 1.1rem;">⚠️ BE CAREFUL</strong><br>
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
                        <strong style="color: #10b981; font-size: 1.1rem;">✅ YOU SEEM SAFE</strong><br>
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
        },
        (error) => {
            console.error(error);
            alert('Unable to retrieve your location. Please check GPS settings.');
            btn.innerHTML = originalText;
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

// Perform External Search (Nominatim API)
async function performExternalSearch(query) {
    if (!query || query.length < 3) return;

    // Feedback UI
    const searchBox = document.getElementById('searchBox');
    const originalPlaceholder = searchBox.placeholder;
    searchBox.placeholder = "Searching map...";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Vadodara, Gujarat')}`);
        const results = await response.json();

        if (results && results.length > 0) {
            const result = results[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            // Fly to location
            map.flyTo([lat, lon], 15);

            // Check Risk Proximity
            const nearbyRisk = checkProximityToRiskZones(lat, lon);

            // Create Result Marker
            const searchIcon = L.divIcon({
                className: 'search-marker',
                html: `<div style="font-size: 24px;">📍</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            });

            // Remove previous user marker if any to avoid clutter
            if (userLocationMarker) map.removeLayer(userLocationMarker);

            userLocationMarker = L.marker([lat, lon], { icon: searchIcon }).addTo(map);

            let popupContent = '';
            if (nearbyRisk) {
                const distance = nearbyRisk.distance.toFixed(1);
                popupContent = `
                    <div style="text-align: center;">
                        <strong>${result.name || query}</strong><br>
                        <span style="color: #ff8c42; font-weight: bold;">⚠️ CAUTION</span><br>
                        <div style="font-size: 0.9em; margin-top: 5px;">
                            Close to <span style="text-decoration: underline;">${nearbyRisk.name}</span><br>
                            (${distance} km away)<br>
                            Risk: <strong>${nearbyRisk.risk_tier}</strong>
                        </div>
                    </div>
                `;
            } else {
                popupContent = `
                    <div style="text-align: center;">
                        <strong>${result.name || query}</strong><br>
                        <span style="color: #06d6a0; font-weight: bold;">✅ NO VERIFIED RISK</span><br>
                        <div style="font-size: 0.9em; margin-top: 5px; color: #aaa;">
                            This specific location is not in our known high-flood database.
                        </div>
                    </div>
                `;
            }

            userLocationMarker.bindPopup(popupContent).openPopup();

        } else {
            alert('Location not found in Vadodara map data.');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('Search failed. Please check internet connection.');
    } finally {
        searchBox.placeholder = originalPlaceholder;
    }
}

// Disclaimer Modal Functions
function showDisclaimerModal() {
    document.getElementById('disclaimerModal').classList.remove('hidden');
}

function acceptDisclaimer() {
    document.getElementById('disclaimerModal').classList.add('hidden');
    document.getElementById('app').classList.remove('app-hidden');
    initializeMap();
}

function showAboutModal() {
    document.getElementById('aboutModal').classList.remove('hidden');
}

function closeAboutModal() {
    document.getElementById('aboutModal').classList.add('hidden');
}

// Map Initialization
function initializeMap() {
    // Initialize Leaflet map centered on Vadodara
    // Initialize Leaflet map centered on Vadodara
    // Optimization: Disable zoomAnimation ONLY on mobile to prevent popup jitter
    // Keep it enabled on desktop for smooth feel
    const isMobile = L.Browser.mobile;

    map = L.map('map', {
        zoomAnimation: !isMobile,
        markerZoomAnimation: !isMobile,
        fadeAnimation: true,
        // Smooth Zoom Settings
        zoomSnap: 0.1,       // Allow fractional zoom (e.g. 12.1 instead of just 12 or 13)
        zoomDelta: 0.2,      // Small storage steps for smoother feel
        wheelPxPerZoomLevel: 120 // Higher = Less sensitive pinch/scroll (Dampening)
    }).setView([22.3072, 73.1812], 12);

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
        "🌙 Dark Mode": darkLayer,
        "🛰️ Satellite": satelliteLayer,
        "🗺️ Street Map": streetLayer
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
        'SATELLITE': '🛰️',
        'GOVT': '👮',
        'VIDEO': '📹',
        'NEWS': '📰'
    };
    return icons[type] || '🔗';
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
                    📰 View Verified Source
                </a>
            </div>

            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333;">
                <button onclick="shareZone('${zone.location_id}', '${data.location.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${shareUrl}')" 
                        style="width: 100%; padding: 6px 12px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <span>📤</span> Share This Zone
                </button>
            </div>
        </div>
    `;
}

// Note: "Am I Safe?" geolocation feature has been removed as requested

// ========================================
// LIVE COMMUNITY LAYER (Crowdsourced Reports)
// ========================================

let communityMarkers = []; // Track community markers for toggle
let communityLayerVisible = true;

/**
 * Load and display community flood reports from Google Sheets
 * Reports are submitted via Tally form → Google Sheets → Published as CSV
 */
async function loadCommunityReports() {
    // Google Sheets CSV URL - Export format from the Tally-connected sheet
    // Sheet ID: 1dbaWwodlJAyFcPc9JI9jBH3thcnfptlCKjPkiuFQImY
    const RAW_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1dbaWwodlJAyFcPc9JI9jBH3thcnfptlCKjPkiuFQImY/export?format=csv';

    // If URL not configured yet, skip
    if (RAW_SHEET_URL === 'YOUR_GOOGLE_SHEET_CSV_URL') {
        console.log('📊 Community layer not configured yet. Set SHEET_URL in loadCommunityReports()');
        return;
    }

    // Try multiple approaches to fetch the data
    const fetchStrategies = [
        // Strategy 1: Direct fetch (works if CORS is enabled)
        {
            name: 'Direct fetch',
            url: RAW_SHEET_URL
        },
        // Strategy 2: AllOrigins proxy (more reliable)
        {
            name: 'AllOrigins proxy',
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(RAW_SHEET_URL)}`
        },
        // Strategy 3: CORS.SH proxy
        {
            name: 'CORS.SH proxy',
            url: `https://proxy.cors.sh/${RAW_SHEET_URL}`,
            headers: { 'x-cors-api-key': 'temp_demo' }
        },
        // Strategy 4: Original corsproxy.io
        {
            name: 'CORSProxy.io',
            url: `https://corsproxy.io/?${encodeURIComponent(RAW_SHEET_URL)}`
        }
    ];

    for (const strategy of fetchStrategies) {
        try {
            console.log(`📡 Trying: ${strategy.name}...`);

            const fetchOptions = {
                cache: 'no-cache',
                headers: strategy.headers || {}
            };

            const response = await fetch(strategy.url, fetchOptions);

            if (!response.ok) {
                console.warn(`⚠️ ${strategy.name} failed: HTTP ${response.status}`);
                continue; // Try next strategy
            }

            const csvData = await response.text();

            // Validate we got CSV data
            if (!csvData || csvData.length < 10) {
                console.warn(`⚠️ ${strategy.name} returned empty/invalid data`);
                continue;
            }

            console.log(`✅ Success with ${strategy.name}!`);

            // Parse CSV data
            const reports = parseCSV(csvData);
            console.log('📄 Parsed headers:', Object.keys(reports[0] || {}));
            console.log('📝 First report row (raw):', reports[0]);

            // Clear existing community markers
            clearCommunityMarkers();

            // Plot approved reports
            let plottedCount = 0;
            let validCount = 0;
            let approvedCount = 0;

            console.log(`📋 Total rows in CSV: ${reports.length}`);

            reports.forEach((report, index) => {
                const valid = isValidReport(report);
                const approved = isApproved(report);

                if (valid) validCount++;
                if (approved) approvedCount++;

                // Debug first 3 rows in detail
                if (index < 3) {
                    console.log(`\n🔍 Row ${index + 1} Debug:`);
                    console.log(`   Raw report object:`, report);
                    console.log(`   Latitude: ${report.latitude || report.lat}`);
                    console.log(`   Longitude: ${report.longitude || report.lng}`);
                    console.log(`   Approved field: "${report.approved}"`);
                    console.log(`   Valid: ${valid}, Approved: ${approved}`);
                }

                if (valid && approved) {
                    plotCommunityMarker(report);
                    plottedCount++;
                    console.log(`✅ Plotted report ${plottedCount}: ${report['current location'] || 'Unknown location'}`);
                } else if (approved && !valid) {
                    console.warn(`⚠️ Row ${index + 1}: Approved but INVALID coordinates`);
                    console.warn(`   Lat: ${report.latitude || report.lat}, Lng: ${report.longitude || report.lng}`);
                } else if (valid && !approved) {
                    console.log(`⏳ Row ${index + 1}: Valid but NOT approved`);
                }
            });

            console.log(`\n📊 Summary:`);
            console.log(`   Total rows: ${reports.length}`);
            console.log(`   Valid coordinates: ${validCount}`);
            console.log(`   Approved: ${approvedCount}`);
            console.log(`   Plotted on map: ${plottedCount}`);

            return; // Success! Exit the function

        } catch (error) {
            console.warn(`❌ ${strategy.name} error:`, error.message);
            // Continue to next strategy
        }
    }

    // If we get here, all strategies failed
    console.error('❌ All fetch strategies failed. Could not load community reports.');
    console.error('💡 Make sure your Google Sheet is published to web as CSV.');
}

/**
 * Parse CSV data into report objects
 * Expected columns: Timestamp, Latitude, Longitude, Severity, Photo URL, Approved
 */
/**
 * Parse CSV data into report objects (Robust version)
 * Handles multiline quoted fields and messy headers from Tally/Google Sheets
 */
function parseCSV(csv) {
    const rows = parseCSVToStringArray(csv);

    if (rows.length < 2) return []; // Need header + at least 1 row

    // Clean headers: remove newlines, quotes, extra spaces, and lowercase
    const headers = rows[0].map(h => h.replace(/[\r\n"]+/g, ' ').trim().toLowerCase());

    console.log('🧹 Cleaned Headers (normalized):', headers);

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
    // Keys are now lowercase
    const lat = parseFloat(report.latitude || report.lat);
    const lng = parseFloat(report.longitude || report.lng);

    return !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
}

/**
 * Check if report is admin-approved
 */
function isApproved(report) {
    // Keys are now lowercase
    const approvalField = report.approved || '';
    return approvalField.toLowerCase() === 'true' || approvalField === '1' || approvalField === 'yes';
}

/**
 * Plot a community report as a purple marker
 */
function plotCommunityMarker(report) {
    // Keys are now lowercase from the parser
    const lat = parseFloat(report.latitude || report.lat);
    const lng = parseFloat(report.longitude || report.lng);
    const severity = report['water level'] || report.severity || 'Not specified';
    const timestamp = report['submitted at'] || report.timestamp || report.date || 'Unknown';
    const photo = report['upload photo/video'] || report.photo || '';
    const locationName = report['current location'] || report.location || 'Community Report';

    // Create purple circle marker (distinct from red/yellow historical markers)
    const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "#a855f7",
        color: "#fff",
        weight: 2,
        fillOpacity: 0.8
    });

    // Create user-interface friendly glassmorphic popup
    const popupHTML = `
        <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: white;">
            
            <!-- Header with Glowing Accent -->
            <div style="padding: 16px 20px 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative;">
                <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #a855f7; box-shadow: 0 0 10px #a855f7;"></div>
                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.6); margin-bottom: 4px;">Community Report</div>
                <div style="font-size: 1.1rem; font-weight: 700; background: linear-gradient(90deg, #fff, #e0e0e0); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${locationName}</div>
            </div>

            <!-- Main Content Area -->
            <div style="padding: 16px 20px;">
                
                <!-- Status & Time Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div style="background: rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-bottom: 2px;">Water Level</div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: #e2e8f0;">${severity}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.05); padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 0.7rem; color: rgba(255,255,255,0.5); margin-bottom: 2px;">Reported</div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: #e2e8f0;">${formatTimestamp(timestamp)}</div>
                    </div>
                </div>

                <!-- Evidence Photo -->
                ${photo ? `
                <div style="position: relative; border-radius: 12px; overflow: hidden; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <img src="${photo}" 
                         style="display: block; width: 100%; height: 160px; object-fit: cover; transition: transform 0.3s;"
                         alt="Flood evidence"
                         loading="lazy"
                         onerror="this.parentElement.style.display='none'">
                    <div style="position: absolute; bottom: 0; left: 0; width: 100%; padding: 8px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); font-size: 0.7rem; color: rgba(255,255,255,0.8);">
                        📸 Visual Evidence
                    </div>
                </div>
                ` : ''}

                <!-- Verified Badge -->
                <div style="display: flex; align-items: center; gap: 8px; padding: 10px; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px;">
                    <div style="width: 16px; height: 16px; background: #a855f7; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(168, 85, 247, 0.5);">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.75rem; font-weight: 700; color: #d8b4fe;">Verified Submission</div>
                        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.6);">Approved by Vadodara Risk Intel</div>
                    </div>
                </div>

            </div>
        </div>
    `;

    marker.bindPopup(popupHTML, {
        maxWidth: 320,
        className: 'community-popup'
    });
    marker.addTo(map);

    // Track marker for later removal/toggle
    communityMarkers.push(marker);
}

/**
 * Format timestamp for display
 */
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
        map.removeLayer(marker);
    });
    communityMarkers = [];
}

/**
 * Toggle community layer visibility
 */
function toggleCommunityLayer() {
    communityLayerVisible = !communityLayerVisible;

    communityMarkers.forEach(marker => {
        if (communityLayerVisible) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });

    // Update toggle button state
    const toggleBtn = document.getElementById('community-toggle');
    if (toggleBtn) {
        toggleBtn.textContent = communityLayerVisible ? '👥 Hide Community' : '👥 Show Community';
        toggleBtn.style.opacity = communityLayerVisible ? '1' : '0.6';
    }
}

/**
 * Auto-refresh community reports every 30 minutes (reduced from 5 to prevent rate limiting)
 */
setInterval(() => {
    loadCommunityReports();
}, 1800000); // 30 minutes

// ========================================
// END COMMUNITY LAYER
// ========================================


// Search Location (Simple)
function searchLocation(e) {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) return;

    // Find matching zone using ledger data
    // We need to find the location_id from ledger that matches name
    let matchedId = null;

    // Search in ledger values
    for (const [id, data] of Object.entries(evidenceLedger.zones)) {
        if (data.location.toLowerCase().includes(query)) {
            matchedId = id;
            break;
        }
    }

    if (matchedId) {
        // Find spatial coords
        const spatialZone = floodZones.find(z => z.id === matchedId);

        if (spatialZone) {
            map.setView(spatialZone.coords, 15);
            // Find and open the marker popup
            // Note: markers stored with zone: { location_id: ... }
            const markerObj = markers.find(m => m.zone.location_id === matchedId);
            if (markerObj) {
                markerObj.marker.openPopup();
            }
        }
    }
}

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
                <div class="result-zone">✅ All Zones Low Risk</div>
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
    const shareText = `⚠️ FLOOD RISK ALERT: ${zoneName}\n\nView verified flood risk data: ${shareUrl}\n\nVadodara Flood Archives | Evidence-Based Risk Assessment`;

    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert(`✅ Link copied to clipboard!`);
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

// REPORT MODAL LOGIC (Live Reporting)
function openReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    if (modal) modal.style.display = 'none';
}

