# Be Funny

Be Funny is a tiny, privacy-friendly humor taste test. Pick the funnier joke in three adaptive rounds and receive:

- a plain-English humor profile;
- a ready-to-paste AI humor prompt;
- a personalized joke;
- a shareable result URL; and
- a five-star feedback control that improves future recommendations on the device.

The app is a dependency-free static site. Its adaptive ranking combines each answer with seeded crowd preferences and feedback saved in `localStorage`, so it can run entirely on GitHub Pages without collecting personal data.

## Run locally

```bash
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.

## Test

```bash
npm test
```

## Deploy

Push to `main`; the workflow in `.github/workflows/pages.yml` publishes the site to GitHub Pages.
