# VMRack-Style Frontend Redesign

## Goal
Rework the public Excel community frontend into a VMRack-inspired interface across the full user-facing site, not only the home page.

## Reference Traits
- Top mint announcement strip and horizontal navigation.
- Dark first viewport with deep navy/black background, blue-violet light beams, oversized centered headline, and pill CTA.
- First viewport reveals the next content row at the bottom.
- Product/feature areas use strong section rhythm: dark feature blocks, left-side category selectors, large visual panels, then white/light-blue support sections.
- Components use large rounded corners, pill actions, blue primary accents, compact icons, and restrained copy.

## Scope
Apply the redesign to:
- Public shell: `Layout.tsx`
- Shared page primitives: `LiteSurface.tsx`
- Home/tutorial landing: `Home.tsx`
- Practice surfaces: campaign hub, chapters, chapter detail, daily challenge, wrongs, ranking, result, detail, history, record detail
- Template center and purchase records
- Mall, props, redemptions
- Tools and tools history
- Notifications, profile center, settings, point history, task center

Admin remains functionally unchanged except for inheriting any global tokens where they do not break dense management screens.

## Architecture
Create a small route/navigation configuration module used by the shell and tests. Keep data-fetching behavior unchanged. Use shared visual primitives for the VMRack-like frame, hero, section title, and panels so deep pages inherit the new shell without large business rewrites.

## Verification
- Unit test the route/nav helper.
- Run frontend build.
- Capture desktop screenshots for `/`, `/practice`, `/templates`, `/mall`, and `/tools`.
- Check mobile screenshot for `/`.
