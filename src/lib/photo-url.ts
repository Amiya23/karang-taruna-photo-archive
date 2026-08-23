export function photoPublicUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${storagePath}`;
}

export function resolveImageUrl(value: string): string {
  return value.startsWith("http") ? value : photoPublicUrl(value);
}
