export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface BonfireInfo {
  id: string;
  name: string;
  taxonomy_labels?: string[];
  groups?: { label: string; group_id: string }[];
  latest_taxonomies?: {
    _id: string;
    name: string;
    description?: string;
    category?: string;
  }[];
}

export interface AgentInfo {
  id: string;
  agent_config_id?: string;
  username: string;
  name: string;
  is_active: boolean;
  bonfire_id: string;
}

export interface BonfireListResponse {
  bonfires: BonfireInfo[];
}

export interface BonfireAgentsResponse {
  bonfire_id: string;
  agents: AgentInfo[];
  total_agents: number;
  active_agents: number;
}

export interface AgentSelectionState {
  selectedBonfire: BonfireInfo | null;
  selectedAgent: AgentInfo | null;
  availableBonfires: BonfireInfo[];
  availableAgents: AgentInfo[];
  loading: { bonfires: boolean; agents: boolean };
  error: { bonfires?: string | null; agents?: string | null } | null;
}

export type GraphMode = "adaptive" | "static" | "dynamic" | "none";

export interface LangGraphChatRequest {
  message: string;
  chat_history?: ChatMessage[];
  agent_id: string;
  graph_mode?: GraphMode;
  center_node_uuid?: string;
  graph_id?: string;
  bonfire_id?: string;
}

/**
 * HTN (Hierarchical Task Network) curriculum phase
 */
export interface HTNPhase {
  id: string;
  name: string;
  order: number;
  completed: boolean;
}

/**
 * Current HTN phase with additional details
 */
export interface HTNCurrentPhase extends HTNPhase {
  description: string;
}

/**
 * HTN curriculum progress metrics
 */
export interface HTNProgress {
  completed_phases: number;
  total_phases: number;
  progress_percentage: number;
}

/**
 * Next HTN phase information
 */
export interface HTNNextPhase {
  id: string;
  name: string;
}

/**
 * Complete HTN status data structure
 */
export interface HTNStatus {
  enabled: boolean;
  graph_id: string;
  graph_hash: string;
  current_phase: HTNCurrentPhase;
  progress: HTNProgress;
  next_phase: HTNNextPhase | null;
  all_phases: HTNPhase[];
}

export interface LangGraphChatResponse {
  reply: string;
  graph_action: string;
  search_prompt?: string;
  graph_data?: any;
  graph_operation?: any;
  new_graph_id?: string;
  graph_id?: string;
  center_node_uuid?: string;
  agent_id?: string;
  htn_status?: HTNStatus;
  context?: Record<string, any>;
}

export interface DelveRequest {
  query: string;
  agent_config_id?: string;
  num_results?: number;
  center_node_uuid?: string;
  graph_id?: string;
}

export interface DelveResponse {
  success: boolean;
  query: string;
  entities?: Record<string, any>[];
  episodes?: Record<string, any>[];
  edges?: Record<string, any>[];
  nodes?: Record<string, any>[];
  metrics?: {
    entity_count?: number;
    episode_count?: number;
    edge_count?: number;
  };
}

export interface EpisodeInput {
  summary: string;
  content: string;
  window_start: string;
  window_end: string;
}

export interface KnowledgeGraphEpisodeUpdateRequest {
  bonfire_id: string;
  agent_id: string;
  episode: EpisodeInput;
}

export interface KnowledgeGraphEpisodeUpdateResponse {
  success: boolean;
  episode_uuid?: string;
  message?: string;
}

export interface PaymentMetadata {
  verified: boolean;
  settled: boolean;
  from_address?: string;
  facilitator?: string;
  tx_hash?: string;
  settlement_error?: string;
  microsub_active?: boolean;
  queries_remaining?: number;
  expires_at?: string;
  htn_generation_status?: "generating" | "ready" | "not_applicable" | "failed";
}

export interface PaidAgentChatRequest extends LangGraphChatRequest {
  payment_header?: string;
  tx_hash?: string;
  expected_amount?: string;
  query_limit?: number;
  expiration_days?: number;
}

export interface PaidDelveRequest extends DelveRequest {
  payment_header?: string;
  tx_hash?: string;
  expected_amount?: string;
  query_limit?: number;
  expiration_days?: number;
}

export interface PaidEpisodeUpdateRequest extends KnowledgeGraphEpisodeUpdateRequest {
  payment_header?: string;
  expected_amount?: string;
  query_limit?: number;
  expiration_days?: number;
}

