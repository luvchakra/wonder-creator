# WonderCreator — Mood Music Player UI Specification

## Purpose

Add a lightweight, persistent music experience to WonderCreator that can continue playing while the user navigates across the app.

The music feature should feel like an ambient creative companion, not a separate music application.

Primary goals:

- Let users choose music based on mood.
- Keep playback running across page navigation.
- Provide play, pause, previous, next, volume, shuffle, and queue controls.
- Let users change mood at any time.
- Show detailed song information only when requested.
- Keep the UI compact and consistent with WonderCreator.
- Keep music controls available from anywhere in the app.
- Support context-aware music suggestions based on what the user is creating.

---

# 1. Core Experience

The music experience has two primary layers:

1. **Persistent Mini Player**
   - Always accessible while music is active.
   - Lives in the global application shell.
   - Survives page navigation.

2. **Expanded Soundtrack Panel**
   - Opens from the mini player.
   - Lets the user:
     - change mood,
     - browse songs,
     - inspect song details,
     - control playback,
     - manage the queue,
     - refresh the mix.

The player should not occupy permanent navigation space.

---

# 2. Persistent Mini Player

## Placement

Recommended location:

- Desktop: fixed/sticky above the bottom edge of the main app content.
- Mobile/tablet: bottom bar above system/browser controls.

The mini player should be rendered in the global WonderCreator shell, outside individual page routes.

Example:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [art] Quiet Morning            ━━━━━●━━━━━━━━━    ⏮  ❚❚  ⏭  🔊 ♡ ☰ ⌃ │
│       Luna Waves · Calm             1:24 / 3:18                     │
└──────────────────────────────────────────────────────────────────────┘
```

## Required Content

Show:

- small artwork thumbnail,
- song title,
- artist/source,
- active mood,
- progress indicator,
- elapsed / total time,
- previous,
- play/pause,
- next,
- volume,
- favorite,
- queue,
- expand panel.

## Compact Mode

On narrow screens, reduce the mini player to:

```text
[art] Forest Whispers       ⏮   ▶   ⏭   ☰
      Nature Blend
```

Hide non-essential metadata before hiding playback controls.

## Behavior

The mini player must:

- remain mounted during route changes,
- never restart because the user opened another WonderCreator page,
- preserve current song,
- preserve playback position,
- preserve selected mood,
- preserve volume,
- preserve queue.

---

# 3. Expanded Soundtrack Panel

Opening the mini player should display an expanded panel.

Recommended layout on desktop:

```text
┌──────────────────────────────────────────────────────────────┐
│ Soundtrack                                         ×         │
│ Music for your creativity                                   │
│                                                              │
│ [Calm] [Dreamy] [Focus] [Creative] [Energy]                 │
│ [Cinematic] [Nature] [All]                                  │
│                                                              │
│ ┌────────────────────────────┐  ┌──────────────────────────┐ │
│ │ Songs for Calm             │  │ NOW PLAYING              │ │
│ │                            │  │                          │ │
│ │ Quiet Morning       3:18   │  │ [ large artwork ]        │ │
│ │ Forest Whispers     2:46   │  │                          │ │
│ │ Dreamer's Piano     3:12   │  │ Quiet Morning            │ │
│ │ Soft Horizons       4:05   │  │ Luna Waves               │ │
│ │ Morning Light       2:58   │  │                          │ │
│ │ Golden Path         3:41   │  │ ━━━━━●━━━━━━━━━━         │ │
│ │                            │  │                          │ │
│ │                            │  │   ⏮    ❚❚    ⏭          │ │
│ │                            │  │                          │ │
│ └────────────────────────────┘  └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

The expanded panel should remain visually compact.

Do not create excessive cards, large headings, or oversized whitespace.

---

# 4. Mood Filtering

## Mood Options

Initial moods:

- Calm
- Dreamy
- Focus
- Creative
- Energy
- Cinematic
- Nature
- All

Potential future moods:

- Cozy
- Playful
- Adventure
- Magical
- Dark
- Peaceful
- Uplifting
- Lo-fi

## UI

Use compact chips.

Example:

