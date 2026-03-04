import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../App';
import { t, getText } from '../i18n';
import type { NavItem } from '../types';
import { navigationData, toolNavigationData } from '../data/navigation';
import { webPayloads } from '../data/webPayloads';
import { intranetPayloads } from '../data/intranetPayloads';
import { toolCommands } from '../data/toolCommands';

interface TreeNodeProps {
  item: NavItem;
  level: number;
  matchedIds: Set<string>;
  forceExpand: boolean;
  expandLevel: ExpandLevel;
}

function TreeNode({ item, level, matchedIds, forceExpand, expandLevel }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    // 初始展开状态根据 expandLevel 决定
    if (expandLevel === 'collapsed') return false;
    if (expandLevel === 'level1') return level === 0;
    if (expandLevel === 'level2') return level <= 1;
    return true;
  });

  // 监听 expandLevel 变化，更新展开状态
  useEffect(() => {
    if (expandLevel === 'collapsed') {
      setIsExpanded(false);
    } else if (expandLevel === 'web-expanded') {
      // 只展开 Web应用攻防 一级分类，子分类保持折叠
      setIsExpanded(level === 0 && item.id === 'web');
    } else if (expandLevel === 'intranet-expanded') {
      // 只展开内网渗透与横向移动一级分类，子分类保持折叠
      setIsExpanded(level === 0 && item.id === 'intranet');
    } else {
      setIsExpanded(true);
    }
  }, [expandLevel, item.id, level]);

  const { selectedPayloadId, setSelectedPayloadId, selectedToolId, setSelectedToolId, language } = useAppContext();

  const hasChildren = item.children && item.children.length > 0;
  const isSelected = item.payloadId === selectedPayloadId || item.toolId === selectedToolId;

  // Check if this node or any descendant matches the search
  const isMatched = matchedIds.has(item.payloadId || item.toolId || '');
  const hasMatchedDescendant = hasChildren && hasDescendantMatch(item, matchedIds);

  // Auto-expand when searching or based on expandLevel
  let effectiveExpanded = isExpanded;
  if (forceExpand) {
    effectiveExpanded = hasMatchedDescendant || isMatched;
  }

  // 在 web-expanded 或 intranet-expanded 模式下，强制收起子节点
  if ((expandLevel === 'web-expanded' || expandLevel === 'intranet-expanded') && level > 0) {
    effectiveExpanded = false;
  }

  if (forceExpand && !isMatched && !hasMatchedDescendant && !hasChildren) {
    return null;
  }

  if (forceExpand && hasChildren && !hasMatchedDescendant) {
    return null;
  }

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    } else if (item.payloadId) {
      setSelectedPayloadId(item.payloadId);
      setSelectedToolId(null);
    } else if (item.toolId) {
      setSelectedToolId(item.toolId);
      setSelectedPayloadId(null);
    }
  };

  return (
    <div className="tree-node">
      <div 
        className={`tree-item ${isSelected ? 'selected' : ''} ${hasChildren ? 'has-children' : ''} ${isMatched && forceExpand ? 'search-match' : ''}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleClick}
      >
        {hasChildren && (
          <span className={`tree-expand-icon ${effectiveExpanded ? 'expanded' : ''}`}>
            ▶
          </span>
        )}
        {!hasChildren && <span className="tree-leaf-spacer" />}
        <span className="tree-label">{getText(item.name, language)}</span>
        {(item.payloadId || item.toolId) && (
          <span className="tree-badge">
            {item.payloadId ? '💀' : '🛠️'}
          </span>
        )}
      </div>
      {hasChildren && effectiveExpanded && (
        <div className="tree-children">
          {item.children!.map(child => (
            <TreeNode key={child.id} item={child} level={level + 1} matchedIds={matchedIds} forceExpand={forceExpand} expandLevel={expandLevel} />
          ))}
        </div>
      )}
    </div>
  );
}

function hasDescendantMatch(item: NavItem, matchedIds: Set<string>): boolean {
  if (!item.children) return false;
  for (const child of item.children) {
    if (matchedIds.has(child.payloadId || child.toolId || '')) return true;
    if (hasDescendantMatch(child, matchedIds)) return true;
  }
  return false;
}

interface SidebarProps {
  collapsed: boolean;
}

type ExpandLevel = 'collapsed' | 'web-expanded' | 'intranet-expanded' | 'all';

function Sidebar({ collapsed }: SidebarProps) {
  const { activeTab, searchQuery, language } = useAppContext();
  const [expandLevel, setExpandLevel] = useState<ExpandLevel>('level2');
  const data = activeTab === 'payloads' ? navigationData : toolNavigationData;

  // Compute matched IDs based on search query
  const { matchedIds, matchCount } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return { matchedIds: new Set<string>(), matchCount: 0 };

    const ids = new Set<string>();

    if (activeTab === 'payloads') {
      const allPayloads = [...webPayloads, ...intranetPayloads];
      for (const p of allPayloads) {
        const searchable = [
          getText(p.name, language), getText(p.description, language), getText(p.category, language), getText(p.subCategory, language),
          ...p.tags,
          ...(p.prerequisites || []).map(pr => getText(pr, language)),
        ].join(' ').toLowerCase();
        if (searchable.includes(query)) {
          ids.add(p.id);
        }
      }
    } else {
      for (const tc of toolCommands) {
        const searchable = [
          getText(tc.name, language), getText(tc.description, language), getText(tc.category, language),
          ...tc.commands.map(c => getText(c.name, language) + ' ' + getText(c.description, language)),
        ].join(' ').toLowerCase();
        if (searchable.includes(query)) {
          ids.add(tc.id);
        }
      }
    }

    return { matchedIds: ids, matchCount: ids.size };
  }, [searchQuery, activeTab, language]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-content">
        <div className="sidebar-header">
          <h2>{activeTab === 'payloads' ? t('sidebar.attackCategories', language) : t('sidebar.toolCategories', language)}</h2>
          {isSearching && (
            <span className="search-result-count">
              {t('sidebar.searchFound', language, { count: matchCount })}
            </span>
          )}
        </div>
        <div className="tree-container">
          {!isSearching && activeTab === 'payloads' && (
            <div className="expand-controls">
              <button
                className={`expand-btn ${expandLevel === 'collapsed' ? 'active' : ''}`}
                onClick={() => setExpandLevel('collapsed')}
                title="全部收起"
              >
                ◀
              </button>
              <button
                className={`expand-btn ${expandLevel === 'web-expanded' ? 'active' : ''}`}
                onClick={() => setExpandLevel('web-expanded')}
                title="展开Web应用攻防"
              >
                Web
              </button>
              <button
                className={`expand-btn ${expandLevel === 'intranet-expanded' ? 'active' : ''}`}
                onClick={() => setExpandLevel('intranet-expanded')}
                title="展开内网渗透与横向移动"
              >
                内网
              </button>
              <button
                className={`expand-btn ${expandLevel === 'all' ? 'active' : ''}`}
                onClick={() => setExpandLevel('all')}
                title="全部展开"
              >
                ▶
              </button>
            </div>
          )}
          {isSearching && matchCount === 0 ? (
            <div className="no-search-results">
              <span className="no-results-icon">🔍</span>
              <p>{t('sidebar.noResults', language)}</p>
              <span className="no-results-hint">{t('sidebar.noResultsHint', language)}</span>
            </div>
          ) : (
            data.map(item => (
              <TreeNode key={item.id} item={item} level={0} matchedIds={matchedIds} forceExpand={isSearching} expandLevel={expandLevel} />
            ))
          )}
        </div>
      </div>

      <style>{`
        .sidebar {
          width: 280px;
          height: calc(100vh - 60px);
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          transition: width var(--transition-normal);
          overflow: hidden;
          position: relative;
        }

        .sidebar::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 1px;
          height: 100%;
          background: linear-gradient(180deg, var(--neon-cyan), transparent);
          opacity: 0.3;
        }

        .sidebar.collapsed {
          width: 0;
        }

        .sidebar-content {
          width: 280px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-header h2 {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--text-muted);
        }

        .search-result-count {
          font-size: 11px;
          color: var(--neon-green);
          font-weight: 500;
        }

        .tree-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .expand-controls {
          display: flex;
          gap: 4px;
          padding: 8px 16px;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
        }

        .expand-btn {
          flex: 1;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }

        .expand-btn:hover {
          border-color: var(--neon-cyan);
          color: var(--neon-cyan);
        }

        .expand-btn.active {
          background: rgba(0, 240, 255, 0.1);
          border-color: var(--neon-cyan);
          color: var(--neon-cyan);
          box-shadow: 0 0 8px rgba(0, 240, 255, 0.2);
        }

        .no-search-results {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          text-align: center;
        }

        .no-results-icon {
          font-size: 32px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .no-search-results p {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .no-results-hint {
          font-size: 11px;
          color: var(--text-muted);
          opacity: 0.7;
        }

        .tree-node {
          user-select: none;
        }

        .tree-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          transition: all var(--transition-fast);
          border-left: 2px solid transparent;
        }

        .tree-item:hover {
          background: var(--bg-hover);
        }

        .tree-item.selected {
          background: rgba(0, 240, 255, 0.1);
          border-left-color: var(--neon-cyan);
        }

        .tree-item.selected .tree-label {
          color: var(--neon-cyan);
        }

        .tree-item.search-match {
          background: rgba(0, 255, 136, 0.08);
          border-left-color: var(--neon-green);
        }

        .tree-item.search-match .tree-label {
          color: var(--neon-green);
          font-weight: 600;
        }

        .tree-expand-icon {
          width: 16px;
          font-size: 8px;
          color: var(--text-muted);
          transition: transform var(--transition-fast);
          margin-right: 4px;
        }

        .tree-expand-icon.expanded {
          transform: rotate(90deg);
        }

        .tree-leaf-spacer {
          width: 20px;
        }

        .tree-label {
          flex: 1;
          font-size: 13px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tree-item:hover .tree-label {
          color: var(--text-primary);
        }

        .tree-badge {
          font-size: 12px;
          opacity: 0.7;
        }

        .tree-children {
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </aside>
  );
}

export default Sidebar;
