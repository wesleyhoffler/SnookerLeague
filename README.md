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

## Kubernetes deployment

The Kubernetes resources are in `kubernetes/deployment.yaml`. They include a 1 GiB persistent volume claim for the JSON score files and intentionally run one replica only.

First, build and push an image to a container registry, then replace `YOUR_GITHUB_USERNAME` in `kubernetes/deployment.yaml` with your registry namespace:

```sh
docker build -t ghcr.io/YOUR_GITHUB_USERNAME/snooker-score-tracker:latest .
docker push ghcr.io/YOUR_GITHUB_USERNAME/snooker-score-tracker:latest
kubectl apply -f kubernetes/deployment.yaml
```

The manifest creates a `LoadBalancer` service. On a cloud Kubernetes cluster, use the external IP assigned to that service. Your cluster needs a default storage class that supports persistent volume claims.
