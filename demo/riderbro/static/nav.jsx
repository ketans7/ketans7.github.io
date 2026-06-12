/* global React, Icon */
// Sidebar navigation. Dark "batman tech" shell.

const NAV = [
  { group: 'OPERATE', items: [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'live',     label: 'Live feed', icon: 'radio', live: true },
    { id: 'riders',   label: 'Riders',    icon: 'users' },
  ]},
  { group: 'ANALYSE', items: [
    { id: 'spatial',  label: 'Spatial',   icon: 'map' },
    { id: 'hunting',  label: 'Hunting',   icon: 'map' },
    { id: 'survey',   label: 'Surveys',   icon: 'survey' },
    { id: 'decisions',label: 'Decisions', icon: 'chart' },
  ]},
  { group: 'SYSTEM', items: [
    { id: 'pipeline', label: 'Pipeline',  icon: 'cpu' },
  ]},
];

function Sidebar({ current, onNav, liveCount, riderCount }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark">R</div>
        <div className="name">RiderIntel<span className="sub">v0.4 · local</span></div>
      </div>

      {NAV.map(g => (
        <div className="nav-group" key={g.group}>
          <div className="nav-group-label">{g.group}</div>
          {g.items.map(it => (
            <div
              key={it.id}
              className={'nav-item' + (current === it.id ? ' active' : '') + (it.live ? ' live' : '')}
              onClick={() => onNav(it.id)}
            >
              <span className="ico"><Icon name={it.icon} size={14} /></span>
              <span>{it.label}</span>
              {it.live && liveCount != null && <span className="count">{liveCount} live</span>}
              {it.id === 'riders' && <span className="count">{riderCount}</span>}
            </div>
          ))}
        </div>
      ))}

      <div className="spacer"></div>

      <div className="footer">
        <div className="health"><span className="dot"></span>bot.healthy · {window.RI ? window.RI.orders.length : '—'} orders ingested</div>
        <div>SQLite · /var/ri/rider.db</div>
        <div>build 26a4f · 26 May 2026</div>
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
