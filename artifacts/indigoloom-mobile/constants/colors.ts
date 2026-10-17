/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

// Colors follow the PLAN.md palette (section 6): Lavender #C5D1EB, Powder Blue
// #92AFD7, Blue Slate #5A7684, Granite #395B50 and Evergreen #1F2F16. The
// washes are lighter shades of those colors. Delete and error stay red.
const colors = {
  light: {
    text: '#1F2F16',
    tint: '#395B50',
    background: '#C5D1EB',
    foreground: '#1F2F16',
    card: '#FFFFFF',
    cardForeground: '#1F2F16',
    primary: '#395B50',
    primaryForeground: '#FFFFFF',
    secondary: '#EEF2F9',
    secondaryForeground: '#1F2F16',
    muted: '#EEF2F9',
    mutedForeground: '#425863',
    accent: '#92AFD7',
    accentForeground: '#1F2F16',
    destructive: '#a3413f',
    destructiveForeground: '#ffffff',
    border: '#DDE5F3',
    input: '#DDE5F3',
    selectedWash: '#DCE6F4',
    knitWash: '#C5D1EB',
    crochetWash: '#DCE6F4',
    planningChip: '#C5D1EB',
    planningText: '#1F2F16',
    inProgressChip: '#92AFD7',
    inProgressText: '#1F2F16',
    pausedChip: '#DCE4E8',
    pausedText: '#425863',
    completedChip: '#395B50',
    completedText: '#FFFFFF',
    warningWash: '#fbefec',
    warningBorder: '#e8c8be',
    warningText: '#694b4b',
  },

  radius: 16,
};

export default colors;
