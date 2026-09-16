import { BiWindow, BiMobileAlt, BiServer, BiData, BiNetworkChart, BiLayer, BiListUl, BiCog, BiCodeBlock, BiPulse, BiTransfer, BiCube } from 'react-icons/bi';
import type { IconType } from 'react-icons';

const specific: Record<string, IconType> = {
  'Web Browser': BiWindow, 'Mobile App': BiMobileAlt, 'Load Balancer': BiNetworkChart,
  'API Gateway': BiCodeBlock, 'Distributed Cache': BiLayer, 'Message Queue': BiListUl,
  'Worker (Async)': BiCog,
};
const categories: Record<string, IconType> = {
  client: BiWindow, traffic: BiNetworkChart, compute: BiServer, database: BiData,
  integration: BiTransfer, observability: BiPulse, group: BiLayer,
};
export function ComponentIcon({ type, category }: { type: string; category: string }) {
  const Icon = specific[type] ?? categories[category] ?? BiCube;
  return <Icon aria-hidden="true" />;
}
