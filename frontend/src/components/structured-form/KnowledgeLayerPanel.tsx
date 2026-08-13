import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Brain, Lightbulb, MessagesSquare, BarChart3,
  Trash2, RefreshCw, Download, Loader2, Sparkles, AlertCircle,
} from 'lucide-react';
import { agentApi } from '../../services/agentApi';

interface LayerDef {
  key: string;
  apiLayer: string;
  title: string;
  desc: string;
  icon: typeof BookOpen;
  listField: string;
  accent: string;
}

const LAYER_DEFS: LayerDef[] = [
  { key: 'knowledge_layer', apiLayer: 'knowledge', title: 'L1 知识体系', desc: '学科知识结构', icon: BookOpen, listField: 'topics', accent: '#4338CA' },
  { key: 'diagnosis_layer', apiLayer: 'diagnosis', title: 'L2 学生诊断', desc: '判断学生问题', icon: Brain, listField: 'pain_points', accent: '#0891B2' },
  { key: 'strategy_layer', apiLayer: 'strategy', title: 'L3 教学策略', desc: '教学决策逻辑', icon: Lightbulb, listField: 'strategies', accent: '#4338CA' },
  { key: 'interaction_layer', apiLayer: 'interaction', title: 'L4 课堂交互', desc: '沟通引导方法', icon: MessagesSquare, listField: 'question_templates', accent: '#0891B2' },
  { key: 'feedback_layer', apiLayer: 'feedback', title: 'L5 效果反馈', desc: '方法效果验证', icon: BarChart3, listField: 'feedback_records', accent: '#4338CA' },
];

interface KnowledgeLayerPanelProps {
  token: string;
  agentId: number;
  agentName: string;
}

