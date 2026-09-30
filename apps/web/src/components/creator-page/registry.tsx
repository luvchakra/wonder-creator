import { TEMPLATE_INFO, resolveTemplateId, type CreatorPageTemplateId } from "@wonder/creator-studio/creator-page";
import { cn } from "@wonder/ui";
import type { ComponentType } from "react";
import type { PublicCreatorPage } from "@/lib/public-pages";
import { templateSettings, type CreatorPageTemplateProps } from "./parts";
import { CinematicDark } from "./templates/cinematic-dark";
import { CreativeCollage } from "./templates/creative-collage";
import { ImmersiveArtistic } from "./templates/immersive-artistic";
import { MinimalEditorial } from "./templates/minimal-editorial";
import { SoftGradient } from "./templates/soft-gradient";

/** The template registry (spec §9): one renderer per id — the only place templates are chosen. */
export const TEMPLATE_RENDERERS: Record<CreatorPageTemplateId, ComponentType<CreatorPageTemplateProps>> = {
  immersive_artistic: ImmersiveArtistic,
  minimal_editorial: MinimalEditorial,
  cinematic_dark: CinematicDark,
  creative_collage: CreativeCollage,
  soft_gradient: SoftGradient,
};

export { TEMPLATE_INFO };

/**
 * A Creator Page through one template. The public page and the owner's preview both render this, so they can't drift
 * (spec §28). Layout follows the container's width (container queries), so the preview's phone and desktop frames show
 * exactly what those screens will.
 */
export function CreatorPageView({ data, mode, templateId, settings, className }: { data: PublicCreatorPage; mode: "public" | "preview"; templateId?: CreatorPageTemplateId; settings?: CreatorPageTemplateProps["settings"]; className?: string }) {
  const id = resolveTemplateId(templateId ?? data.templateId);
  const Renderer = TEMPLATE_RENDERERS[id];
  return (
    <div className={cn("@container", className)} data-template={id}>
      <Renderer data={data} mode={mode} settings={settings ?? templateSettings(data, id)} />
    </div>
  );
}
