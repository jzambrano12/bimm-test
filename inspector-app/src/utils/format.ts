export function truncateMakeModel(make: string, model: string): string {
  const combined = `${make} ${model}`;
  if (combined.length > 22) {
    return `${combined.slice(0, 22)}…`;
  }
  return combined;
}
