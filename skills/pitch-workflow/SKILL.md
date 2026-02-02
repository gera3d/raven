---
description: "End-to-end audio pitch generation: idea → script → professional audio in one command"
metadata: |
  {
    "skillKey": "pitch-workflow",
    "emoji": "🎬",
    "homepage": "https://github.com/gera3d/raven",
    "always": false,
    "requires": {
      "anyEnv": ["ELEVENLABS_API_KEY", "OPENAI_API_KEY"]
    }
  }
---

# Pitch Workflow Skill

Generate complete audio pitches from just an idea. This skill combines pitch writing and voice generation into a single, streamlined workflow.

## Quick Start

```
/pitch-workflow

Idea: [Describe your idea in 1-3 sentences]
```

That's it! Raven will:
1. Write a compelling pitch script
2. Optimize it for voice delivery
3. Generate professional audio
4. Return both the script and audio file

## Full Options

```
/pitch-workflow

Idea: An app that uses AI to help people learn musical instruments
Duration: 60s
Tone: inspiring
Audience: music lovers
Voice: rachel
Provider: elevenlabs
Preset: product
Output: music-app-pitch
Versions: 1
```

## Parameters

| Parameter | Options | Default | Description |
|-----------|---------|---------|-------------|
| `Idea` | text | required | Your idea description |
| `Duration` | 30s, 60s, 90s, 2min | 60s | Target length |
| `Tone` | professional, casual, energetic, inspiring, warm | professional | Voice and script tone |
| `Audience` | investors, customers, partners, general | general | Target audience |
| `Voice` | see voice list | rachel | Voice model |
| `Provider` | elevenlabs, openai, edge | elevenlabs | TTS provider |
| `Preset` | investor, crowdfunding, product, podcast, explainer | auto | Voice settings preset |
| `Output` | filename | pitch-[timestamp] | Output filename |
| `Versions` | 1-5 | 1 | Number of script variations |

## Workflow Steps

### Step 1: Idea Analysis
Raven analyzes your idea to identify:
- Core value proposition
- Target pain point
- Key differentiators
- Emotional hooks

### Step 2: Script Generation
Creates a structured pitch:
- **Hook** - Attention grabber
- **Problem** - Pain point identification
- **Solution** - Your answer
- **Proof** - Credibility/traction
- **CTA** - Clear next step

### Step 3: Voice Optimization
Adapts the script for spoken delivery:
- Shortens sentences
- Adds natural pauses
- Inserts emphasis markers
- Adjusts pacing cues

### Step 4: Audio Generation
Produces professional audio:
- Applies voice settings
- Optimizes for clarity
- Exports in chosen format

### Step 5: Quality Check
Validates the output:
- Duration matches target
- Audio is clear
- No artifacts or glitches

## Output

The skill returns:

```
## Pitch Generated Successfully!

### Script
[Full pitch script with timing markers]

### Audio
📁 File: pitch-music-app-20240201-143022.mp3
⏱️ Duration: 58 seconds
🎙️ Voice: Rachel (ElevenLabs)
📊 Words: 145

### Files Created
- pitch-music-app-20240201-143022.mp3 (audio)
- pitch-music-app-20240201-143022.md (script)
- pitch-music-app-20240201-143022.json (metadata)
```

## Presets Explained

### `investor`
**Best for:** VC meetings, pitch decks, fundraising
- Voice: Drew (confident, professional)
- Tone: Data-driven, credible
- Focus: Market size, traction, team
- Speed: Measured, deliberate

### `crowdfunding`
**Best for:** Kickstarter, Indiegogo, product launches
- Voice: Clyde (energetic, persuasive)
- Tone: Exciting, urgent
- Focus: Vision, early adopter benefits
- Speed: Dynamic, engaging

### `product`
**Best for:** Product demos, landing pages, ads
- Voice: Rachel (warm, trustworthy)
- Tone: Relatable, benefit-focused
- Focus: User experience, outcomes
- Speed: Natural, conversational

### `podcast`
**Best for:** Podcast intros, sponsor reads, interviews
- Voice: Domi (friendly, approachable)
- Tone: Casual, authentic
- Focus: Story, personality
- Speed: Relaxed, intimate

### `explainer`
**Best for:** How-it-works videos, tutorials, demos
- Voice: Adam (clear, neutral)
- Tone: Educational, helpful
- Focus: Features, process
- Speed: Clear, paced

## Examples

### Startup Pitch
```
/pitch-workflow

Idea: A platform that connects retired professionals with startups for mentorship
Duration: 90s
Tone: inspiring
Audience: investors
Preset: investor
```

### Product Launch
```
/pitch-workflow

Idea: Smart water bottle that tracks hydration and reminds you to drink
Duration: 30s
Tone: energetic
Audience: health-conscious consumers
Preset: product
```

### Crowdfunding Campaign
```
/pitch-workflow

Idea: Board game that teaches kids programming concepts through adventure
Duration: 2min
Tone: exciting
Audience: parents and educators
Preset: crowdfunding
```

