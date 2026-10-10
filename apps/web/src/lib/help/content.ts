/**
 * The Help page, as data (owner, 8 Oct 2026: "update the get help page for each app — match the latest features").
 *
 * Rendered by /help (`components/public/help-center.tsx`) and searched in the browser (`./search.ts`). Content rule:
 * describe only what the product does today, in the words the screens use — where something depends on a service that
 * may not be switched on (AI, images, video, voice and video in Huddles, licence payments, other networks), say so the
 * way the product does ("Not connected"). Nothing here promises a reply time, names the technology behind the product,
 * or gives an email address: the ways to reach us are the ones on /contact and in Settings. When a feature changes,
 * change its topic in the same pull request (docs/help.md).
 */

export interface HelpLink {
  label: string;
  /** A page of this app, with an optional query. Checked against the real routes by `content.test.ts`. */
  href: string;
}

export interface HelpTopic {
  /** The topic's anchor (`/help#slug`) and its key. Unique across the whole page, sections included. */
  slug: string;
  title: string;
  /** One sentence, shown on the closed topic and read by search. */
  summary: string;
  /** Words a person might type that the prose doesn't contain. */
  keywords: string[];
  /** Short paragraphs. */
  body?: string[];
  /** Numbered how-to steps. */
  steps?: string[];
  /** Words with a line each, shown as a list. */
  terms?: Array<{ term: string; text: string }>;
  /** "Good to know". */
  notes?: string[];
  /** "Open" links to the places the topic is about. */
  links?: HelpLink[];
}

export interface HelpSection {
  /** The section's anchor. */
  id: string;
  title: string;
  blurb: string;
  topics: HelpTopic[];
}

