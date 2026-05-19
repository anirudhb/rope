import { RopeAPI } from "../api";
import { wirePlugin } from "../plugins";

const IDV_API_URL = 'https://identity.hackclub.com/api/external/check';
const IDV_CACHE_KEY = 'slack_idv_status_v2';
const IDV_CACHE_TIMESTAMP_KEY = 'slack_idv_status_timestamp_v2';
const IDV_CACHE_DURATION = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 5000;

type IdvStatusType = 'eligible' | 'over_18' | 'unverified' | 'loading'
let idvCache: Record<string, IdvStatusType> = {};

const idvStatusCss = `
.taut-idv-not-eligible, .taut-idv-not-eligible .c-message__sender_button {
  text-decoration: underline wavy #e01e5a !important;
  text-decoration-thickness: 1px !important;
}

.taut-idv-over-18, .taut-idv-over-18 .c-message__sender_button {
  text-decoration: underline wavy #d97706 !important;
  text-decoration-thickness: 1px !important;
}
`;

// Pending fetch promises to prevent duplicate requests
const pendingFetches = new Map<string, Promise<IdvStatusType>>()
// ok since it will always be non-null when functions run
let api: RopeAPI = null as any;

//////

function clearCache() {
  idvCache = {};
  pendingFetches.clear();
  localStorage.removeItem(IDV_CACHE_KEY);
  localStorage.removeItem(IDV_CACHE_TIMESTAMP_KEY);
  api.log('IDV Cache cleared');
}

function loadIdvCache() {
  try {
    const timestamp = localStorage.getItem(IDV_CACHE_TIMESTAMP_KEY);
    if (
      timestamp &&
      Date.now() - parseInt(timestamp, 10) < IDV_CACHE_DURATION
    ) {
      const cached = localStorage.getItem(IDV_CACHE_KEY);
      if (cached) {
        idvCache = JSON.parse(cached);
        api.log('Loaded IDV cache:', Object.keys(idvCache).length, 'users');
      }
    }
  } catch (e) {
    api.log('Error loading IDV cache:', e);
  }
}

function saveIdvCache() {
  try {
    localStorage.setItem(IDV_CACHE_KEY, JSON.stringify(idvCache));
    localStorage.setItem(IDV_CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (e) {
    api.log('Error saving IDV cache:', e);
  }
}

function setCache(slackId: string, status: IdvStatusType) {
  idvCache[slackId] = status;

  const keys = Object.keys(idvCache);
  if (keys.length > MAX_CACHE_SIZE) {
    const toRemove = keys.slice(0, 100);
    toRemove.forEach((k) => delete idvCache[k]);
  }

  saveIdvCache();
}

async function fetchIdvStatus(slackId: string): Promise<IdvStatusType> {
  // Return cached value if available
  if (idvCache[slackId] && idvCache[slackId] !== 'loading') {
    return idvCache[slackId];
  }

  // If there's already a pending fetch for this user, return that promise
  if (pendingFetches.has(slackId)) {
    return pendingFetches.get(slackId)!;
  }

  // Create the fetch promise
  const fetchPromise = (async (): Promise<IdvStatusType> => {
    try {
      const response = await fetch(`${IDV_API_URL}?slack_id=${slackId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      let status: IdvStatusType = 'unverified';
      if (data.result) {
        if (data.result === 'verified_eligible') {
          status = 'eligible';
        } else if (data.result === 'verified_but_over_18') {
          status = 'over_18';
        } else if (
          data.result === 'pending' ||
          data.result === 'needs_submission'
        ) {
          status = 'unverified';
        }
      }

      setCache(slackId, status);
      return status;
    } catch (e) {
      api.log('Error fetching IDV status:', e);
      return 'loading'; // Do not cache errors
    } finally {
      pendingFetches.delete(slackId);
    }
  })();

  pendingFetches.set(slackId, fetchPromise);
  return fetchPromise;
}

//////

export default wirePlugin({
}, undefined, {
  id: "IdvStatus",
  meta: {
    name: "IDV Status",
    description: "Shows a red squiggle on users who are not IDV eligible",
    authors: "<@U08PUHSMW4V>",
  },
  init(api_) {
    api = api_;

    const idvStatusStyle = document.createElement("style");
    /* NB: original class names are kept even though this is a port to Rope */
    idvStatusStyle.textContent = idvStatusCss;
    document.head.appendChild(idvStatusStyle);

    loadIdvCache();
    globalThis.tautIdvClearCache = clearCache;

    return {
      modules: [],
      components: [{
        componentName: "BaseMessageSender",
        debugName: "idvstatus-basemessagesender-patch",
        patch: (_require, React, BaseMessageSender: React.FC<{
          botId?: string;
          userId?: string;
          className?: string;
        }>) => {
          const PatchedBaseMessageSender = api.react.patchedComponent(BaseMessageSender, props => {
            const userId = props.userId;
            const isBotMessage = !!props.botId;

            const [idvStatus, setIdvStatus] = React.useState<IdvStatusType | null>(() => {
              if (!userId || isBotMessage) return null;
              if (!userId.startsWith('U') && !userId.startsWith('W')) return null;
              if (userId === 'USLACKBOT') return null;
              return idvCache[userId] || 'loading';
            });

            React.useEffect(() => {
              if (!userId || isBotMessage || idvStatus === null) return;
              if (!userId.startsWith('U') && !userId.startsWith('W')) return;
              if (userId === 'USLACKBOT') return;

              // If we have a cached status that's not loading, we're done
              if (idvCache[userId] && idvCache[userId] !== 'loading') {
                if (idvStatus !== idvCache[userId]) {
                  setIdvStatus(idvCache[userId]);
                }
                return;
              }

              // Fetch the status
              fetchIdvStatus(userId).then((status) => {
                setIdvStatus(status);
              });
            }, [userId, isBotMessage]);

            const className =
              idvStatus === 'unverified'
                ? 'taut-idv-not-eligible'
                : idvStatus === 'over_18'
                  ? 'taut-idv-over-18'
                  : '';

            return <BaseMessageSender
              {...props}
              className={props.className ? `${props.className} ${className}` : className}
            />;
          });

          return PatchedBaseMessageSender;
        },
      }],
    };
  },
});
