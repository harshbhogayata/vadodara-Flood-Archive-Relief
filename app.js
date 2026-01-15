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

    // Map Controls
    document.getElementById('locateBtn').addEventListener('click', locateUser);

    // Simulator Controls
    document.getElementById('ajwaLevel').addEventListener('input', updateAjwaValue);
    document.getElementById('localRain').addEventListener('input', updateRainValue);
    document.getElementById('runSimulation').addEventListener('click', runSimulation);

    // Report Modal Controls
    const reportBtn = document.getElementById('report-btn');
    const reportModal = document.getElementById('report-modal');
    const closeReportBtn = reportModal?.querySelector('.close-btn');

    if (reportBtn) reportBtn.addEventListener('click', openReportModal);
    if (closeReportBtn) closeReportBtn.addEventListener('click', closeReportModal);

    // Close modal on overlay click
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target.id === 'report-modal') closeReportModal();
        });
    }

    // Language Toggle
    const langToggle = document.getElementById('langToggle');
    if (langToggle) langToggle.addEventListener('click', toggleLanguage);

    // Community Layer Toggle
    const communityToggle = document.getElementById('community-toggle');
    if (communityToggle) communityToggle.addEventListener('click', toggleCommunityLayer);
});

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
    map = L.map('map').setView([22.3072, 73.1812], 12);

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

