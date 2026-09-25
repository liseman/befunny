# Be Funny

Be Funny is a tiny, privacy-friendly humor taste test. Pick the funnier joke in three adaptive rounds and receive:

- a plain-English humor profile;
- a ready-to-paste AI humor prompt;
- a personalized joke;
- a shareable result URL; and
- a five-star feedback control that improves future recommendations on the device.

The app is a dependency-free static site. Its adaptive ranking combines each answer with seeded crowd preferences and feedback saved in `localStorage`. A Cloudflare Worker uses Workers AI to write every displayed pair on demand and generate the final personalized joke; recent material stays in the browser to discourage repeats. Anonymous joke choices and star ratings are also aggregated in Cloudflare KV so what works—or fails—for one visitor improves future generations for everyone; no account or personal identifier is stored.

## Test

```bash
npm test
```

## Deploy

Push to `main`; the workflow in `.github/workflows/pages.yml` publishes the site to GitHub Pages.
