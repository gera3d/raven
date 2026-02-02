---
description: "Convert pitch scripts to professional audio using premium voice models (ElevenLabs, OpenAI)"
metadata: |
  {
    "skillKey": "voice-pitch",
    "emoji": "🎙️",
    "homepage": "https://github.com/gera3d/raven",
    "always": false,
    "requires": {
      "anyEnv": ["ELEVENLABS_API_KEY", "OPENAI_API_KEY"]
    }
  }
---

# Voice Pitch Skill

Convert your pitch scripts into professional-quality audio using the best voice AI models.

## Supported Voice Providers

### 1. ElevenLabs (Recommended for Pitches)
**Best for:** Natural, expressive, emotionally engaging voices
**Quality:** Studio-grade
**Requires:** `ELEVENLABS_API_KEY`

**Top Voices for Pitches:**

| Voice | Style | Best For |
|-------|-------|----------|
| **Rachel** | Warm, conversational | Consumer products, lifestyle |
| **Drew** | Confident, professional | B2B, enterprise, tech |
| **Clyde** | Energetic, persuasive | Startups, crowdfunding |
| **Domi** | Friendly, approachable | Apps, services, SaaS |
| **Bella** | Soft, trustworthy | Health, finance, education |
| **Antoni** | Deep, authoritative | Luxury, premium brands |
| **Josh** | Casual, relatable | Social apps, Gen Z products |
| **Arnold** | Bold, commanding | Hardware, automotive |
| **Adam** | Clear, neutral | Explainers, tutorials |
| **Sam** | Young, dynamic | Gaming, entertainment |

### 2. OpenAI TTS
**Best for:** Quick generation, good quality
**Quality:** High
**Requires:** `OPENAI_API_KEY`

**Available Voices:**
- `alloy` - Neutral, versatile
- `echo` - Warm, conversational
- `fable` - Expressive, storytelling
- `onyx` - Deep, authoritative
- `nova` - Friendly, upbeat
- `shimmer` - Soft, gentle

### 3. Edge TTS (Free)
**Best for:** Testing, drafts, no API key needed
**Quality:** Good
**Requires:** Nothing (built-in)

## How to Use

### Basic Usage
```
/voice-pitch

Script: [Your pitch script]
Voice: rachel
Provider: elevenlabs
```

### With Full Options
```
/voice-pitch

Script: |
  Picture this... It's 5:30 PM. You just got home.
  The kids are hungry. And you're staring into the fridge...

Voice: rachel
Provider: elevenlabs
Speed: 1.0
Stability: 0.7
Style: 0.5
Output: pitch-audio.mp3
```

## Voice Settings (ElevenLabs)

Fine-tune your voice for the perfect pitch delivery:

### Stability (0.0 - 1.0)
- **Low (0.3):** More expressive, emotional variation
- **Medium (0.5):** Balanced, natural
- **High (0.8):** Consistent, controlled

**For pitches:** Use 0.5-0.7 (expressive but not erratic)

### Similarity Boost (0.0 - 1.0)
- **Low:** More creative interpretation
- **High:** Closer to original voice

**For pitches:** Use 0.7-0.8 (maintain voice identity)

### Style (0.0 - 1.0)
- **Low:** Neutral delivery
- **High:** Exaggerated style

**For pitches:** Use 0.3-0.5 (engaging but professional)

### Speed (0.5 - 2.0)
- **0.8:** Slower, deliberate (serious topics)
- **1.0:** Normal pace
- **1.1:** Slightly faster (energetic pitches)

**For pitches:** Use 0.95-1.05 (natural conversational pace)

## Presets

Use preset configurations for common pitch types:

### `--preset investor`
```yaml
voice: drew
stability: 0.6
similarity: 0.8
style: 0.3
speed: 0.95
# Confident, professional, measured
```

### `--preset crowdfunding`
```yaml
voice: clyde
stability: 0.5
similarity: 0.75
style: 0.5
speed: 1.05
# Energetic, persuasive, exciting
```

### `--preset product`
```yaml
voice: rachel
stability: 0.6
similarity: 0.8
style: 0.4
speed: 1.0
# Warm, trustworthy, relatable
```

### `--preset podcast`
```yaml
voice: domi
stability: 0.5
similarity: 0.7
style: 0.4
speed: 1.0
# Conversational, friendly, engaging
```

### `--preset explainer`
```yaml
voice: adam
stability: 0.7
similarity: 0.8
style: 0.2
speed: 0.95
# Clear, neutral, educational
```

## Output Formats

### MP3 (Default)
- Universal compatibility
- Good compression
- Best for: Sharing, embedding

### WAV
- Lossless quality
- Larger files
- Best for: Editing, post-production

### OGG/Opus
- Excellent compression
- Best for: Messaging apps (Telegram, Discord)

## Advanced Features

### Section-by-Section Generation
Generate each pitch section separately for editing:

```
/voice-pitch --sections

Script: |
  [HOOK]
  Picture this...

  [PROBLEM]
  We've all been there...

  [SOLUTION]
  That's why we built...
```

This creates:
- `pitch-hook.mp3`
- `pitch-problem.mp3`
- `pitch-solution.mp3`
- `pitch-full.mp3` (combined)

### A/B Voice Testing
Generate the same script with multiple voices:

```
/voice-pitch --compare

Script: [Your script]
Voices: rachel, drew, clyde
```

Creates three versions for comparison.

### Background Music (Coming Soon)
Add subtle background music:

```
/voice-pitch --music ambient

Script: [Your script]
Music: ambient-corporate
MusicVolume: 0.15
```

## Example Workflow

### 1. Write the pitch
```
/pitch-writer

Idea: AI-powered resume builder
Duration: 60s
Tone: professional
Audience: job seekers
```

### 2. Generate audio
```
/voice-pitch

Script: [paste script from step 1]
Voice: domi
Preset: product
Output: resume-ai-pitch.mp3
```

### 3. Get variations
```
/voice-pitch --compare

Script: [same script]
Voices: domi, rachel, josh
```

## Troubleshooting

### "API key not found"
Set your API key:
```bash
# ElevenLabs
export ELEVENLABS_API_KEY="your-key-here"

# Or in Raven config (~/.raven/raven.json)
{
  "skills": {
    "entries": {
      "voice-pitch": {
        "apiKey": "your-elevenlabs-key"
      }
    }
  }
}
```

### "Voice not found"
Check available voices:
```
/voice-pitch --list-voices
```

### Audio sounds robotic
- Lower stability (try 0.4-0.5)
- Increase style (try 0.4-0.5)
- Try a different voice

### Audio too fast/slow
- Adjust speed setting
- Check script word count vs target duration

## Cost Estimation

### ElevenLabs
- ~$0.30 per 1,000 characters
- 60-second pitch (~150 words, ~900 chars) ≈ $0.27

### OpenAI TTS
- $0.015 per 1,000 characters
- 60-second pitch ≈ $0.014

### Edge TTS
- Free (no limit)

## Integration

### With TTS Tool
The voice-pitch skill uses Raven's built-in TTS system. Configure defaults in:

```json
// ~/.raven/raven.json
{
  "messages": {
    "tts": {
      "provider": "elevenlabs",
      "voice": "rachel",
      "stability": 0.6,
      "similarityBoost": 0.8
    }
  }
}
```

### Sending via Messaging
After generation, send the audio:
```
/send --channel telegram --to @user --file pitch-audio.mp3
```

---

*This skill is part of the Raven Audio Pitch Suite.*