export const HELP_SECTIONS: HelpSection[] = [
  /* ------------------------------------------------------------------------------------------------ Getting started */
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "Your first five minutes, and how to find your way around.",
    topics: [
      {
        slug: "first-five-minutes",
        title: "Your first five minutes",
        summary: "Make an account, say a little about your creative world, keep one small thing, and turn it into a Creation.",
        keywords: ["start", "begin", "sign up", "create account", "register", "onboarding", "new", "first time", "welcome", "handle"],
        steps: [
          "Choose Start Creating. Add your name, your email and a password of at least 10 characters with letters and numbers, tick the box to say you’re 18 or older and agree to the Terms and Privacy notice, then choose Let’s begin. If you’re asked to confirm your email, open the message, then come back and sign in.",
          "Answer the welcome steps: About you, Your creative world, Style & voice and Preferences. Only your name and handle are required. Everything else can be skipped and changed later in Settings. Your handle becomes part of your public address, so choose one you like — lowercase letters, numbers and underscores, at least three characters.",
          "On Home, choose Quick note or Voice note and keep one small thing. A line is enough. It’s saved as a Material and stays private to you.",
          "Open it (Open, beside the saved message, or Materials from the Palette) and choose Use in creation. Pick a format, and the note’s words become your first draft.",
          "Write a little. Your words are saved as a draft while you write. When you like where it is, choose More, then Save version, to keep a checkpoint you can come back to.",
        ],
        notes: [
          "Nothing is shared until you choose to share it. Materials and Creations are private by default.",
          "Home offers one gentle next step at a time, such as “Begin with one small thing — a line is enough.” It is never a checklist, and there is nothing to complete.",
          "If we update the Terms or Privacy notice, you’re asked to confirm them again before you continue. Two optional choices — usage measures and occasional emails — stay off unless you turn them on.",
        ],
        links: [
          { label: "Home", href: "/" },
          { label: "Materials", href: "/materials?tab=ideas" },
          { label: "Settings", href: "/settings" },
        ],
      },
      {
        slug: "signing-in",
        title: "Signing in and account security",
        summary: "Email and password, Google where it’s offered, and an extra code if you’ve turned on two-step verification.",
        keywords: ["sign in", "log in", "login", "password", "forgot", "reset", "google", "two-step", "2fa", "authenticator", "code", "security", "change password"],
        steps: [
          "Sign in with your email and password. Where it’s switched on, Continue with Google also appears on the sign-in and sign-up pages.",
          "If you’ve turned on two-step verification, you’re asked for the 6-digit code from your authenticator app right after your password.",
          "Forgot your password? Choose Forgot your password? on the sign-in page and follow the email.",
          "To change your password or turn two-step verification on or off, go to Settings, then Privacy & Security. Changing your password asks for your current one.",
        ],
        notes: [
          "Turning two-step verification off needs a verified session, so you’ll be asked for a code first.",
          "Deleting your account asks for your password again, to make sure it’s you.",
        ],
        links: [
          { label: "Sign in", href: "/sign-in" },
          { label: "Privacy & Security settings", href: "/settings?section=privacy" },
        ],
      },
      {
        slug: "finding-your-way",
        title: "Finding your way around",
        summary: "The top bar, the Palette in the corner, and how Back works.",
        keywords: ["navigation", "menu", "palette", "where is", "back", "top bar", "search", "home", "account menu", "move", "drag", "corner", "shortcut"],
        body: [
          "There are no rows of tabs. The top bar holds the logo (it takes you Home), search, messages, notifications and your account menu.",
          "The Palette is the painted button in the corner. Open it to see what you can do next on the page you’re on, then More… for the rest or Go to… for other places. Away from Home, the places include Home, Create, Materials, Explore and Me.",
          "Drag the Palette to either side and it stays where you leave it on this device. From the keyboard, hold Shift and use the arrow keys to move it.",
          "Back arrows return you to the page you came from, even after a few steps, rather than to a fixed parent page.",
          "Your account menu (your picture, top right) holds your profile, Scrapbook, Creative Memory, Creative Rooms, Publishing, Campaigns, Business, Settings, Get help and Sign out.",
        ],
        notes: [
          "Search looks across your own world — your Materials, Creations, Collections and references — and the conversations and people you can already see. Someone else’s private work never appears in your results.",
        ],
        links: [
          { label: "Explore", href: "/explore" },
          { label: "Settings", href: "/settings" },
        ],
      },
      {
        slug: "home-screen",
        title: "Putting Wonder Creator on your home screen",
        summary: "On a phone or tablet, install it so it opens full screen from its own icon, one tap away.",
        keywords: ["install", "app", "home screen", "add to home screen", "icon", "phone", "tablet", "iphone", "ipad", "android", "shortcut", "full screen"],
        body: [
          "On a phone or tablet, a small band at the top of the page offers to install Wonder Creator when your browser can. It opens from its own icon, full screen, straight to Home, so a quick note is a tap away.",
          "It still needs a connection, as it does in the browser. Your work is the same wherever you open it.",
        ],
        steps: [
          "On Android (Chrome, Edge, Samsung Internet and others), choose Install in the band, then confirm. You can also use your browser’s menu: Install app or Add to Home screen.",
          "On iPhone or iPad, choose How to in the band: tap Share (in Safari it may be under •••), then Add to Home Screen. Choose I’ve added it once it’s there.",
        ],
        notes: [
          "Not now hides the band for two weeks. Once it’s installed, the band doesn’t come back on that browser.",
          "The band never appears on a computer, inside another app’s built-in browser, or once you’re using the installed app.",
        ],
      },
      {
        slug: "words-we-use",
        title: "Words we use",
        summary: "Materials, Creations, CreativeMind, Pulse and the rest, in a line each.",
        keywords: ["glossary", "terms", "what is", "meaning", "material", "creation", "creativemind", "metalk", "dejavu", "working table", "huddle", "pulse", "community", "creator page", "room"],
        terms: [
          { term: "Material", text: "Anything you keep: a note, photo, voice memo, video, document or link. Private until you share it." },
          { term: "Creation", text: "Something you make: writing, a carousel, images, video, audio or a presentation." },
          { term: "CreativeStudio", text: "Where you shape a Creation on a canvas, with your sources close by." },
          { term: "Working Table", text: "The sources you’ve gathered for the Creation you’re working on." },
          { term: "CreativeMind", text: "The AI beside you. It suggests; you decide." },
          { term: "meTalk", text: "A quick way to say where an idea is going, by typing or speaking. It appears when you need it and goes away — it isn’t a chat." },
          { term: "DejaVu", text: "A thread you name — a person, place, idea or feeling — that connects things across time." },
          { term: "Scrapbook", text: "Thoughts, sketches and fragments, shared only as widely as you choose." },
          { term: "Creative Room", text: "A shared space to make one piece of work with other people." },
          { term: "Pulse", text: "The open square for conversations, asks and people." },
          { term: "Community", text: "A lasting place for people who share an interest, with a Forum of topics and posts." },
          { term: "Huddle", text: "A small live conversation that ends when the last person leaves." },
          { term: "Creator Page", text: "Your public home, showing only what you choose." },
        ],
      },
    ],
  },

  /* ----------------------------------------------------------------------------------------- Capturing and keeping */
  {
    id: "capturing",
    title: "Capturing and keeping",
    blurb: "Get ordinary moments in quickly, and find them again.",
    topics: [
      {
        slug: "quick-capture",
        title: "Quick Capture on Home",
        summary: "A note, a voice note, a picture or a short video in a few seconds.",
        keywords: ["quick note", "voice note", "quick pic", "video note", "record", "capture", "microphone", "photo", "offline", "idea"],
        steps: [
          "On Home, choose Quick note, Voice note, Quick Pic or Video Note.",
          "For a note, write anything — a line, an idea, something you noticed — and save it. Ctrl or ⌘ with Enter saves too.",
          "For a voice note, recording starts as soon as the sheet opens. Stop when you’re done, listen back if you like, then choose Save. A recording stops by itself at 20 minutes.",
          "For a picture or a video, take one or choose one from your device.",
          "Once it’s saved you can add it to a DejaVu (suggested ones appear when there are any), capture another, or choose Open to see it as a Material.",
        ],
        notes: [
          "A note written while you’re offline is kept on your device and sent when you’re back online. Each note keeps its own identity, so nothing lands twice.",
          "What you capture is private to you.",
        ],
        links: [{ label: "Home", href: "/" }],
      },
      {
        slug: "bring-in",
        title: "Bringing in files, links and text",
        summary: "Drop or choose files, paste links, or write a note, and watch each one get ready.",
        keywords: ["upload", "import", "send", "creatorsend", "file", "pdf", "word", "docx", "photo", "audio", "video", "link", "youtube", "url", "paste", "limit", "size", "bring material"],
        steps: [
          "Open Create from the Palette and choose “bring in Material or capture something”. From Materials, the Palette’s first action is Bring Material.",
          "Drop files on the page or choose them. You can also use Camera, paste one or more links (web pages, YouTube or PDFs), or write or paste a note.",
          "Each item shows its progress: Ingest, Check, Extract, Understand, Ready. When it’s Ready it’s a Material.",
        ],
        notes: [
          "Accepted: photos, audio, video, PDFs, Word (.docx) documents, plain text and Markdown. Up to 20 MB for a photo, 50 MB for audio, 100 MB for video, 25 MB for a PDF or Word file and 2 MB for a text file.",
          "Every file is checked before it’s stored, by what it really is rather than by its name. A file that is held for safety isn’t stored.",
          "A very long note is best split into a few notes.",
          "Audio and video are transcribed when CreativeMind is connected. A transcript is automatic, so it may contain mistakes.",
        ],
        links: [{ label: "Bring something in", href: "/send" }],
      },
      {
        slug: "materials",
        title: "Finding and organising Materials",
        summary: "Search, filter, add details, gather things in Collections, and archive or delete.",
        keywords: ["materials", "creative space", "search", "filter", "collections", "tags", "archive", "delete", "notes", "photos", "details", "download", "source", "rights note", "in progress", "created"],
        steps: [
          "Open Materials from the Palette. The tabs are All, Ideas & Material, In Progress, Created, Shared and Collections. Search sits at the top.",
          "In Ideas & Material you can filter by Notes, Photos, Audio, Video, Documents, Links or Archived.",
          "Open a Material to read it, or to edit a note’s words and Save. Choose Details to give it a title and description, add tags, write a source and rights note (where it came from, who made it, any permissions), add it to a Collection, see which Creations use it, download the original, archive it or delete it.",
          "To make a Collection, open the Collections tab and choose New collection. Add Materials to it from a Material’s Details.",
        ],
        notes: [
          "To delete a card quickly, press and hold it, or right-click it. You’re always asked first.",
          "Deleting a Material can’t be undone. Archiving keeps it out of the way instead, and you can unarchive it.",
          "Deleting a Collection keeps the Materials in it.",
        ],
        links: [
          { label: "Materials", href: "/materials?tab=ideas" },
          { label: "Collections", href: "/materials?tab=collections" },
        ],
      },
      {
        slug: "dejavu",
        title: "DejaVu: threads across time",
        summary: "Name a person, place, idea or feeling that keeps coming back, and gather what belongs to it.",
        keywords: ["dejavu", "thread", "moments", "connect", "theme", "recurring", "memory", "suggestion"],
        steps: [
          "After you capture something, choose Add under DejaVu. Or open a Material’s Details, or a Creation’s About, and add a DejaVu there.",
          "Give it a name, such as a place or a feeling. The same name is one thread, however it’s capitalised.",
          "Open All DejaVus to see your threads, how many Moments each holds and when you last used it.",
        ],
        notes: [
          "A DejaVu only connects things you already have. Anything suggested for you shows as a suggestion; it joins a thread only if you accept it, and the small X dismisses it.",
          "DejaVus are yours. They aren’t shared unless you choose to show one on your Creator Page.",
        ],
        links: [{ label: "Your DejaVus", href: "/dejavu" }],
      },
      {
        slug: "scrapbook",
        title: "Scrapbook",
        summary: "A place for thoughts, reflections, sketches and fragments, in the order they happened.",
        keywords: ["scrapbook", "post", "thought", "reflection", "sketch", "fragment", "share", "replies", "attach"],
        steps: [
          "Open Scrapbook from your account menu, or use My Scrapbook on Home.",
          "Choose what you’re sharing — a thought, reflection, sketch or fragment — and write it under “What’s on your mind?”.",
          "Choose Who can see it: people who can see your profile, or only you. Choose Who can reply.",
          "Attach one of your own Materials or Creations if you like, then choose Share.",
        ],
        notes: [
          "Attaching shares its title, a short excerpt and its file with whoever can see the post. Nothing else from your Materials is shared.",
          "There are no likes or rankings. Posts and replies can be reported from their menus.",
        ],
        links: [{ label: "Scrapbook", href: "/scrapbook" }],
      },
      {
        slug: "personal-sources",
        title: "Connecting your own sources",
        summary: "Let Wonder Creator look at notes, photos, mail or calendar you point it to — and bring in only what you choose.",
        keywords: ["sources", "personal sources", "connect your world", "gmail", "calendar", "photos", "notes", "sync", "disconnect", "import"],
        steps: [
          "Open Settings and choose Personal sources. The page is called Connect your world.",
          "Choose a source and connect it. A source that isn’t available yet says “Not set up yet” — nothing pretends to be connected.",
          "Choose Sync now to discover what’s there. Wonder Creator groups what it finds into a few ideas for you to review.",
          "Pick the items you want. Only those become private Materials. Nothing is imported without your choice.",
          "To stop, disconnect. That removes the connection and what was discovered from it. Materials you already brought in stay, because they’re yours.",
        ],
        notes: [
          "Sign-in, security and statement mail is left out, and details such as links, card numbers and phone numbers are removed from what’s shown.",
          "For Photos, you choose the pictures yourself with your browser’s own picker.",
        ],
        links: [{ label: "Personal sources", href: "/sources" }],
      },
      {
        slug: "creative-memory",
        title: "Creative Memory",
        summary: "What Wonder Creator remembers about your creative practice, and why — editable by you.",
        keywords: ["memory", "creative memory", "remember", "preferences", "forget", "edit", "style", "voice"],
        body: [
          "Creative Memory lists what Wonder Creator has noted about how you work, with where each note came from and when. Open it from your account menu.",
          "You can add, correct or remove anything. What you shared while setting up is kept here, so you can change it any time.",
        ],
        links: [{ label: "Creative Memory", href: "/memory" }],
      },
    ],
  },

  /* ----------------------------------------------------------------------------------------------- Making Creations */
  {
    id: "creating",
    title: "Making a Creation",
    blurb: "Pick a format, shape it on the canvas, and keep every version.",
    topics: [
      {
        slug: "start-a-creation",
        title: "Starting a Creation",
        summary: "Choose a format from Create, or start from a Material that’s already waiting.",
        keywords: ["create", "new creation", "format", "writing", "carousel", "images", "video", "audio", "presentation", "start", "make", "use in creation", "untitled"],
        steps: [
          "Open Create from the Palette. The sheet says “Make a new Creation”.",
          "Choose a format: Writing (article, story, poem), Carousel (social media), Images (visual series), Video (reel, short film), Audio (voice, podcast, song) or Presentation (deck, proposal). Each opens a page built for that format.",
          "Or start from a Material: open it and choose Use in creation. Its words (a note’s text, a transcript) become the first draft, and the Material is recorded as the source.",
          "To make something with other people, choose Collaborate with others instead. That opens a new Creative Room.",
        ],
        notes: ["You can change the format later without losing your sources. See “Changing a Creation into another format”."],
        links: [
          { label: "Materials", href: "/materials?tab=ideas" },
          { label: "Creative Rooms", href: "/rooms" },
        ],
      },
      {
        slug: "working-table",
        title: "The Working Table: sources, pins and Use together",
        summary: "Everything you’re drawing on for this Creation, with what’s in use and what’s still available.",
        keywords: ["working table", "sources", "working set", "bring in", "use together", "pin", "in use", "available", "influencing", "fragment", "part of", "external", "royalty free"],
        steps: [
          "In the Studio, open the Working Table bar at the bottom. It shows how many sources there are and how many are in use.",
          "Choose Bring in to add Materials, earlier Creations, Collections, Huddle moments, comments, Scrapbook entries, new captures or links. Where it’s switched on, External searches royalty-free pictures.",
          "Each source is In use or Available. Open a card to use it, and choose how — for example as content, style, mood or a reference.",
          "To work from a part of something, choose “Use a part of it…” on its menu.",
          "Choose Manage to pin the sources you want to keep hold of, or select several and choose Use together.",
          "More › What’s influencing this? lists what is in use, what’s available and what’s pinned, so you can see what CreativeMind is considering.",
        ],
        notes: [
          "Unused sources stay on the table. Nothing is thrown away for you, and “Take off the table” only removes it from this Creation, not from your Materials.",
          "Routine changes on the table are saved as you go; they don’t make a new version each time.",
        ],
      },
      {
        slug: "writing",
        title: "Writing",
        summary: "Write on the page, hear it read back, refine it with suggestions, and save versions when you’re ready.",
        keywords: ["writing", "write", "poem", "story", "article", "essay", "script", "draft", "autosave", "cover", "ornament", "read aloud", "export", "markdown", "save version", "refine"],
        steps: [
          "Open a Writing Creation and choose Write to start typing. Choose Done to set the words back on their paper.",
          "Your words are saved as a draft while you write; the top bar says “Autosaved”.",
          "Choose More for the rest: Read it on its own, Publish as link, Refine with CreativeMind, Export, Share privately, Save version, Versions, Change format and Rights.",
          "Poems, lyrics, stories and scripts each get tools of their own, such as lines and stanzas for a poem, and a cover and a Roman-style ornament to dress the page. For written pieces you can also have it read aloud by your device.",
          "Export gives you the words as Markdown, plain text or a web page. Screenplays can also be exported in Fountain.",
        ],
        notes: ["A draft isn’t a version. A version is a checkpoint you make with Save version (see “Versions: save, compare and restore”)."],
      },
      {
        slug: "carousel",
        title: "Carousels",
        summary: "Choose how many images, review the slides, add one more, rearrange, and edit each slide.",
        keywords: ["carousel", "slides", "images", "generate", "social", "arrange", "reorder", "overlay", "text on image", "regenerate", "add slide", "duplicate"],
        steps: [
          "On a new Carousel, choose How many images? (3, 4, 5, 6 or Custom), then Generate. Your words are matched to each image.",
          "When the slides appear, choose Continue Creating to open the first slide, or use Generate one more to add exactly one new image at the end. A Carousel can hold up to 12 slides.",
          "Choose Arrange to reorder the slides. Reordering never regenerates anything.",
          "Open a slide to edit it: its words, and any words placed on the image.",
          "A slide’s menu has Regenerate this image, Duplicate slide and Remove slide. A new image waits for you to choose Use new or Keep current — nothing is replaced until you decide.",
        ],
        notes: [
          "Slide words stay real, editable text; they’re never flattened into the picture.",
          "If image generation isn’t connected, the page says “Image generation isn’t connected.” See “AI, images or video say Not connected”.",
        ],
      },
      {
        slug: "images",
        title: "Images",
        summary: "A visual series or photo essay: add pictures, arrange them, and write a line under each.",
        keywords: ["images", "photo essay", "pictures", "photos", "poster", "art series", "moodboard", "caption", "arrange", "add a picture"],
        steps: [
          "On an Images Creation, choose Add a picture. Take one, choose one of yours, or let CreativeMind make one.",
          "Choose Arrange & captions to set the order and write a line under each picture.",
          "Use More to publish it as a link, share it privately, make a carousel from it, or see its versions.",
        ],
        notes: ["Making a picture with CreativeMind needs image generation to be connected."],
      },
      {
        slug: "audio",
        title: "Audio",
        summary: "Record a take, keep the ones you like, and add background music.",
        keywords: ["audio", "record", "take", "podcast", "song", "voice", "transcript", "music", "mix", "microphone", "sing"],
        steps: [
          "On an Audio Creation, choose Record. Recording starts at once; stop when you’re done.",
          "Choose Keep this take to save it. Keeping a take makes a new version, and earlier takes stay as Materials and come back by restoring a version.",
          "Where it’s available, the take is transcribed after you keep it. Choose Use the transcript as the words if you want them.",
          "Add background music if you like. Play the recording with its music, and download the recording or the mix from More.",
        ],
        notes: [
          "Without a transcript service connected, the page says there is no transcript for the take.",
          "If the microphone won’t start, see “The microphone won’t record”.",
        ],
      },
      {
        slug: "video",
        title: "Video",
        summary: "Plan a video shot by shot — what is seen or said, how it’s framed, how long it holds.",
        keywords: ["video", "storyboard", "shot list", "shots", "reel", "short film", "trailer", "render", "frame"],
        steps: [
          "On a Video Creation, choose Add a shot. Each shot has what’s seen or said, camera and staging, and how long it holds.",
          "For each shot you can choose a frame from your own pictures.",
          "Play through the shots in order, then export the shot list or publish it as a link.",
        ],
        notes: ["Turning the storyboard into a rendered video needs a video service to be connected. Until then Render video says “Video rendering isn’t connected.” The storyboard and shot list work without it."],
      },
      {
        slug: "presentation",
        title: "Presentations",
        summary: "Slides with words, a picture and speaker notes, in a theme you choose.",
        keywords: ["presentation", "deck", "slides", "pitch", "proposal", "speaker notes", "theme", "print", "pdf", "present"],
        steps: [
          "On a Presentation, choose Add a slide, then Edit slide to write its title and words, add a picture and add speaker notes.",
          "Choose More › Theme to pick Editorial Paper, Cinematic Dark or Soft Gradient. It sets how every slide looks.",
          "Choose Present to fill the screen. Arrows, space or a tap move on; N shows the notes; Escape ends it.",
          "Choose More › Print or save as PDF to put every slide on its own landscape page.",
        ],
        notes: ["A presentation saves itself as a version a moment after your last edit."],
      },
      {
        slug: "versions",
        title: "Versions: save, compare and restore",
        summary: "Every checkpoint is kept. Compare any two, and restoring one never erases the others.",
        keywords: ["version", "versions", "history", "restore", "compare", "undo", "save version", "revert", "diff", "checkpoint"],
        steps: [
          "Choose More › Save version in the Studio. Give it a name, or keep the suggested one.",
          "Open a Creation and choose the Versions tab to see them all, with who made each — you, CreativeMind, or a restore.",
          "To compare, choose two versions. The differences are shown line by line.",
          "To go back, choose Restore as new version on the one you want.",
        ],
        notes: [
          "Versions can’t be edited after they’re saved. Restoring adds a new version rather than rewriting history.",
          "In Writing, drafts autosave as you write and only Save version makes a durable version. A presentation saves a version a moment after your last edit.",
        ],
      },
      {
        slug: "change-format",
        title: "Changing a Creation into another format",
        summary: "Make a carousel, video, audio or other form from what you have. The original stays as it is.",
        keywords: ["transform", "change format", "derive", "convert", "adapt", "carousel from", "turn into", "destination", "youtube description"],
        steps: [
          "In the Studio, choose More › Change format (the Creation page calls it Transform or Create from this).",
          "Choose the format. A separate new Creation is made from the same ingredients, with a link back to the one it came from.",
          "For a particular destination — a post, a YouTube description, a thumbnail — choose “For a destination” on the Transform page.",
        ],
        notes: ["The source, its contributors and its rights carry over to the new Creation, and its About tab shows what it was made from."],
      },
    ],
  },

  /* ------------------------------------------------------------------------------------------------------------ AI */
  {
    id: "ai",
    title: "CreativeMind and AI",
    blurb: "What it suggests, how you stay in charge, and using your own key.",
    topics: [
      {
        slug: "what-creativemind-does",
        title: "What CreativeMind does",
        summary: "It suggests, summarises and drafts from what you bring in. It never decides for you.",
        keywords: ["creativemind", "ai", "suggestions", "explore", "directions", "refine", "improve", "shorten", "quality", "understood", "transcribe", "visual directions", "insight"],
        body: [
          "CreativeMind works only on what you bring in or open. It offers possibilities; you choose whether to use them. In the Studio, nothing it suggests changes your work until you keep it.",
        ],
        steps: [
          "Explore possibilities: from a Material, ask for directions. You see a few, each with a line on why it fits, and pick what you’d like CreativeMind to consider.",
          "Refine with CreativeMind: in the Studio, choose More › Refine. You can improve, shorten or ask for a quality review. The sheet says it plainly: suggestions only, nothing changes until you keep a revision.",
          "What CreativeMind understood: a Material’s Details can show a short summary of what is in it.",
          "Ways this could look: visual directions for a Material or Creation, when image generation is connected.",
          "Transcripts: audio and video can be turned into text.",
        ],
        notes: [
          "Your material is never used to train AI models.",
          "Anything imported — a web page, a document — is treated as data and can never change your settings.",
        ],
        links: [{ label: "Creative Memory", href: "/memory" }],
      },
      {
        slug: "you-decide",
        title: "You decide what it may do",
        summary: "Ten areas, each set from Never to Auto-execute — with rights, commerce and deletion always waiting for you.",
        keywords: ["autonomy", "approvals", "approve", "permissions", "control", "never", "observe", "suggest", "draft", "ask for approval", "auto-execute", "settings", "ai and creativemind"],
        steps: [
          "Open Settings, then AI & CreativeMind.",
          "For each area — Creative Generation, Research, Transformation, Organization, Collaboration, Communication, Publishing, Commerce, Rights and Destructive Actions — choose a level: Never, Observe, Suggest, Draft, Ask for approval or Auto-execute.",
          "When CreativeMind wants to do something that needs your OK, it appears in Approvals with what it would change. Approve, decline or edit it. Approving covers only that one action.",
          "Reset to defaults puts every area back to where it started.",
        ],
        notes: [
          "Rights, commerce and destructive actions can never run automatically. At most CreativeMind asks for your approval, and the Auto-execute level isn’t offered for them.",
          "CreativeMind never decides who owns something or who may use it.",
        ],
        links: [
          { label: "AI & CreativeMind settings", href: "/settings?section=autonomy" },
          { label: "Approvals", href: "/approvals" },
        ],
      },
      {
        slug: "own-key",
        title: "Using your own AI key",
        summary: "Connect a Google Gemini or Anthropic Claude key so CreativeMind runs under your own account.",
        keywords: ["byok", "api key", "own key", "gemini", "anthropic", "claude", "google", "ai providers", "model", "bring your own", "key"],
        steps: [
          "Open Settings, then AI Providers.",
          "Choose Google Gemini or Anthropic Claude. Create a key in Google AI Studio or the Anthropic Console, paste it in, and choose Check and connect. The key is checked with the provider first, without sending any of your content, and isn’t saved if it’s rejected.",
          "Turn on Use this key for CreativeMind. The Status section at the top says whose key is in use.",
          "Optionally choose a model from the ones your key can use, or leave it on Recommended.",
          "To stop, choose Remove. CreativeMind goes back to Wonder Creator’s own AI provider.",
        ],
        notes: [
          "Keys are stored encrypted and never shown again after you save them — only their last four characters.",
          "With your key, the material and Creations you work on, and the context CreativeMind needs, are sent to that provider under your own account and its terms. Their handling of that data follows your agreement with them, not ours.",
          "Search indexing always uses Wonder Creator’s provider.",
          "If the page says connecting your own key isn’t set up yet, it isn’t available right now.",
        ],
        links: [{ label: "AI Providers", href: "/settings/ai" }],
      },
    ],
  },

  /* ----------------------------------------------------------------------------------------- Publishing and sharing */
  {
    id: "publishing",
    title: "Publishing and sharing",
    blurb: "Share privately, publish a page, and keep a Creator Page of your own.",
    topics: [
      {
        slug: "share-privately",
        title: "Sharing privately",
        summary: "A link only people you give it to can use, or a Creation shared directly with another creator.",
        keywords: ["share", "private link", "link", "invite", "embed", "download", "expiry", "expire", "revoke", "version", "handle", "send"],
        steps: [
          "In the Studio, choose More › Share privately. On a Creation’s own page, choose Share, then “Private links and people”.",
          "To make a link, choose the version to share — the latest, or one you pin — and whether to allow downloads and embedding on other sites. Choose when the link ends (never, or in 1, 7 or 30 days), and name it if you like. Then choose Create link and copy it; it’s shown once.",
          "To share with a creator instead, choose Share with a creator and enter their handle. They find it under Shared with you.",
          "To stop sharing, revoke the link or the share. It stops working at once.",
        ],
        notes: [
          "Anyone with a link can read the piece without signing in, so share it only where you’d be comfortable with that.",
          "You can’t share with someone who has blocked you or whom you’ve blocked.",
        ],
      },
      {
        slug: "publish-a-page",
        title: "Publishing a Creation as a page",
        summary: "Publish a Creation as a page of its own, shown on your Creator Page or only to people with the link.",
        keywords: ["publish", "publish as link", "published", "public", "visibility", "unpublish", "take it down", "address", "slug", "update", "treatment", "cover", "preview", "handle"],
        steps: [
          "Open the Creation and choose Preview to see it as readers will, then Publish as link. The longer Publish page has more choices.",
          "Decide where it shows: Private, Anyone with the link, or Public on my page. “Show on my Creator Page” is off until you turn it on.",
          "Choose the cover, and how the work is presented. You never design a web page; the form follows the kind of work.",
          "Choose Publish. The page lives at your address followed by the work’s own name. Use Copy link to share it.",
          "If you keep working, the page says how many newer versions there are. Choose Publish the latest version to update it, or Take it down to remove it.",
        ],
        notes: [
          "Your link needs a handle. If you haven’t picked one yet, the sheet sends you to your Profile.",
          "A link shows the latest saved version. If you see “You have unsaved words”, choose Save a version first.",
          "Published pages show no counts — no likes, followers or views.",
          "Rights stay as you set them. Being public doesn’t give anyone the right to reuse the work.",
        ],
        links: [{ label: "Publishing", href: "/publishing" }],
      },
      {
        slug: "creator-page",
        title: "Your Creator Page",
        summary: "A public home that shows only what you choose, in a style that suits your work.",
        keywords: ["creator page", "public page", "profile", "template", "style", "featured", "sections", "links", "headline", "moments", "dejavu", "preview"],
        steps: [
          "Open your Profile and choose Creator Page.",
          "In Appearance, choose one of five styles — Immersive Artistic, Minimal Editorial, Cinematic Dark, Creative Collage or Soft Gradient — and look at the preview with your own content.",
          "Write a headline and a short introduction. Switch sections on or off and put them in the order you like: Featured, Creations, DejaVu, Moments, About, Open to and Links. You can feature up to four works.",
          "Choose which DejaVus and Scrapbook moments are public. Add your links.",
          "Turn on Page is public when you’re ready. Your page lives at your handle’s address.",
        ],
        notes: [
          "Only what you chose and published appears. Private fields, private moments and unpublished work never do.",
          "While the page is yours to preview, you see “Previewing your page”; nobody else does.",
        ],
        links: [{ label: "Creator Page", href: "/creator-page" }],
      },
      {
        slug: "other-destinations",
        title: "Other destinations and webhooks",
        summary: "Send a published Creation onward through a webhook, and see what has gone out.",
        keywords: ["destinations", "webhook", "zapier", "make", "instagram", "youtube", "tiktok", "linkedin", "medium", "substack", "social", "connected apps", "publishing history"],
        steps: [
          "In a Creation’s Publish page, choose where it goes: your Wonder Creator profile and any webhooks you’ve connected.",
          "To connect a webhook, choose Connect a webhook and add the address of your site or tool. Each delivery is signed so your side can check it came from here.",
          "The Publishing page (account menu › Publishing) lists what’s waiting, what went out and where it can go.",
        ],
        notes: [
          "Posting straight to other networks isn’t connected yet. The Publish page lists which ones, and a webhook can forward to them.",
          "Nothing is published without your approval, and nothing is marked published until the destination confirms it.",
        ],
        links: [{ label: "Publishing", href: "/publishing" }],
      },
    ],
  },

  /* -------------------------------------------------------------------------------------------------------- Together */
  {
    id: "together",
    title: "Together",
    blurb: "Feedback, conversation and making things with other people.",
    topics: [
      {
        slug: "pulse",
        title: "Pulse: conversations, asks and people",
        summary: "An open square to ask, offer a thought, and discover someone’s work — with no likes or ranking.",
        keywords: ["pulse", "conversation", "ask", "critique", "feedback", "help", "looking for", "share knowledge", "explore together", "people", "open to"],
        steps: [
          "Open Explore, then Pulse. The views are For you, Communities, Conversations, Help and People.",
          "Start a conversation and choose what it is: Discuss, Ask, Critique, Share knowledge, Looking for or Explore together. Choose who can see it: Signed-in creators, Public (anyone who can see your profile) or Limited (only the people you add).",
          "Offer a thought on someone else’s ask. Asks, critiques and “looking for” requests also appear under Help.",
          "To ask about a part of your own work, select the text in the Studio and choose More › Ask Pulse. Only that part is shared.",
        ],
        notes: [
          "Lists follow time, not popularity. There are no likes, follower counts or trending.",
          "On your profile, you can say what you’re open to — giving feedback, Huddles, collaborating, sharing references, mentoring or being asked a question. It is always your choice.",
        ],
        links: [{ label: "Pulse", href: "/pulse" }],
      },
      {
        slug: "communities",
        title: "Communities",
        summary: "Lasting, interest-based places with topics and posts — Public, Unlisted or Private.",
        keywords: ["community", "communities", "join", "forum", "topic", "post", "moderator", "private", "unlisted", "public", "start a community"],
        steps: [
          "Open Pulse and choose Communities. Your communities come first, then others you can discover.",
          "Join with one tap. A Private community takes only people its hosts invited.",
          "Once you’ve joined, start a topic or reply. Only members can add anything.",
          "To start one, choose Start a community, or open a Creative Room’s menu and choose Open as a community.",
        ],
        notes: [
          "Public communities are listed and open to join. Unlisted ones appear only to people with the link. Private ones are visible only to members and invitees; everyone else gets “not found”.",
          "The owner and moderators can remove a topic from the forum or a post from a topic. Leaving a community asks first, and you can rejoin unless the hosts removed you.",
        ],
        links: [{ label: "Communities", href: "/pulse?filter=communities" }],
      },
      {
        slug: "huddles",
        title: "Huddles",
        summary: "A small, temporary conversation. It ends when the last person leaves, and nothing is kept unless someone saves it.",
        keywords: ["huddle", "huddles", "live", "talk", "voice", "video", "chat", "join", "invite", "discoverable", "topic"],
        steps: [
          "Open Explore, then Huddles. Live Huddles you can join are shown; you can also start your own.",
          "Choose Start a Huddle. Say what you’re talking about, whether it’s discoverable, and invite creators if you like.",
          "In the room you can chat in text, invite more people, leave, or — as host — end it for everyone.",
          "Some Huddles ask you to request to join, and the host decides.",
        ],
        notes: [
          "The room says it plainly: nothing is recorded or transcribed.",
          "A chat message is saved only if the host allowed saving chat moments, and never from before they allowed it.",
          "Voice and video work when they’re connected. When they aren’t, the room says so and text chat is live.",
          "Use Report a problem in the room if something isn’t right. Reports are kept for safety review.",
        ],
        links: [{ label: "Huddles", href: "/huddles" }],
      },
      {
        slug: "creative-rooms",
        title: "Creative Rooms and making one thing together",
        summary: "A shared space around one piece of work, with parts for each person.",
        keywords: ["creative room", "room", "crew", "invite", "parts", "song", "lyrics", "tune", "voice", "podcast", "together", "collaborate", "team", "project"],
        steps: [
          "Choose Create, then Collaborate with others, or open Creative Rooms from your account menu and start a room. You’ll be its owner.",
          "Invite people. They choose whether to join.",
          "For a joint piece, say what it’s made of. Templates include Song (Lyrics, Tune, Voice), Podcast episode (Script, Host, Edit) and Illustrated story (Words, Pictures), or start with just a room.",
          "Each person claims a part, which is a Creation of its own made on that format’s page. Several people can share a part, and someone can be invited to just one part without joining the whole room.",
          "The room shows the work first, each part as a row, and a timeline of what happened.",
        ],
        notes: ["A part is final when the people on it say so, and it can go back into rounds."],
        links: [{ label: "Creative Rooms", href: "/rooms" }],
      },
      {
        slug: "collaborators",
        title: "Working with people on a Creation",
        summary: "Invite someone to comment, propose changes or edit — and every change is credited.",
        keywords: ["collaborate", "collaborator", "people", "comment", "propose", "edit", "credit", "contributors", "who wrote what", "sign-off", "invite"],
        steps: [
          "Open the Creation and choose People (in the Palette), or Collaborate.",
          "Choose Add a collaborator. Say their part (for example Co-writer, Editor or Translator) and what they can do: Can comment, Can propose changes or Can edit.",
          "Proposed changes wait for you to accept or decline. Edits become new versions, credited to whoever wrote them.",
          "Who wrote what shows the contributions by person.",
        ],
        notes: [
          "If a Creative Room asks for it, collaborators and co-owners approve a version before it is published, and a new version needs a new sign-off.",
          "To stop collaborating, remove the person. You’re asked first.",
        ],
      },
      {
        slug: "feedback-and-safety",
        title: "Feedback, reporting, muting and blocking",
        summary: "How to ask for feedback kindly, and what to do if something isn’t right.",
        keywords: ["report", "mute", "block", "unblock", "abuse", "harassment", "moderation", "safety", "feedback"],
        steps: [
          "To report a post, reply or conversation, open its More menu and choose Report. Reports go to the moderators, and the person isn’t told who reported.",
          "To mute or block someone, use their profile, or a conversation’s menu. Blocking means you won’t see each other’s conversations or replies.",
          "To see who you’ve blocked, or to unblock, go to Settings, then Privacy & Security.",
        ],
        notes: ["Feedback here is asked for and offered, not counted. There are no likes, trending lists or rankings."],
        links: [{ label: "Privacy & Security settings", href: "/settings?section=privacy" }],
      },
    ],
  },

  /* ------------------------------------------------------------------------------------------ Rights and licensing */
  {
    id: "rights",
    title: "Rights and licensing",
    blurb: "A plain-language guide to the records Wonder Creator keeps. This is not legal advice.",
    topics: [
      {
        slug: "rights-record",
        title: "The Rights tab",
        summary: "A record of who owns a Creation and on what terms, kept as evidence.",
        keywords: ["rights", "ownership", "copyright", "attribution", "derivatives", "joint", "sole", "transferred", "history", "legal", "contributors", "credits"],
        body: [
          "Every Creation has a Rights tab. It keeps a record of ownership, licenses and changes as evidence. The tab says it itself: these records don’t by themselves establish legal ownership. That depends on your agreements and the law where you are. Nothing on this page is legal advice.",
        ],
        steps: [
          "Open the Creation and choose the Rights tab. Only the creator sees the details.",
          "Set whether ownership is sole, joint or transferred, and who the copyright holder is. Add a registration if you have one.",
          "Say whether attribution is required and whether derivatives are allowed, and add notes.",
          "Say whether you offer commercial use. If you do, you can name the channels you’re open to.",
        ],
        notes: [
          "Changes to rights are kept in a history that records what changed and when. It can’t be edited.",
          "When you change a Creation’s format, its rights carry over and the note names the source and version.",
          "Sensitive rights changes, such as transferring ownership, ask for your password.",
        ],
      },
      {
        slug: "licenses",
        title: "Creating and requesting licenses",
        summary: "Say what someone may do with a Creation, for how long and where — or ask for permission to use someone else’s.",
        keywords: ["license", "licence", "licensing", "request", "approve", "decline", "counter", "exclusive", "limited edition", "commercial", "territory", "channels", "terms"],
        steps: [
          "To grant a license, open the Rights tab and create one. You choose the kind (Free to use; Free, with a license; Paid, non-exclusive; Limited edition; Exclusive) and the permitted use (personal, educational, editorial, promotional, internal or commercial).",
          "Then set what’s allowed, where and when (territory, channels, start and end), and review. Save it as a draft or activate it.",
          "To ask for permission to use someone’s public Creation, open its Rights tab and choose Request a license. Say how you’d like to use it.",
          "The owner can approve, decline or suggest other terms. If they suggest other terms, you can accept them or withdraw.",
        ],
        notes: ["Commercial, paid, limited-edition and exclusive licenses need your password to activate."],
      },
      {
        slug: "license-fees",
        title: "Fees and payments",
        summary: "A fee is a written term. Collecting it online depends on a payment service being connected.",
        keywords: ["fee", "payment", "pay", "money", "licence payments", "price", "currency", "paid", "not connected", "payout", "business"],
        body: [
          "When you set a fee on a license, it is recorded as one of its terms.",
          "Whether a payment can be taken online depends on a payment service being connected. Settings › Privacy & Security › Account shows Licence payments as Connected or Not connected. While it says Not connected, Wonder Creator doesn’t collect or move money for a license, and no payment is pretended.",
          "Card and bank details, where payments are connected, are entered only on the payment provider’s own page.",
        ],
        links: [{ label: "Privacy & Security settings", href: "/settings?section=privacy" }],
      },
      {
        slug: "using-others-work",
        title: "Using other people’s material",
        summary: "Keep where it came from with it, and remember that the decision is yours.",
        keywords: ["source", "credit", "attribution", "quote", "reference", "permission", "web", "youtube", "provenance", "lineage", "copyright"],
        body: [
          "Every Material has a Source & rights note in Details: where it came from, who made it, and any permissions. Material you brought from a link, YouTube, a Huddle or an AI draft is marked with its origin, and a Creation made from it keeps that lineage.",
          "CreativeMind doesn’t decide whether you may use something, and it can’t grant permission. Check with the person who made it, and write down what they say.",
        ],
        notes: ["A Creation’s Quality review includes a rights and provenance check from where its material came from. It is a prompt to look, not a ruling."],
      },
    ],
  },

  /* ------------------------------------------------------------------------------------- Your data and your privacy */
  {
    id: "privacy",
    title: "Your data and privacy",
    blurb: "What you control, and where to find it.",
    topics: [
      {
        slug: "who-can-see",
        title: "Who can see what",
        summary: "Materials and Creations are private until you share them. Your profile has three levels.",
        keywords: ["privacy", "visibility", "profile", "private", "public", "creators only", "who can see", "share", "hidden"],
        steps: [
          "Open Settings, then Privacy & Security. Under Profile visibility choose Public (anyone can see your profile and public work), Creators only (signed-in creators can see your profile) or Private (only me — your profile is hidden, and your Huddle presence shows no name). Then Save visibility.",
          "Each Creation, link and post has its own audience. See “Sharing privately”, “Publishing a Creation as a page” and “Scrapbook”.",
        ],
        notes: ["Your material is never used to train AI models, and imported content can never change your settings."],
        links: [{ label: "Privacy & Security settings", href: "/settings?section=privacy" }],
      },
      {
        slug: "your-data",
        title: "Download your data, or delete your account",
        summary: "Export everything we hold about you, or delete it permanently.",
        keywords: ["export", "download my data", "delete account", "erase", "remove", "portability", "gdpr", "dpdp", "close account", "leave"],
        steps: [
          "To download your data, go to Settings › Privacy & Security and choose Export my data. It’s one machine-readable file with everything we hold about you.",
          "To delete your account, choose Delete my account in the same place. Enter your password and type DELETE to confirm.",
        ],
        notes: [
          "Deleting is permanent. It removes your profile, Materials, Creations, memories and conversations, and it can’t be undone.",
          "Want a copy first? Export before you delete.",
        ],
        links: [{ label: "Privacy & Security settings", href: "/settings?section=privacy" }],
      },
      {
        slug: "privacy-requests",
        title: "Privacy requests and choices",
        summary: "Ask for a copy, a correction, erasure and more — and change the optional choices you made.",
        keywords: ["privacy request", "access", "correction", "erasure", "objection", "withdraw consent", "nominate", "grievance", "consent", "analytics", "emails", "data rights"],
        steps: [
          "Open Settings › Privacy & Security and find Make a privacy request.",
          "Choose what you’d like: a copy of your data and how it’s used, correct or complete your data, erase specific data, move your data elsewhere, object to or restrict a use, withdraw a consent, nominate someone to act for you, or raise a grievance. Add details and send.",
          "The page shows the date by which the request will be answered, and keeps a list of your requests with their status.",
          "Your optional choices — usage measures, and occasional emails about new features — are listed there too, and you can change them any time.",
        ],
        notes: [
          "Usage measures are counts of what is used and how long things take — never your content.",
          "Read the full Privacy notice, the Security page and the list of data processors on the public site.",
        ],
        links: [
          { label: "Privacy notice", href: "/legal/privacy" },
          { label: "Data & subprocessors", href: "/legal/subprocessors" },
          { label: "Terms", href: "/legal/terms" },
        ],
      },
      {
        slug: "activity",
        title: "Security & activity",
        summary: "A plain-language history of sign-ins, sharing, publishing, approvals and other changes.",
        keywords: ["activity", "audit", "security", "history", "sign-ins", "devices", "log", "export csv"],
        steps: [
          "Open Settings › Privacy & Security and choose Security & activity.",
          "At the top are your last sign-in and device, failed password confirmations, live shares and confirmed publications.",
          "Below is a chronological history, which you can filter by category and date. Export it as a CSV if you need to keep it.",
        ],
        notes: ["Entries name titles only, never the content itself."],
        links: [{ label: "Security & activity", href: "/settings/audit" }],
      },
    ],
  },

  /* -------------------------------------------------------------------------------------------------- Troubleshooting */
  {
    id: "troubleshooting",
    title: "When something isn’t working",
    blurb: "Start with the checklist, then look for the one that sounds like yours.",
    topics: [
      {
        slug: "checklist",
        title: "The “something isn’t working” checklist",
        summary: "A few quick things to try before anything else.",
        keywords: ["not working", "broken", "error", "bug", "stuck", "problem", "blank", "slow", "doesn't load", "failed", "checklist", "troubleshoot"],
        steps: [
          "Reload the page.",
          "Check you’re online. A note written offline is kept on your device and sent when you’re back, and a recording that didn’t save stays on screen so you can try again.",
          "Look for a “Not connected” or “isn’t connected” note nearby. Some features, like images, video rendering and Huddle voice and video, depend on services that may not be switched on yet.",
          "Sign out from your account menu, then sign back in.",
          "Try another browser or a private window, and check that nothing is blocking the microphone, scripts or pop-ups for this site.",
          "Open Settings › Privacy & Security › Security & activity to see whether recent sign-ins and changes look right.",
          "Still stuck? Send us a message from Contact. Tell us what you were doing, what you expected and what you saw, and the page you were on.",
        ],
        links: [
          { label: "Contact", href: "/contact" },
          { label: "Security & activity", href: "/settings/audit" },
        ],
      },
      {
        slug: "sign-in-trouble",
        title: "I can’t sign in",
        summary: "Wrong password, an expired link, a code that won’t work, or a message about confirming your email.",
        keywords: ["can't sign in", "cannot login", "wrong password", "expired link", "code", "two-step", "google sign-in", "confirm email", "locked out"],
        steps: [
          "“That email and password don’t match.” Check the email and the password, then try again. Use Forgot your password? if you need a new one.",
          "“Check your email to confirm your account.” Open the message we sent, then come back and sign in.",
          "“That link has expired or was already used.” Sign in again to get a fresh link.",
          "“Google sign-in didn’t finish.” Try again, or use your email and password.",
          "“That code isn’t right, or it expired.” Use the latest 6-digit code in your authenticator app.",
        ],
        links: [{ label: "Sign in", href: "/sign-in" }],
      },
      {
        slug: "files-wont-bring-in",
        title: "A file or link won’t come in",
        summary: "Check the type and size, then look at what the item says.",
        keywords: ["upload failed", "needs attention", "held for safety", "unsupported", "too large", "file", "link", "pdf", "docx", "try again", "stuck processing"],
        steps: [
          "Check the type and size. Photos (JPEG, PNG, WebP, GIF, HEIC, AVIF) can be up to 20 MB, audio (MP3, M4A, WAV, OGG, FLAC, AAC, WebM) 50 MB, video (MP4, MOV, WebM) 100 MB, PDF and Word (.docx) 25 MB, and text or Markdown 2 MB. Older .doc files aren’t accepted.",
          "“Held for safety” means the file didn’t pass a safety check or isn’t a supported type, so it wasn’t stored. We look at what a file really is, so renaming it won’t help.",
          "“Needs attention” means processing didn’t finish. Your original is safe. Open the Material and choose Try again.",
          "For a link, make sure the page is public. If it answered with an error the link is still saved, and you can try again later.",
        ],
        links: [{ label: "Bring something in", href: "/send" }],
      },
      {
        slug: "microphone",
        title: "The microphone won’t record",
        summary: "Allow it for this site, check it’s connected, or write a note instead.",
        keywords: ["microphone", "mic", "record", "permission", "voice note", "no sound", "blocked", "audio"],
        steps: [
          "If it says microphone access is off, allow it for this site in your browser’s site settings, then try again.",
          "If it says no microphone was found, connect one.",
          "If your browser can’t record audio, try another browser, or write a quick note instead.",
          "If saving fails, the recording is still on screen. Try Save again.",
        ],
      },
      {
        slug: "not-connected",
        title: "AI, images or video say “Not connected”",
        summary: "Some services depend on being switched on. Here is what each message means and what still works.",
        keywords: ["not connected", "ai isn't connected", "image generation", "video rendering", "offline", "simple rules", "transcript", "no transcript", "provider", "suggestions missing"],
        steps: [
          "“AI isn’t connected.” CreativeMind’s AI service isn’t switched on right now, so requests are read with simple rules and drafts may be placeholders to edit. Settings › Privacy & Security › Account shows CreativeMind (AI) as Connected or Not connected.",
          "You can connect your own key under Settings › AI Providers. See “Using your own AI key”.",
          "“Image generation isn’t connected.” Pictures can’t be made until it is. Use your own pictures and Materials in the meantime; nothing stand-in is substituted.",
          "“Video rendering isn’t connected.” Your storyboard and shot list still work.",
          "“No transcript for this take.” Transcripts need the AI service. The recording itself is fine.",
        ],
        links: [{ label: "AI Providers", href: "/settings/ai" }],
      },
      {
        slug: "cant-publish",
        title: "I can’t publish, or my link shows old words",
        summary: "A link needs a handle and a saved version.",
        keywords: ["publish", "link", "not published", "old version", "handle", "unsaved", "page not found", "take down"],
        steps: [
          "If the sheet asks you to choose a handle, open your Profile and set one first. It’s part of the link.",
          "If it says “You have unsaved words”, choose Save a version. A link shows the latest saved version.",
          "If the page says there are newer versions, choose Publish the latest version.",
          "If a link says it can’t be found, check that the work is still published (Take it down removes it) and that the whole link was copied.",
          "Posting straight to other networks isn’t connected yet. Use a webhook to forward to them.",
        ],
      },
      {
        slug: "huddle-trouble",
        title: "A Huddle has no voice or video",
        summary: "Huddles are text chat until voice and video are connected.",
        keywords: ["huddle", "no voice", "no video", "mute", "camera", "microphone", "cannot join", "ended", "disappeared"],
        steps: [
          "If the room says voice and video aren’t connected, text chat is live and works as usual. Settings › Privacy & Security › Account shows whether they’re connected.",
          "If a Huddle has ended, it’s gone — a Huddle dissolves when the last person leaves. Only moments someone saved explicitly stay.",
          "If you can’t join, the host may need to approve you first, or the Huddle may be only for people who were invited.",
        ],
      },
      {
        slug: "cant-find-creation",
        title: "I can’t find my Creation",
        summary: "Creations live in Materials. Look under In Progress or Created, or search.",
        keywords: ["lost", "missing", "find creation", "where is", "draft", "gone", "deleted"],
        steps: [
          "Open Materials. All lists your Materials and Creations together. In Progress shows drafts and ones in review. Created shows finished and published ones.",
          "Use the search at the top of Materials, or the search in the top bar.",
          "If you deleted it, it’s gone — deleting can’t be undone. The Materials it was made from are safe.",
        ],
        links: [{ label: "Materials", href: "/materials" }],
      },
    ],
  },

  /* --------------------------------------------------------------------------------------------------- Reaching us */
  {
    id: "contact",
    title: "Reaching us",
    blurb: "The ways to get in touch are the ones that already exist in the product.",
    topics: [
      {
        slug: "contact-us",
        title: "Contact, privacy and security",
        summary: "Send a message, make a privacy request, or report a security problem.",
        keywords: ["contact", "support", "message", "email", "feedback", "idea", "founder", "team", "report a bug", "security report", "vulnerability", "privacy contact"],
        steps: [
          "For a question, feedback or an idea, open Contact and use Send us a message. Choose what it’s about — A question, Help with my account, Feedback or an idea, Working together, My data and privacy, or A security issue. Add your name, your email and your message. We’ll reply to the email you give.",
          "For your data, signed in, use Settings › Privacy & Security › Make a privacy request. The page shows the date it will be answered by.",
          "To report a vulnerability, please tell us privately before sharing it anywhere else. How we handle reports is on the Security page.",
          "To report a post, reply or conversation, use its More menu. In a Huddle, use Report a problem.",
        ],
        notes: ["Contact also lists any email addresses that have been set up, when there are any."],
        links: [
          { label: "Contact", href: "/contact" },
          { label: "Security", href: "/legal/security" },
          { label: "Privacy notice", href: "/legal/privacy" },
        ],
      },
    ],
  },
];

/** Every topic, in reading order, with the section it sits in. */
export function allTopics(sections: HelpSection[] = HELP_SECTIONS): Array<{ topic: HelpTopic; section: HelpSection }> {
  return sections.flatMap((section) => section.topics.map((topic) => ({ topic, section })));
}
