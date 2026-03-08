# Vadodara | Flood Archive & Relief
*(Formerly Vadodara Flood Archives)*

A verified digital archive of flood risk in Vadodara (2019-2025) and a live relief coordination system ("SewaSetu").

![Preview](social-preview.png)

## What is this?

**1. The Archive (Vadodara | Flood Archive & Relief)**
A map of 50+ locations in Vadodara with their flood history. Each zone has a risk score based on satellite data, news reports, and VMC bulletins.
- **Red Zones**: Critical risk (Water > Waist deep).
- **Yellow Zones**: Moderate risk (Waterlogging).
- **Green Zones**: Safe history.

**2. The Relief System (SewaSetu)**
A built-in mode for active emergency response.
- **Find Shelters**: Locate verified safe houses and schools.
- **Community Reports**: Crowdsourced live flood updates.
- **Live SOS Feed**: Real-time needs (Food, Rescue, Meds).

## Features

- **Risk Simulator**: Interactive flood modeling (Ajwa Dam levels + Rainfall).
- **Android Ready**: Runs as a native app via WebView (see below).
- **Offline Capable**: Critical data works with spotty internet.
- **Privacy First**: Zero tracking, local-first architecture.

## How to use

1. **Check your area**: Use the search bar in the Analysis tab.
2. **Verify risk**: Click any zone to see year-by-year flood history.
3. **Emergency mode**: Toggle the siren icon to switch to SewaSetu mode.

---

## Android Build (Capacitor)

This project uses **Capacitor** to build the Android app. No manual copying required.

### Requirements
- Node.js installed
- Android Studio installed
- Java (JDK 17+)

### Build Commands
Open your terminal and run:

```powershell
# 1. Validate source and regenerate ./dist
npm run check

# 2. Copy web assets to Android project
npx cap sync

# 3. Open Android Studio
npx cap open android
```

If you only need a fresh web build, run `npm run build`. The `dist/` folder is generated output and should not be edited by hand.

### Local Preview

Use the generated app shell for local verification:

```powershell
npm run build
npm run serve:dist
```

The repo includes `.editorconfig` and `.gitattributes` so source files stay UTF-8/LF and do not regress into BOM or mojibake issues.

Once Android Studio opens, wait for Gradle sync to finish, then click the Run button to deploy to your phone or emulator.

## Technical Details

- **Stack**: HTML5, CSS3 (Glassmorphism), Vanilla JS.
- **Map Engine**: Leaflet.js + OpenStreetMap.
- **Data**: Static JSON plus published Google Sheets CSV feeds for live reports.

## Contributions

If you have verified photos or data for a specific area in Vadodara, please open a PR or Issue. Accuracy is the top priority.

## Legal Disclaimer

**Strictly for informational and research purposes only.**

- This dashboard is **NOT** affiliated with the Vadodara Municipal Corporation (VMC), Government of Gujarat, or any disaster management authority.
- Archive evidence, live community reports, and SOS requests may appear together in the app, but they do **not** carry the same level of verification.
- Community submissions and volunteer-fed information may be delayed, incomplete, or inaccurate even after review.
- **NO LIABILITY**: The creators and contributors accept **no liability** for any loss, damage, injury, or decision made based on this information.
- Do not use this tool for critical safety decisions, emergency navigation, or real estate valuation.
- If flooding is active or someone is at medical risk, call official responders first and follow their instructions.