```text
😌 Calm
✨ Dreamy
🌧 Focus
🎨 Creative
⚡ Energy
🎬 Cinematic
🌿 Nature
▦ All
```

Selected mood should use the WonderCreator accent color.

Unselected moods should remain neutral.

## Filtering Behavior

When a mood is selected:

1. Filter songs whose `moods[]` contains the selected mood.
2. Prefer songs not played recently.
3. Keep the currently playing song until:
   - it finishes,
   - the user skips it,
   - or the user explicitly selects another track.
4. Rebuild the upcoming queue using the selected mood.
5. Display:

```text
Songs for Calm
6 songs
```

If `All` is selected, show the full available library.

## Multi-Mood Songs

A track may belong to multiple moods.

Example:

```json
{
  "title": "Forest Whispers",
  "moods": ["calm", "focus", "nature"]
}
```

The same song may therefore appear under multiple mood filters.

---

# 5. Track Ranking Within a Mood

Filtering should not be a simple random list.

Recommended ranking:

```text
score =
  moodMatch
  + userPreference
  + freshness
  + contextMatch
  - recentlyPlayedPenalty
```

Suggested priorities:

1. Exact mood match.
2. Avoid songs played very recently.
3. Favor liked songs slightly.
4. Use energy level to keep the playlist coherent.
5. Optionally use page/context relevance.

Example:

If user selects:

```text
Mood = Focus
```

Prefer:

```text
instrumental = true
energy = low or medium
vocals = none or minimal
recentlyPlayed = false
```

---

# 6. Song List

Each track row should be compact.

Example:

```text
[art] Quiet Morning                         3:18   ♡   ⋮
      Luna Waves

[art] Forest Whispers                       2:46   ♡   ⋮
      Nature Blend
```

## Track Row Content

Show:

- thumbnail,
- title,
- artist/source,
- duration,
- favorite icon,
- overflow menu.

Do not show every metadata field in the list.

## Selected / Playing State

Currently playing track should have a subtle accent background.

Optionally show:

```text
▮▮
```

or a tiny animated equalizer icon.

---

# 7. Track Actions

Clicking the track itself:

- starts playback.

Overflow menu:

```text
Play now
Play next
Add to queue
Favorite
Show song details
More like this
```

Optional future actions:

```text
Hide this song
Don't play this artist
Add to playlist
```

---

# 8. Song Details

Song details should be optional.

Do not permanently occupy screen space on smaller layouts.

Open song details via:

- info icon,
- track overflow menu,
- clicking the artwork/title in the now-playing panel.

## Song Detail UI

Example:

```text
┌─────────────────────────────┐
│ Forest Whispers          ×  │
│                             │
│ [ artwork ]                 │
│                             │
│ Nature Blend                │
│                             │
│ Calm   Nature   Focus       │
│                             │
│ Duration      2:46          │
│ Genre         Ambient       │
│ Energy        Low           │
│ License       CC0           │
│ Source        DURU-AI       │
│                             │
│ [ Play this song ]          │
│ [ Play more like this ]     │
└─────────────────────────────┘
```

## Metadata to Support

Recommended fields:

```text
title
artist
album / collection
duration
moods[]
genre
energy
instrumental
source
license
licenseURL
sourceURL
artworkURL
audioURL
```

Do not show technical metadata unless the user opens Song Details.

---

# 9. Queue / Up Next

The user should be able to see what will play next.

Example:

```text
Up next                                      Clear

1  Forest Whispers                    2:46  ⋮
2  Dreamer's Piano                    3:12  ⋮
3  Soft Horizons                      4:05  ⋮
4  Morning Light                      2:58  ⋮
5  Golden Path                        3:41  ⋮
```

## Queue Actions

Support:

- play a queue item immediately,
- remove item,
- move item up/down,
- clear queue,
- refresh queue.

Drag reorder may be supported on desktop.

Also provide accessible move up/down actions for mobile and keyboard users.

---

# 10. Playback Controls

Required controls:

```text
Shuffle
Previous
Play / Pause
Next
Repeat
Volume
```

Recommended primary control order:

