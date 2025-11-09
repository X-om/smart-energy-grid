export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: Date;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertData {
  type: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  region?: string;
  meter_id?: string;
  message: string;
  metadata?: Record<string, unknown>;
}
export interface UpdateAlertData {
  status?: 'active' | 'acknowledged' | 'resolved';
  acknowledged?: boolean;
  acknowledged_by?: string;
  acknowledged_at?: Date;
  resolved_at?: Date;
  metadata?: Record<string, unknown>;
}

export interface AlertFilters {
  status?: string;
  type?: string;
  region?: string;
  meter_id?: string;
  acknowledged?: boolean;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}
