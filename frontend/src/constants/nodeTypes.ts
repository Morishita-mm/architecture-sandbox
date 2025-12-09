// frontend/src/constants/nodeTypes.ts

export type NodeTypeItem = {
  type: string; // 内部的な識別子としても使用可能
  label: string; // 表示ラベル
};

export type NodeCategory = {
  id: string;
  label: string;
  color: string;   // カテゴリのテーマカラー (ボーダーやアイコン用)
  bgColor: string; // ノードの背景色 (薄い色)
  items: NodeTypeItem[];
};

export const NODE_CATEGORIES: NodeCategory[] = [
  {
    id: 'client',
    label: 'Client / User',
    color: '#3b82f6', // Blue 500
    bgColor: '#eff6ff', // Blue 50
    items: [
      { type: 'Client', label: 'Client App' },
      { type: 'Mobile', label: 'Mobile App' },
      { type: 'Browser', label: 'Web Browser' },
    ]
  },
  {
    id: 'traffic',
    label: 'Entry & Traffic',
    color: '#8b5cf6', // Violet 500
    bgColor: '#f5f3ff', // Violet 50
    items: [
      { type: 'DNS', label: 'DNS (Route53)' },
      { type: 'CDN', label: 'CDN (CloudFront)' },
      { type: 'Load Balancer', label: 'Load Balancer' },
      { type: 'API Gateway', label: 'API Gateway' },
      { type: 'WAF', label: 'WAF (Firewall)' },
    ]
  },
  {
    id: 'compute',
    label: 'Compute',
    color: '#f97316', // Orange 500
    bgColor: '#fff7ed', // Orange 50
    items: [
      { type: 'Web Server', label: 'Web Server' },
      { type: 'App Server', label: 'App Server' },
      { type: 'Worker', label: 'Worker (Async)' },
      { type: 'Batch', label: 'Batch Job' },
      { type: 'Function', label: 'Serverless Func' },
    ]
  },
  {
    id: 'database',
    label: 'Data Store',
    color: '#10b981', // Emerald 500
    bgColor: '#ecfdf5', // Emerald 50
    items: [
      { type: 'RDBMS', label: 'RDBMS (SQL)' },
      { type: 'NoSQL (KV)', label: 'KVS (Redis)' },
      { type: 'NoSQL (Doc)', label: 'Document DB' },
      { type: 'NoSQL (Graph)', label: 'Graph DB' },
      { type: 'Object Storage', label: 'Object Storage' },
      { type: 'Search Engine', label: 'Search Engine' },
    ]
  },
  {
    id: 'integration',
    label: 'Integration & Flow',
    color: '#ec4899', // Pink 500
    bgColor: '#fdf2f8', // Pink 50
    items: [
      { type: 'Distributed Cache', label: 'Dist. Cache' },
      { type: 'Message Queue', label: 'Message Queue' },
      { type: 'Pub/Sub', label: 'Pub/Sub' },
      { type: 'Event Bus', label: 'Event Bus' },
    ]
  },
  {
    id: 'observability',
    label: 'Observability',
    color: '#64748b', // Slate 500
    bgColor: '#f1f5f9', // Slate 50
    items: [
      { type: 'Log Aggregator', label: 'Log Aggregator' },
      { type: 'Metrics Store', label: 'Metrics Store' },
      { type: 'Tracing', label: 'Dist. Tracer' },
      { type: 'Alert Manager', label: 'Alert Manager' },
      { type: 'Health Checker', label: 'Health Checker' },
    ]
  },
];