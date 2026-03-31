# SCM Platform Prototype

Fresh Next.js App Router scaffold for the SCM platform, created from the reference prototype at `C:/Users/Anton/OneDrive/Desktop/scm-platform-clickable-prototype.html`.

## Stack

- Next.js with the App Router
- TypeScript
- Flat-config ESLint
- Typed mock data extracted from the prototype

## Routes

- `/dashboard`
- `/gigs`
- `/gigs/new`
- `/gigs/[gigId]`
- `/gigs/[gigId]/shifts/[shiftId]`
- `/people`
- `/profile`

## Project Structure

- `app/`: route tree, layouts, and pages
- `components/`: reusable UI building blocks
- `data/`: typed mock data and helpers
- `types/`: shared application types

## Run Locally

According to the current Next.js installation docs, Next.js now expects Node.js 20.9 or newer.

1. Install Node.js 20.9+.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Notes

- The scaffold mirrors the prototype's information architecture and visual hierarchy.
- Data is static for now so we can wire real persistence, auth, and workflows in the next pass.
