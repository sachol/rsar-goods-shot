
export type WorkMode = 'BACKGROUND' | 'MODEL';
export type PlacementType = 'PEOPLE' | 'PLACE';
export type BackgroundType = 'INDOOR' | 'OUTDOOR';

export interface AISuggestion {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

export interface GenerationHistory {
  id: string;
  originalImage: string;
  resultImage: string;
  mode: WorkMode;
  placementType?: PlacementType;
  backgroundType?: BackgroundType;
  styleTitle: string;
  createdAt: number;
}

export interface AnalysisResult {
  productType: string;
  suggestions: AISuggestion[];
}
