---
description: "Transform ideas into compelling pitch scripts optimized for audio delivery"
metadata: |
  {
    "skillKey": "pitch-writer",
    "emoji": "✍️",
    "homepage": "https://github.com/gera3d/raven",
    "always": false
  }
---

# Pitch Writer Skill

Transform any idea, product, or concept into a compelling audio pitch script.

## What This Skill Does

This skill helps you create professional pitch scripts optimized for voice delivery. It structures your idea into a compelling narrative that sounds natural when spoken aloud.

## Pitch Structure

Every great pitch follows this structure:

1. **Hook** (5-10 seconds) - Grab attention immediately
2. **Problem** (15-20 seconds) - Identify the pain point
3. **Solution** (20-30 seconds) - Present your solution
4. **Proof** (15-20 seconds) - Evidence, traction, or credibility
5. **Call to Action** (5-10 seconds) - What you want them to do

## How to Use

Simply describe your idea and specify the pitch format:

```
/pitch-writer

Idea: [Your idea description]
Duration: [30s | 60s | 90s | 2min]
Tone: [professional | casual | energetic | inspirational]
Audience: [investors | customers | partners | general]
```

## Pitch Formats

### 30-Second Elevator Pitch
- Quick hook + core value proposition
- Best for: Networking, quick introductions

### 60-Second Pitch
- Full structure, concise delivery
- Best for: Pitch competitions, investor meetings

### 90-Second Pitch
- Expanded proof and details
- Best for: Demo days, detailed introductions

### 2-Minute Pitch
- Complete story with examples
- Best for: Podcast intros, video scripts

## Voice Optimization Tips

The script will be optimized for audio delivery:
- Short sentences (easier to speak)
- Natural pauses indicated with "..."
- Emphasis markers for key words
- Conversational language (contractions, informal phrasing)
- Breathing points between sections

## Output Format

The skill outputs:

```markdown
## [Pitch Title]

**Duration:** ~[X] seconds
**Word Count:** [N] words
**Tone:** [tone]

---

### Script

[The actual pitch script with timing markers]

---

### Speaking Notes

- Pace: [words per minute recommendation]
- Key emphasis points
- Suggested pauses
- Emotion/energy cues

---

### Voice Recommendation

Best voice style for this pitch:
- Gender: [male/female/neutral]
- Tone: [warm/authoritative/energetic]
- Suggested voices: [ElevenLabs voice names]
```

## Examples

### Input
```
Idea: An AI assistant that helps busy parents plan healthy meals for their families
Duration: 60s
Tone: warm and relatable
Audience: busy parents
```

### Output
```markdown
## MealMind - Your AI Kitchen Companion

**Duration:** ~60 seconds
**Word Count:** 150 words
**Tone:** Warm, relatable

---

### Script

[HOOK - 8 sec]
Picture this... It's 5:30 PM. You just got home. The kids are hungry.
And you're staring into the fridge wondering... "What can I possibly make?"

[PROBLEM - 15 sec]
We've all been there. Meal planning feels like a second job.
Between work, kids, and life... who has time to figure out healthy dinners
that everyone will actually eat?

[SOLUTION - 20 sec]
That's why we built MealMind. It's like having a personal chef in your pocket.
Just tell it what's in your fridge... your family's preferences...
and in seconds, you get a complete meal plan. With recipes. Shopping lists.
Everything.

[PROOF - 12 sec]
Over fifty thousand families are already saving five hours a week on meal planning.
Parents tell us dinner time went from stressful... to something they actually enjoy.

[CTA - 5 sec]
Try MealMind free for two weeks. Your family's taste buds will thank you.

---

### Speaking Notes

- Pace: 150 words/minute (conversational)
- Pause after "Picture this..." for effect
- Emphasize "five hours a week"
- Warm up voice on "families" and "enjoy"
- End with smile in voice

---

### Voice Recommendation

- Gender: Female (warm, maternal)
- Tone: Conversational, warm, relatable
- Suggested voices:
  - ElevenLabs: "Rachel" or "Bella"
  - OpenAI: "nova" or "shimmer"
```

## Advanced Options

### Custom Sections
Add or remove sections:
```
Sections: hook, problem, solution, cta (skip proof)
```

### Multiple Versions
Request variations:
```
Versions: 3 (generate 3 different approaches)
```

### Specific Style
Reference a style:
```
Style: Like a TED talk opening
Style: Like a podcast ad read
Style: Like a movie trailer
```

## Integration with Voice Generation

After generating your script, use the `voice-pitch` skill to convert it to audio:

```
/voice-pitch
Script: [paste the script]
Voice: rachel
```

Or use the complete workflow:
```
/pitch-workflow
Idea: [your idea]
Voice: rachel
Duration: 60s
```

## Tips for Great Pitches

1. **Start with emotion** - Make them feel something
2. **Be specific** - "50,000 families" beats "many people"
3. **Use "you" language** - Make it about them
4. **One idea per sentence** - Easy to follow when listening
5. **End with clear action** - Tell them exactly what to do

---

*This skill is part of the Raven Audio Pitch Suite.*
