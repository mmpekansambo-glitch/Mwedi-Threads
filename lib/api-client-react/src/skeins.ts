// What skeins left becomes when a maker changes how many they bought,
// worked out from the numbers saved before this edit:
// - buying more adds the same amount to what's left;
// - buying fewer lowers what's left only if none had been used yet, or if
//   what's left would now be more than was bought;
// - a blank skeins left means "same as bought" and stays blank.
// Returns null when skeins left doesn't need to change.
export function skeinsLeftAfter(
  savedPurchased: number | null,
  savedLeft: number | null,
  purchased: number | null,
): number | null {
  if (savedPurchased === null || savedLeft === null || purchased === null || purchased === savedPurchased) return null;
  if (purchased > savedPurchased) return savedLeft + (purchased - savedPurchased);
  if (savedLeft === savedPurchased || savedLeft > purchased) return purchased;
  return null;
}
