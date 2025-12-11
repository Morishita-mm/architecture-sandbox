import defs from "./architecture_defs.json";
import { CustomNode } from "../components/CustomNode";
import { GroupNode } from "../components/GroupNode";

export type NodeTypeItem = {
  type: string;
  label: string;
};

export type NodeCategory = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  items: NodeTypeItem[];
};

export const NODE_CATEGORIES: NodeCategory[] = defs.categories;

export const nodeTypes = {
  custom: CustomNode,
  group: GroupNode,
};
