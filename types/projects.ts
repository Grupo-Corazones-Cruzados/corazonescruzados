export interface Subsection {
  id: string;
  name: string;
  description?: string;
}

export interface Section {
  id: string;
  name: string;
  description?: string;
  subsections: Subsection[];
}

export interface Module {
  id: string;
  name: string;
  description?: string;
  sections: Section[];
}

export interface ProjectStructure {
  id: string;
  agentId: string;
  name: string;
  modules: Module[];
}
