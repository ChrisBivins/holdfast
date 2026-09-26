# Holdfast

Web campaign board for two people running a narrative tabletop campaign.

Click a territory, change who owns it, log a battle, keep a roster. Data lives in Firestore so a reload does not wipe the board.

## Stack

- Vite
- React + TypeScript
- Firebase Firestore
- Firebase Storage (optional map image)

## Run it

```bash
npm install
cp .env.example .env.local
```

Paste the Firebase web keys into `.env.local`, then:

```bash
npm run dev
```

First load writes the shrine world tiles if the campaign collection is empty.

Do not commit `.env.local`.

## What this proof of concept shows

- UI talks to Firestore
- Saving a tile owner + note survives a refresh
- Battle log writes and reads from the same campaign
- Roster add / remove
- Optional image upload to Storage

Login, settings, and theme are not in this build on purpose.
