import { API_BASE_URL } from './api';
import type { SkillFile, SkillFileCreateData, SkillFileUpdateData, SkillFileMarketplaceItem } from '../types/skillFile';

export const skillFileApi = {
  async getAll(token: string): Promise<SkillFile[]> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('获取技能文件列表失败');
    return res.json();
  },
  async getById(token: string, id: number): Promise<SkillFile> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('获取技能文件失败');
    return res.json();
  },
  async create(token: string, data: SkillFileCreateData): Promise<SkillFile> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('创建技能文件失败');
    return res.json();
  },
  async update(token: string, id: number, data: SkillFileUpdateData): Promise<SkillFile> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('更新技能文件失败');
    return res.json();
  },
  async delete(token: string, id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('删除技能文件失败');
  },
  async publish(token: string, id: number): Promise<SkillFile> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/${id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('发布技能文件失败');
    return res.json();
  },
  async download(token: string, id: number): Promise<SkillFile> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/${id}/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('下载技能文件失败');
    return res.json();
  },
  async getMarketplace(token: string, query?: { keyword?: string; page?: number; page_size?: number }): Promise<{ items: SkillFileMarketplaceItem[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.keyword) params.set('keyword', query.keyword);
    if (query?.page) params.set('page', String(query.page));
    if (query?.page_size) params.set('page_size', String(query.page_size));
    const res = await fetch(`${API_BASE_URL}/api/skill-files/marketplace?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('获取技能市场失败');
    return res.json();
  },
  async importFromGithub(token: string, rawUrl: string): Promise<SkillFile> {
    const res = await fetch(`${API_BASE_URL}/api/skill-files/import-github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ raw_url: rawUrl })
    });
    if (!res.ok) throw new Error('从GitHub导入失败');
    return res.json();
  },
  async mountToAgent(token: string, agentId: number, skillFileId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/agents/${agentId}/skills/mount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ skill_file_id: skillFileId })
    });
    if (!res.ok) throw new Error('挂载技能失败');
  },
  async unmountFromAgent(token: string, agentId: number, skillFileId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/agents/${agentId}/skills/unmount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ skill_file_id: skillFileId })
    });
    if (!res.ok) throw new Error('卸载技能失败');
  },
  async getAgentSkills(token: string, agentId: number): Promise<SkillFile[]> {
    const res = await fetch(`${API_BASE_URL}/api/agents/${agentId}/skills`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('获取已挂载技能失败');
    return res.json();
  }
};
