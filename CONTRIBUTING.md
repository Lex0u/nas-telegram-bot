# Contribuer à nas-telegram-bot

Merci de vouloir contribuer ! Quelques règles pour que ça se passe bien.

## Workflow

1. Fork le repo (ou crée une branche si tu as les droits)
2. Crée une branche depuis `main` : `git checkout -b feat/ma-fonctionnalite`
3. Fais tes changements, avec des commits clairs
4. Vérifie localement avant de pousser :
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```
5. Ouvre une pull request vers `main` — **toutes** les modifications passent par PR,
   y compris celles du mainteneur, la branche `main` est protégée.

## Style de code

- TypeScript strict, pas de `any` non justifié
- ESLint + Prettier font foi (`npm run lint`, `npm run format`)
- Un fichier = une responsabilité (voir la structure `src/` dans le README)
- Commentaire d'en-tête avec le chemin du fichier en première ligne de chaque fichier `.ts`

## Tests

Les nouveaux services/utilitaires doivent avoir une couverture de test raisonnable
(Vitest, pattern Arrange/Act/Assert). Les commandes Telegram elles-mêmes n'ont pas
besoin d'être testées unitairement (dépendance forte à l'API Telegram), mais leur
logique de formatage/décision doit être extraite et testable.

## Signaler un bug / proposer une fonctionnalité

Utilise les templates d'issue GitHub plutôt qu'une issue vide.
