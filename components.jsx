// ─────────────────────────────────────────────────────────────
// Street Craps 7-11 — UI components
// ─────────────────────────────────────────────────────────────
const { useState, useEffect } = React;

// ── Die ───────────────────────────────────────────────────────
function Die({ value, rolling, size = 80, delay = 0 }) {
  const [displayVal, setDisplayVal] = useState(value);

  useEffect(() => {
    if (!rolling) { setDisplayVal(value); return; }
    let id;
    const tick = () => {
      setDisplayVal(1 + Math.floor(Math.random() * 6));
      id = setTimeout(tick, 55);
    };
    id = setTimeout(tick, delay);
    return () => clearTimeout(id);
  }, [rolling, value, delay]);

  const pipPositions = {
    1: [[0.5, 0.5]],
    2: [[0.25, 0.25], [0.75, 0.75]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.25, 0.22], [0.25, 0.5], [0.25, 0.78], [0.75, 0.22], [0.75, 0.5], [0.75, 0.78]],
  };
  const pipR = size * 0.075;
  const pips = pipPositions[displayVal] || [];

  return (
    <div className={`die ${rolling ? 'die-rolling' : ''}`} style={{ width: size, height: size, borderRadius: size * 0.18 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {pips.map(([x, y], i) => (
          <circle key={i} cx={x * size} cy={y * size} r={pipR} fill="#7BFDEB" />
        ))}
      </svg>
    </div>
  );
}

// ── Dice row (2 dice) ─────────────────────────────────────────
function DiceRow({ dice, rolling, size = 80 }) {
  return (
    <div className="dice-row">
      {dice.map((v, i) => (
        <Die key={i} value={v} rolling={rolling} size={size} delay={i * 80} />
      ))}
    </div>
  );
}

// ── Point puck ────────────────────────────────────────────────
function PointPuck({ point, phase }) {
  const isOn = point !== null;
  const label = isOn ? point : 'OFF';
  const phases = {
    idle: 'COME OUT',
    'come-out': 'ROLLING…',
    'point-set': `ON ${point}`,
    'point-rolling': `ON ${point}`,
    resolved: isOn ? `POINT WAS ${point}` : 'COME OUT',
  };
  const subtitle = phases[phase] || '';

  return (
    <div className={`point-puck ${isOn ? 'puck-on' : 'puck-off'}`}>
      <div className="puck-label">{label}</div>
      <div className="puck-sub">{subtitle}</div>
    </div>
  );
}

// ── Roll total badge ──────────────────────────────────────────
function RollBadge({ result, phase }) {
  if (!result) {
    return (
      <div className="roll-badge placeholder">
        {phase === 'idle' ? 'place your bet' : '—'}
      </div>
    );
  }
  const tone =
    result.kind === 'natural' ? 'hot' :
    result.kind === 'craps'   ? 'cold' :
    result.kind === 'hit'     ? 'hot' :
    result.kind === 'seven-out' ? 'cold' :
    result.kind === 'point'   ? 'accent' :
    'neutral';
  return (
    <div className={`roll-badge tone-${tone}`}>
      <span className="rb-total">{result.total}</span>
      <span className="rb-name">{result.label}</span>
      {result.hard && <span className="rb-hard">THE HARD WAY</span>}
    </div>
  );
}

// ── Roll log (point-phase history) ───────────────────────────
function RollLog({ rolls }) {
  if (!rolls.length) return null;
  return (
    <div className="roll-log">
      {rolls.map((r, i) => (
        <div key={i} className={`rl-entry rl-${r.kind}`}>
          <span className="rl-total">{r.total}</span>
        </div>
      ))}
    </div>
  );
}

// ── Bet type toggle (Pass / Don't Pass) ───────────────────────
function BetTypeToggle({ value, onChange, disabled }) {
  return (
    <div className={`bet-toggle ${disabled ? 'disabled' : ''}`}>
      <button
        className={`bt-btn ${value === 'pass' ? 'active' : ''}`}
        onClick={() => !disabled && onChange('pass')}
        disabled={disabled}
      >
        <span className="bt-main">PASS LINE</span>
        <span className="bt-sub">with shooter</span>
      </button>
      <button
        className={`bt-btn ${value === 'dont' ? 'active dont' : ''}`}
        onClick={() => !disabled && onChange('dont')}
        disabled={disabled}
      >
        <span className="bt-main">DON'T PASS</span>
        <span className="bt-sub">against shooter</span>
      </button>
    </div>
  );
}

// ── Amount input (same as Cee-Lo) ─────────────────────────────
function AmountInput({ value, onChange, label = 'Wager', disabled }) {
  return (
    <div className="amount-block">
      <label className="field-label">{label}</label>
      <div className={`amount-input ${disabled ? 'disabled' : ''}`}>
        <span className="coin-dot" />
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          disabled={disabled}
          step="0.5"
          min="0"
        />
        <div className="amt-btns">
          <button onClick={() => onChange(Math.max(0, value / 2))} disabled={disabled}>½</button>
          <button onClick={() => onChange(value * 2)} disabled={disabled}>2×</button>
        </div>
      </div>
    </div>
  );
}

// ── Side bet chip (same pattern as Cee-Lo) ────────────────────
function SideBetChip({ keyName, def, amount, onSet, disabled, resolved, point }) {
  const active = amount > 0;
  const tone = resolved === 'win' ? 'chip-win' : resolved === 'lose' ? 'chip-lose' : '';

  // Show dynamic odds label for Odds bet
  const { oddsMultiplier } = window.StreetCraps;
  let oddsLabel = def.odds > 0 ? `${def.odds}×` : '';
  if (keyName === 'odds' && point) {
    const m = oddsMultiplier(point);
    oddsLabel = m === 2 ? '2:1' : m === 1.5 ? '3:2' : '6:5';
  }

  return (
    <button
      className={`sidebet-chip ${active ? 'active' : ''} ${tone}`}
      disabled={disabled}
      onClick={() => { if (amount > 0) onSet(0); else onSet(1); }}
    >
      <div className="sb-top">
        <span className="sb-label">{def.label}</span>
        {oddsLabel && <span className="sb-odds">{oddsLabel}</span>}
      </div>
      <div className="sb-bottom">
        {amount > 0
          ? <span className="sb-amt">▴ {amount.toFixed(2)}</span>
          : <span className="sb-place">tap to bet</span>}
        {amount > 0 && (
          <div className="sb-steppers" onClick={(e) => e.stopPropagation()}>
            <span onClick={() => onSet(Math.max(0, amount - 1))}>−</span>
            <span onClick={() => onSet(amount + 1)}>+</span>
          </div>
        )}
      </div>
    </button>
  );
}

window.SevenElevenUI = {
  Die, DiceRow, PointPuck, RollBadge, RollLog,
  BetTypeToggle, AmountInput, SideBetChip,
};