```text
Shuffle   ⏮   ▶/❚❚   ⏭   Repeat
```

Volume should remain secondary.

Play/Pause is the primary action and should be visually dominant.

---

# 11. Change Mood While Playing

Changing mood should not abruptly stop the current track.

Recommended behavior:

```text
Current:
Forest Whispers
Mood = Calm

User selects:
Creative

Result:
- Forest Whispers continues playing.
- Queue becomes Creative.
- Next song is selected from Creative tracks.
```

Provide an optional action:

```text
Switch now
```

if the user explicitly wants immediate mood change.

---

# 12. Refresh Mix

Include:

```text
↻ Refresh mix
```

This should:

- keep the selected mood,
- keep the current song,
- regenerate the upcoming queue,
- avoid recently played tracks when possible.

Do not require the user to switch moods just to get different songs.

---

# 13. "More Like This"

Song details should include:

```text
Play more like this
```

This uses attributes such as:

```text
mood
energy
genre
instrumental
tempo
artist/source
```

to generate a similar queue.

---

# 14. Favorite Songs

Allow a user to favorite tracks.

Favorite button:

```text
♡
```

Selected:

```text
♥
```

Favorites may later become another automatic filter:

```text
Favorites
```

Do not make Favorites a main navigation item.

---

# 15. Context-Aware Music

WonderCreator should optionally use creative context to suggest music.

Examples:

While writing a fantasy story:

```text
Music for this story
Magical · Adventure · Cinematic
```

While illustrating:

```text
Music for drawing
Focus · Creative
```

While creating a bedtime story:

```text
Suggested soundtrack
Calm · Dreamy · Cozy
```

Context-aware music should be a suggestion.

Never automatically change what is already playing without user action.

---

# 16. Context-Aware Palette Integration

Do not add a permanent large "Music" section to the main Palette.

Instead show music commands when relevant.

Examples:

When music is not playing:

```text
🎵 Set the mood
```

When music is playing:

```text
🎵 Calm · Forest Whispers
```

While working on a story:

```text
🎵 Music for this story
```

Additional contextual actions:

```text
Change mood
Pause music
Next song
Open soundtrack
```

This follows the WonderCreator principle:

> Show controls only when they are relevant to the user's current task.

---

# 17. Mobile Behavior

On mobile, the expanded desktop panel should become a bottom sheet.

Structure:

```text
Soundtrack
────────────

Now Playing

[art] Forest Whispers
Nature Blend

━━━━━●━━━━━━

⏮      ❚❚      ⏭

Mood
[Calm] [Dreamy] [Focus] ...

Songs for Calm

...
```

Song Details should open as another bottom sheet or nested detail view.

Do not try to show:

- song list,
- now playing panel,
- queue,
- details

all side-by-side on mobile.

---

# 18. Persistence Across WonderCreator

Music playback state should live above the route/page layer.

Recommended architecture:

```text
WonderCreatorApp
│
├── AudioProvider
│   ├── audio engine
│   ├── currentTrack
│   ├── selectedMood
│   ├── queue
│   ├── history
│   ├── volume
│   └── playback state
│
├── Router
│   ├── Create
│   ├── Stories
│   ├── Characters
│   ├── Illustrations
│   ├── Gallery
│   └── Settings
│
├── GlobalMiniPlayer
│
└── SoundtrackPanel
```

Do not mount the audio engine inside individual pages.

---

# 19. Recommended State Model

```ts
type MusicState = {
  currentTrackId: string | null
  selectedMood: string
  queue: string[]
  history: string[]

  isPlaying: boolean
  currentTime: number
  volume: number

  shuffle: boolean
  repeatMode: "off" | "one" | "all"

  favorites: string[]
  panelOpen: boolean
  detailsTrackId: string | null
}
```

---

# 20. Suggested Track Model

```ts
type Track = {
  id: string

  title: string
  artist: string
  duration: number

  audioUrl: string
  artworkUrl?: string

  moods: string[]
  genre?: string
  energy?: "low" | "medium" | "high"

  instrumental?: boolean
  bpm?: number

  license: string
  licenseUrl?: string
  source?: string
  sourceUrl?: string
}
```

