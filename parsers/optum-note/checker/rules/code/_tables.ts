export const ICD_BODY_MAP: Record<string, string[]> = {
  KNEE: ["M17", "M25.56", "M25.46", "M25.36", "M76.5", "M23", "M22"],
  SHOULDER: ["M25.51", "M75", "M79.61"],
  ELBOW: ["M25.52", "M77.0", "M77.1"],
  NECK: ["M54.2", "M54.6", "M47.81", "M50"],
  LBP: ["M54.5", "M54.4", "M54.3", "M47.8", "M51"],
  MID_LOW_BACK: ["M54.5", "M54.4", "M54.3", "M47.8", "M51", "M54.6"],
  UPPER_BACK: ["M54.6", "M54.2"],
  HIP: ["M25.55", "M16"],
};

export const LATERALITY_ICD_SUFFIX: Record<string, string[]> = {
  right: ["1", "91"],
  left: ["2", "92"],
  bilateral: ["3", "93"],
};

export const CPT_ESTIM = ["97813", "97814"];
export const CPT_NO_ESTIM = ["97810", "97811"];
