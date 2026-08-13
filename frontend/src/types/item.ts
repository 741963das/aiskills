export interface Item {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
}

export interface ItemCreate {
  title: string;
  description?: string | null;
}