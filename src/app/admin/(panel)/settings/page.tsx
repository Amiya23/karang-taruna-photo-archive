import type { Metadata } from "next";
import {
  getHomepageSettings,
  getPhotosForHeroPicker,
} from "@/lib/supabase/queries";
import { HeroSettingsForm } from "@/components/admin/hero-settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaturan — Panel Admin Karang Taruna RT016",
};

export default async function AdminSettingsPage() {
  const [settings, photos] = await Promise.all([
    getHomepageSettings(),
    getPhotosForHeroPicker(200),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-charcoal/60">
          Atur tampilan beranda, termasuk 3 foto yang muncul pada Hero homepage.
        </p>
      </header>

      <section
        aria-label="Hero Homepage"
        className="overflow-hidden rounded-xl border border-cloudgray bg-white shadow-sm"
      >
        <div className="border-b border-cloudgray px-5 py-4">
          <h2 className="font-semibold text-navy-900">Hero Homepage</h2>
          <p className="mt-0.5 text-xs text-charcoal/55">
            Pilih tepat 3 foto dari koleksi yang ada. Setiap slot harus foto
            yang berbeda. Perubahan langsung terlihat di beranda setelah simpan.
          </p>
        </div>
        <div className="px-5 py-5">
          <HeroSettingsForm
            initial={{
              heroPhoto1Id: settings?.heroPhoto1Id ?? null,
              heroPhoto2Id: settings?.heroPhoto2Id ?? null,
              heroPhoto3Id: settings?.heroPhoto3Id ?? null,
            }}
            photos={photos}
          />
        </div>
      </section>
    </div>
  );
}
