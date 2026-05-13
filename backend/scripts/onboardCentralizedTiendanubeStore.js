const connectDB = require('../src/config/database');
const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const User = require('../src/models/User');
const tnAPI = require('../src/services/tiendanubeAPI');
const metaAPI = require('../src/services/metaAPI');
const { syncOrders, syncProducts } = require('../src/services/syncTiendanube');
const { syncMetaStructure, syncMetaInsights } = require('../src/services/syncMeta');

function resolveTiendanubeStoreName(metadata, fallbackName) {
  if (!metadata) return fallbackName;
  if (typeof metadata.name === 'string' && metadata.name.trim()) return metadata.name.trim();
  if (metadata.name?.es) return metadata.name.es;
  if (metadata.name?.pt) return metadata.name.pt;
  if (metadata.name?.en) return metadata.name.en;
  if (metadata.store_name) return metadata.store_name;
  if (metadata.business_name) return metadata.business_name;
  return fallbackName;
}

function resolveStoreUrl(metadata) {
  const raw =
    metadata?.original_domain ||
    metadata?.domain ||
    metadata?.store_url ||
    metadata?.url ||
    '';
  if (!raw) return '';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

function resolveLogo(metadata) {
  return (
    metadata?.logo?.src ||
    metadata?.logo?.url ||
    metadata?.logo ||
    metadata?.main_image ||
    metadata?.images?.[0]?.src ||
    metadata?.images?.[0]?.url ||
    ''
  );
}

async function findMetaTokenSourceStore(metaAdAccountId) {
  const candidates = await Store.find({
    metaAccessToken: { $exists: true, $ne: '' },
  })
    .select('nombre metaAccessToken metaTokenExpiresAt metaAdAccountId metaAdAccounts')
    .lean();

  for (const candidate of candidates) {
    try {
      const accounts = await metaAPI.getAdAccounts(candidate.metaAccessToken);
      const match = accounts.find((item) => item.id === metaAdAccountId);
      if (match) {
        return {
          store: candidate,
          account: match,
        };
      }
    } catch (error) {
      // Ignore expired or invalid tokens and keep searching.
    }
  }

  throw new Error(`No se encontro un token de Meta con acceso a ${metaAdAccountId}`);
}

async function main() {
  const [, , tnStoreIdRaw, aliasRaw, metaAdAccountIdRaw] = process.argv;
  const tnStoreId = String(tnStoreIdRaw || '').trim();
  const aliasNombre = String(aliasRaw || '').trim() || `Tienda ${tnStoreId}`;
  const metaAdAccountId = String(metaAdAccountIdRaw || '').trim();

  if (!tnStoreId || !metaAdAccountId) {
    throw new Error('Uso: node scripts/onboardCentralizedTiendanubeStore.js <tnStoreId> <aliasNombre> <metaAdAccountId>');
  }

  await connectDB();

  try {
    const metadata = await tnAPI.validateConnection(tnStoreId, null);
    const resolvedName = resolveTiendanubeStoreName(metadata, aliasNombre);
    const storeUrl = resolveStoreUrl(metadata);
    const logoUrl = resolveLogo(metadata);

    const { store: tokenSourceStore, account: metaAccount } = await findMetaTokenSourceStore(metaAdAccountId);

    let store = await Store.findOne({ tnStoreId });
    if (!store) {
      store = new Store({
        nombre: aliasNombre || resolvedName,
        plataforma: 'tiendanube',
        tnStoreId,
      });
    }

    store.nombre = aliasNombre || resolvedName;
    store.plataforma = 'tiendanube';
    store.tnStoreId = tnStoreId;
    store.tnNombre = resolvedName;
    store.tnAccessToken = '';
    store.tnTokenSource = 'cro_service';
    store.logoUrl = logoUrl || store.logoUrl || '';
    store.storeUrl = storeUrl || store.storeUrl || '';
    store.metaAccessToken = tokenSourceStore.metaAccessToken;
    store.metaTokenExpiresAt = tokenSourceStore.metaTokenExpiresAt || null;
    store.metaAdAccountId = metaAccount.id;
    store.metaAdAccounts = [
      {
        id: metaAccount.id,
        accountId: metaAccount.account_id,
        name: metaAccount.name,
        status: metaAccount.account_status,
        currency: metaAccount.currency,
        isPrimary: true,
        connectedAt: new Date(),
      },
    ];
    store.integrationStatus = store.integrationStatus || {};
    store.integrationStatus.tiendanube = {
      connected: true,
      lastSync: store.integrationStatus?.tiendanube?.lastSync || null,
    };
    store.integrationStatus.metaAds = {
      connected: true,
      lastSync: store.integrationStatus?.metaAds?.lastSync || null,
    };
    store.integrationStatus.shopify = store.integrationStatus?.shopify || {
      connected: false,
      lastSync: null,
    };

    await store.save();

    await User.updateMany(
      { role: 'admin', isActive: true },
      { $addToSet: { storeAccess: store._id } }
    );

    await syncProducts(store);
    await syncOrders(store);
    await syncMetaStructure(store);
    await syncMetaInsights(store, 30);

    console.log(
      JSON.stringify(
        {
          success: true,
          storeId: String(store._id),
          nombre: store.nombre,
          tnStoreId: store.tnStoreId,
          metaAdAccountId: store.metaAdAccountId,
          metaSourceStore: tokenSourceStore.nombre,
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        message: error.message,
        status: error.response?.status || null,
        data: error.response?.data || null,
      },
      null,
      2
    )
  );
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    // no-op
  }
  process.exit(1);
});
