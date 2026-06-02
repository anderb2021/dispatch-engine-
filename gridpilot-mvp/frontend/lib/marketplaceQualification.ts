export type MarketplaceQualification = {
  zip_code?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  utility_provider?: string | null;
  state?: string | null;
  iso_rto?: string | null;
  pjm_zone?: string | null;
  vehicle_location_scope_granted?: boolean;
  charging_location_verified?: boolean;
  utility_verified?: boolean;
  marketplace_eligible?: boolean;
  needs_location_scope?: boolean;
  qualification_status?: string;
  recommended_next_action?: string;
  recommended_next_action_label?: string;
};

export type AdminMarketplaceSummary = {
  total_connected_users: number;
  vehicle_location_scope_enabled: number;
  missing_location_scope: number;
  zip_verified: number;
  utility_verified: number;
  marketplace_eligible: number;
  needs_verification: number;
  generatedAt?: string;
};

export type AdminMarketplaceUserRow = {
  user_id: string;
  name: string;
  vehicle: string;
  zip_code: string;
  utility_provider: string;
  pjm_zone: string;
  location_scope: string;
  location_verification: string;
  qualification_status: string;
  next_action: string;
  marketplace_eligible: boolean;
};

export const fallbackMarketplaceQualification: MarketplaceQualification = {
  zip_code: null,
  utility_provider: null,
  iso_rto: "PJM",
  vehicle_location_scope_granted: false,
  charging_location_verified: false,
  utility_verified: false,
  marketplace_eligible: false,
  needs_location_scope: true,
  qualification_status: "Needs ZIP",
  recommended_next_action: "add_zip",
  recommended_next_action_label: "Add ZIP",
};

export const fallbackAdminMarketplaceSummary: AdminMarketplaceSummary = {
  total_connected_users: 4,
  vehicle_location_scope_enabled: 1,
  missing_location_scope: 3,
  zip_verified: 2,
  utility_verified: 2,
  marketplace_eligible: 1,
  needs_verification: 3,
};

export const PJM_UTILITIES = [
  "PSE&G",
  "JCP&L",
  "Atlantic City Electric",
  "PECO",
  "PPL",
  "Met-Ed",
  "Penelec",
  "Duquesne Light",
  "West Penn Power",
  "Other PJM utility",
];
