# Wonder Creator — Right-Middle Persistent Mini Player Specification

**Status:** Implementation-ready  
**Date:** 27 September 2026  
**Audience:** Claude Code / engineering / design  
**Scope:** persistent mini music/audio player across Wonder Creator  
**Primary behavior:** collapsed right-edge tab ↔ expanded floating mini player  
**Visual direction:** compact, calm, artistic, non-blocking, consistent with Wonder Creator

---

# 1. Product Intent

Wonder Creator should support a lightweight music/audio player that can continue playing while the creator moves through the app.

The player should:

- stay available across pages;
- never dominate the screen;
- never cover the primary creative action;
- collapse neatly into the **right side, vertically centered**;
- expand from that same location when tapped;
- preserve playback across navigation;
- remain compact and predictable.

The experience should feel like:

> **A creative companion that stays with me without getting in my way.**

---

# 2. Core Interaction Model

The player has two persistent states:

```text
COLLAPSED
→ slim right-edge floating tab
→ vertically positioned around the middle-right of the viewport
→ partially detached from the page content
→ tap to expand

EXPANDED
→ compact floating player panel
→ expands leftward from the same right-middle anchor
→ shows essential playback controls
→ tap collapse control / outside area to collapse
```

The player should not jump between corners when changing state.

---

# 3. Right-Middle Anchor

Default anchor:

```text
right: 0–8px
top: 50%
transform: translateY(-50%)
```

The player should appear approximately in the right-middle zone of the active viewport.

Do not place it:
- permanently at bottom;
- inside bottom navigation;
- on top of the Palette;
- inside the navbar;
- as a large sticky footer.

---

# 4. Safe-Area Handling

Respect:

```text
env(safe-area-inset-top)
env(safe-area-inset-bottom)
env(safe-area-inset-right)
```

The right-middle anchor may shift slightly to avoid:

- keyboard;
- system overlays;
- browser controls;
- accessibility zoom;
- floating OS elements;
- video controls;
- Picture-in-Picture controls.

Do not let it overlap the Palette trigger.

---

# 5. Collapsed State

## Purpose

Give the creator:

- awareness that audio is playing;
- one-tap access;
- minimal screen obstruction.

## Suggested visual structure

```text
┌──────┐
│ art  │
│wave  │
│  ›   │
└──────┘
```

Recommended contents:

- tiny album/track artwork;
- subtle waveform/equalizer indicator when playing;
- chevron / expand affordance.

Optional:
- pause/play icon if interaction remains obvious.

## Size

Suggested visual size:

```text
width: 42–52px
height: 96–120px
```

Hit targets remain >=44px.

---

# 6. Collapsed Interaction

Tap anywhere on collapsed player:

```text
→ expand player
```

Optional long-press:

```text
→ playback menu
```

Do not expose several tiny buttons in collapsed mode.

Collapsed mode is primarily for:

```text
awareness + expand
```

---

# 7. Expanded State

Expanded panel should open **leftward from the right-middle anchor**.

Suggested size:

```text
mobile width: 280–340px
height: 150–200px
```

Keep it compact enough that the underlying page is still recognizable.

## Recommended contents

Top row:

```text
thumbnail
track title
artist / source
collapse / close
```

Middle:

```text
progress bar
current time
duration
```

Bottom controls:

```text
previous
play / pause
next
queue / more
```

Optional:

```text
favorite
mood
```

but only if space permits.

---

# 8. Expanded Player — Minimal Buttons

Visible player controls should remain minimal.

Recommended:

```text
Previous
Play / Pause
Next
Queue / More
```

Do not simultaneously show:

```text
repeat
shuffle
favorite
mood
speed
lyrics
device
download
playlist
volume
```

unless the user explicitly opens More.

---

# 9. Collapse Behavior

Expanded player should collapse when:

```text
user taps collapse control
user taps the collapsed-edge affordance
user swipes the panel rightward
optional outside-tap if it does not conflict with page interaction
```

