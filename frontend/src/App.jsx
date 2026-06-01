import { useState, useEffect, useRef } from 'react';

// Setup API URL based on environment (Vite Dev Server vs Nginx)
const API_BASE = '/api';

function App() {
  const [metrics, setMetrics] = useState(null);
  const [docker, setDocker] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [apiStatus, setApiStatus] = useState('connecting'); // active, warning, inactive
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const terminalEndRef = useRef(null);

  // Function to fetch all dashboard data
  const fetchDashboardData = async (manual = false) => {
    if (manual) setIsRefreshing(true);

    try {
      // 1. Health check to confirm API connectivity
      const healthRes = await fetch(`${API_BASE}/health`);
      if (!healthRes.ok) throw new Error('API server down');
      const healthData = await healthRes.json();

      // 2. Fetch system metrics
      const metricsRes = await fetch(`${API_BASE}/metrics`);
      const metricsData = await metricsRes.ok ? await metricsRes.json() : null;

      // 3. Fetch Docker container list
      const dockerRes = await fetch(`${API_BASE}/containers`);
      const dockerData = await dockerRes.ok ? await dockerRes.json() : null;

      // 4. Fetch Deployment metadata
      const deployRes = await fetch(`${API_BASE}/deployment`);
      const deployData = await deployRes.ok ? await deployRes.json() : null;

      // 5. Fetch system logs
      const logsRes = await fetch(`${API_BASE}/logs?limit=50`);
      const logsData = await logsRes.ok ? await logsRes.json() : null;

      setMetrics(metricsData);
      setDocker(dockerData);
      setDeployment(deployData);
      setLogs(logsData?.logs || []);
      setApiStatus('active');
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setApiStatus('inactive');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Set up periodic polling
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 5000); // poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal disabled to prevent main page scrolling down automatically
  // useEffect(() => {
  //   if (terminalEndRef.current) {
  //     terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
  //   }
  // }, [logs]);

  // Helper for uptime formatting
  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? `${d}d ` : '';
    const hDisplay = h > 0 ? `${h}h ` : '';
    const mDisplay = m > 0 ? `${m}m ` : '';
    const sDisplay = `${s}s`;

    return dDisplay + hDisplay + mDisplay + sDisplay;
  };

  // Custom circular gauge component
  const CircularGauge = ({ percent, label, color, subtext }) => {
    const radius = 45;
    const strokeWidth = 8;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
      <div className="metric-circle-container">
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth={strokeWidth}
            className="gauge-bg"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            strokeWidth={strokeWidth}
            className="gauge-progress"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          <text
            x="60"
            y="60"
            textAnchor="middle"
            dominantBaseline="central"
            className="gauge-text"
            style={{ transform: 'rotate(90deg)', transformOrigin: '60px 60px' }}
          >
            {Math.round(percent)}%
          </text>
        </svg>
        <span className="metric-label">{label}</span>
        {subtext && <span className="metric-subtext">{subtext}</span>}
      </div>
    );
  };

  // Filter logs based on search input
  const filteredLogs = logs.filter(line =>
    line.toLowerCase().includes(logFilter.toLowerCase())
  );

  const getLineClass = (line) => {
    const l = line.toLowerCase();
    if (l.includes('[error]') || l.includes('failed') || l.includes('exception')) return 'log-line error';
    if (l.includes('[warning]') || l.includes('warn')) return 'log-line warn';
    if (l.includes('[info]')) return 'log-line info';
    if (l.includes('success') || l.includes('healthy')) return 'log-line success';
    return 'log-line';
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-title-section">
          {/* Server Icon */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-cyan)'}}>
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          <div>
            <h1 className="header-logo">ANTIGRAVITY</h1>
            <span className="header-subtitle">DevOps Control Center</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="header-status">
            <span className={`status-dot ${apiStatus === 'active' ? 'active' : 'inactive'}`}></span>
            <span style={{ fontWeight: 600, color: apiStatus === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {apiStatus === 'active' && 'SYSTEM OPERATIONAL'}
              {apiStatus === 'warning' && 'DAEMON WARNING'}
              {apiStatus === 'inactive' && 'API OFFLINE'}
            </span>
          </div>

          <button className="refresh-btn" onClick={() => fetchDashboardData(true)} disabled={isRefreshing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={isRefreshing ? 'spin' : ''}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Refresh {lastUpdated && <span style={{fontSize: '0.75rem', opacity: 0.6}}>({lastUpdated})</span>}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="dashboard-grid">

        {/* Row 1: System Metrics Card */}
        <section className="glass-card col-8">
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
            System Telemetry (Host)
          </h2>

          <div className="metrics-row">
            <CircularGauge
              percent={metrics?.cpu?.percent ?? 0}
              label="CPU Load"
              color="var(--accent-cyan)"
              subtext={`${metrics?.cpu?.count ?? 0} Cores`}
            />
            <CircularGauge
              percent={metrics?.memory?.percent ?? 0}
              label="RAM Utilization"
              color="var(--accent-purple)"
              subtext={`${metrics?.memory?.used_gb ?? 0} / ${metrics?.memory?.total_gb ?? 0} GB`}
            />
            <CircularGauge
              percent={metrics?.disk?.percent ?? 0}
              label="Storage Allocation"
              color="var(--accent-success)"
              subtext={`${metrics?.disk?.used_gb ?? 0} / ${metrics?.disk?.total_gb ?? 0} GB`}
            />
          </div>
        </section>

        {/* Row 1: Health Overview */}
        <section className="glass-card col-4">
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Node Diagnostics
          </h2>
          <div className="info-stats-grid">
            <div className="stat-item">
              <span className="stat-label">Host Uptime</span>
              <span className="stat-value cyan">{formatUptime(metrics?.uptime_seconds)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Load Average</span>
              <span className="stat-value">
                {metrics?.load_average ? metrics.load_average.map(v => v.toFixed(2)).join(', ') : '0.00, 0.00, 0.00'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Docker Daemon</span>
              <span className={`stat-value ${docker?.docker_daemon === 'connected' ? 'success' : 'danger'}`}>
                {docker?.docker_daemon === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Web Health API</span>
              <span className={`stat-value ${apiStatus !== 'inactive' ? 'success' : 'danger'}`}>
                {apiStatus !== 'inactive' ? 'ONLINE (200)' : 'UNREACHABLE'}
              </span>
            </div>
          </div>
        </section>

        {/* Row 2: Docker Containers Grid */}
        <section className="glass-card col-12">
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Dockerized Services ({docker?.containers?.length ?? 0} active)
          </h2>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>CONTAINER ID</th>
                  <th>NAME</th>
                  <th>IMAGE</th>
                  <th>STATUS</th>
                  <th>PORTS</th>
                  <th>CREATED AT</th>
                </tr>
              </thead>
              <tbody>
                {docker?.containers && docker.containers.length > 0 ? (
                  docker.containers.map(c => (
                    <tr key={c.id}>
                      <td className="mono-text">{c.id}</td>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td className="mono-text">{c.image}</td>
                      <td>
                        <span className={`badge ${c.status.includes('Up') || c.status.includes('running') ? 'running' : 'exited'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="mono-text">
                        {c.ports.length > 0 ? c.ports.join(', ') : 'None'}
                      </td>
                      <td className="mono-text">{c.created}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                      {docker?.docker_daemon === 'disconnected'
                        ? 'Docker connection disabled. Verify EC2 socket configuration.'
                        : 'No Docker containers found on system.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Row 3: Deployment Tracker */}
        <section className="glass-card col-4">
          <h2 className="card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 15V9a4 4 0 0 0-4-4H9" />
              <line x1="6" y1="9" x2="6" y2="15" />
            </svg>
            CI/CD Pipeline Details
          </h2>
          <div className="deploy-tracker">
            <div className="deploy-field">
              <span className="deploy-label">Latest Release</span>
              <span className="deploy-val success" style={{fontWeight: 700}}>{deployment?.status ? 'SUCCESSFUL' : 'STABLE'}</span>
            </div>
            <div className="deploy-field">
              <span className="deploy-label">Environment</span>
              <span className="deploy-val mono-text" style={{textTransform: 'uppercase'}}>{deployment?.environment ?? 'production'}</span>
            </div>
            <div className="deploy-field">
              <span className="deploy-label">Active Branch</span>
              <span className="deploy-val mono-text" style={{color: 'var(--accent-cyan)'}}>{deployment?.branch ?? 'main'}</span>
            </div>
            <div className="deploy-field">
              <span className="deploy-label">Commit Hash</span>
              <span className="deploy-val mono-text">{deployment?.commit_hash?.slice(0, 7) ?? 'Initial'}</span>
            </div>
            <div className="deploy-field">
              <span className="deploy-label">Commit Note</span>
              <span className="deploy-val" style={{maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right'}} title={deployment?.commit_message}>
                {deployment?.commit_message ?? 'Initial Setup'}
              </span>
            </div>
            <div className="deploy-field">
              <span className="deploy-label">Trigger Author</span>
              <span className="deploy-val">{deployment?.author ?? 'Administrator'}</span>
            </div>
            <div className="deploy-field">
              <span className="deploy-label">Last Deploy</span>
              <span className="deploy-val" style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{deployment?.last_deployment ?? 'Manual Setup'}</span>
            </div>
          </div>
        </section>

        {/* Row 3: Server Logs console */}
        <section className="glass-card col-8">
          <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
              Live Diagnostics Console
            </span>
            <input
              type="text"
              placeholder="Search / filter logs..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                width: '180px'
              }}
            />
          </h2>

          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="terminal-dot dot-red"></span>
                <span className="terminal-dot dot-yellow"></span>
                <span className="terminal-dot dot-green"></span>
              </div>
              <span className="terminal-title">gunicorn/flask@server.local:~/logs</span>
            </div>
            <div className="terminal-body">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((line, idx) => (
                  <div key={idx} className={getLineClass(line)}>
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                  No matching log entries.
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </section>

     </main>
    </div>
  );
}
export default App;
