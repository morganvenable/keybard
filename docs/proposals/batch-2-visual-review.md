# Batch 2 follow-up visual review

The first review missed the Layer Keys bottom layout and populated Layouts previews. Passing component tests did not establish that these compositions worked. This follow-up checked rendered content, scrolling, and actions in both placements.

## Corrections

| Area | Finding | Correction |
| --- | --- | --- |
| Layer Keys | A vertical type selector and full-width legend pushed the keys below the panel. | Horizontal wrapping selector; keys immediately below; compact explanation follows the keys. Sidebar types also wrap. |
| Layouts | Oversized preview children scaled around their centers and clipped the board. The bottom layout also used awkward vertical group labels and omitted ordinary controls. | Measure the preview viewport, scale from the top-left, and use a responsive card grid with shared search, group headings, and actions. Whole-board thumbnails fit their cards. |
| Standard Keys | Bottom layout duplicated Function Keys and stacked modifiers in a tall column. Narrow diagrams squeezed labels. | Remove the duplicate; wrap groups; use compact modifier controls. The Standard Keys keyboard scales to the available column width without a horizontal scrollbar. |
| Pointing key groups | Compact groups retained a tall column composition. | Wrap groups across the available width. |
| Binding lists | Several bottom card lists extended as one unbroken row. | Wrap cards in the available panel width. |
| Binding editors | Fixed-width combo/override forms and rigid rows overflowed constrained editors. | Fluid containers and wrapping fields, tabs, modifiers, and layer grids. Text fields fit their available width. |
| Tap dances | An empty bottom panel had no action to create a tap dance. | Add an explicit action that opens the first empty slot without enabling or saving it merely by opening. |
| Scan Lab / hardware configuration | Rigid section widths and field rows prevented narrow reflow. | Remove inappropriate minimum widths and wrap field rows. |
| Dialogs | Long dialogs could exceed short windows. | Bound shared dialogs to the viewport with scrolling. Enlarged layout previews keep their close control reachable. |
| Short-window toolbar | Essential controls depended on hover and disappeared when the pointer left. | Explicit Show/Hide editor controls disclosure; ordinary desktop toolbar remains unchanged. |
| Preview badge | The badge painted above panel controls and dialogs. | Keep the exact “Sval preview” text, with panels and dialogs painting above it. |

## Rendered coverage

Browser checks used local Chromium with the offline example and populated fixtures. Viewports: **1280×720, 1024×768, 640×360, and 390×844**. The 640×360 check represents constrained CSS space, not a claim of testing native browser zoom.

- Layer, Standard, Special, and Mouse palettes: both placements at all four sizes; verified the final layer key is reachable in a short bottom panel.
- Macro, tap-dance, combo, override, leader, and alternate-repeat editors: empty and populated cases, both placements, narrow and short windows. Checked horizontal fit and closure. At 1024×768 in both placements, clicked palette keys into a new tap dance and combo and verified the resulting binding.
- Layouts: a populated library in all eight size/placement combinations; whole-board thumbnails, enlarged preview bounds, and close control.
- Settings, Quick Start, and About: both placements at all four sizes. Device-only controls have additional fixture tests, not physical-board browser acceptance.
- Main canvas: multiple layers, 3D, overview, and matrix-test view at all four sizes. Verified scroll extents and reachable mode controls.
- Export and custom-color dialogs: desktop, short, and narrow windows; verified bounds, scrolling where needed, and dismissal.

The spacious main layout view remains intentional. These changes repair panel composition and reachability; they do not make editing panels permanent or fill the canvas with more controls.

## Automated validation

The combined follow-up passed **585 tests across 67 test files**, TypeScript, and the preview production build. Existing React test warnings and bundle-size warnings remain. These results supplement the rendered checks; they do not replace visual or hardware acceptance.

## Remaining acceptance

Live device-only Developer/QMK settings, Scan Lab telemetry, physical-board persistence, screen-reader output, and touch behavior still require their respective acceptance checks. The matrix tester was checked as a rendered view, not against physical key events. No deployment is included.