Do not auto-collapse after a fixed timer while the user is interacting with the player.

---

# 10. Animation

Use one restrained transition.

Expand:

```text
200–260ms
panel grows/slides left from right edge
small opacity fade
```

Collapse:

```text
180–240ms
panel contracts/slides right into edge tab
```

No:
- bounce;
- large spring overshoot;
- rotation;
- multi-stage card animation;
- decorative particle effects.

Respect:

```text
prefers-reduced-motion
```

Reduced-motion mode:

```text
simple opacity + size change
```

---

# 11. Persistence Across Pages

The mini player should remain mounted at the app-shell level.

It should not remount on every route.

Recommended placement:

```text
AuthenticatedAppShell
 ├── Navbar
 ├── Page
 ├── MiniPlayerLayer
 └── PaletteLayer
```

Playback must continue across:

```text
Home
Materials
Creation
Creative Studio
Creative Room
Huddles
Explore
Me
Settings
Business
Analytics
```

unless the user explicitly stops playback.

---

# 12. Player State Persistence

Persist:

```text
current track
queue
play / pause state
current time
volume
collapsed / expanded state
selected mood / station if applicable
```

At minimum:

```text
track
queue
currentTime
isPlaying
```

Persist app-session state across route navigation.

Optional:

```text
local persistence across app restart
```

if product behavior calls for it.

---

# 13. Route Behavior

Default:

```text
player remains collapsed or expanded as user left it
```

Exceptions may force collapse:

```text
full-screen Slide Editor
immersive Creative Studio
full-screen Huddle video
full-screen Creation playback
keyboard-heavy text editor if overlap occurs
```

Even in these cases:

```text
playback continues
```

Only the visual player collapses.

---

# 14. Do Not Compete With Palette

The Palette is usually bottom-right.

The mini player is right-middle.

Maintain a minimum vertical separation:

```text
>= 72px
```

If overlap risk exists:

```text
player shifts upward slightly
```

Do not move the Palette.

---

# 15. Do Not Obscure Primary Actions

Before rendering expanded player, check:

- sticky primary CTA;
- floating form submit;
- live Huddle controls;
- media playback controls;
- text overlay editing handles;
- right-side utility panel.

If collision occurs:

```text
shift player vertically
or temporarily collapse
```

Never cover the most important action.

---

# 16. Scroll Behavior

Collapsed player:

```text
fixed to viewport
```

It should not scroll with page content.

Expanded player:

```text
fixed to viewport
```

Do not attach to document flow.

---

# 17. Drag Repositioning

Default behavior should stay predictable.

Do **not** require free dragging.

Optional advanced behavior:

```text
drag vertically along right edge only
```

If implemented:
- constrain to right edge;
- snap to safe zones;
- persist position for session.

Do not allow arbitrary floating placement across the page unless proven necessary.

---

# 18. Playing Indicator

Collapsed mode may show:

```text
small animated equalizer / waveform
```

Only when audio is playing.

When paused:

```text
static waveform / pause state
```

Animation should be subtle.

Respect reduced-motion preference.

---

# 19. Track Information

Expanded panel should show:

```text
Track title
Artist / source
```

Optional:

```text
mood
playlist/station name
```

Avoid long metadata.

Truncate cleanly.

Example:

```text
Nocturne in E-flat
Frédéric Chopin
```

---

# 20. Artwork

Use:

```text
track artwork
album art
Creation artwork
mood artwork
```

depending on source.

Fallback:

```text
Wonder Creator audio glyph
```

Do not generate new artwork solely for the mini player unless the source experience explicitly calls for it.

---

# 21. Playback Controls

Essential controls:

```text
previous
play / pause
next
```

Optional fourth:

```text
queue / more
```

Minimum hit target:

```text
44 × 44px
```

Visual icons can remain 18–22px.

---

# 22. Progress Bar

Expanded state should show:

```text
current time
scrubbable progress
duration
```

Progress bar visual height can remain small.

