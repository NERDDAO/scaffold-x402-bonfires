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
}

export interface MicrosubListResponse {
  microsubs: MicrosubInfo[];
  total_count: number;
  active_count: number;
}
