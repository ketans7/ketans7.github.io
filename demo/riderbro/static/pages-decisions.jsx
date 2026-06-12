/* global React, Stat, VerdictChip, Scatter */
// Placeholder for the Decisions page. The design spec describes it
// (override rate, predicted vs realised £/hr, accept-rate divergence by hour)
// but the prototype handed off didn't include a final layout. This stub
// renders the key metrics from current data and reserves space for the
// real charts.

const { useMemo: useMemoDecisions } = React;

function DecisionsPage({ openOrder, range }) {
  const stats = useMemoDecisions(() => {
    const orders = window.RI.orders || [];
    const totalWithOutcome = orders.filter(o => o.accepted !== null && o.accepted !== undefined).length;
    const overrideBotAccept = orders.filter(o => o.verdict === 'accept' && o.accepted === false).length;
    const overrideBotSkip = orders.filter(o => o.verdict === 'skip' && o.accepted === true).length;
    const thumbsTotal = orders.filter(o => o.thumbs !== 0).length;
    const thumbsUp = orders.filter(o => o.thumbs === 1).length;
    const acceptedComplete = orders.filter(o => o.accepted && o.completed).length;

    return {
      totalWithOutcome,
      overrideBotAccept,
      overrideBotSkip,
      overrideRate: totalWithOutcome ? (overrideBotAccept + overrideBotSkip) / totalWithOutcome : 0,
      thumbsAccuracy: thumbsTotal ? thumbsUp / thumbsTotal : 0,
      acceptedComplete,
    };
  }, []);

  return (
    <div className="page">
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <Stat label="Override rate" value={(stats.overrideRate * 100).toFixed(1) + '%'} hint={`${stats.overrideBotAccept + stats.overrideBotSkip} of ${stats.totalWithOutcome}`} />
        <Stat label="We said accept · rider declined" value={stats.overrideBotAccept} hint="too generous?" />
        <Stat label="We said skip · rider took it" value={stats.overrideBotSkip} hint="too cautious?" />
        <Stat label="Thumbs-up rate" value={(stats.thumbsAccuracy * 100).toFixed(0) + '%'} hint="verdict accuracy proxy" />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Decisions analytics</div>
            <div className="card-subtitle">
              Full charts (override matrix, predicted vs realised £/hr scatter,
              accept-rate divergence by hour) land here as we collect more
              labelled outcomes. Need realised payout + actual duration on every
              completed order before the £/hr-calibration chart becomes meaningful.
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Open any order from the Riders or Live feed view to inspect its verdict and outcome side-by-side.
        </p>
      </div>
    </div>
  );
}
