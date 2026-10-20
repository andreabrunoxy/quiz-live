-- Esegui UNA volta nel SQL Editor di Supabase (aggiunge l'editor domande).
-- Cancella le partite di prova esistenti (non compatibili con il nuovo formato).
delete from games;

alter table games add column questions jsonb;
alter table games add column time_limit int not null default 30;

create table quiz_config (
  id int primary key,
  questions jsonb not null,
  time_limit int not null default 30
);
alter table quiz_config enable row level security;
create policy "config_all" on quiz_config for all using (true) with check (true);

-- Il limite di tempo ora segue la durata scelta nell'editor (+2 secondi di margine rete)
create or replace function check_answer() returns trigger as $$
declare g games%rowtype;
begin
  select * into g from games where code = new.game_code;
  if g.status <> 'question' or g.current_q <> new.q_index then
    raise exception 'Domanda non attiva';
  end if;
  new.elapsed_ms := (extract(epoch from (now() - g.question_started_at)) * 1000)::int;
  if new.elapsed_ms > (g.time_limit + 2) * 1000 then raise exception 'Tempo scaduto'; end if;
  return new;
end $$ language plpgsql;
