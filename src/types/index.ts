export type UserRole = 'platform_admin' | 'tenant_manager' | 'operations_officer' | 'meter_reader' | 'collection_officer' | 'maintenance_officer' | 'technician' | 'data_exception_officer' | 'viewer';

export interface Profile {
  id: string; email: string; full_name: string; role: UserRole;
  project_id: string | null; tenant_id: string | null; phone: string | null;
  must_change_password: boolean; created_at: string; updated_at: string;
}
