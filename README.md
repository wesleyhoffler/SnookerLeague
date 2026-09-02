# Score Tracker

Scores are shared and persisted in JSON files on the server:

- `data/users.json` stores players.
- `data/scores.json` stores match results.

Run the application with Node.js 18 or newer:

```sh
node server.js
```

Then open http://localhost:3000. Do not open `index.html` directly: the site needs the server to read and update the JSON files. Deploy the entire project (including `data/`) to one server so every visitor uses the same saved records.

## Admin controls

The player and score editing controls are hidden by default. To show them, open:

```text
http://localhost:3000/?admin=true
```

This is only a visibility flag, not authentication. Anyone who knows the URL can show the controls.
