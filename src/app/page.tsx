import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { HomeHero } from "@/components/home/hero";
import { ArchiveSection } from "@/components/home/archive-section";
import { getArchives, getGalleryHighlights } from "@/lib/supabase/queries";
import { resolveImageView } from "@/lib/photo-url-server";

export const revalidate = 300;

export default async function HomePage() {
  const [archives, photos] = await Promise.all([
    getArchives(),
    getGalleryHighlights(6),
  ]);

  const heroPhotos = photos.map((p) => ({
    ...p,
    url: resolveImageView(p.id, p.storagePath) ?? "",
  }));

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
