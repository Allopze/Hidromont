export const overlayStyles = `
  [data-cms-entry] {
    cursor: crosshair;
    outline-offset: 4px;
  }
  [data-cms-entry]:hover {
    outline: 2px solid #0065A9;
    box-shadow: 0 0 0 4px rgba(0,101,169,0.2);
  }
  .hm-cms-shell {
    position: fixed;
    z-index: 99999;
    inset: 0;
    pointer-events: none;
    font-family: Inter, system-ui, sans-serif;
  }
  .hm-cms-bar {
    pointer-events: auto;
    position: fixed;
    left: 16px;
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #0F2433;
    color: white;
    border: 1px solid #D9E2EC;
    border-radius: 0px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.24);
  }
  .hm-cms-bar button,
  .hm-cms-panel button {
    border: 0;
    border-radius: 0px;
    padding: 9px 12px;
    min-height: 44px;
    min-width: 44px;
    font-weight: 700;
    background: #0065A9;
    color: #fff;
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .hm-cms-bar button:hover,
  .hm-cms-panel button:hover {
    background: #004B7D;
  }
  .hm-cms-bar button:focus-visible,
  .hm-cms-panel button:focus-visible {
    outline: 2px solid #00A6D6;
    outline-offset: 2px;
  }
  .hm-cms-bar button.secondary,
  .hm-cms-panel button.secondary {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }
  .hm-cms-bar button.secondary:hover,
  .hm-cms-panel button.secondary:hover {
    background: rgba(255,255,255,0.2);
  }
  .hm-cms-bar button.destructive,
  .hm-cms-panel button.destructive {
    background: #fee2e2;
    color: #991b1b;
  }
  .hm-cms-bar button.destructive:hover,
  .hm-cms-panel button.destructive:hover {
    background: #fecaca;
  }
  .hm-cms-panel {
    pointer-events: auto;
    position: fixed;
    top: 0;
    right: 0;
    width: min(420px, 100vw);
    height: 100dvh;
    background: #F5F8FA;
    color: #1F2933;
    border-left: 1px solid #D9E2EC;
    box-shadow: -20px 0 60px rgba(15,36,51,0.24);
    transform: translateX(104%);
    transition: transform 180ms ease;
    display: flex;
    flex-direction: column;
  }
  .hm-cms-panel.open {
    transform: translateX(0);
  }
  .hm-cms-panel header {
    padding: 18px;
    background: #0F2433;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .hm-cms-panel h2 {
    font-size: 16px;
    margin: 0;
  }
  .hm-cms-panel main {
    padding: 18px;
    overflow: auto;
    display: grid;
    gap: 14px;
  }
  .hm-cms-panel label {
    display: grid;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: #1F2933;
  }
  .hm-cms-panel input,
  .hm-cms-panel textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #D9E2EC;
    border-radius: 0px;
    padding: 10px;
    font: inherit;
    color: #1F2933;
    background: white;
  }
  .hm-cms-panel input:focus-visible,
  .hm-cms-panel textarea:focus-visible,
  .hm-cms-panel select:focus-visible {
    outline: 2px solid #0065A9;
    outline-offset: 0;
    border-color: #0065A9;
    box-shadow: 0 0 0 3px rgba(0,101,169,0.2);
  }
  .hm-cms-panel textarea {
    min-height: 150px;
    resize: vertical;
  }
  .hm-cms-error {
    color: #C62828;
    font-size: 13px;
  }
  .hm-cms-muted {
    color: #5B6770;
    font-size: 12px;
    line-height: 1.5;
  }
  .hm-cms-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  @keyframes hm-cms-spin {
    to { transform: rotate(360deg); }
  }
  .hm-cms-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: white;
    border-radius: 50%;
    animation: hm-cms-spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  button[data-loading] {
    opacity: 0.7;
    cursor: not-allowed;
    pointer-events: none;
  }
  .hm-cms-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 0px;
    padding: 3px 8px;
    background: #E6F2FA;
    color: #004B7D;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .hm-cms-badge.succeeded { background: #e8f5e9; color: #2E7D32; }
  .hm-cms-badge.failed { background: #ffebee; color: #C62828; }
  .hm-cms-badge.draft { background: #fef3c7; color: #92400e; }
  .hm-cms-badge.pending_review { background: #e0f2fe; color: #0369a1; }
  .hm-cms-badge.published { background: #dcfce7; color: #166534; }
  .hm-cms-media-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    max-height: 260px;
    overflow: auto;
    padding-right: 2px;
  }
  .hm-cms-media-item {
    display: grid;
    gap: 6px;
    border: 1px solid #cbd5e1;
    border-radius: 0px;
    padding: 6px;
    background: white;
    color: #172331;
    text-align: left;
    cursor: pointer;
  }
  .hm-cms-media-item:hover,
  .hm-cms-media-item.selected {
    border-color: #0065A9;
    box-shadow: 0 0 0 3px rgba(0,101,169,0.16);
  }
  .hm-cms-media-item img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 0px;
    background: #e2e8f0;
  }
  .hm-cms-gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .hm-cms-gallery-thumb {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 0px;
    border: 2px solid transparent;
    cursor: pointer;
    background: #e2e8f0;
  }
  .hm-cms-gallery-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .hm-cms-gallery-thumb:hover { border-color: #0065A9; }
  @media (max-width: 640px) {
    .hm-cms-bar {
      left: 8px;
      right: 8px;
      bottom: 8px;
      justify-content: space-between;
    }
    .hm-cms-panel {
      width: 100vw;
    }
  }
`;
