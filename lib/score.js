// Risposta giusta: da 1000 (istantanea) a 500 (allo scadere). Sbagliata: 0.
export function points(q, choice, elapsedMs, limit = 30) {
  if (!q || choice !== q.correct) return 0;
  const t = Math.min(elapsedMs / 1000, limit);
  return Math.round(1000 * (1 - (t / limit) * 0.5));
}

// Ordina per punti; a parità vince chi ha il tempo totale minore sulle risposte giuste.
export function computeLeaderboard(players, answers, questions = [], limit = 30) {
  return players
    .map((p) => {
      let score = 0, correct = 0, time = 0;
      for (const a of answers.filter((x) => x.player_id === p.id)) {
        const pts = points(questions[a.q_index], a.choice, a.elapsed_ms, limit);
        if (pts > 0) { score += pts; correct++; time += a.elapsed_ms; }
      }
      return { id: p.id, nickname: p.nickname, score, correct, time };
    })
    .sort((a, b) => b.score - a.score || a.time - b.time);
}
