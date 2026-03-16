# AI Smart Study Platform

This is a React + Vite + Firebase web application.

Goal:
Convert the UI demo into a functional AI-powered study platform.

Main features:
1. Dashboard shows real data from Firestore
2. Users can create flashcards
3. Users can track study sessions
4. AI summarizer generates notes

Tech stack:
- React
- Vite
- Firebase Firestore
- TailwindCSS

Project structure:

src/
 ├ pages/
 │   ├ Dashboard.tsx
 │   ├ StudyTracker.tsx
 │
 ├ components/
 │   ├ Layout.tsx
 │
 ├ services/
 │   ├ firestoreService.ts

Firestore collections:
- users
- studySessions
- flashcards

Coding rules:
- Use React functional components
- Use Firestore for data storage
- Do not create mock data
- Keep components inside /src/pages or /src/components


Never use hardcoded statistics in UI components.
All metrics must come from Firestore queries.