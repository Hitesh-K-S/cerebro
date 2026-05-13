# Design System Strategy: High-End Editorial Grid

## 1. Overview & Creative North Star: "The Architectural Monolith"
This design system is a rejection of the "soft and bubbly" web. Our Creative North Star is **The Architectural Monolith**. It treats the digital screen as a physical broadsheet printed on heavy-stock paper, where information is not just displayed but *constructed*. 

We move beyond the template look by embracing a Bauhaus-inspired structuralism. We break the digital "glass" by using aggressive 2px rules to physically divide content, creating a layout that feels permanent and authoritative. Asymmetry is used intentionally: a massive display heading might occupy the left 8 columns, while the right 4 columns remain entirely empty—creating a "tension of void" that feels premium and curated.

## 2. Colors: High-Contrast Sophistication
The palette is built on a foundation of stark, intellectual neutrals punctuated by high-energy industrial accents.

*   **Primary (#000000 / #111111):** Used for structural rules, typography, and deep-ink backgrounds. It represents the "ink" of our editorial system.
*   **Surface (#F4F4F0):** Our "Off-White" base. It provides a warmer, more sophisticated feel than pure white, mimicking high-end archival paper.
*   **The Cobalt Signal (#0047FF):** Our primary action color. It is electric and digital, creating a sharp contrast against the traditional editorial base.
*   **The International Accent (#FF4D00):** Used sparingly for "Wayfinding"—notifications, error states, or critical highlights.

### The "No-Softness" Rule
Standard UI uses soft shadows and rounded corners to feel "friendly." We do the opposite. We prohibit 1px borders and soft blurs. Boundaries must be defined by:
1.  **The 2px Rule:** All primary sectioning is defined by a solid `2px` black rule (using the `primary` token).
2.  **Tonal Shifts:** Transitioning from `surface` to `surface_container_low` (#F4F4F0) to create distinct content zones without "framing" them.
3.  **Visible Grid Lines:** Treat the 12-column grid as a physical element. Allow rules to bleed to the edges of the viewport.

### Surface Hierarchy & Nesting
Instead of floating cards, we use "In-set Nesting." An inner container should not lift *off* the page; it should feel like a cutout *into* the page. Use `surface_container_high` (#E8E8E4) for nested modules to create a sense of architectural depth.

## 3. Typography: The Expressive Voice
Typography is the most critical asset in this system. It is not just for reading; it is a graphical element.

*   **Display & Headlines (Syne Extra Bold):** These must be set with `letter-spacing: -0.04em`. The goal is a dense, "blocky" feel that carries significant visual weight. Headlines should be treated as hero elements.
*   **Body (Cabinet Grotesk / Cabinet Grotesk):** For an architectural, geometric feel. Cabinet Grotesk provides a modern, sans-serif clarity that balances the expressive nature of Syne.
*   **Labels (Space Grotesk):** Used for metadata, small captions, and technical data. It introduces a "monospace-lite" vibe that reinforces the intellectual, precise nature of the system.

## 4. Elevation & Depth: The Hard Offset
We reject the concept of "Z-index" as a light source. In this system, depth is a physical displacement.

*   **The Layering Principle:** Use the `surface-container` tiers to create hierarchy. A `surface_container_lowest` (#FFFFFF) module placed on a `surface` background creates a crisp, clean focus area without needing a shadow.
*   **Hard Offset Shadows:** Floating elements (like active buttons or cards) do not use blurs. They use a **Hard Offset**: `4px 4px 0px #111111`. This creates a "Pop-Art" or "Brutalist" depth that feels intentional and high-end.
*   **The 0px Mandate:** Every element—from buttons to input fields to images—must have a `0px` border-radius. Sharp corners are non-negotiable; they convey precision and sophistication.

## 5. Components: Structural Primitives

### Buttons
*   **Primary:** Solid `primary` (#000000) background, `on_primary` (#FFFFFF) text. Rectangular, no radius. Hover state: Offset shadow `4px 4px 0px #0047FF`.
*   **Secondary:** 2px solid `primary` border, transparent background. 
*   **Tertiary:** Underlined text using a 2px weight line.

### Inputs & Fields
*   **Text Inputs:** No background. A 2px bottom-border only (ink black). Labels are always `label-md` in all-caps, positioned strictly above the field.
*   **Error State:** Border shifts to `tertiary_container` (#FF4D00). No soft red glows.

### Cards & Editorial Modules
*   **Forbid Dividers:** Do not use thin grey lines to separate list items. Use the 12-column grid rules (2px black) or aggressive vertical white space (`spacing-16` or `spacing-20`).
*   **Image Treatments:** Images must be strictly rectangular. Consider a subtle grayscale filter that reverts to color on hover to maintain the editorial "Black & White" aesthetic.

### Additional Components: The "Grid-Breaker"
*   **The Vertical Siderail:** A component that sits in the first column of the 12-column grid, containing vertical text (Space Grotesk) to act as a section label. This reinforces the "Editorial" feel.

## 6. Do's and Don'ts

### Do:
*   **Embrace the Grid:** Let your 2px rules define the rhythm of the page.
*   **Use Massive Scale:** Don't be afraid to make a headline 5rem if the content allows.
*   **Respect the "Bleed":** Allow rules to touch the very edge of the screen to make the layout feel infinite.
*   **Tighten Kerning:** Syne is designed to be squeezed. Ensure headlines feel like a single cohesive "object."

### Don't:
*   **No Rounded Corners:** Never use a border-radius. Not for buttons, not for images, not for checkboxes.
*   **No Soft Shadows:** If it doesn't have a hard 4px offset, it shouldn't have a shadow.
*   **No 1px Lines:** 1px lines feel "default." 2px lines feel "designed."
*   **Avoid Symmetry:** If a layout feels too "centered," shift the content 2 columns to the left and leave the right side for a large-scale `label-sm` metadata block.