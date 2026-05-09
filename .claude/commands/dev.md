---
description: Start Ada in dev mode (npm start) after sanity-checking config.json.
---

Start Ada in dev mode. Before running `npm start`, perform these
sanity checks and abort with a clear message if any fails:

1. **`config.json` exists.** Run `test -f config.json`. If it's
   missing, tell the user to create it using the schema in
   `docs/whisper-integration.md` and stop.

2. **`config.json` parses as JSON.** Run
   `python3 -m json.tool config.json > /dev/null`. If it errors,
   show the user the error and stop.

3. **`openai_api_key` is set and not the placeholder `sk-...`.** Run:
   ```bash
   python3 -c "import json; k=json.load(open('config.json')).get('openai_api_key',''); import sys; sys.exit(0 if k and k != 'sk-...' else 1)"
   ```
   If it exits non-zero, tell the user to put a real OpenAI API key in
   `config.json` and stop.

If all three pass, run:

```bash
npm start
```

In the foreground. Do not background it — the user wants to see the
Electron stdout/stderr live and stop the app with Ctrl+C.
