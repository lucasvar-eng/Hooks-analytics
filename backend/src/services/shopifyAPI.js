const axios = require('axios');
const logger = require('../utils/logger');

function normalizeShopDomain(input = '') {
  let domain = String(input).trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (domain && !domain.includes('.')) {
    domain = `${domain}.myshopify.com`;
  }
  return domain;
}

async function graphql(shopDomain, accessToken, query, variables = {}) {
  const domain = normalizeShopDomain(shopDomain);
  const url = `https://${domain}/admin/api/2026-01/graphql.json`;

  try {
    const response = await axios.post(
      url,
      { query, variables },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    if (response.data?.errors?.length || response.data?.data?.orders?.userErrors?.length) {
      const firstError = response.data.errors?.[0] || response.data.data.orders.userErrors[0];
      const message = firstError.message || 'Shopify GraphQL error';
      const error = new Error(message);
      error.response = { status: 400, data: response.data };
      throw error;
    }

    return response.data?.data;
  } catch (error) {
    logger.error(`Shopify API error: ${error.response?.status || 'unknown'} ${error.message}`);
    throw error;
  }
}

async function paginateConnection(shopDomain, accessToken, query, rootKey, variables = {}) {
  const items = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await graphql(shopDomain, accessToken, query, { ...variables, after });
    const connection = data?.[rootKey];
    const edges = connection?.edges || [];
    items.push(...edges.map((edge) => edge.node));
    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    after = connection?.pageInfo?.endCursor || null;
  }

  return items;
}

async function validateConnection(shopDomain, accessToken) {
  const data = await graphql(
    shopDomain,
    accessToken,
    `
      query ValidateShopConnection {
        shop {
          id
          name
          myshopifyDomain
          primaryDomain {
            host
            url
          }
        }
        products(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `
  );

  return {
    shopId: data?.shop?.id || null,
    name: data?.shop?.name || null,
    shopDomain: data?.shop?.myshopifyDomain || normalizeShopDomain(shopDomain),
    primaryDomain: data?.shop?.primaryDomain?.url || null,
    logoUrl: null,
  };
}

async function listProducts(shopDomain, accessToken) {
  return paginateConnection(
    shopDomain,
    accessToken,
    `
      query ListProducts($after: String) {
        products(first: 100, after: $after, sortKey: UPDATED_AT) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              status
              onlineStorePreviewUrl
              productType
              totalInventory
              featuredImage {
                url
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }
      }
    `,
    'products'
  );
}

async function listOrders(shopDomain, accessToken, { updatedAtMin } = {}) {
  const queryFilter = updatedAtMin
    ? `updated_at:>=${new Date(updatedAtMin).toISOString()}`
    : '';

  return paginateConnection(
    shopDomain,
    accessToken,
    `
      query ListOrders($after: String, $query: String) {
        orders(first: 100, after: $after, sortKey: UPDATED_AT, query: $query) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              name
              createdAt
              processedAt
              cancelledAt
              displayFinancialStatus
              displayFulfillmentStatus
              totalPriceSet {
                shopMoney { amount }
              }
              subtotalPriceSet {
                shopMoney { amount }
              }
              totalShippingPriceSet {
                shopMoney { amount }
              }
              totalDiscountsSet {
                shopMoney { amount }
              }
              paymentGatewayNames
              currentSubtotalPriceSet {
                shopMoney { amount }
              }
              customer {
                id
                firstName
                lastName
                email
              }
              lineItems(first: 100) {
                edges {
                  node {
                    title
                    quantity
                    product {
                      id
                    }
                    originalUnitPriceSet {
                      shopMoney { amount }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    'orders',
    { query: queryFilter || null }
  );
}

module.exports = {
  normalizeShopDomain,
  graphql,
  validateConnection,
  listProducts,
  listOrders,
};
