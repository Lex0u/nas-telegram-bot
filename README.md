# nas-telegram-bot

![CI](https://github.com/Lex0u/nas-telegram-bot/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/Lex0u/nas-telegram-bot/actions/workflows/codeql.yml/badge.svg)
![Node](https://img.shields.io/badge/node-%3E%3D22.5-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5.7-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

Bot Telegram de monitoring et de contrôle pour NAS auto-hébergé (Raspberry Pi ou
équivalent) : températures disques, statut système, gestion Docker, historique et
alertes proactives.

## Fonctionnalités

- 📊 **Statut système** — CPU, RAM, température, load average
- 🌡️ **Températures disques** — lecture SMART (`smartctl`), alertes sur seuils
- 🐳 **Gestion Docker** — statut/santé par conteneur, restart, logs, arrêt groupé d'urgence
- 📈 **Historique** — CPU/RAM/températures sur la durée, graphiques à la demande
- 🔔 **Alertes proactives** — espace disque faible, conteneur down/unhealthy, MAJ système et images Docker disponibles
- 🔴 **Arrêt général du Pi** — avec double confirmation

## Prérequis

- Node.js ≥ 22.5 (utilise le module intégré `node:sqlite`, pas de compilation native requise)
- Docker (pour la gestion des conteneurs)
- `smartmontools` installé sur l'hôte (`sudo apt install smartmontools`)
- Un sudoers restreint autorisant `smartctl` et `shutdown` sans mot de passe (voir [le wiki](../../wiki) pour la configuration recommandée)

## Installation

```bash
git clone https://github.com/Lex0u/nas-telegram-bot.git
cd nas-telegram-bot
npm install
npm run setup   # assistant interactif : token bot, disques, conteneurs, seuils
npm run build
npm start
```

En développement :

```bash
npm run dev     # rechargement à chaud via tsx
```

## Configuration

`npm run setup` génère deux fichiers à la racine (tous deux dans `.gitignore`) :

- **`.env`** — secrets uniquement (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`)
- **`config.json`** — disques surveillés, conteneurs Docker, seuils d'alerte, fréquence de monitoring

Relance `npm run setup` à tout moment pour ajuster la configuration.

## Docker

```bash
docker compose up -d --build
```

Le `docker-compose.yml` fourni monte `config.json` et `data/` en volumes, expose les
devices disque (`/dev/sda`, `/dev/sdb` — à adapter à ta config) et le socket Docker,
avec `SYS_RAWIO` nécessaire à la lecture SMART dans le conteneur. `.env` est chargé
automatiquement via `env_file`.

Pour un `docker run` équivalent sans Compose :

```bash
docker build -t bot .
docker run -d \
  --name telegram-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/config.json:/app/config.json:ro \
  -v $(pwd)/data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --device /dev/sda --device /dev/sdb \
  --cap-add=SYS_RAWIO \
  bot
```

Une image multi-arch (`linux/amd64`, `linux/arm64`) est publiée sur GHCR à chaque release.

## Développement

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
npm run format     # Prettier
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le workflow de contribution.

## Licence

[MIT](LICENSE)
