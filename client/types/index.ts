export interface NodeData {
  id: string;
  type: 'repo' | 'contributor' | 'commit' | 'branch' | 'file';
  name: string;
  x?: number;
  y?: number;
  avatar?: string;
  contributions?: number;
  // Additional fields for future node types
  sha?: string; // for commits
  path?: string; // for files
  protected?: boolean; // for branches
  [key: string]: any; // Allow additional properties
}

export interface LinkData {
  id: string;
  source: string | NodeData;
  target: string | NodeData;
  type?: 'contribution' | 'commit' | 'branch' | 'dependency';
  strength?: number;
}

export interface ApiResponse {
  repo?: any;
  contributors?: any[];
  icon?: string | null;
  commits?: any[];
  branches?: any[];
  error?: string;
  options?: {
    contributorDelay?: number;
  };
}

export interface VisualizationContext {
  svg: any; // d3 selection
  container: any; // d3 selection  
  zoom: any; // d3 zoom behavior
  width: number;
  height: number;
}

export interface ResourceData {
  nodes: NodeData[];
  links: LinkData[];
}