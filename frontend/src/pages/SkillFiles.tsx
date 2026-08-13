import { useState, useEffect, useCallback } from 'react';
import {
  Files, Plus, GitBranch, Loader2, AlertCircle, FileCode2, Edit3,
  Trash2, Rocket, Search, X, Check, Clock, Tag, Download,
} from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { skillFileApi } from '../services/skillFileApi';
import type { SkillFile, SkillFileCreateData, SkillFileUpdateData } from '../types/skillFile';

type ModalMode = 'create' | 'edit' | 'github' | 'delete' | null;

const SOURCE_LABELS: Record<string, { label: string; className: string }> = {
  manual: { label: '手动创建', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  github: { label: 'GitHub', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  marketplace: { label: '来自市场', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-600' },
  published: { label: '已发布', className: 'bg-green-50 text-green-700' },
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return '';
  }
};

export function SkillFiles() {
  const { token } = useAuth();
  const [files, setFiles] = useState<SkillFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  // 弹窗状态
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<SkillFile | null>(null);
  const [form, setForm] = useState<SkillFileCreateData>({ name: '', description: '', content: '' });
  const [githubUrl, setGitBranchUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await skillFileApi.getAll(token);
      setFiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载技能文件失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const filtered = keyword.trim()
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(keyword.toLowerCase()) ||
          (f.description || '').toLowerCase().includes(keyword.toLowerCase()),
      )
    : files;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', content: '' });
    setFormError(null);
    setModalMode('create');
  };

  const openEdit = (file: SkillFile) => {
    setEditing(file);
    setForm({ name: file.name, description: file.description || '', content: file.content });
    setFormError(null);
    setModalMode('edit');
  };

  const openGitBranch = () => {
    setGitBranchUrl('');
    setFormError(null);
    setModalMode('github');
  };

  const openDelete = (file: SkillFile) => {
    setEditing(file);
    setModalMode('delete');
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setEditing(null);
    setFormError(null);
  };

  const handleSubmitCreateEdit = async () => {
    if (!token) return;
    if (!form.name.trim()) {
      setFormError('请填写技能文件名称');
      return;
    }
    if (!form.content.trim()) {
      setFormError('请填写技能文件内容');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'edit' && editing) {
        const data: SkillFileUpdateData = {
          name: form.name.trim(),
          description: form.description?.trim() || '',
          content: form.content,
        };
        await skillFileApi.update(token, editing.id, data);
      } else {
        const data: SkillFileCreateData = {
          name: form.name.trim(),
          description: form.description?.trim() || '',
          content: form.content,
          source: 'manual',
        };
        await skillFileApi.create(token, data);
      }
      closeModal();
      loadFiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGitBranchImport = async () => {
    if (!token) return;
    if (!githubUrl.trim()) {
      setFormError('请填写 GitHub Raw URL');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await skillFileApi.importFromGithub(token, githubUrl.trim());
      closeModal();
      loadFiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (file: SkillFile) => {
    if (!token) return;
    try {
      await skillFileApi.publish(token, file.id);
      loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败');
    }
  };

  const handleDownload = async (file: SkillFile) => {
    if (!token) return;
    try {
      const data = await skillFileApi.download(token, file.id);
      const blob = new Blob([data.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '下载失败');
    }
  };

  const handleDelete = async () => {
    if (!token || !editing) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await skillFileApi.delete(token, editing.id);
      closeModal();
      loadFiles();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="flex flex-col h-[calc(100vh-48px)]">
        {/* 顶部标题 + 操作 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-700 rounded-lg flex items-center justify-center shadow-sm">
              <Files className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">技能文件管理</h1>
              <p className="text-xs text-gray-500 mt-0.5">管理可挂载到助手的技能（Markdown 片段），支持手动创建与 GitHub 导入</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openGitBranch}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <GitBranch className="w-4 h-4" />
              GitHub 导入
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              新建技能文件
            </button>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索名称或描述"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none bg-white"
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums">共 {filtered.length} 个文件</span>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                  <div className="h-5 bg-gray-100 rounded w-2/3 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                  <div className="flex gap-2">
                    <div className="h-7 bg-gray-100 rounded w-16" />
                    <div className="h-7 bg-gray-100 rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <FileCode2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                {keyword ? '没有匹配的技能文件' : '暂无技能文件'}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {keyword ? '尝试更换关键词' : '新建一个技能文件，或从 GitHub 导入'}
              </p>
              {!keyword && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    新建技能文件
                  </button>
                  <button
                    onClick={openGitBranch}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <GitBranch className="w-4 h-4" />
                    GitHub 导入
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((file) => {
                const source = SOURCE_LABELS[file.source] || SOURCE_LABELS.manual;
                const status = STATUS_LABELS[file.status] || STATUS_LABELS.draft;
                return (
                  <div
                    key={file.id}
                    className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col hover:shadow-md hover:border-indigo-100 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                          <FileCode2 className="w-4 h-4 text-indigo-700" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900 truncate" title={file.name}>
                          {file.name}
                        </h3>
                      </div>
                      <span className={'text-xs px-2 py-0.5 rounded-full border shrink-0 ' + status.className}>
                        {status.label}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 min-h-[32px] mb-3">
                      {file.description || '暂无描述'}
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={'text-xs px-2 py-0.5 rounded-full border ' + source.className}>
                        {source.label}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        v{file.version}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(file.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-auto pt-3 border-t border-gray-50 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(file)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        onClick={() => handleDownload(file)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        下载
                      </button>
                      {file.status === 'draft' ? (
                        <button
                          onClick={() => handlePublish(file)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Rocket className="w-3.5 h-3.5" />
                          发布
                        </button>
                      ) : null}
                      <button
                        onClick={() => openDelete(file)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 创建/编辑 弹窗 */}
      {modalMode === 'create' || modalMode === 'edit' ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-800 to-indigo-700 text-white shrink-0">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-5 h-5" />
                <h2 className="text-base font-semibold">
                  {modalMode === 'edit' ? '编辑技能文件' : '新建技能文件'}
                </h2>
              </div>
              <button onClick={closeModal} className="p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：React 组件设计规范"
                  className="input-field"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
                <input
                  type="text"
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="简要描述这个技能文件的用途"
                  className="input-field"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  内容（Markdown） <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="# 标题&#10;&#10;在此编写技能内容，支持 Markdown 语法..."
                  rows={12}
                  className="input-field font-mono text-sm resize-y"
                  disabled={submitting}
                  style={{ minHeight: '260px' }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  字数：{form.content.length}
                </p>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 shrink-0">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSubmitCreateEdit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {modalMode === 'edit' ? '保存修改' : '创建'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* GitHub 导入 弹窗 */}
      {modalMode === 'github' ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-800 to-gray-700 text-white">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                <h2 className="text-base font-semibold">从 GitHub 导入</h2>
              </div>
              <button onClick={closeModal} className="p-1 hover:bg-white/20 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-500">
                填写 GitHub 文件的 Raw URL，系统将拉取内容并创建技能文件。
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Raw URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGitBranchUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/user/repo/branch/path/to/file.md"
                  className="input-field font-mono text-sm"
                  disabled={submitting}
                />
                <p className="text-xs text-gray-400 mt-1">
                  支持 .md / .markdown / .txt 等文本文件
                </p>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleGitBranchImport}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                导入
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 删除确认 弹窗 */}
      {modalMode === 'delete' && editing ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-xl mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">确认删除？</h3>
              <p className="text-sm text-gray-500 text-center mb-1">
                将删除技能文件「<span className="font-medium text-gray-700">{editing.name}</span>」
              </p>
              <p className="text-xs text-gray-400 text-center mb-5">此操作不可撤销</p>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TeacherLayout>
  );
}
