export interface MeasureGridConfig {
  trackStart: number;
  trackCount: number;
  measureStart: number;
  measureCount: number;
}

export function getVisibleTracks(config: MeasureGridConfig): number[] {
  return Array.from({ length: config.trackCount }, (_, index) => config.trackStart + index);
}

export function getVisibleMeasures(config: MeasureGridConfig): number[] {
  return Array.from(
    { length: config.measureCount },
    (_, index) => config.measureStart + index
  );
}

export function expandMeasureGridConfigToInclude(
  config: MeasureGridConfig,
  track: number,
  measure: number,
  limits: { maxTrackCount: number; maxMeasureCount: number }
): MeasureGridConfig | null {
  let nextConfig = config;

  if (track < nextConfig.trackStart) {
    const expandedTrackCount = nextConfig.trackCount + (nextConfig.trackStart - track);
    if (expandedTrackCount > limits.maxTrackCount) {
      return null;
    }

    nextConfig = {
      ...nextConfig,
      trackCount: expandedTrackCount,
      trackStart: track,
    };
  } else if (track >= nextConfig.trackStart + nextConfig.trackCount) {
    const expandedTrackCount = track - nextConfig.trackStart + 1;
    if (expandedTrackCount > limits.maxTrackCount) {
      return null;
    }

    nextConfig = {
      ...nextConfig,
      trackCount: expandedTrackCount,
    };
  }

  if (measure < nextConfig.measureStart) {
    const expandedMeasureCount =
      nextConfig.measureCount + (nextConfig.measureStart - measure);
    if (expandedMeasureCount > limits.maxMeasureCount) {
      return null;
    }

    nextConfig = {
      ...nextConfig,
      measureCount: expandedMeasureCount,
      measureStart: measure,
    };
  } else if (measure >= nextConfig.measureStart + nextConfig.measureCount) {
    const expandedMeasureCount = measure - nextConfig.measureStart + 1;
    if (expandedMeasureCount > limits.maxMeasureCount) {
      return null;
    }

    nextConfig = {
      ...nextConfig,
      measureCount: expandedMeasureCount,
    };
  }

  return nextConfig;
}
