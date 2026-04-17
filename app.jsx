// ─────────────────────────────────────────────────────────────
// Street Craps 7-11 — app orchestration
// ─────────────────────────────────────────────────────────────
const { useState, useEffect, useRef } = React;
const { DiceRow, PointPuck, RollBadge, RollLog, BetTypeToggle, AmountInput, SideBetChip } = window.SevenElevenUI;
const {
  rollDice, diceSum, isDouble,
  comeOutResult, pointRollResult,
  roundOutcome, oddsMultiplier,
  SIDE_BETS, resolveSideBet, mainBetMult,
  ROLL_NAMES,
} = window.StreetCraps;

const TWEAKS = { animationSpeed: 1.0, showSideBets: true, showSecondWindow: true };
const SPEED = (base) => Math.round(base / (TWEAKS.animationSpeed || 1));

// ── Phases ────────────────────────────────────────────────────
const PHASES = {
  idle:          'idle',
  comeOut:       'come-out',
  pointSet:      'point-set',      // second window: odds/hardways available
  pointRolling:  'point-rolling',  // player keeps rolling
  resolved:      'resolved',
};

function App() {
  const [balance, setBalance]         = useState(1000);
  const [betSide, setBetSide]         = useState('pass');
  const [wager, setWager]             = useState(10);
  const [sideBetAmts, setSideBetAmts] = useState({});
  const [phase, setPhase]             = useState(PHASES.idle);

  const [dice, setDice]               = useState([1, 1]);
  const [rolling, setRolling]         = useState(false);
  const [rollCount, setRollCount]     = useState(0);

  const [comeOutR, setComeOutR]       = useState(null);
  const [lastResult, setLastResult]   = useState(null);
  const [point, setPoint]             = useState(null);
  const [pointLog, setPointLog]       = useState([]); // rolls during point phase
  const [pointDice, setPointDice]     = useState(null); // final dice of point phase

  const [outcome, setOutcome]         = useState(null); // 'win'|'lose'|'push'
  const [payoutBreakdown, setPayoutBreakdown] = useState(null);
  const [history, setHistory]         = useState([]);
  const [flash, setFlash]             = useState(null);
  const [showRules, setShowRules]     = useState(false);
  const [tweaksOpen, setTweaksOpen]   = useState(false);
  const [tweakVals, setTweakVals]     = useState(TWEAKS);

  // ── Tweaks ───────────────────────────────────────────────
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setTweaksOpen(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    TWEAKS.animationSpeed  = tweakVals.animationSpeed;
    TWEAKS.showSideBets    = tweakVals.showSideBets;
    TWEAKS.showSecondWindow = tweakVals.showSecondWindow;
  }, [tweakVals]);

  const setTweak = (key, val) => {
    setTweakVals((p) => ({ ...p, [key]: val }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, window.location.origin);
  };

  // ── Side bet helpers ─────────────────────────────────────
  const totalSideBets = Object.values(sideBetAmts).reduce((a, b) => a + b, 0);
  const totalStake    = wager + totalSideBets;

  const setSideBet = (k, amt) => {
    setSideBetAmts((p) => {
      const n = { ...p };
      if (amt <= 0) delete n[k];
      else n[k] = amt;
      return n;
    });
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── Which side bets are locked ───────────────────────────
  // Pre-come-out props locked once betting starts
  // Post-point bets only available during second window
  const preBetsLocked  = phase !== PHASES.idle;
  const postBetsLocked = phase !== PHASES.pointSet || !TWEAKS.showSecondWindow;

  // ── Hardway availability: only show the matching point ───
  const hardwayKeys = { hard4: 4, hard6: 6, hard8: 8, hard10: 10 };

  // ── Place bet & auto-roll come-out ───────────────────────
  const canPlaceBet = phase === PHASES.idle && wager > 0;

  const placeBet = async () => {
    if (!canPlaceBet) return;
    if (totalStake > balance) {
      setFlash({ type: 'err', msg: 'Not enough balance' });
      setTimeout(() => setFlash(null), 1500);
      return;
    }
    setBalance((b) => b - totalStake);
    setPhase(PHASES.comeOut);
    setComeOutR(null);
    setLastResult(null);
    setPoint(null);
    setPointLog([]);
    setPointDice(null);
    setOutcome(null);
    setPayoutBreakdown(null);
    setRollCount(0);

    await sleep(SPEED(400));
    await doComeOut();
  };

  // ── Come-out roll (auto) ─────────────────────────────────
  const doComeOut = async () => {
    setRolling(true);
    await sleep(SPEED(900));
    const d = rollDice();
    const r = comeOutResult(d);
    setDice(d);
    setRolling(false);
    setComeOutR(r);
    setLastResult(r);
    setRollCount(1);
    await sleep(SPEED(600));

    if (r.kind === 'natural' || r.kind === 'craps') {
      await resolveRound(r, null, null);
    } else {
      // Point set
      setPoint(r.point);
      if (TWEAKS.showSideBets && TWEAKS.showSecondWindow) {
        setPhase(PHASES.pointSet);
      } else {
        setPhase(PHASES.pointRolling);
      }
    }
  };

  // ── Player rolls in point phase ──────────────────────────
  const rollPoint = async () => {
    if (phase !== PHASES.pointSet && phase !== PHASES.pointRolling) return;
    setPhase(PHASES.pointRolling);
    setRolling(true);
    await sleep(SPEED(900));

    const d = rollDice();
    const r = pointRollResult(d, point);
    setDice(d);
    setRolling(false);
    setLastResult(r);
    setRollCount((c) => c + 1);
    setPointLog((log) => [...log, { ...r }]);
    await sleep(SPEED(500));

    if (r.kind === 'hit' || r.kind === 'seven-out') {
      setPointDice(d);
      await resolveRound(comeOutR, r, d);
    }
    // neutral: stay in pointRolling, player taps again
  };

  // ── Settle round ─────────────────────────────────────────
  const resolveRound = async (coR, ptR, ptDice) => {
    const pointHit = ptR?.kind === 'hit';
    const activePoint = coR.kind === 'point' ? coR.point : null;
    const oc = roundOutcome(betSide, coR, pointHit);
    setOutcome(oc);

    // Main bet payout
    const mainMult   = mainBetMult(oc);
    const mainPayout = wager * mainMult;

    // Side bets
    const sideRes = {};
    let sidePayout = 0;
    for (const k of Object.keys(sideBetAmts)) {
      const amt = sideBetAmts[k];
      const { win, mult } = resolveSideBet(k, dice, ptDice, activePoint, oc);
      sideRes[k] = win ? 'win' : 'lose';
      if (win) sidePayout += amt * (1 + mult);
    }

    const totalReturn = mainPayout + sidePayout;
    const netChange   = totalReturn - totalStake;

    setPayoutBreakdown({ oc, mainMult, mainPayout, sideRes, sidePayout, totalReturn, netChange });
    setBalance((b) => b + totalReturn);
    setPhase(PHASES.resolved);

    setHistory((h) => [{
      id: Date.now(),
      betSide,
      outcome: oc,
      coTotal: coR.total,
      coKind: coR.kind,
      point: activePoint,
      net: netChange,
    }, ...h].slice(0, 24));

    // Flash
    const msg =
      oc === 'win'  ? (coR.kind === 'natural' ? (coR.total === 7 ? 'NATURAL!' : 'YO-LEVEN!') : 'POINT HIT!') :
      oc === 'lose' ? (coR.kind === 'craps' ? 'CRAPPED OUT' : "SEVEN-OUT") :
      'PUSH';
    setFlash({ type: oc, msg });
    setTimeout(() => setFlash(null), 2800);
  };

  // ── New round ────────────────────────────────────────────
  const newRound = () => {
    setPhase(PHASES.idle);
    setDice([1, 1]);
    setRolling(false);
    setRollCount(0);
    setComeOutR(null);
    setLastResult(null);
    setPoint(null);
    setPointLog([]);
    setPointDice(null);
    setOutcome(null);
    setPayoutBreakdown(null);
    setSideBetAmts({});
  };

  // ── Derived subtitles ────────────────────────────────────
  const stageTitle =
    phase === PHASES.idle         ? 'READY TO SHOOT' :
    phase === PHASES.comeOut      ? 'COME-OUT ROLL…' :
    phase === PHASES.pointSet     ? `POINT SET · ${point} · LOCK IN BETS` :
    phase === PHASES.pointRolling ? `SHOOTING FOR ${point} · ROLL ${rollCount}` :
    phase === PHASES.resolved     ? (outcome === 'win' ? 'WINNER!' : outcome === 'lose' ? 'NO LUCK' : 'PUSH') :
    '';

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="app-root">
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="brand">
          <img src="assets/logo-mark.png" alt="Dices" className="brand-mark" />
          <span className="brand-word">Dices</span>
          <span className="game-tag">Street Craps · 7-11</span>
        </div>
        <div className="balance-pill">
          <span className="bal-label">BALANCE</span>
          <span className="coin-dot" />
          <span className="bal-val">{balance.toFixed(2)}</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => setShowRules(true)} title="Rules">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4" />
              <circle cx="12" cy="17" r="0.6" fill="currentColor" />
            </svg>
          </button>
          <button className="icon-btn" title="Chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a8 8 0 1 1-3.8-6.8L21 4l-1.2 3.8A8 8 0 0 1 21 12z" />
            </svg>
          </button>
          <div className="avatar-dot" />
        </div>
      </header>

      {/* ── Main grid ── */}
      <main className="main-grid">

        {/* ── Left bet rail ── */}
        <aside className="bet-rail">
          <div className="rail-tabs">
            <button className="tab active">Manual</button>
            <button className="tab">Auto</button>
            <button className="tab">Advanced</button>
          </div>

          {/* Bet type */}
          <div className="rail-section">
            <label className="field-label">BET TYPE</label>
            <BetTypeToggle value={betSide} onChange={setBetSide} disabled={phase !== PHASES.idle} />
          </div>

          {/* Wager */}
          <div className="rail-section">
            <AmountInput value={wager} onChange={setWager} label="WAGER" disabled={phase !== PHASES.idle} />
            <div className="field-row">
              <div className="field-col">
                <label className="field-label">WIN (1:1)</label>
                <div className="readout">{(wager * 2).toFixed(2)}</div>
              </div>
              <div className="field-col">
                <label className="field-label">HOUSE EDGE</label>
                <div className="readout accent">1.41%</div>
              </div>
            </div>
          </div>

          {/* Side bets */}
          {TWEAKS.showSideBets && (
            <div className="rail-section sidebets">
              <div className="section-head">
                <span className="section-title">SIDE BETS</span>
                {phase === PHASES.pointSet && TWEAKS.showSecondWindow && (
                  <span className="live-pill">● POINT WINDOW</span>
                )}
              </div>

              {/* Pre-come-out props — always visible, lock after bet placed */}
              <div className="sb-group">
                <div className="sb-group-label">field & props</div>
                <div className="sb-grid-2">
                  {['field', 'yo', 'any7', 'anycraps', 'snakeeyes', 'boxcars'].map((k) => (
                    <SideBetChip
                      key={k} keyName={k} def={SIDE_BETS[k]}
                      amount={sideBetAmts[k] || 0}
                      onSet={(a) => setSideBet(k, a)}
                      disabled={preBetsLocked}
                      resolved={phase === PHASES.resolved ? (payoutBreakdown?.sideRes?.[k] || null) : null}
                      point={point}
                    />
                  ))}
                </div>
              </div>

              {/* Post-point bets — only after point is set */}
              {(phase === PHASES.pointSet || phase === PHASES.pointRolling || phase === PHASES.resolved) && (
                <div className="sb-group">
                  <div className="sb-group-label">true odds &amp; hardways</div>
                  <div className="sb-grid-2">
                    {/* Odds bet */}
                    <SideBetChip
                      keyName="odds" def={SIDE_BETS.odds}
                      amount={sideBetAmts.odds || 0}
                      onSet={(a) => setSideBet('odds', a)}
                      disabled={postBetsLocked}
                      resolved={phase === PHASES.resolved ? (payoutBreakdown?.sideRes?.odds || null) : null}
                      point={point}
                    />
                    {/* Only the hardway matching current point */}
                    {Object.entries(hardwayKeys).map(([k, n]) =>
                      n === point ? (
                        <SideBetChip
                          key={k} keyName={k} def={SIDE_BETS[k]}
                          amount={sideBetAmts[k] || 0}
                          onSet={(a) => setSideBet(k, a)}
                          disabled={postBetsLocked}
                          resolved={phase === PHASES.resolved ? (payoutBreakdown?.sideRes?.[k] || null) : null}
                          point={point}
                        />
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rail footer */}
          <div className="rail-footer">
            <div className="stake-line">
              <span>TOTAL STAKE</span>
              <span className="stake-val">▴ {totalStake.toFixed(2)}</span>
            </div>

            {phase === PHASES.idle && (
              <button className="play-btn" onClick={placeBet} disabled={!canPlaceBet}>
                PLACE BET · SHOOT DICE
              </button>
            )}
            {phase === PHASES.comeOut && (
              <button className="play-btn loading" disabled>ROLLING COME-OUT…</button>
            )}
            {phase === PHASES.pointSet && (
              <button className="play-btn ready" onClick={rollPoint}>
                {TWEAKS.showSecondWindow ? 'LOCK IN · SHOOT' : 'SHOOT FOR THE POINT'}
              </button>
            )}
            {phase === PHASES.pointRolling && (
              !rolling
                ? <button className="play-btn ready" onClick={rollPoint}>ROLL AGAIN</button>
                : <button className="play-btn loading" disabled>ROLLING…</button>
            )}
            {phase === PHASES.resolved && (
              <button className="play-btn" onClick={newRound}>NEW ROUND</button>
            )}

            {/* Payout breakdown */}
            {payoutBreakdown && (
              <div className={`payout-box payout-${payoutBreakdown.oc}`}>
                <div className="pb-row">
                  <span>{betSide === 'pass' ? 'Pass Line' : "Don't Pass"}</span>
                  <span>
                    {payoutBreakdown.oc === 'win'  ? `+${(payoutBreakdown.mainPayout - wager).toFixed(2)}` :
                     payoutBreakdown.oc === 'push' ? 'returned' :
                     `−${wager.toFixed(2)}`}
                  </span>
                </div>
                {payoutBreakdown.sidePayout > 0 && (
                  <div className="pb-row">
                    <span>Side bets</span>
                    <span>+{(payoutBreakdown.sidePayout - totalSideBets).toFixed(2)}</span>
                  </div>
                )}
                <div className="pb-row total">
                  <span>Net</span>
                  <span>{payoutBreakdown.netChange >= 0 ? '+' : ''}{payoutBreakdown.netChange.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Right stage ── */}
        <section className="stage">
          <div className="stage-inner">

            {/* Point puck + phase header */}
            <div className="stage-header">
              <PointPuck point={point} phase={phase} />
              <div className={`stage-title ${outcome ? `outcome-${outcome}` : ''}`}>{stageTitle}</div>
            </div>

            {/* Dice zone */}
            <div
              className={`shooter-zone ${phase === PHASES.pointRolling && !rolling ? 'tap-ready' : ''}`}
              onClick={phase === PHASES.pointRolling && !rolling ? rollPoint : undefined}
            >
              <div className="zone-label">YOU · THE SHOOTER</div>
              <DiceRow dice={dice} rolling={rolling} size={88} />
              <RollBadge result={lastResult} phase={phase} />
              {phase === PHASES.pointRolling && !rolling && (
                <div className="tap-hint">↻ TAP TO ROLL AGAIN</div>
              )}
            </div>

            {/* Point-phase roll log */}
            {pointLog.length > 0 && (
              <div className="roll-log-wrap">
                <span className="rl-label">ROLLS THIS HAND</span>
                <RollLog rolls={pointLog} />
              </div>
            )}

            {/* Flash */}
            {flash && (
              <div className={`flash flash-${flash.type}`}>
                <div className="flash-glyph">
                  {flash.type === 'win' ? '◆◆◆' : flash.type === 'lose' ? '✕' : flash.type === 'push' ? '=' : '!'}
                </div>
                <div className="flash-msg">{flash.msg}</div>
              </div>
            )}
          </div>

          <HistoryStrip history={history} />
        </section>
      </main>

      {/* ── Bottom strip ── */}
      <div className="bottom-strip" onClick={() => setShowRules(true)}>
        <div className="bs-left">
          <span className="bs-title">Street Craps</span>
          <span className="bs-tag">Dices Originals</span>
        </div>
        <div className="bs-right">
          <span className="bs-odds">▴ 30× MAX PROP</span>
          <span className="bs-fair">Demo · Play Money</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>

      {showRules && <RulesDrawer onClose={() => setShowRules(false)} />}
      {tweaksOpen && <TweaksPanel vals={tweakVals} onChange={setTweak} onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}

// ── History strip ─────────────────────────────────────────────
function HistoryStrip({ history }) {
  if (!history.length) return (
    <div className="history-strip empty">
      <span className="hs-label">RECENT ROLLS</span>
      <span className="hs-placeholder">no rounds yet — place your first bet</span>
    </div>
  );
  return (
    <div className="history-strip">
      <span className="hs-label">RECENT</span>
      <div className="hs-scroller">
        {history.map((h) => (
          <div key={h.id} className={`hs-chip hs-${h.outcome}`}>
            <span className="hs-side">{h.betSide === 'pass' ? 'PASS' : "DON'T"}</span>
            <span className="hs-dice">
              {h.coKind === 'natural' ? `${h.coTotal}` :
               h.coKind === 'craps'   ? `${h.coTotal}` :
               h.point ? `P${h.point}` : `${h.coTotal}`}
            </span>
            <span className="hs-net">{h.net >= 0 ? '+' : ''}{h.net.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Rules drawer ──────────────────────────────────────────────
function RulesDrawer({ onClose }) {
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>How Street Craps works</h2>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          <section>
            <h3>THE LOOP</h3>
            <p>Place Pass Line or Don't Pass. You're the Shooter — roll both dice. A <em>Natural</em> (7 or 11) wins instantly. <em>Craps</em> (2, 3, or 12) loses instantly. Any other number sets the <em>Point</em> — keep rolling until you hit it (win) or roll a 7 (lose).</p>
          </section>
          <section className="rules-grid">
            <div className="rule-card rule-hot">
              <div className="rule-badge">NATURAL WIN</div>
              <div className="rule-title">7 or 11 (Come-Out)</div>
              <div className="rule-sub">Pass wins · Don't Pass loses</div>
            </div>
            <div className="rule-card rule-cold">
              <div className="rule-badge">CRAPS OUT</div>
              <div className="rule-title">2, 3, or 12 (Come-Out)</div>
              <div className="rule-sub">Pass loses · Don't wins (12 = push)</div>
            </div>
            <div className="rule-card rule-neutral">
              <div className="rule-badge">SETS POINT</div>
              <div className="rule-title">4 · 5 · 6 · 8 · 9 · 10</div>
              <div className="rule-sub">Roll until you hit it or 7</div>
            </div>
            <div className="rule-card rule-hot">
              <div className="rule-badge">POINT HIT</div>
              <div className="rule-title">Match the Point</div>
              <div className="rule-sub">Pass wins · Don't loses</div>
            </div>
            <div className="rule-card rule-cold">
              <div className="rule-badge">SEVEN-OUT</div>
              <div className="rule-title">Roll a 7 (Point Phase)</div>
              <div className="rule-sub">Pass loses · Don't wins</div>
            </div>
            <div className="rule-card rule-neutral">
              <div className="rule-badge">NEUTRAL</div>
              <div className="rule-title">Any Other Number</div>
              <div className="rule-sub">Keep rolling — no effect</div>
            </div>
          </section>
          <section>
            <h3>POINT PHASE ODDS</h3>
            <ol className="hier-list">
              <li><span>4/10</span> 33.3% to hit · 2:1 true odds</li>
              <li><span>5/9</span>  40.0% to hit · 3:2 true odds</li>
              <li><span>6/8</span>  45.5% to hit · 6:5 true odds</li>
            </ol>
          </section>
          <section>
            <h3>ROLL NICKNAMES</h3>
            <div className="nick-grid">
              {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                <div key={n} className="nick-row">
                  <span className="nick-num">{n}</span>
                  <span className="nick-name">{window.StreetCraps.ROLL_NAMES[n]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Tweaks panel ──────────────────────────────────────────────
function TweaksPanel({ vals, onChange, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tp-head"><span>Demo Settings</span><button onClick={onClose}>✕</button></div>
      <div className="tp-body">
        <label className="tp-field">
          <span>Animation speed</span>
          <div className="tp-slider-row">
            <input type="range" min="0.3" max="3" step="0.1"
              value={vals.animationSpeed}
              onChange={(e) => onChange('animationSpeed', Number(e.target.value))} />
            <span className="tp-val">{vals.animationSpeed.toFixed(1)}×</span>
          </div>
        </label>
        <label className="tp-field toggle">
          <span>Show side bets</span>
          <input type="checkbox" checked={vals.showSideBets}
            onChange={(e) => onChange('showSideBets', e.target.checked)} />
        </label>
        <label className="tp-field toggle">
          <span>Second betting window (after point set)</span>
          <input type="checkbox" checked={vals.showSecondWindow}
            onChange={(e) => onChange('showSecondWindow', e.target.checked)} />
        </label>
        <div className="tp-hint">Changes apply on the next round.</div>
      </div>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
