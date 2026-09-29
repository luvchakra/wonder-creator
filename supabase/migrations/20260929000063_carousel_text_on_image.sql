-- Carousel slides show their words on the image by default (owner, 29 Sep 2026: "text on image should come by default
-- once in carousel mode"). Slides still carrying only the old column default ({"enabled": false}, never touched by the
-- creator — an edited overlay always stores its full style) switch on; a creator's own choice to turn it off is kept.
alter table public.carousel_slides alter column overlay set default '{"enabled": true}'::jsonb;
update public.carousel_slides set overlay = '{"enabled": true}'::jsonb where overlay = '{"enabled": false}'::jsonb;
