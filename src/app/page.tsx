import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { HomeHero } from "@/components/home/hero";
import { ArchiveSection } from "@/components/home/archive-section";
import {
  getArchives,
  getGalleryHighlights,
  getHomepageSettings,
  getHeroPhotosByIds,
  type GalleryPhoto,
} from "@/lib/supabase/queries";
import { resolveImageView } from "@/lib/photo-url-server";
import { resolveHeroPhotos, type HeroSlot } from "@/lib/hero-settings";

export const revalidate = 300;

export default async function HomePage() {
  const [archives, settings, fallback] = await Promise.all([
    getArchives(),
    getHomepageSettings(),
    getGalleryHighlights(12),
  ]);

  // Resolve the 3 admin-chosen hero photos (in slot order); missing/deleted IDs
  // are absent so the pure resolver can fill the gap from fallback highlights.
  const settingsIds: (string | null)[] = settings
    ? [settings.heroPhoto1Id, settings.heroPhoto2Id, settings.heroPhoto3Id]
    : [null, null, null];
  const chosenPhotos = await getHeroPhotosByIds(settingsIds);

  const fallbackSlots: HeroSlot[] = fallback.map((p) => ({
    id: p.id,
    storagePath: p.storagePath,
    filename: p.filename,
    caption: p.caption,
  }));

  const heroSlots: HeroSlot[] = resolveHeroPhotos(chosenPhotos, fallbackSlots);

  const heroPhotos: (GalleryPhoto & { url: string })[] = heroSlots
    .map((slot) => {
      const url = resolveImageView(slot.id, slot.storagePath);
      return url
        ? { ...(slot as GalleryPhoto), url }
        : null;
    })
    .filter((p): p is GalleryPhoto & { url: string } => p !== null);

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <SiteHeader />
      <main className="flex-1">
        <HomeHero photos={heroPhotos} yearsCount={archives.length} />
        <ArchiveSection archives={archives} />
      </main>
      <SiteFooter />
    </div>
  );
}
