export interface PanelSection {
  title: string;
  type: "text" | "stats" | "content";
  data?: any;
}

export interface PanelContent {
  name: string; // Required for all nodes
  avatar?: string; // Optional avatar URL for contributors
  sections: PanelSection[];
}

export interface StatItem {
  label: string;
  value: string;
  icon: string;
}
