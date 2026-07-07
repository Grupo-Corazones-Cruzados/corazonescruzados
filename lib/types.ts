export type UserRole = "client" | "member" | "admin";

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: UserRole;
  /** Para role='client': distingue 'candidate' (postulante) de 'client' (cliente). */
  account_type: 'candidate' | 'client' | null;
  member_id: number | null;
  is_verified: boolean;
  created_at: string;
  youtube_handle: string | null;
  tiktok_handle: string | null;
  instagram_handle: string | null;
  facebook_handle: string | null;
}