// Geolocation - "Am I Safe?" Feature
function locateUser() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    const locateBtn = document.getElementById('locateBtn');
    locateBtn.innerHTML = '<span>📍</span> Locating...';
    locateBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            // Remove previous user marker if exists
            if (userLocationMarker) {
                map.removeLayer(userLocationMarker);
            }

            // Add user location marker
            userLocationMarker = L.marker([userLat, userLng], {
                icon: L.divIcon({
                    className: 'user-marker',
                    html: `<div style="
                        background: #4a90e2;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 0 10px #4a90e2;
                    "></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(map);

            // Check if user is in a risk zone
            const nearbyZone = checkProximityToRiskZones(userLat, userLng);

            if (nearbyZone) {
                userLocationMarker.bindPopup(`
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>
                        <strong style="color: #ff3b3b;">YOU ARE NEAR A RISK ZONE</strong>
                        <p style="margin: 8px 0; font-size: 0.9rem;">
                            Closest: <strong>${nearbyZone.name}</strong><br>
                            Distance: ~${nearbyZone.distance.toFixed(2)} km<br>
                            Risk: <span style="color: #ff8c42;">${nearbyZone.risk_tier}</span>
                        </p>
                        <p style="font-size: 0.8rem; color: #a0a0a0;">
                            Click on the red marker for details.
                        </p>
                    </div>
                `).openPopup();
            } else {
                userLocationMarker.bindPopup(`
                    <div style="text-align: center;">
                        <div style="font-size: 2rem; margin-bottom: 8px;">✅</div>
                        <strong style="color: #06d6a0;">NO HIGH-RISK ZONES NEARBY</strong>
                        <p style="margin: 8px 0; font-size: 0.85rem; color: #a0a0a0;">
                            You are not near any verified flood zones.<br>
                            Always check official VMC alerts during monsoon.
                        </p>
                    </div>
                `).openPopup();
            }

            // Center map on user location
            map.setView([userLat, userLng], 14);

            locateBtn.innerHTML = '<span>📍</span> Am I Safe?';
            locateBtn.disabled = false;
        },
        (error) => {
            alert('Unable to retrieve your location. Please enable location services.');
            locateBtn.innerHTML = '<span>📍</span> Am I Safe?';
            locateBtn.disabled = false;
        }
    );
}

// Check Proximity to Risk Zones (within 2km radius)
// Check Proximity to Risk Zones (within 2km radius)
function checkProximityToRiskZones(userLat, userLng) {
    const PROXIMITY_THRESHOLD = 2; // km
    let closestZone = null;
    let minDistance = Infinity;

    floodZones.forEach(zone => {
        // Use zone.coords
        const distance = calculateDistance(userLat, userLng, zone.coords[0], zone.coords[1]);
        if (distance < minDistance && distance < PROXIMITY_THRESHOLD) {
            // Merge with content for display
            const ledgerData = evidenceLedger.zones[zone.id];

            minDistance = distance;
            closestZone = {
                location_id: zone.id,
                name: ledgerData ? ledgerData.location : 'Unknown Zone',
                risk_tier: ledgerData ? ledgerData.risk_level : 'MODERATE',
                distance: distance
            };
        }
    });

    return closestZone;
}

// Calculate Distance (Haversine Formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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
    // Google Sheets CSV URL - Published from Tally integration
    // Updates automatically when new reports are approved
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRguoBxzzi0hEXpbk0hu5hivwy131-l8FRQlumD22urDW1AUiikLSAYGyZneFphJRtA0fr4vLW82na4/pub?output=csv';

    // If URL not configured yet, skip
    if (SHEET_URL === 'YOUR_GOOGLE_SHEET_CSV_URL') {
        console.log('📊 Community layer not configured yet. Set SHEET_URL in loadCommunityReports()');
        return;
    }

    try {
        console.log('📡 Loading community reports...');
        const response = await fetch(SHEET_URL, {
            cache: 'no-cache' // Always get fresh data
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const csvData = await response.text();

        // Parse CSV data
        const reports = parseCSV(csvData);

        // Clear existing community markers
        clearCommunityMarkers();

        // Plot approved reports
        let plottedCount = 0;
        reports.forEach(report => {
            if (isValidReport(report) && isApproved(report)) {
                plotCommunityMarker(report);
                plottedCount++;
            }
        });

        console.log(`✅ Loaded ${plottedCount} approved community reports`);

    } catch (error) {
        console.error('❌ Error loading community reports:', error);
        // Fail silently - don't break the app if community layer is down
    }
}

/**
 * Parse CSV data into report objects
 * Expected columns: Timestamp, Latitude, Longitude, Severity, Photo URL, Approved
 */
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return []; // Need header + at least 1 row

    const headers = lines[0].split(',').map(h => h.trim());
    const reports = [];

    // Parse each row (skip header)
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);

        // Create report object
        const report = {};
        headers.forEach((header, index) => {
            report[header] = values[index] ? values[index].trim() : '';
        });

        reports.push(report);
    }

    return reports;
}

/**
 * Parse a single CSV line (handles quoted fields with commas)
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current); // Last value

    return values;
}

/**
 * Validate report has minimum required fields
 */
function isValidReport(report) {
    const lat = parseFloat(report.Latitude || report.latitude || report.Lat);
    const lng = parseFloat(report.Longitude || report.longitude || report.Lng);

    return !isNaN(lat) && !isNaN(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180;
}

/**
 * Check if report is admin-approved
 */
function isApproved(report) {
    const approvalField = report.Approved || report.approved || report.APPROVED || '';
    return approvalField.toLowerCase() === 'true' || approvalField === '1' || approvalField === 'yes';
}

/**
 * Plot a community report as a purple marker
 */
function plotCommunityMarker(report) {
    const lat = parseFloat(report.Latitude || report.latitude || report.Lat);
    const lng = parseFloat(report.Longitude || report.longitude || report.Lng);
    const severity = report.Severity || report.severity || report['Water Level'] || 'Not specified';
    const timestamp = report.Timestamp || report.timestamp || report.Date || 'Unknown';
    const photo = report.Photo || report.photo || report['Photo URL'] || '';
    const location = report.Location || report.location || report.Area || 'Community Report';

    // Create purple circle marker (distinct from red/yellow historical markers)
    const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: "#a855f7", // Purple - Tailwind purple-500
        color: "#ffffff",
        weight: 2,
        fillOpacity: 0.85,
        className: 'community-marker'
    });

    // Create popup content
    const popupHTML = `
        <div style="min-width: 200px;">
            <div style="background: linear-gradient(135deg, #a855f7, #c084fc); padding: 8px; margin: -12px -16px 8px -16px; border-radius: 4px 4px 0 0;">
                <strong style="color: white; font-size: 0.95rem;">📢 Community Report</strong>
            </div>
            
            <div style="margin-top: 8px;">
                <strong>${location}</strong>
            </div>
            
            <table style="width: 100%; margin-top: 8px; font-size: 0.85rem;">
                <tr>
                    <td style="color: #666; padding: 4px 8px 4px 0;">Status:</td>
                    <td><strong>${severity}</strong></td>
                </tr>
                <tr>
                    <td style="color: #666; padding: 4px 8px 4px 0;">Reported:</td>
                    <td>${formatTimestamp(timestamp)}</td>
                </tr>
            </table>
            
            ${photo ? `
                <img src="${photo}" style="width: 100%; margin-top: 8px; border-radius: 4px; max-height: 150px; object-fit: cover;" 
                     alt="Flood evidence photo" loading="lazy">
            ` : ''}
            
            <div style="margin-top: 8px; padding: 8px; background: rgba(168, 85, 247, 0.1); border-radius: 4px; font-size: 0.75rem; color: #666;">
                <strong>Live User Submission</strong><br>
                Verified by admin
            </div>
        </div>
    `;

    marker.bindPopup(popupHTML);
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
 * Auto-refresh community reports every 5 minutes
 */
setInterval(() => {
    loadCommunityReports();
}, 300000); // 5 minutes

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

