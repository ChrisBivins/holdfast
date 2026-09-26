# Holdfast R&D setup

This is the Assignment 5 proof app. It is not the finished product.

## What it has to prove

1. Click a territory, change the owner, save.
2. Reload. The owner is still there.
3. Log a battle. It comes from Firestore, not only from React state.
4. Add and remove a roster unit.
5. Optional: upload one image to Storage.

## Firebase project

1. Open https://console.firebase.google.com
2. Add project. Name it holdfast-rd.
3. Build > Firestore Database > Create database > start in test mode for this week.
4. Build > Storage > Get started > test mode for this week.
5. Project settings > Your apps > Web app. Copy the firebaseConfig values.

## Keys

Copy `.env.example` to `.env.local` and paste the values:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Do not commit `.env.local`.

Firestore test-mode rules expire. Before the month ends, lock writes to signed-in users. Assignment 5 does not include a login screen.

## Run

```
cd holdfast-rd
npm install
npm run dev
```

Open the local URL. First load writes the shrine world tiles if the collection is empty.
