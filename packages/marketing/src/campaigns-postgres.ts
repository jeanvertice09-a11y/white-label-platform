import type {
  CampaignRepository,
  MarketingSqlExecutor,
} from "./repository.ts";
import {
  createCampaign,
  updateCampaign,
  cancelCampaign,
  prepareCampaign,
} from "./campaign-mutations.ts";
import {
  getCampaignById,
  getCampaignRecipientById,
  listCampaignPage,
} from "./campaign-query.ts";
import {
  listProviderBoundaryRecipients,
  recordMarketingConsent,
} from "./campaign-consent.ts";

export function createCampaignRepository(
  sql: MarketingSqlExecutor,
): CampaignRepository {
  return {
    listPage: (scope, query) => listCampaignPage(sql, scope, query),
    getById: (scope, id) => getCampaignById(sql, scope, id),
    getRecipientById: (scope, id) => getCampaignRecipientById(sql, scope, id),
    create: (scope, input, actorUserId = null) =>
      createCampaign(sql, scope, input, actorUserId),
    update: (scope, id, input, actorUserId = null) =>
      updateCampaign(sql, scope, id, input, actorUserId),
    cancel: (scope, id, actorUserId = null) =>
      cancelCampaign(sql, scope, id, actorUserId),
    prepare: (scope, id, actorUserId = null) =>
      prepareCampaign(sql, scope, id, actorUserId),
    recordConsent: (scope, input) =>
      recordMarketingConsent(sql, scope, input),
    listProviderBoundaryRecipients: (scope, campaignId, limit = 100) =>
      listProviderBoundaryRecipients(sql, scope, campaignId, limit),
  };
}