export function KnowledgeLayerPanel({ token, agentId, agentName }: KnowledgeLayerPanelProps) {
  const [fiveLayer, setFiveLayer] = useState<Record<string, Record<string, unknown>[]>>({});
  const [stats, setStats] = useState<Record<string, number>>({});
  const [activeLayer, setActiveLayer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await agentApi.getFiveLayerKnowledge(token, agentId);
      setFiveLayer(result.five_layer as Record<string, Record<string, unknown>[]>);
      setStats(result.stats);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [token, agentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentDef = LAYER_DEFS[activeLayer];
  const currentLayerData = (fiveLayer[currentDef.key] || {}) as unknown as Record<string, unknown>;
  const entries = (currentLayerData[currentDef.listField] as unknown[]) || [];

  const handleExtract = async () => {
    setExtracting(true);
    setMessage(null);
    try {
      const result = await agentApi.extractKnowledge(token, agentId, []);
      setMessage({ type: 'success', text: result.message });
      await fetchData();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '提取失败' });
    } finally {
      setExtracting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      await agentApi.exportTeachingStrategy(token, agentId);
      setMessage({ type: 'success', text: '已导出为技能包，可在技能文件中查看' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '导出失败' });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (index: number) => {
    setDeletingIndex(index);
    try {
      await agentApi.deleteFiveLayerEntry(token, agentId, currentDef.apiLayer, index);
      await fetchData();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : '删除失败' });
    } finally {
      setDeletingIndex(null);
    }
  };

  const totalCount = LAYER_DEFS.reduce((sum, d) => sum + (stats[d.key] || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部统计概览 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4338CA] to-[#312E81] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-indigo-950">五层经验沉淀</h3>
            <p className="text-xs text-gray-500">{agentName} · 共 {totalCount} 条沉淀</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#4338CA] border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            提取知识点
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#4338CA] hover:bg-[#312E81] rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            导出技能包
          </button>
        </div>
      </div>

      {message && (
        <div className={'mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ' + (
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
        )}>
          {message.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* 左侧：五层垂直导航 */}
        <div className="w-48 shrink-0 flex flex-col gap-1.5">
          {LAYER_DEFS.map((def, idx) => {
            const Icon = def.icon;
            const count = stats[def.key] || 0;
            const active = idx === activeLayer;
            return (
              <button
                key={def.key}
                onClick={() => setActiveLayer(idx)}
                className={'text-left p-3 rounded-lg border transition-all duration-200 cursor-pointer ' + (
                  active
                    ? 'bg-indigo-50 border-[#4338CA] shadow-sm'
                    : 'bg-white border-gray-100 hover:border-indigo-200'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={'w-3.5 h-3.5 ' + (active ? 'text-[#4338CA]' : 'text-gray-400')} />
                    <span className={'text-xs font-semibold ' + (active ? 'text-[#4338CA]' : 'text-gray-700')}>{def.title}</span>
                  </div>
                  <span className={'text-xs font-bold px-1.5 py-0.5 rounded ' + (
                    count > 0 ? 'bg-[#4338CA] text-white' : 'bg-gray-100 text-gray-400'
                  )}>
                    {count}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{def.desc}</p>
              </button>
            );
          })}
        </div>

        {/* 右侧：当前层次条目列表 */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-4 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <currentDef.icon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 mb-1">暂无{currentDef.title}数据</p>
                <p className="text-xs text-gray-400">与助手对话时自动提取，或点击"提取知识点"从上传文件中手动提取</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <EntryCard
                  key={idx}
                  entry={entry as Record<string, unknown>}
                  layerKey={currentDef.apiLayer}
                  index={idx}
                  onDelete={handleDelete}
                  deleting={deletingIndex === idx}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EntryCardProps {
  entry: Record<string, unknown>;
  layerKey: string;
  index: number;
  onDelete: (index: number) => void;
  deleting: boolean;
}

function EntryCard({ entry, layerKey, index, onDelete, deleting }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const renderContent = () => {
    switch (layerKey) {
      case 'knowledge': {
        const keyPoints = (entry.key_points as string[]) || [];
        const difficulties = (entry.difficulties as Array<Record<string, string>>) || [];
        return (
          <>
            <div className="text-xs text-gray-500 mt-1">
              章节：{(entry.chapter as string) || '未分类'}
            </div>
            {keyPoints.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {keyPoints.slice(0, 4).map((kp, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 bg-indigo-50 text-[#4338CA] rounded">{kp}</span>
                ))}
              </div>
            )}
            {expanded && difficulties.length > 0 && (
              <div className="mt-2 space-y-1">
                {difficulties.map((d, i) => (
                  <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded p-1.5">
                    难点：{d.point} — {d.reason}
                  </div>
                ))}
              </div>
            )}
          </>
        );
      }
      case 'diagnosis': {
        return (
          <>
            <div className="text-xs text-gray-500 mt-1">表现：{(entry.surface_error as string) || ''}</div>
            {expanded && (
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <div>诊断：{(entry.teacher_diagnosis as string) || ''}</div>
                <div>原因：{(entry.root_cause as string) || ''}</div>
                <div className="text-[#4338CA]">对策：{(entry.solution as string) || ''}</div>
              </div>
            )}
          </>
        );
      }
      case 'strategy': {
        const steps = (entry.steps as string[]) || [];
        return (
          <>
            <div className="text-xs text-gray-500 mt-1">方法：{(entry.method as string) || ''}</div>
            {expanded && (
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <div>理由：{(entry.reasoning as string) || ''}</div>
                {steps.length > 0 && (
                  <div>步骤：{steps.join(' → ')}</div>
                )}
              </div>
            )}
          </>
        );
      }
      case 'interaction': {
        const steps = (entry.steps as string[]) || [];
        return (
          <>
            <div className="text-xs text-gray-500 mt-1">
              {(entry.prompt as string) || (entry.trigger as string) || ''}
            </div>
            {expanded && steps.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">流程：{steps.join(' → ')}</div>
            )}
          </>
        );
      }
      case 'feedback': {
        return (
          <>
            <div className="text-xs text-gray-500 mt-1">应用场景：{(entry.applied_in as string) || ''}</div>
            {expanded && (
              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <div>效果：{(entry.effectiveness as string) || ''}</div>
                <div className="text-[#4338CA]">优化：{(entry.optimization as string) || ''}</div>
              </div>
            )}
          </>
        );
      }
      default:
        return null;
    }
  };

  const hasDetail = layerKey === 'knowledge'
    ? ((entry.difficulties as unknown[]) || []).length > 0
    : layerKey === 'diagnosis'
      ? !!(entry.teacher_diagnosis || entry.root_cause)
      : layerKey === 'strategy'
        ? ((entry.steps as unknown[]) || []).length > 0 || !!entry.reasoning
        : layerKey === 'interaction'
          ? ((entry.steps as unknown[]) || []).length > 0
          : !!entry.effectiveness || !!entry.optimization;

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:border-indigo-200 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium text-indigo-950 cursor-pointer"
            onClick={() => hasDetail && setExpanded(!expanded)}
          >
            {(entry.name as string) || (entry.topic as string) || (entry.goal as string) || (entry.scenario as string) || (entry.pattern as string) || `条目 ${index + 1}`}
            {hasDetail && <span className="ml-1 text-xs text-gray-400">{expanded ? '收起' : '展开'}</span>}
          </div>
          {renderContent()}
        </div>
        <button
          onClick={() => onDelete(index)}
          disabled={deleting}
          className="ml-2 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0"
          title="删除此条目"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
