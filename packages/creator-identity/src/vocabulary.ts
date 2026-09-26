/** Known-choice vocabularies (pickers, not free text). Creators can add their own where marked. */
export const DISCIPLINES = [
  "Visual Arts", "Filmmaking", "Storytelling", "Photography", "Writing", "Poetry", "Music",
  "Songwriting", "Illustration", "Design", "Dance", "Performance", "Documentary", "Animation",
  "Podcasting", "Spoken Word", "Journalism", "Painting",
] as const;

export const LANGUAGES = [
  "English", "Hindi", "Bengali", "Marathi", "Tamil", "Telugu", "Kannada", "Malayalam", "Gujarati",
  "Punjabi", "Urdu", "Spanish", "French", "Portuguese", "German", "Italian", "Japanese", "Korean",
  "Mandarin", "Arabic", "Swahili",
] as const;

export const TONES = ["Warm", "Poetic", "Professional", "Bold", "Conversational", "Reflective", "Playful", "Emotional", "Cinematic"] as const;

export const WRITING_STYLES = [
  { value: "concise", label: "Concise" },
  { value: "detailed", label: "Detailed" },
  { value: "narrative", label: "Narrative" },
  { value: "technical", label: "Technical" },
  { value: "poetic", label: "Poetic" },
  { value: "experimental", label: "Experimental" },
] as const;

export const VISUAL_STYLES = ["Cinematic", "Documentary", "Minimal", "Poetic", "Vibrant", "Experimental"] as const;

export const FORMALITY = [
  { value: "casual", label: "Casual" },
  { value: "balanced", label: "Balanced" },
  { value: "formal", label: "Formal" },
] as const;

export const EXPERIMENTATION = [
  { value: "stay_close", label: "Stay close to my style" },
  { value: "balanced", label: "Balanced" },
  { value: "experiment", label: "Experiment outside my usual style" },
] as const;

export const SUGGESTED_PRESERVE = ["My voice", "My core ideas", "Cultural references", "Personal memories"] as const;
export const SUGGESTED_AVOID = ["Clichés", "Overly formal", "Generic AI tone", "Heavy jargon"] as const;
