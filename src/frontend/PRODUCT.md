# Product

## Register

product

## Users
Engineering teams and leads who connect a GitHub repo to see where knowledge is concentrated in too few people. They open the dashboard to answer "which files would hurt us if one person left?" — usually while planning work, onboarding, or reviewing team risk.

## Product Purpose
Cortex mines git history to surface bus-factor risk per file. The dashboard is where that risk becomes visible: files sorted by risk, with the person who owns most of each file. Success = a user spots the riskiest files within seconds and knows who to talk to.

## Brand Personality
Calm, technical, trustworthy. Reads like a well-made developer tool (GitHub, Linear): neutral and dense, with color reserved for meaning so that high-risk files stand out.

## Anti-references
- Flashy SaaS analytics dashboards: hero metrics, gradients, glass cards.
- Alarm-style monitoring UIs where everything is red and shouting.
- Decorative charts that look impressive but are harder to read than a table.

## Design Principles
1. **Risk is the only loud thing.** Neutral UI; color and weight are spent on risk level.
2. **Data first.** A clear, scannable table beats decoration. Density is fine.
3. **Never color alone.** Every risk level also has a text label so it works for colorblind users.
4. **Every state is designed.** Loading, error and empty states are as clear as the happy path.

## Accessibility & Inclusion
- WCAG 2.1 AA contrast for all text.
- Colorblind-safe: risk shown by label text, not color alone.
- Keyboard-friendly with visible focus; respects reduced-motion preference.
- Theme: dark only (v1).
