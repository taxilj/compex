import { env } from "../../../config/env.js";
import { Errors } from "../../../lib/errors.js";
import { cacheGet, cacheSet } from "../../../lib/cache.js";
import type { CatalogFetcher, RawCatalogItem } from "../types.js";
import { normalizeMpn } from "../normalizer.js";
import { nexarGraphQL } from "./nexar-client.js";
import { mapNexarInternalOffers, mapNexarPart, type NexarPart, type NexarSearchMpnResult } from "./nexar-mapper.js";

// Exact-MPN lookup only for V1 (Phase 9: "Do not introduce general keyword
// search in this task", Phase 1: "For V1, support exact MPN lookup only").
// supSearchMpn is Nexar's documented equivalent of the old REST
// /parts/match endpoint (support.nexar.com "Transitioning from RESTful API
// into GraphQL API").
//
// Field selection is deliberately narrow (Phase 4: "request ONLY fields
// actually required by COMPEX") -- no medianPrice/price fields at the Part
// level are requested at all; commercial data is confined to
// sellers.offers, which is mapped separately (mapNexarInternalOffers) into
// internal-only storage and never reaches RawCatalogItem's public fields.
const SEARCH_MPN_QUERY = /* GraphQL */ `
  query CompexNexarMpnLookup($mpn: String!, $limit: Int!) {
    supSearchMpn(q: $mpn, limit: $limit) {
      hits
      results {
        part {
          mpn
          slug
          manufacturer {
            name
            homepageUrl
          }
          category {
            id
            name
          }
          shortDescription
          octopartUrl
          images {
            url
            creditString
            creditUrl
          }
          bestDatasheet {
            url
          }
          documentCollections {
            name
            documents {
              name
              url
              mimeType
            }
          }
          specs {
            attribute {
              name
              shortname
              group
            }
            displayValue
          }
          sellers {
            company {
              name
              homepageUrl
            }
            country
            isRfq
            offers {
              sku
              inventoryLevel
              moq
              packaging
              factoryLeadDays
              clickUrl
              prices {
                quantity
                price
                currency
              }
            }
          }
        }
      }
    }
  }
`;

const CACHE_NAMESPACE = "nexar-mpn-lookup";
// A handful of exact-match candidates, same reasoning as the Mouser/
// element14/DigiKey fetchers: supSearchMpn can return near-matches (other
// packaging/variants), so this fetcher still filters to the exact
// normalized MPN client-side and keeps at most one canonical item.
const SEARCH_LIMIT = 5;

interface CachedNexarResult {
  items: RawCatalogItem[];
}

export function createNexarFetcher(mpn: string): CatalogFetcher {
  return {
    source: "NEXAR",
    async fetch(): Promise<{ items: RawCatalogItem[] }> {
      const normalizedMpn = normalizeMpn(mpn);
      if (!normalizedMpn) throw Errors.validation("MPN is required");

      const cached = await cacheGet<CachedNexarResult>(CACHE_NAMESPACE, normalizedMpn);
      if (cached) return cached.value;

      const data = await nexarGraphQL<{ supSearchMpn: NexarSearchMpnResult }>(SEARCH_MPN_QUERY, {
        mpn,
        limit: SEARCH_LIMIT,
      });

      const parts: NexarPart[] = (data.supSearchMpn?.results ?? [])
        .map((r) => r.part)
        .filter((part): part is NexarPart => Boolean(part));

      const exactMatch = parts.find((part) => part.mpn && normalizeMpn(part.mpn) === normalizedMpn);

      const result: CachedNexarResult = exactMatch
        ? {
            items: [
              {
                ...mapNexarPart(exactMatch),
                internalOffers: mapNexarInternalOffers(exactMatch),
              },
            ],
          }
        : { items: [] };

      // Only a successful lookup is cached -- an upstream failure throws
      // above and never reaches this line, so a transient Nexar outage can
      // never poison the cache with an empty/error result for this MPN
      // (Phase 16: "provider-specific failures must not poison cache").
      await cacheSet(CACHE_NAMESPACE, normalizedMpn, result, env.NEXAR_CACHE_TTL_SECONDS);

      return result;
    },
  };
}
