# Design System Document

## 1. Overview & Creative North Star
### The Architectural Editor
This design system moves away from the "standard software" look to embrace a high-end, editorial aesthetic tailored for the corporate exhibition planning space. We view the interface not as a collection of boxes, but as an **Architectural Editor**. It balances the bold, industrial precision of the brand's red and grey palette with a sophisticated layering of tonal surfaces. 

By utilizing intentional asymmetry, expansive negative space, and a hierarchy driven by depth rather than lines, we create a premium environment that feels both authoritative and effortless. The "Messeplaner" experience is about organization and vision; our design reflects this through clinical precision and "The Layering Principle."

---

## 2. Colors
Our palette is rooted in industrial strength but executed with digital finesse. We leverage a specific hierarchy of surfaces to guide the user's eye without the clutter of traditional borders.

### Primary & Action
*   **Primary (`#ac0019`)**: Used for high-emphasis states.
*   **Primary Container (`#da0023`)**: Our signature red. Use this for main CTAs, brand highlights, and active indicators.
*   **On Primary (`#ffffff`)**: Ensuring maximum contrast for readability.

### Tonal Neutrals & Sophistication
*   **Secondary (`#5d5e60`)**: Derived from the grey in the brand logo. Used for secondary actions and supporting iconography.
*   **Tertiary (`#005988`)**: A deep professional blue used sparingly for informative states or distinct functional sections to provide tonal depth.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or layout containment. Boundaries must be defined solely through background color shifts. 
*   Place a `surface_container_low` section against a `surface` background.
*   Use `surface_container_highest` for floating navigation elements to create distinction.

### The "Glass & Gradient" Rule
To elevate the UI beyond a flat template, use **Glassmorphism** for floating overlays (e.g., Modals, Tooltips). Use semi-transparent `surface` colors with a 20px-40px backdrop blur. 
*   **Signature Textures:** For Hero sections or primary action buttons, apply a subtle linear gradient from `primary` to `primary_container` (top-left to bottom-right) to give the red a metallic, high-end "soul."

---

## 3. Typography: The Manrope Scale
We use **Manrope** for its geometric yet approachable character. The hierarchy is designed to feel editorial—large, bold headings contrasted with tight, functional labels.

*   **Display (lg/md/sm):** 3.5rem down to 2.25rem. Use for high-impact landing areas or dashboard summaries. 
*   **Headline (lg/md/sm):** 2rem down to 1.5rem. Bold and authoritative. These act as the "anchors" for your page sections.
*   **Body (lg/md/sm):** 1rem down to 0.75rem. Designed for maximum legibility in complex planning data. Use `on_surface_variant` for secondary body text to reduce visual noise.
*   **Label (md/sm):** 0.75rem down to 0.6875rem. Used for micro-copy and functional metadata.

---

## 4. Elevation & Depth
In this system, depth is a functional tool, not a stylistic flourish. We achieve hierarchy through **Tonal Layering**.

### The Layering Principle
Think of the UI as a series of stacked, high-quality paper sheets. 
*   **Base:** `surface` (`#faf9fb`).
*   **Content Areas:** `surface_container_low`.
*   **Interactive Cards:** `surface_container_lowest` (Pure White).
*   **Nesting:** By placing a white card on a light grey background, you create a natural lift that requires no shadow.

### Ambient Shadows
Shadows are used only when an element physically "floats" above the stack (e.g., a dropdown or modal).
*   **Blur:** 24px - 48px.
*   **Opacity:** 4% - 6% of `on_surface`.
*   **Color:** Tint the shadow with a hint of `primary` or `secondary` to avoid a "dirty" grey look.

### The "Ghost Border" Fallback
If a border is required for extreme accessibility needs, use a **Ghost Border**: `outline_variant` at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary_container` with a subtle gradient. Roundedness: `md` (0.375rem).
*   **Secondary:** `secondary_container` background with `on_secondary_container` text.
*   **Tertiary:** No background. Text-only in `primary` red, used for "Cancel" or "Back" actions.

### Cards & Planning Modules
*   **Constraint:** No dividers. Use vertical white space (`spacing.8`) or tonal shifts (`surface_container`) to separate data chunks.
*   **Layout:** Use asymmetrical padding (e.g., more padding on the left than the right) to mirror the "industrial" layout of the logo.

### Input Fields
*   **Style:** Minimalist. Use `surface_container_high` as the background with a 2px `primary` bottom-border active state.
*   **Focus:** Smooth transition to a `primary` "Ghost Border" at 20% opacity.

### Navigation (The "Floating" Bar)
*   Top navigation should use the **Glassmorphism** rule. It floats above content with a backdrop-blur and a `surface_container_lowest` at 80% opacity.

---

## 6. Do's and Don'ts

### Do
*   **Do** use the logo's "H" red blocks as inspiration for UI accents—vertical red "blips" to indicate active menu items.
*   **Do** embrace negative space. If a section feels crowded, increase the spacing from `spacing.4` to `spacing.8`.
*   **Do** use `Manrope` Medium for body text to maintain a professional weight against the red accents.

### Don't
*   **Don't** use pure black `#000000` for text; use `on_surface` (`#1a1c1d`) for a more premium, softer contrast.
*   **Don't** use standard "drop shadows" with tight blurs. It breaks the high-end editorial feel.
*   **Don't** use dividers or lines to separate list items. Use the `spacing.px` scale to create subtle gaps of the background color instead.