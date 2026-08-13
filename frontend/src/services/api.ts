import type { Item, ItemCreate } from '../types/item';

const API_BASE = '/api';

// 技能文件 API 使用的基础地址（空串表示同源相对路径，配合 Vite 代理转发到后端 /api）
export const API_BASE_URL = '';

export const api = {
  items: {
    getAll: async (): Promise<Item[]> => {
      const response = await fetch(`${API_BASE}/items/`);
      if (!response.ok) throw new Error('Failed to fetch items');
      return response.json();
    },

    getById: async (id: number): Promise<Item> => {
      const response = await fetch(`${API_BASE}/items/${id}`);
      if (!response.ok) throw new Error('Item not found');
      return response.json();
    },

    create: async (item: ItemCreate): Promise<Item> => {
      const response = await fetch(`${API_BASE}/items/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error('Failed to create item');
      return response.json();
    },

    update: async (id: number, item: ItemCreate): Promise<Item> => {
      const response = await fetch(`${API_BASE}/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error('Failed to update item');
      return response.json();
    },

    delete: async (id: number): Promise<Item> => {
      const response = await fetch(`${API_BASE}/items/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete item');
      return response.json();
    },
  },

  health: {
    check: async (): Promise<{ status: string }> => {
      const response = await fetch(`${API_BASE}/health`);
      if (!response.ok) throw new Error('Health check failed');
      return response.json();
    },
  },
};