Interactive target should be enlarged invisibly.

---

# 23. Queue

Queue should open as a compact sheet.

Do not expand the mini player vertically into a giant playlist.

Queue sheet may show:

```text
Now Playing
Up Next
Recently Played
```

Compact rows only.

---

# 24. Mood Switching

If the player is driven by mood:

```text
More → Change mood
```

or:

```text
Queue sheet → mood selector
```

Do not permanently place mood controls in the expanded player unless proven high-frequency.

---

# 25. Audio Source Types

Mini player should support:

```text
background music
Creative Material audio
Creation audio
Huddle-preserved audio
generated music
licensed/free music
```

Use one unified playback store.

---

# 26. Creative Material Playback

When playing an audio Material:

```text
track title → Material title
artist/source → creator or source attribution
```

Tapping track info may open the Material detail.

---

# 27. Creation Playback

When playing audio from a Creation:

```text
track title → Creation title
subtitle → Creation type / creator
```

Tapping track info opens the Creation.

---

# 28. Huddle Interaction

If a live Huddle begins and requires microphone/audio focus:

Default:

```text
pause background music automatically
```

Show:

```text
Paused for Huddle
```

After Huddle ends:

```text
offer Resume
```

Do not automatically resume if that would surprise the creator.

---

# 29. Video / Media Conflict

If a video starts playing with sound:

Recommended:

```text
pause mini player
```

or duck volume if the media framework supports safe predictable ducking.

Prefer predictable pause over simultaneous competing audio.

---

# 30. Phone Call / OS Audio Interruption

Respect platform audio focus.

On interruption:

```text
pause playback
```

After interruption:
- do not auto-resume unless platform/user preference allows.

---

# 31. Keyboard Behavior

If on-screen keyboard would collide with player:

```text
collapse automatically
```

and move above keyboard if still shown.

Do not cover:
- text input;
- send button;
- meTalk field;
- slide text editor.

---

# 32. Carousel Composer Interaction

In Carousel Overview:

```text
mini player remains right-middle
```

In full-screen Slide Editor:

```text
default to collapsed
```

If text overlay editing begins:

```text
collapse if it overlaps handles/tools
```

Playback continues.

---

# 33. Creative Studio Interaction

In immersive Creative Studio:

Recommended:

```text
collapsed only by default
```

Expanded state allowed only when:
- not blocking editing;
- user explicitly opens it.

---

# 34. Huddle Discovery Interaction

Mini player can remain available.

If a live Huddle is joined:

```text
pause/collapse
```

---

# 35. Home Interaction

Home is a suitable place for:

```text
collapsed by default
```

Expanded player may show comfortably without blocking current Creation card.

---

# 36. Materials Interaction

Player should stay fixed while the Material grid scrolls.

Collapsed state should not cover:
- search;
- filter chips;
- selected Material actions.

---

# 37. Accessibility

Collapsed player:

```text
aria-label="Open audio player"
```

Expanded player:

- semantic buttons;
- clear play/pause state;
- track title announced;
- progress accessible;
- collapse button labelled.

Keyboard/web:

```text
Space → play/pause when player focused
Arrow keys → optional seek
Escape → collapse
```

Do not trap focus permanently unless a modal sheet opens.

---

# 38. Screen Reader Behavior

Do not announce:

```text
current time every second
```

Announce:

```text
Track changed
Playback paused
Playback resumed
```

only when appropriate.

---

# 39. Performance

Mini player must not cause app-wide re-renders every second.

Use isolated state/selectors.

Progress updates should remain local to player components.

Avoid:
- route-level re-render;
- expensive visualizer loops;
- unnecessary artwork fetches.

---

# 40. Audio Engine Architecture

Recommended conceptual structure:

```text
AudioProvider
 ├── playback state
 ├── queue state
 ├── audio element / native bridge
 ├── media session integration
 └── persistence
```

UI:

```text
MiniPlayerCollapsed
MiniPlayerExpanded
QueueSheet
```

