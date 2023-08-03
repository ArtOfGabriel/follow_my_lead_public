interface Window {
  $fx: {
    hash: string;
    rand(): () => number;
    preview: () => void;
    isPreview: boolean;
    features: (features: Record<string, any>) => void;
    getFeatures: () => Record<string, any>;
  };
}
