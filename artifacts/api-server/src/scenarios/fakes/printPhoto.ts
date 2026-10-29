// Stands in for lib/printPhoto in the scenario stories, where the photos are
// never really uploaded. A story sets what the print photo check answers when
// new fabric looks like fabric in the Archive: true (same print), false
// (clearly different) or null (can't tell).
export const printPhotos: { lookAlike: boolean | null } = { lookAlike: null };

export async function printsLookAlike(_photoPath: string, _otherPhotoPath: string): Promise<boolean | null> {
  return printPhotos.lookAlike;
}