---

# 41. Suggested State Model

```ts
type PlayerState = {
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  queueIndex: number;

  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;

  uiState: "collapsed" | "expanded";
  anchorY?: number;

  interruptionReason?: string | null;
};
```

---

# 42. Track Model

```ts
type PlayerTrack = {
  id: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string;

  sourceType:
    | "music"
    | "material"
    | "creation"
    | "huddle"
    | "generated";

  sourceId?: string;
  audioUrl: string;
  duration?: number;
};
```

---

# 43. App Shell Integration

Example:

```tsx
<AppShell>
  <Navbar />
  <RouteContent />
  <PersistentMiniPlayer />
  <CreativePalette />
</AppShell>
```

The player should exist once.

Do not create a new audio element per page.

---

# 44. Z-Index Rules

Suggested conceptual ordering:

```text
Page content
< Mini player
< Palette open layer / sheets
< Modal
< critical system dialog
```

Collapsed player may sit above normal cards.

Expanded player should not sit above an active modal.

---

# 45. More Menu

Expanded player `More` may contain:

```text
View track
Queue
Change mood
Save to Materials
Stop playback
```

Only include actions relevant to the current source.

Do not show irrelevant controls.

---

# 46. Stop Playback

Stopping is different from pausing.

Stop may:
- clear current playback;
- optionally keep queue.

Put under More rather than as a permanent visible control.

---

# 47. Close vs Collapse

Use interaction language carefully.

Recommended:

```text
Collapse
```

for hiding the player into the right-edge tab.

Do not use an X if it implies stopping playback.

If an X is used visually, it must mean:

```text
Collapse player
```

not terminate audio.

Better icon:

```text
›
```

or right-edge collapse glyph.

---

# 48. Visual Styling

Use:

- cream/white surface;
- subtle purple accents;
- small botanical detail only if it does not add size;
- soft shadow;
- moderate radius;
- restrained artwork.

Avoid oversized decorative chrome.

The mini player should be beautiful but mostly functional.

---

# 49. Collapsed Visual Example

```text
                ┌─────┐
                │ art │
                │ ≋≋≋ │
                │  ›  │
                └─────┘
```

Right edge should feel intentionally tucked into the device edge.

---

# 50. Expanded Visual Example

```text
          ┌──────────────────────────────┐
          │ [art] Track title        ›  │
          │       Artist                 │
          │ ───────●──────────────       │
          │ 0:14                 2:38    │
          │   ‹‹      ▶ / ❚❚      ››  ≡ │
          └──────────────────────────────┘
```

Panel expands leftward while preserving the same vertical anchor.

---

# 51. Interaction Sequence

```text
User sees collapsed tab
↓
Tap
↓
Expanded player opens left
↓
User controls playback
↓
Tap collapse / swipe right
↓
Player tucks back into right edge
↓
Playback continues
```

---

# 52. Route Transition Rule

When navigating to another page:

```text
player remains in same UI state
```

unless page explicitly requests:

```text
forceCollapsed = true
```

Use this only for immersive/editing contexts.

---

# 53. Page-Level Collision API

Allow routes/components to declare:

```ts
type MiniPlayerConstraint = {
  forceCollapsed?: boolean;
  avoidBottomPx?: number;
  avoidTopPx?: number;
  hidden?: boolean;
};
```

Prefer:

```text
forceCollapsed
```

over fully hiding.

Only hide player UI when absolutely necessary.

Playback continues even if UI is temporarily hidden.

---

# 54. Media Session Integration

Where supported, integrate with OS media session for:

```text
play
pause
next
previous
track metadata
artwork
```

This lets playback remain usable outside the app UI.

---

# 55. Lock Screen / Notification Controls

Where platform support allows:

- track title;
- play/pause;
- next/previous;
- artwork.

Do not duplicate app-specific CreativeMind controls in system media UI.

---

# 56. Error State

If audio fails:

Collapsed:

```text
small warning state
```

Expanded:

