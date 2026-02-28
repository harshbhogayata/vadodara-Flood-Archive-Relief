// Vadodara Flood Archives - Translation System
// Supports: English (en) and Gujarati (gu)

const translations = {
    en: {
        // Header
        appTitle: "Vadodara | Flood Archive & Relief",
        appSubtitle: "Vadodara Risk Intelligence",

        // Tabs
        tabSimulator: "⚡ Simulator",
        tabAnalysis: "📊 Analysis",

        // Simulator
        ajwaLabel: "Ajwa Dam Level",
        rainfallLabel: "Rainfall (24hr)",
        dhadharLabel: "Dhadhar River",
        dhadharNormal: "Normal Flow",
        dhadharHigh: "High (Backflow Risk)",
        runForecast: "⚡ Run Forecast",
        forecastResults: "Results",

        // Analysis
        searchPlaceholder: "🔍 Search zones (e.g., Vadsar)...",
        zonesCount: "verified zones (Jan 2026)",
        zonesShown: "zones shown",

        // Legend
        legendTitle: "Risk Levels",
        critical: "Critical",
        high: "High",
        moderate: "Moderate",
        low: "Low Risk",
        river: "Vishwamitri",

        // Modal - Disclaimer
        disclaimerTitle: "⚠️ Legal Disclaimer",
        disclaimerIntro: "This is a public research archive, NOT an official flood warning system.",
        disclaimerNoGuarantee: "No Guarantee:",
        disclaimerNoGuaranteeText: "Based on historical data (2019-2025). Past flooding does NOT guarantee future safety or risk.",
        disclaimerNotRealEstate: "Not for Real Estate:",
        disclaimerNotRealEstateText: "Do NOT use as sole criterion for property decisions.",
        disclaimerNoLiability: "No Liability:",
        disclaimerNoLiabilityText: "The creator assumes NO liability for damages from reliance on this information.",
        disclaimerOfficial: "Official Sources:",
        disclaimerOfficialText: "For evacuation orders, contact VMC directly.",
        disclaimerAccept: "I Understand — Enter Map",
        disclaimerFooter: "By continuing, you acknowledge this is a community research tool and not a substitute for official alerts.",

        // Footer
        disclaimer: "Disclaimer",
        about: "About",

        // Popup
        viewSource: "📰 View Verified Source",
        shareZone: "📤 Share This Zone"
    },

    gu: {
        // Header
        appTitle: "વડોદરા | પૂર આર્કાઇવ અને રાહત",
        appSubtitle: "વડોદરા જોખમ માહિતી",

        // Tabs
        tabSimulator: "⚡ સિમ્યુલેટર",
        tabAnalysis: "📊 વિશ્લેષણ",

        // Simulator
        ajwaLabel: "અજવા ડેમ સ્તર",
        rainfallLabel: "વરસાદ (24 કલાક)",
        dhadharLabel: "ધાધર નદી",
        dhadharNormal: "સામાન્ય પ્રવાહ",
        dhadharHigh: "ઊંચો (બેકફ્લો જોખમ)",
        runForecast: "⚡ પૂરનું અનુમાન જુઓ",
        forecastResults: "પરિણામો",

        // Analysis
        searchPlaceholder: "🔍 વિસ્તાર શોધો (દા.ત., વડસર)...",
        zonesCount: "ચકાસાયેલ વિસ્તારો (જાન્યુ 2026)",
        zonesShown: "વિસ્તારો દેખાય છે",

        // Legend
        legendTitle: "જોખમ સ્તરો",
        critical: "ગંભીર",
        high: "ઊંચું",
        moderate: "મધ્યમ",
        low: "ઓછું જોખમ",
        river: "વિશ્વામિત્રી",

        // Modal - Disclaimer
        disclaimerTitle: "⚠️ કાનૂની અસ્વીકરણ",
        disclaimerIntro: "આ એક જાહેર સંશોધન આર્કાઇવ છે, સત્તાવાર પૂર ચેતવણી સિસ્ટમ નથી.",
        disclaimerNoGuarantee: "કોઈ ગેરંટી નથી:",
        disclaimerNoGuaranteeText: "ઐતિહાસિક ડેટા (2019-2025) પર આધારિત. ભૂતકાળનું પૂર ભવિષ્યની સલામતી અથવા જોખમની ગેરંટી આપતું નથી.",
        disclaimerNotRealEstate: "રિયલ એસ્ટેટ માટે નથી:",
        disclaimerNotRealEstateText: "મિલકત નિર્ણયો માટે એકમાત્ર માપદંડ તરીકે ઉપયોગ કરશો નહીં.",
        disclaimerNoLiability: "કોઈ જવાબદારી નથી:",
        disclaimerNoLiabilityText: "આ માહિતી પર આધાર રાખવાથી થતા નુકસાન માટે સર્જક કોઈ જવાબદારી સ્વીકારતા નથી.",
        disclaimerOfficial: "સત્તાવાર સ્ત્રોતો:",
        disclaimerOfficialText: "ખાલી કરવાના આદેશો માટે, સીધા VMC નો સંપર્ક કરો.",
        disclaimerAccept: "હું સમજું છું — નકશો જુઓ",
        disclaimerFooter: "ચાલુ રાખીને, તમે સ્વીકારો છો કે આ એક સમુદાય સંશોધન સાધન છે અને સત્તાવાર ચેતવણીઓનો વિકલ્પ નથી.",

        // Footer
        disclaimer: "અસ્વીકરણ",
        about: "વિશે",

        // Popup
        viewSource: "📰 ચકાસાયેલ સ્ત્રોત જુઓ",
        shareZone: "📤 આ વિસ્તાર શેર કરો"
    }
};

// Current language state
let currentLang = 'en';

// Get translation
function t(key) {
    return translations[currentLang][key] || translations['en'][key] || key;
}

// Switch language
function switchLanguage(lang) {
    currentLang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    localStorage.setItem('floodArchiveLang', lang);
    applyTranslations();
    updateLangToggleUI();
}

// Apply translations to all elements with data-i18n attribute
function applyTranslations() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

// Update language toggle button appearance
function updateLangToggleUI() {
    const toggle = document.getElementById('langToggle');
    if (toggle) {
        toggle.textContent = currentLang === 'en' ? 'ગુ' : 'EN';
        toggle.title = currentLang === 'en' ? 'Switch to Gujarati' : 'Switch to English';
    }
}

// Initialize language - FORCE ENGLISH (Project Requirement)
function initLanguage() {
    currentLang = 'en';
    localStorage.removeItem('floodArchiveLang');
    applyTranslations();
    updateLangToggleUI();
}

// Toggle between languages
function toggleLanguage() {
    switchLanguage(currentLang === 'en' ? 'gu' : 'en');
}
