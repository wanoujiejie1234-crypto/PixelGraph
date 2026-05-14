# Design System: PixelGraph

## 1. Visual Theme & Atmosphere
PixelGraph is a precise developer workbench with Daily App Balanced density, Offset Asymmetric composition, and Fluid CSS motion. The interface should feel like a focused diagram console: technical, calm, local-first, and sharp enough for long writing sessions without becoming sterile.

Use a split workspace as the default first screen. Editing and preview are both primary surfaces, but the preview should carry more visual weight through scale, contrast, and spatial breathing room. Avoid landing-page composition.

## 2. Color Palette & Roles
- **Zinc Paper** (#F6F7F4) - Primary light canvas.
- **Porcelain Surface** (#FFFFFF) - Tool panels, controls, and elevated work areas.
- **Zinc Ink** (#18181B) - Primary text and diagram labels.
- **Steel Note** (#71717A) - Secondary text, helper copy, and metadata.
- **Mist Border** (#D9DED8) - Structural borders and editor separators.
- **Charcoal Field** (#1C1D1B) - Dark theme primary canvas.
- **Graphite Surface** (#272824) - Dark theme panels and preview surfaces.
- **Washed Mint** (#5E8D76) - Single accent for active controls, focus rings, and ready states.

The accent must remain below 80% saturation. Do not introduce purple, neon blue, or large gradient surfaces.

## 3. Typography Rules
- **Display:** Geist, Satoshi, or Outfit. Use tight but not negative tracking, strong weight contrast, and restrained scale.
- **Body:** Geist or Satoshi. Keep prose readable with relaxed leading and a 65ch maximum line length.
- **Mono:** Geist Mono or JetBrains Mono. Use for Mermaid source, metadata, diagram IDs, timestamps, and numeric status.
- **Banned:** Inter, generic serif fonts, Times New Roman, Georgia, Garamond, Palatino, pure system default stacks for premium contexts.

## 4. Component Stylings
- **Buttons:** Flat or bordered controls with a clear 44px minimum target. Active state uses a tactile 1px downward transform. No outer glow.
- **Segmented controls:** Use compact pills or connected buttons for diagram type switching. The selected item receives Washed Mint fill or border emphasis.
- **Panels:** Use soft 1px borders and shallow tinted shadows only where hierarchy needs it. In dense regions, use dividers instead of nested cards.
- **Editor:** Monospace source area with line-height comfort, subtle gutter color, and clear focus ring in Washed Mint.
- **Preview canvas:** Large unframed drawing surface with grid texture, visible zoom tools, and status feedback.
- **ER graph canvas:** Treat SQL ER as a database design tool, not as decorative SVG art. Default to a practical table-node view with fields grouped inside each table. Preserve standard Chen ER as a professional alternate view only. Use React Flow-style direct manipulation: drag nodes, pan canvas, wheel zoom, fit view, reset, auto layout, and minimap.
- **ER nodes:** Database nodes use compact table headers, mono field rows, and PK/FK badges. Chen nodes use strict shapes: rectangles for entities, ellipses for attributes, diamonds for relationships. Large schemas must support hiding fields and keys-only display.
- **ER edges:** Lines must route cleanly and avoid a single crowded origin point. Relationship labels and cardinality are concise and readable. Do not allow dense schemas to become a bundle of crossing lines.
- **Loading states:** Use text and skeletal blocks that match the final layout. Do not use circular spinners.
- **Error states:** Show inline, specific messages near the affected area.

## 5. Layout Principles
Use CSS Grid for the application shell and workspace. Desktop layouts should favor an asymmetric 5:7 editor-to-preview split. Below 768px, collapse to a single column with the toolbar, editor, preview, and status sections stacked in that order.

Every element must occupy its own clear spatial zone. Do not overlap controls, text, or diagram objects. Keep the first viewport as the usable product interface.

For ER diagrams, default layout direction is left-to-right. Use automatic layered layout for first render and when the user requests beautify/auto layout. Once users drag nodes manually, keep their positions stable across label edits and SQL regeneration.

## 6. Motion & Interaction
Motion should be quiet and continuous. Use transform and opacity only. Default timing should feel weighted: 180ms for direct feedback, 320ms for panel transitions. Active status indicators may use a subtle opacity pulse. Lists and preview updates should cascade in small delays rather than appearing all at once.

## 7. Anti-Patterns (Banned)
- No emojis.
- No Inter font.
- No pure black (#000000).
- No neon glows or purple-blue gradients.
- No oversaturated accents.
- No excessive gradient text.
- No custom mouse cursors.
- No overlapping elements.
- No equal three-column feature rows.
- No generic placeholder brands or people.
- No fake round-number metrics such as 99.99%.
- No AI copywriting cliches such as Elevate, Seamless, Unleash, or Next-Gen.
- No filler prompts such as Scroll to explore or Swipe down.
- No broken external image links.
- No centered hero section for this product.
