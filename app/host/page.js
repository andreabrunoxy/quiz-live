'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { QUESTIONS as DEFAULT_Q, TIME_LIMIT as DEFAULT_T } from '@/lib/questions';
import { computeLeaderboard, points } from '@/lib/score';
import { unlockAudio, tick, gong } from '@/lib/sounds';

const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export default function Host() {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState('');
  const QUESTIONS = game?.questions ?? [];
  const TIME_LIMIT = game?.time_limit ?? 30;
  const [soundOn, setSoundOn] = useState(true);
  const lastKey = useRef(null);
  const leftNow = game?.question_started_at
    ? Math.max(0, Math.ceil(TIME_LIMIT - (now - new Date(game.question_started_at).getTime()) / 1000)) : null;

  // Tic tac ogni secondo e gong a tempo scaduto
  useEffect(() => {
    if (game?.status !== 'question' || leftNow === null) { lastKey.current = null; return; }
    const key = `${game.current_q}:${leftNow}`;
    const prev = lastKey.current;
    if (prev === key) return;
    lastKey.current = key;
    if (!soundOn) return;
    if (leftNow > 0) tick(leftNow <= 3);
    else if (prev && prev.startsWith(`${game.current_q}:`)) gong();
  }, [leftNow, game?.status, game?.current_q, soundOn]);

  const load = useCallback(async (code) => {
    const [g, p, a] = await Promise.all([
      supabase.from('games').select('*').eq('code', code).single(),
      supabase.from('players').select('*').eq('game_code', code),
      supabase.from('answers').select('*').eq('game_code', code),
    ]);
    if (g.data) setGame(g.data);
    setPlayers(p.data || []);
    setAnswers(a.data || []);
  }, []);

  useEffect(() => {
    if (!game) return;
    const ch = supabase.channel('host-' + game.code)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => load(game.code))
      .subscribe();
    const poll = setInterval(() => load(game.code), 4000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [game?.code, load]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  async function create() {
    unlockAudio();
    const code = newCode();
    const { data: cfg } = await supabase.from('quiz_config').select('*').eq('id', 1).maybeSingle();
    const questions = cfg?.questions?.length ? cfg.questions : DEFAULT_Q;
    const time_limit = cfg?.time_limit ?? DEFAULT_T;
    const { error } = await supabase.from('games').insert({ code, questions, time_limit });
    if (error) return setErr(error.message);
    load(code);
  }
  async function update(patch) {
    const { error } = await supabase.from('games').update(patch).eq('code', game.code);
    if (error) setErr(error.message); else load(game.code);
  }
  const next = () => {
    unlockAudio();
    const n = game.current_q + 1;
    n >= QUESTIONS.length ? update({ status: 'finished' }) : update({ current_q: n, status: 'question' });
  };

  function exportCsv() {
    const rows = [['Posizione', 'Nickname', 'Punti', 'Risposte giuste', 'Tempo totale (s)']];
    computeLeaderboard(players, answers, QUESTIONS, TIME_LIMIT).forEach((r, i) => rows.push([i + 1, r.nickname, r.score, r.correct, (r.time / 1000).toFixed(1)]));
    const blob = new Blob([rows.map((r) => r.join(';')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `classifica-${game.code}.csv`; a.click();
  }

  if (!game) return (<main><h1>Console presentatore</h1><div className="row"><button onClick={create}>Crea nuova partita</button><a href="/editor"><button className="ghost">Modifica le domande</button></a></div>{err && <p className="err">{err}</p>}</main>);

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/play/${game.code}` : '';
  const q = QUESTIONS[game.current_q];
  const elapsed = game.question_started_at ? (now - new Date(game.question_started_at).getTime()) / 1000 : 0;
  const left = Math.max(0, Math.ceil(TIME_LIMIT - elapsed));
  const qAnswers = answers.filter((a) => a.q_index === game.current_q);
  const board = computeLeaderboard(players, answers, QUESTIONS, TIME_LIMIT);

  return (
    <main>
      {game.status === 'lobby' && (<>
        <h1>Entra con il tuo telefono</h1>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}><QRCodeSVG value={joinUrl} size={260} /></div>
          <div><p className="muted">Codice partita</p><div className="big">{game.code}</div>
            <h2>{players.length} {players.length === 1 ? 'giocatore connesso' : 'giocatori connessi'}</h2></div>
        </div>
        <p>{players.map((p) => p.nickname).join(' · ')}</p>
        <button disabled={!players.length} onClick={next}>Avvia la prima domanda</button>
      </>)}

      {(game.status === 'question' || game.status === 'results') && q && (<>
        <p className="muted">Domanda {game.current_q + 1} di {QUESTIONS.length}</p>
        <h1>{q.text}</h1>
        {game.status === 'question' && (<>
          <div className="timer">{left}</div>
          <div className="bar"><i style={{ width: `${(left / TIME_LIMIT) * 100}%` }} /></div>
          <p>{qAnswers.length} su {players.length} hanno risposto</p>
          <div className="row"><button onClick={() => update({ status: 'results' })}>Chiudi la domanda</button>
          <button className="ghost" onClick={() => { unlockAudio(); setSoundOn(!soundOn); }}>Suono: {soundOn ? 'acceso' : 'spento'}</button></div>
        </>)}
        <div className="opts">{q.options.map((o, i) => (
          <div key={i} className={`opt o${i} ${game.status === 'results' && i !== q.correct ? 'wrong' : ''} ${game.status === 'results' && i === q.correct ? 'right' : ''}`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderRadius: 10 }}>
            <span>{o}</span>{game.status === 'results' && <b>{qAnswers.filter((a) => a.choice === i).length}</b>}</div>))}</div>
        {game.status === 'results' && (<>
          <h2 style={{ marginTop: 24 }}>Classifica provvisoria</h2>
          <Board rows={board.slice(0, 5)} />
          <button onClick={next}>{game.current_q + 1 >= QUESTIONS.length ? 'Mostra la classifica finale' : 'Prossima domanda'}</button>
        </>)}
      </>)}

      {game.status === 'finished' && (<>
        <h1>Classifica finale</h1>
        <Board rows={board.slice(0, 10)} />
        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={exportCsv}>Scarica la classifica (CSV)</button>
          <button className="ghost" onClick={() => { setGame(null); setPlayers([]); setAnswers([]); }}>Nuova partita</button>
        </div>
      </>)}
      {err && <p className="err">{err}</p>}
    </main>
  );
}

function Board({ rows }) {
  return (<table><thead><tr><th>#</th><th>Nickname</th><th className="n">Giuste</th><th className="n">Punti</th></tr></thead>
    <tbody>{rows.map((r, i) => (<tr key={r.id}><td>{i + 1}</td><td>{r.nickname}</td><td className="n">{r.correct}</td><td className="n"><b>{r.score}</b></td></tr>))}</tbody></table>);
}
