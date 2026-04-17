// ─────────────────────────────────────────────────────────────
// Street Craps 7-11 — game logic & rules engine
// ─────────────────────────────────────────────────────────────

const rand6 = () => 1 + Math.floor(Math.random() * 6);
const rollDice = () => [rand6(), rand6()];
const diceSum = (d) => d[0] + d[1];
const isDouble = (d) => d[0] === d[1];

const ROLL_NAMES = {
  2:  'SNAKE EYES',
  3:  'ACE DEUCE',
  4:  'LITTLE JOE',
  5:  'FEVER FIVE',
  6:  'JIMMY HICKS',
  7:  'BIG RED',
  8:  'EIGHTER',
  9:  'NINA',
  10: 'PUPPY PAWS',
  11: 'YO-LEVEN',
  12: 'BOXCARS',
};

// ── Come-out roll evaluation ──────────────────────────────────
// Returns: { kind, total, label, push12? }
function comeOutResult(dice) {
  const t = diceSum(dice);
  if (t === 7)  return { kind: 'natural', total: t, label: 'NATURAL · BIG RED' };
  if (t === 11) return { kind: 'natural', total: t, label: 'YO-LEVEN!' };
  if (t === 2)  return { kind: 'craps',   total: t, label: 'SNAKE EYES',  push12: false };
  if (t === 3)  return { kind: 'craps',   total: t, label: 'ACE DEUCE',   push12: false };
  if (t === 12) return { kind: 'craps',   total: t, label: 'BOXCARS',     push12: true  };
  return { kind: 'point', total: t, point: t, label: ROLL_NAMES[t] };
}

// ── Point-phase roll evaluation ───────────────────────────────
// Returns: { kind, total, hard?, label }
function pointRollResult(dice, point) {
  const t = diceSum(dice);
  if (t === point) return { kind: 'hit',       total: t, hard: isDouble(dice), label: `POINT HIT · ${t}` };
  if (t === 7)     return { kind: 'seven-out', total: t, label: 'SEVEN-OUT' };
  return { kind: 'neutral', total: t, label: ROLL_NAMES[t] || `ROLL ${t}` };
}

// ── Round outcome from player's perspective ───────────────────
// betSide: 'pass' | 'dont'
// comeOutR: result of come-out roll
// pointHit: true = point was hit, false = seven-out (only relevant if phase 2)
function roundOutcome(betSide, comeOutR, pointHit) {
  if (comeOutR.kind === 'natural') {
    return betSide === 'pass' ? 'win' : 'lose';
  }
  if (comeOutR.kind === 'craps') {
    if (comeOutR.push12) return betSide === 'pass' ? 'lose' : 'push';
    return betSide === 'pass' ? 'lose' : 'win';
  }
  // Point phase
  if (pointHit) return betSide === 'pass' ? 'win' : 'lose';
  return betSide === 'pass' ? 'lose' : 'win'; // seven-out
}

// ── True odds multiplier for Odds bet (pass side) ─────────────
function oddsMultiplier(point) {
  if (point === 4 || point === 10) return 2;
  if (point === 5 || point === 9)  return 1.5;
  return 1.2; // 6 or 8 (6:5)
}

// ── Side bet definitions ──────────────────────────────────────
// phase: 'pre' = available before come-out; 'post' = after point is set
const SIDE_BETS = {
  // Pre-come-out single-roll props
  field:     { label: 'Field',       odds: 1,  group: 'field', phase: 'pre',  desc: '2·3·4·9·10·11·12 win; 2 pays 2×, 12 pays 3×' },
  yo:        { label: 'Yo (11)',      odds: 15, group: 'prop',  phase: 'pre',  desc: '11 on come-out · 15:1' },
  any7:      { label: 'Any 7',        odds: 4,  group: 'prop',  phase: 'pre',  desc: '7 on come-out · 4:1' },
  anycraps:  { label: 'Any Craps',    odds: 7,  group: 'prop',  phase: 'pre',  desc: '2, 3, or 12 · 7:1' },
  snakeeyes: { label: 'Snake Eyes',   odds: 30, group: 'prop',  phase: 'pre',  desc: '2 (1+1) · 30:1' },
  boxcars:   { label: 'Boxcars',      odds: 30, group: 'prop',  phase: 'pre',  desc: '12 (6+6) · 30:1' },
  // Post-point bets (locked in when second window opens)
  odds:      { label: 'Odds',         odds: 0,  group: 'odds',  phase: 'post', desc: 'True odds · zero house edge' },
  hard4:     { label: 'Hard 4',       odds: 7,  group: 'hard',  phase: 'post', desc: '2+2 before 7 · 7:1' },
  hard6:     { label: 'Hard 6',       odds: 9,  group: 'hard',  phase: 'post', desc: '3+3 before 7 · 9:1' },
  hard8:     { label: 'Hard 8',       odds: 9,  group: 'hard',  phase: 'post', desc: '4+4 before 7 · 9:1' },
  hard10:    { label: 'Hard 10',      odds: 7,  group: 'hard',  phase: 'post', desc: '5+5 before 7 · 7:1' },
};

// ── Side bet resolution ───────────────────────────────────────
// comeOutDice: the come-out roll dice
// pointDice:   the dice that ended the point phase (hit or seven-out), null if no point phase
// point:       the active point number (null if instant resolution)
// outcome:     'win' | 'lose' | 'push' from betSide's perspective
function resolveSideBet(key, comeOutDice, pointDice, point, outcome) {
  const ct = diceSum(comeOutDice);

  switch (key) {
    case 'field': {
      if (![2,3,4,9,10,11,12].includes(ct)) return { win: false, mult: 0 };
      const mult = ct === 2 ? 2 : ct === 12 ? 3 : 1;
      return { win: true, mult };
    }
    case 'yo':        return { win: ct === 11,           mult: 15 };
    case 'any7':      return { win: ct === 7,            mult: 4  };
    case 'anycraps':  return { win: [2,3,12].includes(ct), mult: 7 };
    case 'snakeeyes': return { win: ct === 2,            mult: 30 };
    case 'boxcars':   return { win: ct === 12,           mult: 30 };

    case 'odds': {
      // Pays true odds only on a pass win in point phase
      if (!point || outcome !== 'win' || !pointDice) return { win: false, mult: 0 };
      return { win: true, mult: oddsMultiplier(point) };
    }
    case 'hard4':  return resolveHardway(4,  pointDice, point, outcome);
    case 'hard6':  return resolveHardway(6,  pointDice, point, outcome);
    case 'hard8':  return resolveHardway(8,  pointDice, point, outcome);
    case 'hard10': return resolveHardway(10, pointDice, point, outcome);
    default:       return { win: false, mult: 0 };
  }
}

function resolveHardway(num, pointDice, point, outcome) {
  const odds = (num === 4 || num === 10) ? 7 : 9;
  // Hardway wins: point was hit AND the final roll was the exact pair
  if (!pointDice || outcome !== 'win' || point !== num) return { win: false, mult: 0 };
  const win = isDouble(pointDice) && diceSum(pointDice) === num;
  return { win, mult: odds };
}

// ── Main bet payout multiplier ────────────────────────────────
// Returns multiplier on the original wager (0 = lose, 1 = push, 2 = 1:1 win)
function mainBetMult(outcome) {
  if (outcome === 'win')  return 2;
  if (outcome === 'push') return 1;
  return 0;
}

window.StreetCraps = {
  rollDice, diceSum, isDouble,
  comeOutResult, pointRollResult,
  roundOutcome, oddsMultiplier,
  SIDE_BETS, resolveSideBet, mainBetMult,
  ROLL_NAMES,
};
