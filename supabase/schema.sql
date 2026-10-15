-- GolfLoop database setup
-- Run the entire file in Supabase > SQL Editor > New query.
-- The app uses Supabase Auth, and each player's data is protected by RLS.

create extension if not exists pgcrypto;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Jernslag', 'Wedges', 'Putting', 'Driver', 'Bunker')),
  description text not null default '',
  instructions text[] not null default '{}'::text[],
  duration_minutes integer not null default 10 check (duration_minutes between 1 and 180),
  facilities text[] not null default '{}'::text[],
  difficulty text not null default 'Alle niveauer',
  target text,
  is_default boolean not null default true,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint exercises_title_category_unique unique (title, category)
);

create table if not exists public.round_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at date not null default current_date,
  focus_areas text[] not null default '{}'::text[],
  good_areas text[] not null default '{}'::text[],
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Min træning',
  duration_minutes integer not null check (duration_minutes between 5 and 240),
  focus_areas text[] not null default '{}'::text[],
  facility text not null default 'Flere faciliteter',
  prioritize_recent_round boolean not null default false,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_title text not null,
  category text not null check (category in ('Jernslag', 'Wedges', 'Putting', 'Driver', 'Bunker')),
  description text not null default '',
  instructions text[] not null default '{}'::text[],
  duration_minutes integer not null check (duration_minutes between 1 and 240),
  position integer not null default 0,
  completed boolean not null default false,
  result_notes text,
  created_at timestamptz not null default now()
);

create index if not exists round_reviews_user_played_at_idx
  on public.round_reviews (user_id, played_at desc);
create index if not exists training_sessions_user_created_at_idx
  on public.training_sessions (user_id, created_at desc);
create index if not exists training_session_exercises_session_position_idx
  on public.training_session_exercises (session_id, position);

-- Enable Row Level Security.
alter table public.exercises enable row level security;
alter table public.round_reviews enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;

-- Set explicit privileges. Exercise catalogue is readable by signed-in users;
-- personal data is available only through the ownership policies below.
revoke all on table public.exercises from anon, authenticated;
revoke all on table public.round_reviews from anon, authenticated;
revoke all on table public.training_sessions from anon, authenticated;
revoke all on table public.training_session_exercises from anon, authenticated;

grant select on table public.exercises to authenticated;
grant select, insert, update, delete on table public.round_reviews to authenticated;
grant select, insert, update, delete on table public.training_sessions to authenticated;
grant select, insert, update, delete on table public.training_session_exercises to authenticated;

-- Exercises: players can read the default library.
drop policy if exists "Signed-in users can read exercise library" on public.exercises;
create policy "Signed-in users can read exercise library"
  on public.exercises for select to authenticated
  using (is_default = true or user_id = (select auth.uid()));

-- Round reviews: a player can only access their own evaluations.
drop policy if exists "Players can read their own round reviews" on public.round_reviews;
create policy "Players can read their own round reviews"
  on public.round_reviews for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can add their own round reviews" on public.round_reviews;
create policy "Players can add their own round reviews"
  on public.round_reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own round reviews" on public.round_reviews;
create policy "Players can update their own round reviews"
  on public.round_reviews for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can delete their own round reviews" on public.round_reviews;
create policy "Players can delete their own round reviews"
  on public.round_reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Training sessions: only the owning player can access and manage a session.
drop policy if exists "Players can read their own training sessions" on public.training_sessions;
create policy "Players can read their own training sessions"
  on public.training_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can create their own training sessions" on public.training_sessions;
create policy "Players can create their own training sessions"
  on public.training_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update their own training sessions" on public.training_sessions;
create policy "Players can update their own training sessions"
  on public.training_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can delete their own training sessions" on public.training_sessions;
create policy "Players can delete their own training sessions"
  on public.training_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- An exercise entry can only be managed if its parent session belongs to the signed-in player.
