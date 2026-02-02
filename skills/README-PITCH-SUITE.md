# Raven Audio Pitch Suite

Transform ideas into professional audio pitches with AI-powered script writing and premium voice synthesis.

## Skills Included

| Skill | Description | Use Case |
|-------|-------------|----------|
| **pitch-writer** | Idea → Script | When you need a written pitch |
| **voice-pitch** | Script → Audio | When you have a script, need audio |
| **pitch-workflow** | Idea → Audio | End-to-end generation |

## Quick Start

### 1. Set Up API Keys

Get your API keys:
- **ElevenLabs** (recommended): https://elevenlabs.io
- **OpenAI** (alternative): https://platform.openai.com

Add to your Raven config (`~/.raven/raven.json`):

```json
{
  "env": {
    "ELEVENLABS_API_KEY": "your-key-here"
  }
}
```

Or set environment variable:
```bash
export ELEVENLABS_API_KEY="your-key-here"
```

### 2. Generate Your First Pitch

```
/pitch-workflow

Idea: An app that helps people find dog-friendly restaurants and cafes
Duration: 60s
```

## Voice Recommendations

### For Different Pitch Types

| Pitch Type | Voice | Why |
|------------|-------|-----|
| Investor Deck | Drew | Confident, professional |
| Product Demo | Rachel | Warm, trustworthy |
| Crowdfunding | Clyde | Energetic, persuasive |
| Podcast Ad | Domi | Friendly, conversational |
| Explainer | Adam | Clear, neutral |

### For Different Industries

| Industry | Voice | Tone |
|----------|-------|------|
| Tech/SaaS | Drew, Domi | Professional but approachable |
| Health/Wellness | Bella, Rachel | Warm, caring |
| Finance | Antoni, Drew | Authoritative, trustworthy |
| Entertainment | Josh, Sam | Fun, energetic |
| Education | Adam, Rachel | Clear, encouraging |
| Luxury | Antoni | Sophisticated, premium |

## Workflow Examples

### Startup Fundraising

```
/pitch-workflow

Idea: We're building the Stripe for carbon credits - making it easy for any business to offset their emissions with one API call

Duration: 90s
Tone: professional
Audience: investors
Preset: investor
```

### Product Launch Video

```
/pitch-workflow

Idea: Noise-canceling earbuds that automatically adjust based on your environment - perfect for commuters who go from subway to office to gym

Duration: 30s
Tone: energetic
Audience: consumers
Preset: product
```

### Podcast Sponsor Read

```
/pitch-workflow

Idea: A meditation app designed specifically for busy entrepreneurs - 5-minute sessions you can do between meetings

Duration: 30s
Tone: casual
Audience: podcast listeners
Preset: podcast
```

## Advanced Usage

### Generate Multiple Versions

```
/pitch-workflow

Idea: [your idea]
Versions: 3
```

### Compare Different Voices

```
/pitch-workflow

Idea: [your idea]
Voice: rachel, drew, clyde
ABTest: true
```

### Custom Pitch Structure

```
/pitch-workflow

Idea: [your idea]
Structure: |
  - hook (10s)
  - story (30s)
  - solution (20s)
  - cta (10s)
```

## Cost Estimation

| Provider | Per 1000 chars | 60s Pitch (~900 chars) |
|----------|----------------|------------------------|
| ElevenLabs | ~$0.30 | ~$0.27 |
| OpenAI TTS | $0.015 | ~$0.014 |
| Edge TTS | Free | $0 |

## Best Practices

### 1. Be Specific
❌ "A productivity app"
✅ "An app that blocks social media during work hours and gamifies focus time"

### 2. Know Your Audience
- **Investors**: Focus on market, traction, team
- **Customers**: Focus on benefits, outcomes, ease

### 3. Test Voices
Generate 2-3 voice options. The "right" voice varies by context.

### 4. Preview Before Sending
Always listen to the full audio before sharing.

### 5. Iterate
First draft is rarely perfect. Refine the idea description and regenerate.

## File Structure

```
skills/
├── pitch-writer/
│   └── SKILL.md          # Script generation skill
├── voice-pitch/
│   └── SKILL.md          # Audio generation skill
├── pitch-workflow/
│   ├── SKILL.md          # End-to-end workflow
│   └── config.example.json
└── README-PITCH-SUITE.md # This file
```

## Configuration

See `pitch-workflow/config.example.json` for full configuration options.

## Troubleshooting

### "API key not found"
- Check `~/.raven/raven.json` has the key
- Or set `ELEVENLABS_API_KEY` environment variable

### "Voice not found"
- Run `/voice-pitch --list-voices` to see available options

### Audio sounds robotic
- Lower stability (0.4-0.5)
- Increase style (0.4-0.5)
- Try a different voice

### Pitch too long/short
- Adjust `Duration` parameter
- Check word count matches target duration

## Related Skills

- **tts** - General text-to-speech (built-in)
- **sherpa-onnx-tts** - Offline TTS (no API key)
- **openai-whisper** - Speech-to-text transcription

---

**Part of Raven** 🐦‍⬛

*Your messages take flight.*
