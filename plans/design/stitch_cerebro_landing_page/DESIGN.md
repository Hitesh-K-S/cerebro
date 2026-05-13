---
name: Cozy Pixel Brain Training
colors:
  surface: '#fbf9f1'
  surface-dim: '#dcdad2'
  surface-bright: '#fbf9f1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ec'
  surface-container: '#f0eee6'
  surface-container-high: '#eae8e0'
  surface-container-highest: '#e4e3db'
  on-surface: '#1b1c17'
  on-surface-variant: '#404945'
  inverse-surface: '#30312c'
  inverse-on-surface: '#f3f1e9'
  outline: '#707975'
  outline-variant: '#c0c9c4'
  surface-tint: '#366758'
  primary: '#366758'
  on-primary: '#ffffff'
  primary-container: '#b5ead7'
  on-primary-container: '#396b5c'
  inverse-primary: '#9dd1bf'
  secondary: '#745945'
  on-secondary: '#ffffff'
  secondary-container: '#fdd9c0'
  on-secondary-container: '#785d49'
  tertiary: '#566246'
  on-tertiary: '#ffffff'
  tertiary-container: '#d6e4c0'
  on-tertiary-container: '#5a6649'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b9eedb'
  primary-fixed-dim: '#9dd1bf'
  on-primary-fixed: '#002018'
  on-primary-fixed-variant: '#1c4f41'
  secondary-fixed: '#ffdcc4'
  secondary-fixed-dim: '#e3c0a8'
  on-secondary-fixed: '#2a1708'
  on-secondary-fixed-variant: '#5a422f'
  tertiary-fixed: '#dae8c3'
  tertiary-fixed-dim: '#becba8'
  on-tertiary-fixed: '#141f08'
  on-tertiary-fixed-variant: '#3f4b30'
  background: '#fbf9f1'
  on-background: '#1b1c17'
  surface-variant: '#e4e3db'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.1em
  button:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  margin: 20px
---

## Brand & Style

This design system establishes a "Modern Lo-Fi Kawaii" aesthetic, blending the nostalgia of pixel art with the clarity of contemporary UI. The brand personality is gentle, encouraging, and intellectually stimulating without being clinical. It aims to evoke the feeling of a calm morning in a sunlit room—studious yet relaxed.

The style is a hybrid of **Tactile Minimalism** and **Pixel-Art Revival**. It avoids the aggressive grids of retro gaming in favor of a "die-cut sticker" look. Every interactive element should feel like a physical object placed onto a soft cream paper surface. By eschewing neon and dark industrial tropes, the system prioritizes accessibility and mental well-being, making brain training feel like a cozy ritual rather than a high-stakes challenge.

## Colors

The palette is anchored by a soft cream base to reduce eye strain during focus-heavy tasks. 
- **Primary (Mint Green):** Used for "Success" states, progress bars, and primary call-to-action buttons.
- **Secondary (Peach):** Used for interactive highlights, gamification milestones, and playful accents.
- **Tertiary (Lavender/Soft Lime):** Used for secondary categories, background chips, and non-critical data visualization.
- **Neutral (Deep Warm Charcoal):** Reserved exclusively for high-contrast borders and "sticker" shadows to ensure legibility and structural definition.

All colors should maintain a "washed-out" but intentional saturation to prevent visual fatigue.

## Typography

This design system utilizes **Space Grotesk** across all levels to bridge the gap between pixel aesthetics and modern readability. The geometric quirks of the typeface complement the "blocky" nature of pixel art without sacrificing the legibility required for a brain training app.

Headlines should use tighter letter-spacing and heavier weights to feel grounded. Body text should remain airy with a generous line height (1.6) to ensure clarity during reading exercises. For labels and small metadata, uppercase styling with increased tracking should be used to provide a crisp, organized hierarchy.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy, centered on a 4px pixel-perfect increment. Elements should always align to this 4px rhythm to reinforce the pixel-art feel. 

Margins and gutters are kept generous to allow the "sticker" shadows enough room to breathe without overlapping adjacent content. Containers should utilize internal padding of `md` (16px) or `lg` (24px) to ensure that the bold charcoal borders do not crowd the content within.

## Elevation & Depth

This design system rejects ambient, blurry shadows in favor of **Hard-Edge Offset Shadows**. Depth is communicated through a 2-tier system:

1.  **Resting State:** Elements feature a 4px offset (down and right) in Deep Warm Charcoal (#2D2926). A solid 2px border of the same color must enclose the element.
2.  **Active/Hover State:** Elements feature an 8px offset to simulate "lifting" off the page. In mobile contexts, the shadow may disappear or "shrink" to 2px upon press to simulate a physical button being pushed into the surface.

This approach creates a tactile "die-cut" effect, where every UI component feels like a high-quality sticker applied to the background.

## Shapes

The shape language is strictly **Sharp (0px roundedness)**. To achieve the lo-fi pixel aesthetic, all corners must remain at 90-degree angles. Any "rounding" should be simulated through the pixel art itself (stair-stepped corners) rather than CSS border-radius. This ensures that the typography and the pixel-based icons feel like they belong to the same visual universe.

## Components

**Buttons**
Primary buttons use the Mint Green (#B5EAD7) fill with a 2px Charcoal border and a 4px hard shadow. Text is centered and bold. Secondary buttons use the Peach (#FFDAC1) or Lavender (#E2F0CB) fill.

**Cards & Modules**
Containers for brain training games use the Soft Cream (#FFFDF5) background, distinguished from the main canvas by their 2px Charcoal border and hard shadow.

**Progress Bars**
Linear bars with a Charcoal frame. The "fill" should be Mint Green, appearing as a solid block of color with no gradients.

**Chips & Tags**
Used for difficulty levels (e.g., "Easy", "Hard"). These are small rectangular boxes with a 1px border and a 2px shadow.

**Input Fields**
White backgrounds with a 2px Charcoal border. When focused, the border weight does not change, but the shadow offset increases from 4px to 6px.

**Modals**
Large-scale stickers centered on the screen. A semi-transparent overlay (Deep Warm Charcoal at 20% opacity) should dim the background to maintain focus on the cozy, tactile modal.