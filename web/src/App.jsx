import { useState } from 'react';
import './index.css';
import { MusicProvider } from './engine/MusicContext';
import SearchBar from './components/SearchBar/SearchBar';
import SearchResults from './components/SearchResults/SearchResults';
import Player from './components/Player/Player';
import Visualizer from './components/Visualizer/Visualizer';
import PlaylistManager from './components/PlaylistManager/PlaylistManager';
import { useMusic } from './engine/MusicContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { PlaylistProvider } from './contexts/PlaylistContext';

function TopNav() {
  const { isPlaying } = useMusic();
  const { theme, toggleTheme } = useTheme();
  return (
    <nav className="top-nav">
      <div className="logo">
        <div className="logo-icon">🎧</div>
        <span className="logo-name">SPATIAL X 8D</span>
        <span className="logo-badge">PERSONAL</span>
      </div>
      <div style={{ width: 180 }}>
        <Visualizer isPlaying={isPlaying} barCount={24} height={24} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            background: 'var(--bg-surface)',
            border: 'var(--glass-border)',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backdropFilter: 'var(--glass-blur)',
            transition: 'all 0.2s',
          }}
        >
          <span className="theme-btn-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="theme-btn-text">{theme === 'dark' ? ' Light Mode' : ' Dark Mode'}</span>
        </button>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }} className="status-indicator">
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isPlaying ? '#22c55e' : 'rgba(255,255,255,0.2)',
            display: 'inline-block',
            boxShadow: isPlaying ? '0 0 8px #22c55e' : 'none',
            transition: 'all 0.3s',
            flexShrink: 0,
          }} />
          <span className="status-text">{isPlaying ? 'PLAYING' : 'READY'}</span>
        </div>
      </div>
    </nav>
  );
}

function AppInner() {
  const { activeTab, setActiveTab } = useMusic();

  // On desktop, the sidebar shows either search or library.
  // If activeTab is 'player', we default the desktop sidebar to 'search'.
  const sidebarTab = activeTab === 'player' ? 'search' : activeTab;

  return (
    <div className={`app-layout active-tab-${activeTab}`}>
      <TopNav />
      <aside className="sidebar">
        {/* Sidebar Tabs (visible on desktop only) */}
        <div className="sidebar-tabs-desktop" style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 14px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setActiveTab('search')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '10px',
              background: sidebarTab === 'search' ? 'rgba(124,58,237,0.15)' : 'none',
              border: sidebarTab === 'search' ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              color: sidebarTab === 'search' ? 'var(--accent-bright)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔍 Search
          </button>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '10px',
              background: sidebarTab === 'library' ? 'rgba(124,58,237,0.15)' : 'none',
              border: sidebarTab === 'library' ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              color: sidebarTab === 'library' ? 'var(--accent-bright)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🎵 Library
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {sidebarTab === 'search' ? (
            <>
              <SearchBar />
              <SearchResults />
            </>
          ) : (
            <PlaylistManager />
          )}
        </div>
      </aside>
      
      <main className="main-content">
        <Player />
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="bottom-nav">
        <button
          onClick={() => setActiveTab('player')}
          className={activeTab === 'player' ? 'active' : ''}
        >
          <span className="nav-icon">💿</span>
          <span className="nav-label">Player</span>
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={activeTab === 'search' ? 'active' : ''}
        >
          <span className="nav-icon">🔍</span>
          <span className="nav-label">Search</span>
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={activeTab === 'library' ? 'active' : ''}
        >
          <span className="nav-icon">🎵</span>
          <span className="nav-label">Library</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PlaylistProvider>
        <div className="aurora-bg">
          <div className="aurora-blob" />
        </div>
        <MusicProvider>
          <AppInner />
        </MusicProvider>
      </PlaylistProvider>
    </ThemeProvider>
  );
}
