export type UserRole = "client" | "member" | "admin";

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  member_id: number | null;
  is_verified: boolean;
  created_at: string;
}
