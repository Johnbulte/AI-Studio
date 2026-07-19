# Design QA — Figma 26:773 creation dashboard

- Source visual truth: `D:\codexproject\AIStudio\artifacts\figma-26-773-reference-responsive.png`
- Rendered Windows implementation: `D:\codexproject\AIStudio\artifacts\qa\dashboard-1440x1024.png`
- Combined same-viewport comparison: `D:\codexproject\AIStudio\artifacts\qa\figma-vs-windows-1440x1024.png`
- Responsive evidence:
  - `D:\codexproject\AIStudio\artifacts\qa\dashboard-1024x720.png` (minimum content size)
  - `D:\codexproject\AIStudio\artifacts\qa\dashboard-compact.png` (1198 × 720)
  - `D:\codexproject\AIStudio\artifacts\qa\dashboard-medium.png` (1263 × 807)
  - `D:\codexproject\AIStudio\artifacts\qa\dashboard-breakpoint.png` (1285 × 807)
- Reference viewport: 1440 × 1024 at device scale factor 1
- State: default creation dashboard
- Renderer: native Tauri/WebView2 release application

## Full-view comparison evidence

The Figma source and native implementation were captured at the same 1440 × 1024 viewport and placed side by side in one comparison image. The 240 / 860 / 340 columns, hero, prompt, action row, recent-work card, project card, task list, account card, and monthly-credit card align with node `26:773`.

The intentional differences are limited to the shared desktop minimize, maximize, and close controls required by the product, plus the Windows pointer highlight present during native capture. No P0, P1, or P2 visual mismatch remains.

## Required fidelity surfaces

- Copy: dashboard navigation and action labels match the selected Figma node.
- Assets: the visible logo, navigation icons, task icons, avatar, thumbnails, project cover, send icon, and membership icon use the Figma-exported files under `public/figma/dashboard/`.
- Desktop layout: 1440 × 1024 preserves the measured Figma geometry.
- Compact layout: below 1440 pixels, every page switches together to the same 72-pixel icon rail; page-specific content columns then reflow within the remaining width.
- Narrow center: below 1100 pixels, quick actions and dashboard cards reflow instead of disappearing.
- Scrolling: the center workspace and task pane scroll vertically and independently.
- Window frame: every view uses one shared 12-pixel clipped surface with one shared minimize, maximize, and close control group.

## Resize and native-window findings

- Root cause of the blank regions: the previous implementation rendered a fixed 1440 × 1024 canvas and transformed it independently from the actual window layout.
- Fix: the fixed canvas and scale transform were removed. The dashboard now uses a real CSS Grid whose columns respond to the live window width.
- Root cause of the white corner fringe: multiple rounded/background layers and native transparency exposed a light compositor edge.
- Fix: the app now uses one clipped rounded surface, a transparent Tauri background color, no native shadow, and a square clip while maximized.
- The native release window reached the configured 1024 × 720 content minimum. It showed continuous dark content, compact navigation, independent scroll regions, and all three desktop controls.

## Comparison history

- [P1] Fixed canvas caused missing/cropped UI during resize — removed and replaced with responsive grid layout.
- [P1] Narrow windows kept desktop-width columns — fixed with 72 / flexible / 280 compact columns and card reflow.
- [P2] White fringe around rounded corners — fixed with a single compositor-safe clipped surface and transparent native background.
- [P2] Window controls were inconsistent between views — resolved by the shared window frame.
- [P2] Main and task content moved as one surface — resolved with independent vertical scroll regions.
- [P1] Dashboard, AI Chat, AI Image, and studio tools used separate sidebar implementations and different responsive thresholds — replaced by one persistent `AppSidebar` and one 1440-pixel compact breakpoint.
- [P1] AI Chat and AI Image kept fixed 1440-pixel root canvases — removed; extra width is now distributed by responsive grid tracks and narrow windows preserve all persistent controls.
- [P2] AI Chat exposed nested horizontal/vertical scrollbars after the responsive conversion — retained scrolling while hiding the nested scrollbar chrome.

## Verification evidence

- Native release build produced the portable executable and NSIS installer on 2026-07-17.
- Automated tests cover the responsive shell, desktop and compact columns, independent scrolling, removal of fixed-canvas transforms, shared controls, rounded clipping, and Tauri flags; 45 tests passed.
- Type checking and the production frontend build complete successfully.
- Native Tauri screenshots were inspected at 1440 × 1024, 1366 × 1024, maximized width, 1285 × 807, 1263 × 807, 1198 × 720, and 1024 × 720. The final release executable was launched successfully and Dashboard, AI Chat, and AI Image navigation was rechecked at 1440 × 1024.

## Follow-up polish

- P3: Windows/WebView2 text antialiasing and the pointer-highlight overlay differ slightly from the Figma renderer. These do not justify changing the measured layout values.

final result: passed
