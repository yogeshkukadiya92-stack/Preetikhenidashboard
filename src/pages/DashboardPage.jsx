import { Card, StatusPill, Tag } from '../components/ui.jsx';
import { FunnelChart, RevenueChart } from '../components/Charts.jsx';
import { ChevronRight } from '../components/icons.jsx';
import { funnelStages, kpis, leads, payments, todaySchedule, urgentTasks } from '../data/mockData.js';

function KpiIcon({ accent }) {
  return (
    <div className={`metric-icon m-${accent}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7.5 3.8V6m9-2.2V6M5.8 9.2h12.4M6 4.8h12A1.8 1.8 0 0 1 19.8 6.6V18a1.8 1.8 0 0 1-1.8 1.8H6A1.8 1.8 0 0 1 4.2 18V6.6A1.8 1.8 0 0 1 6 4.8Z" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function DashboardPage() {
  return (
    <>
      <section className="kpis">
        {kpis.map((kpi) => (
          <article className="kpi" key={kpi.label}>
            <div className="kpi-head">
              <KpiIcon accent={kpi.accent} />
              <div>
                <h3>{kpi.label}</h3>
                <div className="value">{kpi.value}</div>
              </div>
            </div>
            <div className="delta">{kpi.delta} <span className="subtle">vs last 7 days</span></div>
            <div className="kpi-footer">
              <ChevronRight />
              View Details
            </div>
          </article>
        ))}
      </section>

      <section className="grid">
        <div className="stack">
          <Card title="Lead Conversion Funnel">
            <FunnelChart stages={funnelStages} />
            <div className="footer-action" style={{ marginTop: 18 }}>
              <span>Conversion Rate: <strong style={{ color: 'var(--green)' }}>7%</strong> <span className="subtle">vs last 7 days</span></span>
              <span className="delta">↑ 1.2%</span>
            </div>
          </Card>
        </div>

        <Card title="Revenue Trend" action={<button className="pill">By Week <ChevronRight /></button>}>
          <RevenueChart />
          <div className="chart-stats">
            <div className="mini-stat">
              <span>Total Revenue</span>
              <strong>₹ 96,420 <span className="delta">↑ 18%</span></strong>
            </div>
            <div className="mini-stat">
              <span>Total Collections</span>
              <strong>₹ 72,380 <span className="delta">↑ 16%</span></strong>
            </div>
          </div>
        </Card>

        <aside className="stack tasks">
          <Card title="Today's Schedule" action={<ChevronRight />}>
            <div className="schedule-list">
              {todaySchedule.map((item) => (
                <div className="schedule-item" key={`${item.time}-${item.name}`}>
                  <div className="time">{item.time}</div>
                  <div className="tiny-avatar" />
                  <div>
                    <div className="item-title">{item.name}</div>
                    <div className="item-sub">{item.note}</div>
                  </div>
                  <StatusPill tone={`st-${item.tone}`}>{item.status}</StatusPill>
                </div>
              ))}
            </div>
            <div className="footer-action">
              <span>View Full Schedule</span>
              <ChevronRight />
            </div>
          </Card>

          <Card title="Urgent Tasks" action={<StatusPill tone="st-bad">5</StatusPill>}>
            <div className="task-list">
              {urgentTasks.map((task, index) => (
                <div className="task-item" key={task.title}>
                  <div className={`task-icon ${index === 1 ? 'gold' : index === 2 ? 'blue' : index === 3 ? 'green' : ''}`} />
                  <div>
                    <div className="item-title">{task.title}</div>
                    <div className="item-sub">{task.note}</div>
                  </div>
                  <span style={{ color: index === 0 ? '#e35c3e' : '#d98a17', fontWeight: 700 }}>{task.due}</span>
                </div>
              ))}
            </div>
            <div className="footer-action">
              <span>View All Tasks</span>
              <ChevronRight />
            </div>
          </Card>
        </aside>
      </section>

      <section className="grid" style={{ marginTop: 16 }}>
        <Card title="Recent Leads" action={<span className="subtle">View All</span>}>
          <ModuleTable type="leads" />
        </Card>
        <Card title="Recent Payments" action={<span className="subtle">View All</span>}>
          <ModuleTable type="payments" />
        </Card>
      </section>
    </>
  );
}

function ModuleTable({ type }) {
  const rows = type === 'leads' ? leads : payments;

  return (
    <div className="data-table">
      <div className="table-head">
        {type === 'leads' ? (
          <>
            <div>Name</div><div>Source</div><div>Status</div><div>Score</div><div>Added On</div><div />
          </>
        ) : (
          <>
            <div>Client</div><div>Invoice #</div><div>Amount</div><div>Status</div><div>Paid On</div><div />
          </>
        )}
      </div>
      {rows.map((row) => (
        <div className="data-row" key={type === 'leads' ? row.name : row.invoice}>
          {type === 'leads' ? (
            <>
              <div>{row.name}</div>
              <div>{row.source}</div>
              <div><Tag tone={row.status === 'Hot' ? 'tag-hot' : row.status === 'Follow-up due' ? 'tag-follow' : row.status === 'Contacted' ? 'tag-contacted' : 'tag-new'}>{row.status}</Tag></div>
              <div>{row.score}</div>
              <div>{row.addedOn}</div>
              <div>⋯</div>
            </>
          ) : (
            <>
              <div>{row.client}</div>
              <div>{row.invoice}</div>
              <div>{row.amount}</div>
              <div><Tag tone={row.status === 'Paid' ? 'tag-paid' : row.status === 'Partial' ? 'tag-partial' : 'tag-pending'}>{row.status}</Tag></div>
              <div>{row.paidOn}</div>
              <div>⋯</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