```text
Couldn’t play this track.

Retry
```

Do not show raw provider/storage errors.

---

# 57. Empty State

If no track is active:

Preferred:

```text
do not show mini player
```

The right-edge tab appears only after audio playback has started or a persistent queue exists.

---

# 58. Loading State

If track is loading:

Collapsed:

```text
static artwork + subtle progress indicator
```

Expanded:

```text
Loading…
```

Keep it compact.

---

# 59. Offline Behavior

If track is cached/downloaded:

```text
continue playback
```

If unavailable offline:

```text
Unavailable offline
```

Do not repeatedly retry in background.

---

# 60. Persisted Queue

Optional session persistence:

```text
queue restored when app resumes
```

If the app was fully closed:
- restore queue;
- default to paused unless product behavior explicitly allows resume.

---

# 61. Analytics

Track:

```text
mini_player_opened
mini_player_collapsed
playback_started
playback_paused
track_changed
queue_opened
mini_player_collision_adjusted
```

Do not log private audio content.

---

# 62. QA Checklist

```text
[ ] Collapsed player sticks to right-middle
[ ] Expanded player grows left from same anchor
[ ] Tap toggles collapsed/expanded predictably
[ ] Playback continues across routes
[ ] Player never overlaps Palette
[ ] Player never covers primary CTA
[ ] Full-screen editors force compact/collapsed state where needed
[ ] Huddle/media audio conflicts handled
[ ] Keyboard does not get covered
[ ] Hit targets >=44px
[ ] Reduced motion supported
[ ] Screen reader labels correct
[ ] No per-page audio element duplication
[ ] App does not re-render globally every second
```

---

# 63. CLAUDE.md Standing Instruction

Add:

```md
## Persistent right-middle mini player (owner's standing instruction)

Wonder Creator's mini audio/music player is a persistent app-shell component.

* When audio is active, the player docks to the **right edge around the vertical middle of the viewport**.
* Default compact state is a slim right-edge tab showing tiny artwork + subtle playing indicator + expand affordance.
* Tapping the collapsed player expands a compact player **leftward from the same right-middle anchor**.
* Expanded player shows only essential controls: track info, progress, previous, play/pause, next, and optional Queue/More.
* Tapping collapse or swiping right returns it to the same right-edge tab. Collapsing never stops playback.
* Do not place the mini player in bottom navigation or as a persistent bottom bar.
* The player persists across routes and should be mounted once at app-shell level. Never create a new audio element/player instance per page.
* Playback continues across Home, Materials, Creation, Creative Studio, Creative Room, Explore, Huddles, Me, Business, Analytics and Settings unless interrupted by another audio-focus experience.
* In immersive/full-screen editing contexts, default to `forceCollapsed`; playback continues.
* Live Huddle or foreground video/audio should pause or appropriately interrupt background mini-player audio.
* Player must not cover the Palette, primary CTA, keyboard, live controls, text-overlay handles, or other high-priority UI. Shift vertically or force-collapse when collision occurs.
* Maintain >=72px separation from the Palette trigger when both are visible.
* Use only one restrained expand/collapse transition (roughly 180–260ms). No bounce, rotation, multi-stage choreography or decorative animation.
* Respect `prefers-reduced-motion`.
* Collapsed mode should not expose multiple tiny buttons. Its main purpose is awareness + expand.
* Expanded player remains compact; secondary controls such as mood, queue, save, stop, repeat/shuffle live under Queue/More as relevant.
* Minimum interactive hit target remains >=44×44 CSS px.
* If no track/queue is active, do not show the mini player.
* Persist current track, queue, playback time and play/pause state across route navigation.
* Integrate OS Media Session controls where supported.
* Keep playback state isolated so progress updates do not trigger app-wide re-renders.
```

---

# 64. Final Product Rule

The mini player should always feel:

> **available, but never in the way.**

The interaction rule is:

> **Stick to the right-middle, expand from there, collapse back there, and preserve the creator’s flow.**
