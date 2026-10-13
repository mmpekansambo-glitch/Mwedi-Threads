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

const colors = {
  light: {
    text: '#302c43',
    tint: '#51458a',
    background: '#f7f3e9',
    foreground: '#302c43',
    card: '#fffdf8',
    cardForeground: '#302c43',
    primary: '#51458a',
    primaryForeground: '#fffaf2',
    secondary: '#ebe5d9',
    secondaryForeground: '#37324b',
    muted: '#efeae0',
    mutedForeground: '#777184',
    accent: '#e8a58c',
    accentForeground: '#302c43',
    destructive: '#a3413f',
    destructiveForeground: '#ffffff',
    border: '#e4ddd2',
    input: '#e4ddd2',
    softPlum: '#eeebf3',
    knitWash: '#e8e3ee',
    crochetWash: '#f1e6d9',
    finishWash: '#f4e5dd',
    finishText: '#995d4b',
    successWash: '#e5eee5',
    successText: '#476f62',
    pauseWash: '#f5ead9',
    pauseText: '#95633d',
    warningWash: '#fbefec',
    warningBorder: '#e8c8be',
    warningText: '#694b4b',
  },

  radius: 16,
};

export default colors;
