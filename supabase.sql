-- Incolla tutto nel SQL Editor di Supabase ed esegui.
create table games (
  code text primary key,
  status text not null default 'lobby',   -- lobby | question | results | finished
  current_q int not null default -1,
  question_started_at timestamptz
);
create table players (
  id uuid primary key default gen_random_uuid(),
  game_code text not null references games(code) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  unique (game_code, nickname)
);
create table answers (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  game_code text not null,
  q_index int not null,
  choice int not null,
  elapsed_ms int,
  unique (player_id, q_index)
);

-- Il server imposta l'orario di inizio domanda (nessuna dipendenza dagli orologi dei telefoni)
create function set_question_start() returns trigger as $$
begin
  if new.current_q is distinct from old.current_q then
    new.question_started_at := now();
  end if;
  return new;
end $$ language plpgsql;
create trigger trg_q_start before update on games
  for each row execute function set_question_start();

-- Il server calcola il tempo di risposta e blocca risposte fuori tempo o a domande sbagliate
-- Limite: 12000 ms = 10 secondi di quiz + 2 secondi di margine per la rete
create function check_answer() returns trigger as $$
declare g games%rowtype;
begin
  select * into g from games where code = new.game_code;
  if g.status <> 'question' or g.current_q <> new.q_index then
    raise exception 'Domanda non attiva';
  end if;
  new.elapsed_ms := (extract(epoch from (now() - g.question_started_at)) * 1000)::int;
  if new.elapsed_ms > 12000 then raise exception 'Tempo scaduto'; end if;
  return new;
end $$ language plpgsql;
create trigger trg_check_answer before insert on answers
  for each row execute function check_answer();

alter table games enable row level security;
alter table players enable row level security;
alter table answers enable row level security;
create policy "games_all" on games for all using (true) with check (true);
create policy "players_rw" on players for select using (true);
create policy "players_ins" on players for insert with check (true);
create policy "answers_r" on answers for select using (true);
create policy "answers_ins" on answers for insert with check (true);

alter publication supabase_realtime add table games, players, answers;