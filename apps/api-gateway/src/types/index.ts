export interface User {
  user_id: string;
  email: string;
  password_hash: string | null;
  name: string;
  phone: string | null;
  role: 'user' | 'operator' | 'admin';
  meter_id: string | null;
  region: string | null;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ApiResponse<T = null> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}