---

# 21. Playback Rules

### Play

Start current track.

### Pause

Pause without resetting position.

### Next

Play the next track in queue.

### Previous

Recommended behavior:

If current time > 5 seconds:

```text
restart current song
```

Otherwise:

```text
play previous song
```

### End of Track

Automatically:

```text
current song
↓
next queue item
↓
continue playback
```

### Empty Queue

Regenerate queue based on current mood.

---

# 22. Progress Bar

The song progress bar should support:

- display current playback position,
- click/tap seeking,
- drag seeking on desktop,
- keyboard accessibility.

Use a thin compact progress bar.

Do not use large media-player controls.

---

# 23. Audio Continuity

During normal WonderCreator navigation:

```text
Create
→ Story
→ Character
→ Gallery
```

audio should continue uninterrupted.

For page reload:

Persist:

```text
trackId
selectedMood
queue
volume
playbackPosition
```

Restore state after reload.

Note:

Browser autoplay restrictions may require a user interaction before audio resumes.

---

# 24. Empty / Loading States

## No songs for mood

```text
No songs available for this mood yet.

Try:
[Dreamy] [Creative] [All]
```

## Loading

Use compact skeleton rows.

Avoid full-screen loaders.

## Failed track

Automatically skip unavailable tracks.

Show small non-blocking message:

```text
This track couldn't be played. Skipping to the next one.
```

---

# 25. Visual Design

The player should follow WonderCreator's existing compact visual system.

Recommended:

- soft warm or white surfaces,
- subtle lavender/purple accent,
- rounded corners,
- thin borders,
- minimal shadows,
- compact typography,
- small artwork,
- clear iconography.

Avoid:

- giant album artwork,
- Spotify-like dark UI,
- large empty cards,
- oversized buttons,
- excessive gradients,
- unnecessary animation.

---

# 26. Density Guidelines

Desktop mini player:

```text
height: approximately 64–72px
```

Track rows:

```text
height: approximately 52–60px
```

Mood chips:

```text
height: approximately 32–36px
```

Panel header:

```text
compact, single line where possible
```

The music feature should feel integrated into WonderCreator, not layered over it as a separate product.

---

# 27. Accessibility

All playback controls must include accessible labels.

Example:

```html
<button aria-label="Pause Quiet Morning">
```

Requirements:

- keyboard navigable,
- visible focus states,
- sufficient color contrast,
- buttons usable without hover,
- minimum comfortable touch target on mobile,
- progress slider keyboard accessible.

Do not communicate selected mood only through color.

Use:

```text
icon + text + selected styling
```

---

# 28. Keyboard Shortcuts

Optional future enhancement:

```text
Space          Play / Pause
Alt + →        Next track
Alt + ←        Previous track
M              Mute
```

Only activate shortcuts when they do not interfere with text editing.

WonderCreator users will frequently be typing stories, so global shortcuts must be conservative.

---

# 29. Suggested MVP

Implement first:

### Global player

- persistent mini player,
- play/pause,
- previous,
- next,
- volume,
- progress bar.

### Mood filtering

- Calm,
- Dreamy,
- Focus,
- Creative,
- Energy,
- Cinematic,
- Nature,
- All.

### Expanded player

- song list,
- mood chips,
- now playing,
- song details,
- queue.

### Track features

- favorite,
- play next,
- refresh mix,
- more like this.

### Persistence

- survive page navigation,
- save playback state locally.

---

# 30. Later Enhancements

Possible future features:

- AI mood selection from story content.
- "Music for this scene."
- User-created playlists.
- Search by title or artist.
- Multiple mood selection.
- Crossfade.
- Smart volume reduction during narration.
- User-provided audio.
- Seasonal soundtrack packs.
- Children's bedtime mode.
- Automatic soundscape generation.
- Nature ambience mixed with music.

---

# 31. Recommended UX Principle

The final music experience should feel like:

```text
Choose a feeling
       ↓
Press play
       ↓
Keep creating
```

Users should not need to manage music constantly.

The best state is when the music fades into the background and WonderCreator remains the primary experience.
