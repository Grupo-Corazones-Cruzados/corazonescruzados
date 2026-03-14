// =====================================================
// SHARED TYPES — Corazones Cruzados v2
// =====================================================

// ----- Auth & Users -----

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

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// ----- Members -----

export interface Member {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  position_id: number | null;
  position_name?: string;
  hourly_rate: number | null;
  is_active: boolean;
  is_blocked_from_projects: boolean;
  created_at: string;
}

// ----- Clients -----

export interface Client {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  created_at: string;
  updated_at: string;
}

// ----- Client-Member Associations -----

export interface ClientMember {
  id: number;
  client_id: number;
  member_id: number;
  source: string;
  created_at: string;
}

// ----- Positions -----

export interface Position {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ----- Services -----

export interface Service {
  id: number;
  position_id: number | null;
  name: string;
  description: string | null;
  base_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  position_name?: string;
}

// ----- Tickets -----

export type TicketStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "withdrawn";

export interface Ticket {
  id: number;
  user_id: string;
  service_id: number | null;
  member_id: number | null;
  client_id: number | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  deadline: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketTimeSlot {
  id: number;
  ticket_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  actual_duration: number | null;
  notes: string | null;
}

export interface TicketService {
  id: number;
  ticket_id: number;
  service_id: number | null;
  assigned_hours: number;
  hourly_cost: number;
  subtotal: number;
}

// ----- Projects -----

export type ProjectStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled"
  | "on_hold"
  | "closed";

export interface Project {
  id: number;
  client_id: number;
  assigned_member_id: number | null;
  title: string;
  description: string | null;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  status: ProjectStatus;
  is_private: boolean;
  share_token: string | null;
  cancellation_reason: string | null;
  final_cost: number | null;
  confirmed_at: string | null;
  completion_notified_at: string | null;
  review_deadline: string | null;
  penalty_applied: boolean;
  created_at: string;
  updated_at: string;
}

export type BidStatus = "invited" | "pending" | "accepted" | "rejected";

export type PaymentStatus = "pending" | "confirmed" | "rejected";

export interface ProjectPayment {
  id: number;
  project_id: number;
  amount: number;
  proof_url: string;
  status: PaymentStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  confirmer_email?: string;
}

export interface ProjectBid {
  id: number;
  project_id: number;
  member_id: number;
  proposal: string | null;
  bid_amount: number | null;
  estimated_days: number | null;
  requirement_ids: number[];
  work_dates: string[];
  status: BidStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectRequirement {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  cost: number | null;
  completed_at: string | null;
  updated_at: string;
}

export interface RequirementItem {
  id: number;
  requirement_id: number;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type AssignmentStatus = "proposed" | "counter" | "accepted" | "rejected";

export interface RequirementAssignment {
  id: number;
  requirement_id: number;
  project_id: number;
  member_id: number;
  proposed_cost: number;
  member_cost: number | null;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  member_name?: string;
  member_photo_url?: string | null;
  requirement_title?: string;
}

export interface ProjectCancellationVote {
  id: number;
  request_id: number;
  member_id: number;
  user_id: string;
  vote: "approve" | "reject";
  comment: string | null;
  created_at: string;
  member_name?: string;
  member_photo_url?: string | null;
}

// ----- Invoices -----

export type InvoiceStatus = "pending" | "sent" | "paid" | "cancelled";

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number | null;
  member_id: number | null;
  ticket_id: number | null;
  project_id: number | null;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  pdf_url: string | null;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// ----- Marketplace -----

export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: number;
  user_id: string;
  product_id: number;
  quantity: number;
  product?: Product;
}

export type OrderStatus =
  | "pending"
  | "pending_confirmation"
  | "awaiting_acceptance"
  | "awaiting_payment"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  id: number;
  user_id: string;
  total: number;
  status: OrderStatus;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  member_id: number | null;
  requires_confirmation: boolean;
  member_confirmed: boolean | null;
  member_message: string | null;
  delivery_date: string | null;
  member_responded_at: string | null;
  client_accepted: boolean | null;
  client_responded_at: string | null;
  // Joined fields
  product_name?: string;
  image_url?: string;
  member_name?: string;
  member_email?: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  user_name?: string;
  user_email?: string;
}

// ----- Recruitment -----

export type ApplicantStatus =
  | "applied"
  | "screening"
  | "interview"
  | "evaluation"
  | "accepted"
  | "rejected"
  | "withdrawn";

export interface Applicant {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  resume_url: string | null;
  status: ApplicantStatus;
  notes: string | null;
  source: string | null;
  created_at: string;
}

export type EventType = "interview" | "evaluation" | "orientation" | "training";

export interface RecruitmentEvent {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  type: EventType;
  max_capacity: number | null;
  created_by: string | null;
  created_at: string;
}

// ----- Modules -----

export interface Module {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  path: string | null;
  sort_order: number;
  requires_verification: boolean;
  allowed_roles: UserRole[];
}

// ----- Schedules -----

export interface MemberSchedule {
  id: number;
  member_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface ScheduleException {
  id: number;
  member_id: number;
  date: string;
  type: "blocked" | "available";
  reason: string | null;
  start_time: string | null;
  end_time: string | null;
}

// ----- CV & Portfolio -----

export interface MemberCvProfile {
  id: number;
  member_id: number;
  bio: string | null;
  skills: string[];
  education: Record<string, unknown>[];
  experience: Record<string, unknown>[];
  languages: string[];
  linkedin_url: string | null;
  website_url: string | null;
}

export interface PortfolioItem {
  id: number;
  member_id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  project_url: string | null;
  tags: string[];
  cost: number | null;
  allow_quantities: boolean;
  item_type: "project" | "product";
  sort_order: number;
  updated_at: string;
}

export interface PortfolioItemWithMember extends PortfolioItem {
  member_name: string;
  member_photo_url: string | null;
  member_position: string | null;
}

// ----- Public Views -----

export interface PublicMember {
  id: number;
  name: string;
  photo_url: string | null;
  position: string | null;
  hourly_rate: number | null;
  phone: string | null;
  bio: string | null;
  skills: string[];
}

// ----- Notifications -----

export type NotificationType =
  | "order_created"
  | "member_confirmed"
  | "client_accepted"
  | "project_invitation"
  | "project_confirmed"
  | "requirement_deleted"
  | "cancellation_requested"
  | "cancellation_vote"
  | "cancellation_resolved"
  | "project_all_completed"
  | "payment_submitted"
  | "payment_confirmed"
  | "member_penalty"
  | "member_blocked";

export interface Notification {
  id: number;
  created_at: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
}

// ----- Email Automation -----

export interface EmailList {
  id: number;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  contact_count?: number;
  categories?: string[];
}

export interface EmailContact {
  id: number;
  list_id: number;
  name: string;
  email: string;
  phone: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus = "draft" | "sending" | "sent" | "failed";

export interface EmailCampaign {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  signature_html: string | null;
  list_id: number | null;
  category_filter: string | null;
  status: CampaignStatus;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  created_by: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  list_name?: string;
}

export type EmailSendStatus = "pending" | "sent" | "failed" | "delivered" | "bounced";

export interface EmailSend {
  id: number;
  campaign_id: number;
  contact_id: number;
  status: EmailSendStatus;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  created_at: string;
  contact_name?: string;
  contact_email?: string;
}

// ----- API Helpers -----

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