### Podcast Sponsor Read
```
/pitch-workflow

Idea: Meal kit delivery service for busy professionals
Duration: 30s
Tone: casual
Audience: podcast listeners
Preset: podcast
```

## Multiple Versions

Generate variations to find the best approach:

```
/pitch-workflow

Idea: AI writing assistant for academic papers
Duration: 60s
Versions: 3
```

Creates:
- `pitch-v1.mp3` - Approach A (e.g., problem-focused)
- `pitch-v2.mp3` - Approach B (e.g., benefit-focused)
- `pitch-v3.mp3` - Approach C (e.g., story-focused)

## A/B Testing Voices

Test different voices with the same script:

```
/pitch-workflow

Idea: Fitness app with AI personal trainer
Duration: 60s
Voice: rachel, drew, clyde
ABTest: true
```

Creates three versions with different voices for comparison.

## Advanced: Custom Structure

Override the default pitch structure:

```
/pitch-workflow

Idea: Revolutionary new solar panel technology
Duration: 90s
Structure: |
  - teaser (5s): Mysterious opening
  - story (20s): Origin story
  - problem (15s): Current limitations
  - solution (25s): Our breakthrough
  - impact (15s): World-changing potential
  - cta (10s): Join the revolution
```

## Integration with Other Skills

### Save to Workspace
```
/pitch-workflow
Idea: ...
SaveTo: ~/pitches/
```

### Send Directly
```
/pitch-workflow
Idea: ...
SendTo: telegram:@partner
```

### Create Video (Future)
```
/pitch-workflow
Idea: ...
CreateVideo: true
Background: product-demo.mp4
```

## Configuration

Set defaults in `~/.raven/raven.json`:

```json
{
  "skills": {
    "entries": {
      "pitch-workflow": {
        "enabled": true,
        "defaultDuration": "60s",
        "defaultVoice": "rachel",
        "defaultProvider": "elevenlabs",
        "outputDir": "~/Documents/Pitches",
        "apiKey": "your-elevenlabs-key"
      }
    }
  }
}
```

## Tips for Best Results

### 1. Be Specific in Your Idea
❌ "An app for productivity"
✅ "An app that blocks distracting websites during work hours and rewards focus time with points"

### 2. Know Your Audience
The same idea sounds different for investors vs customers:
- **Investors:** Market size, revenue model, growth
- **Customers:** Benefits, ease of use, outcomes

### 3. Match Voice to Tone
- Serious/professional → Drew, Antoni, Adam
- Warm/friendly → Rachel, Domi, Bella
- Energetic/exciting → Clyde, Josh, Sam

### 4. Test Multiple Versions
Generate 2-3 versions and pick the best. Different approaches resonate with different audiences.

### 5. Listen Before Sending
Always preview the audio. Sometimes a script reads well but sounds awkward when spoken.

## Troubleshooting

### Pitch too long/short
- Adjust `Duration` parameter
- The skill auto-adjusts word count

### Voice doesn't match tone
- Try a different `Preset`
- Or specify `Voice` directly

### Script feels generic
- Add more detail to your `Idea`
- Specify unique differentiators

### Audio quality issues
- Check API key is valid
- Try different provider
- Reduce script complexity

---

## Complete Example

**Input:**
```
/pitch-workflow

Idea: A browser extension that summarizes any webpage into key bullet points using AI, saving professionals hours of reading time each week

Duration: 60s
Tone: professional
Audience: busy professionals
Voice: drew
Preset: product
Output: summarize-pro-pitch
```

**Output:**

```markdown
## Pitch Generated Successfully!

### Script

[HOOK - 7 sec]
How many browser tabs do you have open right now?
If you're like most professionals... it's probably too many to count.

[PROBLEM - 15 sec]
We're drowning in information.
Articles. Reports. Documentation.
Research shows professionals spend over two hours a day just reading.
Two hours... that could be spent actually doing the work.

[SOLUTION - 22 sec]
Introducing SummarizePro.
One click... and any webpage becomes a clear, concise summary.
Key points. Main arguments. Action items.
All in seconds, not minutes.
It's like having a brilliant assistant who reads everything for you...
and tells you only what matters.

[PROOF - 10 sec]
Already trusted by teams at Google, Microsoft, and over two hundred startups.
Users report saving an average of eight hours per week.

[CTA - 6 sec]
Try SummarizePro free for thirty days.
Your inbox will thank you.

---

### Audio
📁 File: summarize-pro-pitch.mp3
⏱️ Duration: 62 seconds
🎙️ Voice: Drew (ElevenLabs)
📊 Words: 156
🎯 Preset: Product

### Voice Settings Applied
- Stability: 0.6
- Similarity: 0.8
- Style: 0.4
- Speed: 1.0
```

---

*This skill is part of the Raven Audio Pitch Suite.*

**Related Skills:**
- `pitch-writer` - Script generation only
- `voice-pitch` - Audio generation only
- `tts` - General text-to-speech
