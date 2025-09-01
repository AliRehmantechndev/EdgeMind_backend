// Utility function to serialize objects containing BigInt values to JSON-safe format
export const serializeDataset = (dataset: any) => {
  return {
    ...dataset,
    totalSize: typeof dataset.totalSize === 'bigint' ? Number(dataset.totalSize) : dataset.totalSize
  };
};

export const serializeDatasets = (datasets: any[]) => {
  return datasets.map(serializeDataset);
};

export const serializeStats = (stats: any) => {
  return {
    ...stats,
    totalSize: typeof stats.totalSize === 'bigint' ? Number(stats.totalSize) : stats.totalSize
  };
};
