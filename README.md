# GolfLoop — React + Supabase

GolfLoop er en startversion af en personlig golftræningsapp. Den er bygget med React, Vite, React Router, Supabase Auth, Supabase Database og Row Level Security (RLS).

## Funktioner

- Opret konto og log ind med Supabase Auth.
- Dashboard med dine seneste træninger og evalueringer.
- Evaluér en golfrunde: vælg hvad du vil forbedre, hvad der gik godt, og skriv noter.
- Planlæg en træning ud fra tidsramme, fokusområder og tilgængelige faciliteter.
- Brug fokus fra seneste runde som input til næste træningsplan.
- Øvelsesbibliotek med jernslag, wedges, putting, driver og bunker.
- Gem træningsplaner og markér øvelser som gennemførte.
- Skriv resultater/noter til hver øvelse.
- RLS-politikker beskytter hver brugers personlige data.

## 1. Installer Node.js

Brug en aktuel LTS-version af Node.js. Kontrollér i terminalen:

```bash
node -v
npm -v
```

## 2. Start projektet lokalt

Hvis du har downloadet og udpakket projektmappen, skal du åbne terminalen i mappen `golfloop` og køre:

```bash
npm install
```

Du behøver ikke først at køre `npm create vite`, fordi denne mappe allerede indeholder Vite-projektet.

## 3. Opret et Supabase-projekt

1. Gå til https://supabase.com/dashboard og opret et nyt projekt.
2. Åbn projektets **Connect**-panel. Du skal bruge Project URL og publishable key.
3. I projektets rodmappe findes `.env.example`. Kopiér filen til en ny fil med navnet `.env.local`.
4. Åbn `.env.local` og indsæt dine egne værdier:

```env
VITE_SUPABASE_URL=https://DIT-PROJEKT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=DIN_PUBLISHABLE_KEY
```

Brug den nye publishable key, der er beregnet til klientapps, eller den offentlige `anon` key i et ældre projekt. **Brug aldrig `service_role`-key i React eller i en fil, der kan ende på GitHub.**

Vite læser `.env.local` ved opstart, så du skal genstarte udviklingsserveren, når du ændrer filen.

## 4. Opret database og øvelser

1. I Supabase skal du åbne **SQL Editor**.
2. Vælg **New query**.
3. Åbn `supabase/schema.sql` fra dette projekt, og kopiér hele filens indhold.
4. Indsæt SQL'en i SQL Editor, og tryk **Run**.
5. Åbn **Table Editor** og kontrollér, at disse tabeller findes:
   - `exercises`
   - `round_reviews`
   - `training_sessions`
   - `training_session_exercises`
6. Tabellen `exercises` får eksempeløvelser fra SQL-scriptet.

Scriptet aktiverer RLS og laver politikker, så en logget ind bruger kun kan læse eller ændre sine egne evalueringer, træninger og træningsøvelser. Øvelsesbiblioteket er læsbart for loggede brugere.

## 5. Kontrollér e-mailbekræftelse

Supabase Auth kan kræve, at brugeren bekræfter sin e-mail før første login. Det er normalt. Hvis bekræftelse er slået til:

1. Opret en konto i GolfLoop.
2. Åbn bekræftelsesmailen.
3. Bekræft e-mailen.
4. Log ind.

Du kan finde indstillingen under **Authentication → Providers → Email** i Supabase. Til en offentlig app bør e-mailbekræftelse være aktiveret. Under lokal udvikling kan du vælge at justere det midlertidigt.

Under **Authentication → URL Configuration** skal `http://localhost:5173` være tilladt som redirect-URL under lokal udvikling. Når du deployer, skal du også tilføje appens rigtige domæne.

## 6. Start appen

I terminalen fra projektmappen:

```bash
npm run dev
```

Vite viser en lokal adresse, typisk `http://localhost:5173`. Åbn adressen i browseren.

Hvis siden stadig viser opsætningsinstruktioner efter `.env.local` er oprettet, skal du stoppe terminalserveren med `Ctrl+C` og køre `npm run dev` igen.

## 7. Test hele brugerflowet

1. Opret en bruger og log ind.
2. Åbn **Efter runden**, vælg fokusområder og gem evalueringen.
3. Åbn **Planlæg træning**.
4. Vælg hvor mange minutter du har, dine fokusområder og dine faciliteter.
5. Tryk **Sammensæt min træning**.
6. Fjern eller tilføj øvelser, hvis du vil tilpasse planen.
7. Tryk **Gem træningsplan**.
8. Åbn træningen, registrér resultater og markér den som gennemført.
9. Gå tilbage til overblikket og se din gemte plan.

## Mappestruktur

```text
golfloop/
├── .env.example
├── index.html
├── package.json
├── README.md
├── supabase/
│   └── schema.sql
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── components/
    ├── context/
    ├── lib/
    └── pages/
```

## Vigtigt inden offentlig lancering

- Tilføj `.env.local` til `.gitignore`, og commit aldrig private nøgler.
- Behold RLS på alle personlige tabeller.
- Konfigurér Supabase Auth redirect-URL'er, når appen deployes.
- React-frontendens publishable key er synlig for browseren; sikkerheden kommer derfor også fra RLS og databasens policies.
- Denne version har ikke GPS, live banedata, handicapberegning eller automatisk analyse af sving. Den fokuserer på træningsplanlægning og manuelle registreringer.

## Fejlfinding

### `Invalid API key` eller netværksfejl
Tjek at `VITE_SUPABASE_URL` og `VITE_SUPABASE_PUBLISHABLE_KEY` er kopieret korrekt, uden anførselstegn eller mellemrum omkring værdierne. Genstart Vite.

### `relation ... does not exist`
Kør hele `supabase/schema.sql` i SQL Editor.

### `new row violates row-level security policy`
Kontrollér, at du er logget ind, og at SQL-scriptets policies blev oprettet. Du kan finde dem under **Authentication → Policies** eller på den enkelte tabels RLS-side.

### Du kan oprette konto, men ikke logge ind
Kontrollér om Supabase har sendt en e-mailbekræftelse, og tjek eventuelt spam.

### Øvelserne vises ikke
Se efter data i `public.exercises`. SQL-scriptet indsætter standardøvelser, men springer titler over, der allerede findes.

## Kilder

- Supabase React-quickstart: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vite guide: https://vite.dev/guide/
