# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour une vulnérabilité. Utilise plutôt
l'onglet [Security > Report a vulnerability](../../security/advisories/new) de ce
repo (GitHub Security Advisories), ou contacte-moi directement.

Ce bot exécute des commandes privilégiées (`sudo shutdown`, `sudo smartctl`) et a
accès au socket Docker : toute faille permettant de contourner la vérification du
`chat_id` autorisé, ou d'injecter des commandes via un paramètre utilisateur
(ex: `/ping`), est considérée critique.

## Bonnes pratiques attendues des utilisateurs de ce bot

- Ne jamais exposer le token du bot (`.env` est dans `.gitignore`, à raison)
- Restreindre les entrées `sudoers` NOPASSWD aux commandes strictement nécessaires
  (`smartctl`, `shutdown`) plutôt qu'un accès sudo général — voir le wiki
- Monter le socket Docker (`/var/run/docker.sock`) uniquement si nécessaire, en
  connaissance des implications (accès root-équivalent au host)

## Versions supportées

Ce projet suit `main` — seule la dernière version publiée reçoit des correctifs de
sécurité.
