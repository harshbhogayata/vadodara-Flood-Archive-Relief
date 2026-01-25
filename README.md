# Vadodara Files 📂
*(Formerly Vadodara Flood Archives)*

A verified digital archive of flood risk in Vadodara (2019-2025) and a live relief coordination system ("SewaSetu").

![Preview](social-preview.png)

## What is this?

**1. The Archive (Vadodara Files)**
A map of 50+ locations in Vadodara with their flood history. Each zone has a risk score based on satellite data, news reports, and VMC bulletins. 
- **Red Zones**: Critical risk (Water > Waist deep).
- **Yellow Zones**: Moderate risk (Waterlogging).
- **Green Zones**: Safe history.

**2. The Relief System (SewaSetu)**
A built-in mode for active emergency response.
- **Find Shelters**: Locate verified safe houses/schools.
- **Community Reports**: Crowdsourced live flood updates.
- **Live SOS Feed**: Real-time needs (Food, Rescue, Meds).

## Features

- **Risk Simulator**: Interactive flood modeling (Ajwa Dam levels + Rainfall).
- **Android Ready**: Runs as a native app via WebView (see below).
- **Offline Capable**: Critical data works with spotty internet.
- **Privacy First**: Zero tracking, local-first architecture.

## How to use

1.  **Check your area**: Use the search bar in "Analysis" tab.
2.  **Verify Risk**: Click any zone to see year-by-year flood history.
3.  **Emergency Mode**: Toggle the siren icon (🚨) to switch to SewaSetu mode.

---

## 📱 Android Build (Capacitor)

This project uses **Capacitor** to build the Android app. No manual copying required!

### 1. Requirements
- Node.js installed
- Android Studio installed
- Java (JDK 17+)

### 2. Build Commands
Open your terminal and run:

```powershell
# 1. Build the web source to ./dist
npm run build

# 2. Copy web assets to Android project
npx cap sync

# 3. Open Android Studio
npx cap open android
```

Once Android Studio opens, wait for Gradle sync to finish, then click the **Run (▶️)** button to deploy to your phone/emulator.

## Technical Details

- **Stack**: HTML5, CSS3 (Glassmorphism), Vanilla JS.
- **Map Engine**: Leaflet.js + OpenStreetMap.
- **Data**: Static JSON (Verified by Civic Tech Initiative).

## Contributions

If you have verified photos or data for a specific area in Vadodara, please open a PR or Issue. Accuracy is our top priority.


## ⚠️ Legal Disclaimer

**Strictly for informational and research purposes only.**

- This application is **NOT** affiliated with the Vadodara Municipal Corporation (VMC), Government of Gujarat, or any official disaster management authority.
- The data presented is based on historical archives (news, satellite imagery) and volunteer reports. It may contain inaccuracies.
- **NO LIABILITY**: The creators and contributors accept **no liability** for any loss, damage, injury, or decision made based on this information.
- Do NOT use this tool for navigation during active floods or for real estate valuation. Always follow official government directives.

