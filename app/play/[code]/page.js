'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { computeLeaderboard, points } from '@/lib/score';

export default function Play() {
  const code = String(useParams().code).toUpperCase();
  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [nick, setNick] = useState('');
  const [answers, setAnswers] = useState([]);
  const [all, setAll] = useState({ players: [], answers: [] });
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState('');
  const QUESTIONS = game?.questions ?? [];
  const TIME_LIMIT = game?.time_limit ?? 30;

  const load = useCallback(async () => {
    const g = await supabase.from('games').select('*').eq('code', code).single();
    if (!g.data) return setErr('Partita non trovata. Controlla il QR code.');
    setGame(g.data);
    if (g.data.status === 'finished') {
      const [p, a] = await Promise.all([supabase.from('players').select('*').eq('game_code', code), supabase.from('answers').select('*').eq('game_code', code)]);
      setAll({ players: p.data || [], answers: a.data || [] });
    }
  }, [code]);

  const loadMine = useCallback(async (id) => {
    const a = await supabase.from('answers').select('*').eq('player_id', id);
    setAnswers(a.data || []);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('quiz-player-' + code);
    if (saved) { const p = JSON.parse(saved); setMe(p); loadMine(p.id); }
    load();
    const ch = supabase.channel('play-' + code)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, load).subscribe();
    const poll = setInterval(load, 3000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => { supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [code, load, loadMine]);

  async function join() {
    const name = nick.trim();
    if (!name) return;
    const { data, error } = await supabase.from('players').insert({ game_code: code, nickname: name }).select().single();
    if (error) return setErr(error.code === '23505' ? 'Nickname già usato, scegline un altro.' : error.message);
    localStorage.setItem('quiz-player-' + code, JSON.stringify(data));
    setErr(''); setMe(data);
  }

  async function answer(choice) {
    const { data, error } = await supabase.from('answers')
      .insert({ player_id: me.id, game_code: code, q_index: game.current_q, choice }).select().single();
    if (error) return setErr(error.message);
    setAnswers((a) => [...a, data]);
  }

  if (err && !game) return <main><p className="err">{err}</p></main>;
  if (!game) return <main><p>Caricamento…</p></main>;

  if (!me) return (<main><h1>Scegli un nickname</h1>
    <input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="Il tuo nickname" aria-label="Nickname" />
    <p><button onClick={join} disabled={!nick.trim()}>Entra nel quiz</button></p>
    {err && <p className="err">{err}</p>}</main>);

  const q = QUESTIONS[game.current_q];
  const mine = answers.find((a) => a.q_index === game.current_q);
  const elapsed = game.question_started_at ? (now - new Date(game.question_started_at).getTime()) / 1000 : 0;
  const left = Math.max(0, Math.ceil(TIME_LIMIT - elapsed));

  if (game.status === 'lobby') return <main><h1>Ciao {me.nickname}!</h1><p>Sei dentro. Aspetta che il presentatore avvii la prima domanda.</p></main>;

  if (game.status === 'question' && q) return (<main>
    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Domanda {game.current_q + 1} di {QUESTIONS.length}</span><span className="timer">{left}</span></div>
    <div className="bar"><i style={{ width: `${(left / TIME_LIMIT) * 100}%` }} /></div>
    <h2 style={{ marginTop: 16 }}>{q.text}</h2>
    {mine ? <p><b>Risposta inviata.</b> Aspetta il risultato.</p> : (
      <div className="opts">{q.options.map((o, i) => (<button key={i} className={`opt o${i}`} disabled={left === 0} onClick={() => answer(i)}>{o}</button>))}</div>)}
    {err && <p className="err">{err}</p>}</main>);

  if (game.status === 'results' && q) {
    const pts = mine ? points(q, mine.choice, mine.elapsed_ms, TIME_LIMIT) : 0;
    return (<main><h1>{!mine ? 'Tempo scaduto' : pts > 0 ? 'Risposta giusta!' : 'Risposta sbagliata'}</h1>
      <p className="timer">+{pts}</p>
      <p>La risposta giusta era: <b>{q.options[q.correct]}</b></p></main>);
  }

  if (game.status === 'finished') {
    const board = computeLeaderboard(all.players, all.answers, QUESTIONS, TIME_LIMIT);
    const pos = board.findIndex((r) => r.id === me.id) + 1;
    const row = board[pos - 1];
    return (<main><h1>Quiz finito</h1>
      <p>Sei <b>{pos}°</b> su {board.length} con <b>{row?.score ?? 0}</b> punti e {row?.correct ?? 0} risposte giuste.</p>
      <p className="muted">La classifica completa è sullo schermo.</p></main>);
  }
  return <main><p>Aspetta la prossima domanda…</p></main>;
}
