# nas-telegram-bot

<p align="center">

![CI](https://github.com/Lex0u/nas-telegram-bot/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/Lex0u/nas-telegram-bot/actions/workflows/codeql.yml/badge.svg)
![node](https://img.shields.io/badge/node-%3E%3D22.5-339933?logo=node.js&logoColor=white)
![typescript](https://img.shields.io/badge/typescript-5.7-3178C6?logo=typescript&logoColor=white)
![docker](https://img.shields.io/badge/docker-multi--arch-2496ED?logo=docker&logoColor=white)
![license](https://img.shields.io/badge/license-MIT-blue)

</p>

<p align="center">
Monitoring • Docker • Alertes proactives • TypeScript-first
</p>

---

## 🚀 Installation

```bash
git clone https://github.com/Lex0u/nas-telegram-bot.git
cd nas-telegram-bot
npm install
npm run setup   # assistant interactif : token bot, disques, conteneurs, seuils
npm run build
npm start
```

---

## ⚡ Quick Start

En développement, avec rechargement à chaud :

```bash
npm run dev
```

En production, via Docker Compose (recommandé) :

```bash
docker compose up -d --build
```

---

## 🐳 Docker

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

---

## 🔧 Configuration

`npm run setup` génère deux fichiers à la racine (tous deux dans `.gitignore`) :

- **`.env`** — secrets uniquement (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`)
- **`config.json`** — disques surveillés, conteneurs Docker, seuils d'alerte, fréquence de monitoring

Relance `npm run setup` à tout moment pour ajuster la configuration.

### Prérequis

- Node.js ≥ 22.5 (utilise le module intégré `node:sqlite`, pas de compilation native requise)
- Docker (pour la gestion des conteneurs)
- `smartmontools` installé sur l'hôte (`sudo apt install smartmontools`)
- Un sudoers restreint autorisant `smartctl` et `shutdown` sans mot de passe (voir [le wiki](../../wiki) pour la configuration recommandée)

---

## ✨ Fonctionnalités

- 📊 **Statut système** — CPU, RAM, température, load average
- 🌡️ **Températures disques** — lecture SMART (`smartctl`), alertes sur seuils
- 🐳 **Gestion Docker** — statut/santé par conteneur, restart, logs, arrêt groupé d'urgence
- 📈 **Historique** — CPU/RAM/températures sur la durée, graphiques à la demande
- 🔔 **Alertes proactives** — espace disque faible, conteneur down/unhealthy, MAJ système et images Docker disponibles
- 🔴 **Arrêt général du Pi** — avec double confirmation

---

## 🛠 Scripts

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
npm run format     # Prettier
npm run build      # Compilation TypeScript
```

---

## 🤝 Contribution

Les contributions sont les bienvenues !

### Workflow

```bash
git clone https://github.com/Lex0u/nas-telegram-bot.git
npm install
npm run dev
```

Toutes les modifications passent par pull request vers `main`, y compris celles du
mainteneur — voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le détail.

### Guidelines

- TypeScript strict, pas de `any` non justifié
- Commentaire d'en-tête avec le chemin du fichier en première ligne de chaque `.ts`
- Commits clairs (`feat:`, `fix:`, `refactor:`)
- Pull request descriptive, CI verte avant merge

---

## 📦 Roadmap

- [ ] Endpoint HTTP `/status` pour intégration widget Homarr
- [ ] Rotation/compression automatique de `data/history.db`
- [ ] Graphiques d'historique envoyés directement dans Telegram (PNG)
- [ ] Tests unitaires Vitest sur les services (parsing smartctl, seuils, historique)
- [ ] Support multi-chat (plusieurs `chat_id` autorisés)
- [ ] Sélection interactive des conteneurs à surveiller depuis Telegram (au lieu de `config.json` uniquement)

---

## 📄 Licence

[MIT](LICENSE) © 2026 Lexou
