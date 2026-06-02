/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Patient {
  id: number;
  name: string;
  bill_name?: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  priority: PriorityLevel;
  equipment: string;
  condition_desc: string;
  status: 'NORMAL' | 'OUTAGE_AFFECTED';
  notes?: string;
  created_at?: string;
}

export interface OutageReport {
  id: number;
  reporter_phone: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number; // radius in km
  status: 'PENDING' | 'RESOLVED';
  report_time: string;
  description: string;
}

export interface SystemStats {
  totalPatients: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  activeOutages: number;
  affectedPatientsCount: number;
}