drop policy if exists "Players can read exercises in their own sessions" on public.training_session_exercises;
create policy "Players can read exercises in their own sessions"
  on public.training_session_exercises for select to authenticated
  using (exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

drop policy if exists "Players can add exercises to their own sessions" on public.training_session_exercises;
create policy "Players can add exercises to their own sessions"
  on public.training_session_exercises for insert to authenticated
  with check (exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

drop policy if exists "Players can update exercises in their own sessions" on public.training_session_exercises;
create policy "Players can update exercises in their own sessions"
  on public.training_session_exercises for update to authenticated
  using (exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

drop policy if exists "Players can delete exercises in their own sessions" on public.training_session_exercises;
create policy "Players can delete exercises in their own sessions"
  on public.training_session_exercises for delete to authenticated
  using (exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
  ));

-- Default exercise library. Re-running this script will not duplicate these rows.
insert into public.exercises (title, category, description, instructions, duration_minutes, facilities, difficulty, target)
values
  (
    'Målskive med jern', 'Jernslag',
    'Træn retning ved at vælge et tydeligt mål på rangen og holde fokus på samme landingsområde.',
    array['Vælg et flag eller et tydeligt mål på rangen.', 'Slå 10 bolde med det samme jern.', 'Notér, hvor mange bolde der starter i den ønskede retning.', 'Gentag eventuelt med et andet jern.'],
    10, array['Driving range'], 'Begynder til øvet', 'Ram det valgte målområde med mindst 6 ud af 10 bolde.'
  ),
  (
    'Skift mellem jern', 'Jernslag',
    'Skift mellem to eller tre jern for at træne valg af kølle og tilpasning af slaget.',
    array['Vælg tre mål på forskellige afstande.', 'Slå tre bolde med hvert af to eller tre jern.', 'Skift mål og kølle efter hver serie.', 'Notér, hvilke afstande der føltes mest sikre.'],
    12, array['Driving range'], 'Let øvet', 'Vælg det rigtige jern og ram et brugbart område ved hvert mål.'
  ),
  (
    'Rolig boldkontakt', 'Jernslag',
    'Arbejd med balanceret tempo og stabil kontakt frem for at forsøge at slå længst muligt.',
    array['Start med halve sving og et kort jern.', 'Slå fem rolige slag, hvor du holder balancen efter hvert slag.', 'Gå gradvist op til trekvart sving.', 'Notér, om kontakten føles ren og stabil.'],
    10, array['Driving range'], 'Alle niveauer', 'Oplev stabil kontakt på mindst 7 ud af 10 bolde.'
  ),
  (
    'Tre wedge-afstande', 'Wedges',
    'Træn længdekontrol ved at slå til tre faste afstande med din wedge.',
    array['Vælg mål på cirka 20, 40 og 60 meter, eller tilpas dem til dit niveau.', 'Slå tre bolde mod hvert mål.', 'Brug samme rytme og variér længden på tilbagesvinget.', 'Notér, hvilken afstand der var sværest at ramme.'],
    15, array['Driving range', 'Indspilsområde'], 'Alle niveauer', 'Få mindst to af tre bolde tæt på hvert afstandsmål.'
  ),
  (
    'Landingszone', 'Wedges',
    'Lær at vælge, hvor bolden skal lande, i stedet for kun at fokusere på hullet.',
    array['Vælg et område på greenen som landingszone.', 'Slå fem korte indspil mod zonen.', 'Flyt zonen, og slå fem nye bolde.', 'Vurdér både landingspunkt og rul efter landing.'],
    12, array['Indspilsområde'], 'Let øvet', 'Land mindst 5 bolde i eller tæt på zonen.'
  ),
  (
    'Up-and-down challenge', 'Wedges',
    'Træn det korte spil ved at kombinere et indspil med et putt.',
    array['Vælg en position uden for greenen.', 'Spil en bold ind mod hullet.', 'Putt bolden færdig, og registrér antal slag.', 'Gentag fra fem forskellige positioner.'],
    15, array['Indspilsområde'], 'Let øvet', 'Prøv at få bolden i hul på to slag så ofte som muligt.'
  ),
  (
    'Korte putts i cirkel', 'Putting',
    'Byg en stabil rutine på korte putts fra flere retninger omkring hullet.',
    array['Placér seks bolde cirka én meter fra hullet rundt om koppen.', 'Putt alle seks bolde med samme pre-shot-rutine.', 'Notér, hvor mange der går i hul.', 'Gentag, og se om du kan forbedre resultatet.'],
    10, array['Puttinggreen'], 'Alle niveauer', 'Hole mindst 5 ud af 6 putts.'
  ),
  (
    'Afstandsstigen', 'Putting',
    'Træn afstandskontrol ved at få bolden til at stoppe tæt på hullet fra forskellige længder.',
    array['Placér bolde cirka 5, 8 og 10 meter fra hullet.', 'Slå to putts fra hver afstand.', 'Fokuser på at stoppe bolden inden for en putterlængde fra hullet.', 'Notér, hvilken afstand der kræver mest kontrol.'],
    12, array['Puttinggreen'], 'Alle niveauer', 'Få bolden tæt på hullet fra alle tre afstande.'
  ),
  (
    'Port-putts', 'Putting',
    'Arbejd med startretning ved at putte bolden gennem en lille port af tees.',
    array['Placér to tees lidt bredere end bolden cirka 30 cm foran bolden.', 'Putt ti bolde gennem porten.', 'Hold øje med, om bolden starter på den ønskede linje.', 'Flyt eventuelt porten tættere på bolden for at øge sværhedsgraden.'],
    10, array['Puttinggreen'], 'Alle niveauer', 'Send mindst 8 ud af 10 bolde gennem porten.'
  ),
  (
    'Rullekontrol', 'Putting',
    'Find en fornemmelse for længden på korte, mellem og lange putts.',
    array['Vælg tre startpunkter med forskellig afstand til hullet.', 'Slå tre bolde fra hvert punkt.', 'Fokuser på tempoet i svinget frem for at styre bolden med hænderne.', 'Notér, hvor ofte bolden stopper på en god afstand.'],
    12, array['Puttinggreen'], 'Alle niveauer', 'Få bolden inden for cirka én meter fra hullet på de lange putts.'
  ),
  (
    'Fairway-vindue', 'Driver',
    'Forestil dig et fairway-vindue, og træn at starte bolden i en kontrolleret retning.',
    array['Vælg to markører, der afgrænser et tænkt fairway.', 'Slå ti drives med fokus på balance og startretning.', 'Registrér, hvor mange bolde der holder sig inden for vinduet.', 'Gentag med fokus på ensartet rutine frem for maksimal længde.'],
    12, array['Driving range'], 'Let øvet', 'Hold mindst 6 ud af 10 drives inden for det tænkte vindue.'
  ),
  (
    'Fairway-femmeren', 'Driver',
    'Træn gentagelighed ved at fokusere på kvaliteten af fem drives frem for at slå mange bolde hurtigt.',
    array['Lav din normale rutine før hvert slag.', 'Slå fem drives med god tid imellem.', 'Vurdér balance, startretning og kontakt efter hvert slag.', 'Notér, hvilket fokuspunkt du vil tage med videre.'],
    10, array['Driving range'], 'Alle niveauer', 'Skab fem kontrollerede slag med samme rutine.'
  ),
  (
    '10 bunkerbolde', 'Bunker',
    'Træn et stabilt grundslag fra sandet med fokus på at få bolden ud og op på greenen.',
    array['Vælg et tydeligt område på greenen som mål.', 'Placér bolden lidt fremme i stancen.', 'Slå sandet lige bag bolden, og lad køllen glide igennem.', 'Slå ti bolde og notér, hvor mange der kommer ud af bunkeren.'],
    12, array['Bunker'], 'Let øvet', 'Få mindst 7 ud af 10 bolde ud af bunkeren.'
  ),
  (
    'Bunkerens landingszone', 'Bunker',
    'Når du kan komme sikkert ud, skal du også øve retning og længdekontrol fra sandet.',
    array['Vælg en stor landingszone på greenen.', 'Slå fem bolde mod zonen.', 'Flyt fokus til en mindre zone, når du rammer den store.', 'Notér både om bolden kom ud, og hvor den landede.'],
    12, array['Bunker', 'Indspilsområde'], 'Øvet', 'Få flere bunkerbolde til at lande i den valgte zone.'
  ),
  (
    'Chipping med tre køller', 'Wedges',
    'Sammenlign, hvordan forskellige køller får bolden til at flyve og rulle forskelligt.',
    array['Vælg tre køller, du kan chippe med.', 'Slå tre bolde med hver kølle fra samme position.', 'Hold landingsområdet ens, og læg mærke til rullet.', 'Vælg den kølle, der passer bedst til situationen.'],
    15, array['Indspilsområde'], 'Let øvet', 'Find en gentagelig løsning til en enkel chip.'
  ),
  (
    'Halve wedgeslag', 'Wedges',
    'Træn kontrol over svinglængden for at skabe mere forudsigelige korte slag.',
    array['Vælg en sikker afstand, fx 30 meter.', 'Slå fem halve wedgeslag med roligt tempo.', 'Hold afslutningen i balance.', 'Registrér, om boldene samler sig omkring samme længde.'],
    10, array['Driving range', 'Indspilsområde'], 'Alle niveauer', 'Skab en tættere spredning mellem slagene.'
  )
on conflict (title, category) do nothing;
