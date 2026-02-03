/**
 * Stores Index
 * Re-exports all stores for convenient importing
 */

export { appStore } from './app';
export type { AppState, User, ProjectConfig } from './app';

export { uiStore } from './ui';
export type { UIState, MainTab, SotView, DevTab, SelectedPerson } from './ui';

export { dataStore } from './data';
export type { 
  DataState, 
  Question, 
  Risk, 
  Action, 
  Decision, 
  Contact, 
  ChatMessage 
} from './data';

export { chartsStore } from './charts';
export type { ChartInstance, NetworkInstance, ChartsState } from './charts';

export { teamAnalysisStore } from './teamAnalysis';
export type { 
  TeamAnalysisState, 
  BehavioralProfile, 
  ProfileData,
  TeamAnalysis,
  BehavioralRelationship,
  GraphNode,
  GraphEdge
} from './teamAnalysis';
