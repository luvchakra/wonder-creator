import { PageTitle } from "@wonder/ui";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PaletteScope } from "@/components/creative-palette";
import { careersKeyView } from "@/lib/careers/wonderjobs";
import { platformAdminEmail } from "@/lib/platform-admin";
import { requireSession } from "@/lib/session";
import { CareersKeyForm } from "./careers-key-form";

export const metadata = { title: "Careers", robots: { index: false, follow: false } };

/**
 * Settings › Careers (platform administrators only; docs/careers.md): the WonderJobs career-site key behind /careers.
 * Anyone else gets "not found". The key is shown only as a mask; saving and clearing are audited.
 */
export default async function CareersSettingsPage() {
  const { db } = await requireSession();
  if (!(await platformAdminEmail(db))) notFound();
  const view = await careersKeyView();
  return (
    <>
      <PaletteScope context={{ page: "settings", strip: { label: "Careers" } }} />
      <div className="mx-auto max-w-3xl">
        <BackLink home="/settings" homeLabel="Settings" />
        <PageTitle title="Careers" subtitle="The WonderJobs connection behind the public Careers page." />
        <CareersKeyForm initial={view} />
      </div>
    </>
  );
}
