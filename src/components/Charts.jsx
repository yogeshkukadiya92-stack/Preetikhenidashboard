export function FunnelChart({ stages }) {
  if (!stages.length) {
    return (
      <div className="empty-state chart-empty">
        <strong>No funnel data yet.</strong>
        <p>Add leads to see the funnel fill in.</p>
      </div>
    );
  }

  const widths = [220, 190, 160, 128, 102];
  const classNames = ['fr1', 'fr2', 'fr3', 'fr4', 'fr5'];

  return (
    <div className="funnel-wrap">
      <div className="funnel" aria-label="Lead conversion funnel">
        {stages.map((stage, index) => (
          <div key={stage.label} className={`funnel-row ${classNames[index]}`} style={{ width: widths[index], height: 46 }}>
            {stage.value}
          </div>
        ))}
      </div>
      <div className="funnel-meta">
        {stages.map((stage) => (
          <div className="funnel-meta-row" key={stage.label}>
            <strong>{stage.label}</strong>
            <span className="badge">{stage.percent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChart({ series = [] }) {
  if (!series.length) {
    return (
      <div className="empty-state chart-empty">
        <strong>No revenue trend yet.</strong>
        <p>Import payments or book visits to generate a line chart.</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...series.map((item) => item.revenue), 1);
  const maxCollections = Math.max(...series.map((item) => item.collections), 1);
  const width = 700;
  const height = 230;
  const scaleX = series.length > 1 ? 620 / (series.length - 1) : 0;
  const pointsRevenue = series.map((item, index) => `${40 + index * scaleX},${190 - (item.revenue / maxRevenue) * 120}`);
  const pointsCollections = series.map((item, index) => `${40 + index * scaleX},${190 - (item.collections / maxCollections) * 110}`);
  const areaPath = `M${pointsRevenue.join(' L ')} L 660 210 L 40 210 Z`;

  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        <span><i className="legend-dot legend-line" />Revenue (₹)</span>
        <span><i className="legend-dot legend-dots" />Collections (₹)</span>
      </div>
      <div className="chart-area">
        <svg className="chart-svg" viewBox="0 0 700 230" preserveAspectRatio="none" aria-label="Revenue chart">
          <defs>
            <linearGradient id="areaGreen" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0d5649" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0d5649" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g opacity="0.16">
            <line x1="40" y1="190" x2="660" y2="190" stroke="#2a5345" />
            <line x1="40" y1="142" x2="660" y2="142" stroke="#2a5345" />
            <line x1="40" y1="94" x2="660" y2="94" stroke="#2a5345" />
            <line x1="40" y1="46" x2="660" y2="46" stroke="#2a5345" />
          </g>
          <path d={areaPath} fill="url(#areaGreen)" />
          <path d={`M${pointsRevenue.join(' L ')}`} fill="none" stroke="#0d5649" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${pointsCollections.join(' L ')}`} fill="none" stroke="#e19a22" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 8" />
          <g fill="#0d5649">
            {series.map((item, index) => (
              <circle key={item.label} cx={40 + index * scaleX} cy={190 - (item.revenue / maxRevenue) * 120} r="5" />
            ))}
          </g>
          <g fill="#e19a22">
            {series.map((item, index) => (
              <circle key={item.label} cx={40 + index * scaleX} cy={190 - (item.collections / maxCollections) * 110} r="5" />
            ))}
          </g>
          <text x="18" y="194">25K</text>
          <text x="14" y="146">50K</text>
          <text x="14" y="98">75K</text>
          <text x="8" y="50">100K</text>
          {series.map((item, index) => (
            <text key={item.label} x={15 + index * scaleX} y="225">{item.label}</text>
          ))}
          <rect x="622" y="58" width="64" height="28" rx="10" fill="#0d5649" />
          <text x="631" y="77" fill="#fff">₹ {maxRevenue.toLocaleString('en-IN')}</text>
          <rect x="622" y="104" width="64" height="28" rx="10" fill="#e19a22" />
          <text x="631" y="123" fill="#fff">₹ {maxCollections.toLocaleString('en-IN')}</text>
        </svg>
      </div>
    </div>
  );
}