export interface ChatResponseWithPayment extends LangGraphChatResponse {
  payment: PaymentMetadata;
}

export interface DelveResponseWithPayment extends DelveResponse {
  payment: PaymentMetadata;
}

export interface EpisodeUpdateResponseWithPayment extends KnowledgeGraphEpisodeUpdateResponse {
  payment: PaymentMetadata;
}

export interface MicrosubInfo {
  tx_hash: string;
  agent_id: string;
  query_limit: number;
  queries_remaining: number;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
  is_exhausted: boolean;
  // Optional fields - may not be present in backend response
  queries_used?: number;
  created_by_address?: string;
  is_valid?: boolean;
  // Data room configuration fields (optional)
  dataroom_id?: string;
  description?: string;
  center_node_uuid?: string;
  system_prompt?: string;
  bonfire_id?: string;
}

export interface MicrosubListResponse {
  microsubs: MicrosubInfo[];
  total_count: number;
  active_count: number;
}

export interface PreviewRequest {
  query: string;
  num_results?: number;
  agent_config_id?: string;
}

export interface DataRoomConfig {
  bonfireId: string;
  bonfire: BonfireInfo;
  description: string;
  systemPrompt?: string;
  centerNodeUuid: string;
  centerNodeName: string;
  priceUsd: number;
  queryLimit: number;
  expirationDays: number;
}

/**
 * Represents a marketplace listing for a data room
 * Matches backend DataRoomInfo DTO
 */
export interface DataRoomInfo {
  id: string;
  creator_id: string;
  bonfire_id: string;
  description: string;
  system_prompt?: string;
  center_node_uuid?: string;
  price_usd: number;
  query_limit: number;
  expiration_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Enriched fields
  creator_name?: string;
  creator_username?: string;
  bonfire_name?: string;
  agent_id?: string;
}

/**
 * Paginated response for marketplace listings
 */
export interface DataRoomListResponse {
  datarooms: DataRoomInfo[];
  count: number;
  limit: number;
  offset: number;
}

/**
 * Request payload for creating new marketplace listings
 */
export interface CreateDataRoomRequest {
  agent_id: string;
  bonfire_id: string;
  description: string;
  system_prompt: string; // Required by backend (can be empty string)
  center_node_uuid?: string;
  price_usd: number;
  query_limit: number;
  expiration_days: number;
}

/**
 * Contains fresh preview entities from a data room's bonfire
 */
export interface DataRoomPreviewResponse {
  entities: Record<string, any>[];
  episodes: Record<string, any>[];
  edges: Record<string, any>[];
  dataroom_id: string;
  description: string;
  num_results: number;
}

/**
 * Blog section structure
 */
export interface BlogSection {
  title: string;
  content: string;
  order: number;
  htn_node_id: string;
  word_count: number;
  sources?: string[];
}

/**
 * Blog content structure
 */
export interface BlogContent {
  sections: BlogSection[];
  metadata?: {
    total_words: number;
    generation_time_seconds: number;
    model: string;
    htn_graph_hash: string;
    user_query: string;
    dataroom_description: string;
    sections_generated: number;
    sections_failed?: number;
    failed_node_ids?: string[];
    generated_at: string;
  };
}

/**
 * HyperBlog information - AI-generated blog post from DataRoom knowledge graph
 */
export interface HyperBlogInfo {
  id: string;
  dataroom_id: string;
  user_query: string;
  generation_status: "generating" | "completed" | "failed";
  author_wallet: string;
  author_name?: string;
  author_username?: string;
  created_at: string;
  is_public: boolean;
  tx_hash: string | null;
  word_count: number | null;
  preview: string;
  blog_content?: BlogContent;
}

/**
 * Request to purchase and generate a HyperBlog
 */
export interface PurchaseHyperBlogRequest {
  payment_header: string;
  dataroom_id: string;
  user_query: string;
  is_public?: boolean;
  expected_amount?: string;
}

/**
 * Response from HyperBlog purchase endpoint
 */
export interface PurchaseHyperBlogResponse {
  hyperblog: HyperBlogInfo;
  payment: PaymentMetadata;
}

/**
 * Paginated list of HyperBlogs for a DataRoom
 */
export interface HyperBlogListResponse {
  hyperblogs: HyperBlogInfo[];
  count: number;
  dataroom_id: string;
  limit: number;
  offset: number;
}
