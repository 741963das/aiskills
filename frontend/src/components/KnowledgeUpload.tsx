import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, File, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { knowledgeApi, type KnowledgeFile } from '../services/knowledgeApi';

interface Props {
  token: string;
  agentId?: number | null;
  files: KnowledgeFile[];
  onFilesChange: (files: KnowledgeFile[]) => void;
  showChunkParams?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
  onChunkParamsChange?: (chunkSize: number, chunkOverlap: number) => void;
  showSkipLink?: boolean;
  onSkip?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['.pdf', '.txt', '.md', '.docx'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (t === 'docx' || t === 'doc') return <FileText className="w-5 h-5 text-indigo-600" />;
  if (t === 'md') return <FileText className="w-5 h-5 text-indigo-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
}

function getStatusBadge(file: KnowledgeFile) {
  const status = file.status;
  const stageLabel = file.progress_stage_label || file.progress_stage;

  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-50 text-green-600 rounded-full font-medium">
        ✓ 已完成
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-50 text-red-600 rounded-full font-medium cursor-pointer"
        title={file.error_message || '处理失败'}
      >
        <AlertCircle className="w-3 h-3" />
        失败
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-50 text-amber-600 rounded-full font-medium">
      <Loader2 className="w-3 h-3 animate-spin" />
      {stageLabel}
    </span>
  );
}

function ProgressBar({ progress, stage }: { progress: number; stage: string }) {
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{stage}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function KnowledgeUpload({
  token,
  agentId,
  files,
  onFilesChange,
  showChunkParams = true,
  chunkSize: chunkSizeProp = 512,
  chunkOverlap: chunkOverlapProp = 50,
  onChunkParamsChange,
  showSkipLink = false,
  onSkip,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chunkSize, setChunkSize] = useState(chunkSizeProp);
  const [chunkOverlap, setChunkOverlap] = useState(chunkOverlapProp);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasProcessing = files.some((f) => f.status !== 'done' && f.status !== 'failed');

  useEffect(() => {
    if (!hasProcessing || !token || !agentId) return;
    const interval = setInterval(async () => {
      try {
        const updated = await knowledgeApi.list(token, agentId);
        onFilesChange(updated);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [hasProcessing, token, agentId, onFilesChange]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (!agentId) {
        setError('请先保存助手草稿后再上传文件');
        return;
      }
      const fileArray = Array.from(fileList);
      setError(null);

      const validFiles = fileArray.filter((file) => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_TYPES.includes(ext)) {
          setError(`「${file.name}」格式不支持，仅支持 PDF、TXT、MD、DOCX`);
          return false;
        }
        if (file.size > MAX_FILE_SIZE) {
          setError(`「${file.name}」超过 50MB 限制`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) return;

      setIsUploading(true);
      try {
        const newFiles: KnowledgeFile[] = [];
        for (const file of validFiles) {
          const result = await knowledgeApi.upload(token, file, agentId);
          newFiles.push(result);
        }
        onFilesChange([...files, ...newFiles]);
      } catch (err) {
        setError(err instanceof Error ? err.message : '文件上传失败');
      } finally {
        setIsUploading(false);
      }
    },
    [token, agentId, files, onFilesChange]
  );

  const handleDelete = async (fileId: number) => {
    if (!agentId) {
      setError('agentId 缺失，无法删除');
      return;
    }
    try {
      await knowledgeApi.delete(token, fileId, agentId);
      onFilesChange(files.filter((f) => f.id !== fileId));
    } catch {
      setError('删除失败');
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ' + (
          isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium mb-1">点击或拖拽上传文件</p>
        <p className="text-sm text-gray-400">支持 PDF、TXT、MD、DOCX 格式，单文件 ≤ 50MB</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {isUploading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-5 h-5 text-indigo-700 animate-spin" />
          <span className="ml-2 text-indigo-700 text-sm">正在上传...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 flex items-center justify-between">
            <span>已上传文件 ({files.length})</span>
            {hasProcessing && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                处理中，每 2 秒自动刷新
              </span>
            )}
          </h3>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {getFileIcon(file.file_type)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{file.filename}</p>
                      <p className="text-xs text-gray-500">
                        {file.file_type?.toUpperCase()} · {formatFileSize(file.file_size)}
                        {file.chunk_count > 0 && ` · ${file.chunk_count} 分块`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(file)}
                    {file.status === 'failed' && file.error_message && (
                      <span className="text-xs text-red-500 max-w-[200px] truncate" title={file.error_message}>
                        {file.error_message}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`确定删除「${file.filename}」吗？`)) {
                          handleDelete(file.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {file.status !== 'done' && file.status !== 'failed' && (
                  <ProgressBar
                    progress={file.progress || 0}
                    stage={file.progress_stage_label || file.progress_stage || '处理中'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showChunkParams && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">分块参数</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chunk Size（分块大小）</label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setChunkSize(v);
                  onChunkParamsChange?.(v, chunkOverlap);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Overlap（重叠大小）</label>
              <input
                type="number"
                value={chunkOverlap}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setChunkOverlap(v);
                  onChunkParamsChange?.(chunkSize, v);
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {showSkipLink && onSkip && (
        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-sm text-indigo-700 hover:text-indigo-800 underline"
          >
            跳过，稍后上传 →
          </button>
        </div>
      )}
    </div>
  );
}
