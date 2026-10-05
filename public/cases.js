// Predefined case studies. Questions, answer keys and explanations are fixed here
// so grading is deterministic; the LLM tutor only explains, it never grades.
//
// Refs used in `required` / `forbidden`:
//   - a fixed node id (e.g. "web1")           -> exactly that node
//   - a component type (e.g. "cache")          -> any placed node of that type

export const COMPONENTS = {
  // fixed building blocks (cannot be dragged from the palette)
  client: { label: 'Client', icon: '👥', desc: 'Browsers / mobile apps sending requests.' },
  'web-server': { label: 'Web Server', icon: '🖥️', desc: 'Serves pages and handles HTTP requests.' },
  'app-server': { label: 'App Server', icon: '⚙️', desc: 'Runs business logic behind an API.' },
  service: { label: 'Service', icon: '🧩', desc: 'An internal backend service.' },
  database: { label: 'Database', icon: '🗄️', desc: 'Durable primary data store.' },
  'external-service': { label: 'External Provider', icon: '🌐', desc: 'Third-party API outside your control.' },

  // palette components
  'load-balancer': { label: 'Load Balancer', icon: '⚖️', desc: 'Spreads incoming requests across several servers and removes failed ones.' },
  cache: { label: 'Cache (Redis)', icon: '⚡', desc: 'In-memory store for hot data and counters. Very fast, not durable.' },
  cdn: { label: 'CDN', icon: '🌍', desc: 'Edge servers that cache static content close to users.' },
  'object-storage': { label: 'Object Storage (S3)', icon: '🪣', desc: 'Cheap, durable storage for large files like images and video.' },
  'message-queue': { label: 'Message Queue', icon: '📬', desc: 'Buffers work so producers do not wait for slow consumers.' },
  worker: { label: 'Worker', icon: '🛠️', desc: 'Background process that consumes jobs from a queue.' },
  'read-replica': { label: 'Read Replica', icon: '📑', desc: 'Copy of the primary database that serves read-only queries.' },
  'api-gateway': { label: 'API Gateway', icon: '🚪', desc: 'Single entry point: auth, routing, throttling.' },
  'rate-limiter': { label: 'Rate Limiter', icon: '🚦', desc: 'Rejects callers that exceed their request quota.' },
  'dead-letter-queue': { label: 'Dead Letter Queue', icon: '☠️', desc: 'Holds messages that failed repeatedly so they can be inspected and replayed.' },
  'search-index': { label: 'Search Index', icon: '🔎', desc: 'Full-text search engine (e.g. Elasticsearch).' },
  'websocket-server': { label: 'WebSocket Server', icon: '🔌', desc: 'Keeps long-lived connections for real-time push.' },
  'graph-database': { label: 'Graph Database', icon: '🕸️', desc: 'Optimised for relationship traversals.' },
};

export const LEVELS = [
  { id: 'beginner', label: 'Beginner', blurb: 'Add one idea to a working system.', unlockAfter: null },
  { id: 'intermediate', label: 'Intermediate', blurb: 'Combine several components.', unlockAfter: { level: 'beginner', passes: 3 } },
  { id: 'advanced', label: 'Advanced', blurb: 'Coming soon.', comingSoon: true },
];

export const CASES = [
  // ───────────────────────────── BEGINNER ─────────────────────────────
  {
    id: 'b1-blog-reads',
    level: 'beginner',
    title: 'Blog under read load',
    scenario:
      'A blogging platform serves 2M readers a day. About 95% of requests read the same few hundred popular posts. ' +
      'The posts database is at 90% CPU and pages take 2 seconds to load. Posts change only a few times a day.',
    goals: ['Cut the load on the database', 'Make popular pages load faster'],
    fixed: [
      { id: 'client', type: 'client', label: 'Readers', x: 40, y: 230 },
      { id: 'web', type: 'web-server', label: 'Web Server', x: 330, y: 230 },
      { id: 'db', type: 'database', label: 'Posts DB', x: 650, y: 230 },
    ],
    fixedEdges: [['client', 'web'], ['web', 'db']],
    palette: ['cache', 'message-queue', 'search-index', 'websocket-server'],
    required: [
      {
        id: 'cache-on-path',
        a: 'web', b: 'cache',
        label: 'Repeated reads should be served from fast memory instead of the database',
        why: 'Hot posts are read thousands of times and rarely change, so the web server can check a cache first (cache-aside) and only hit the DB on a miss.',
      },
    ],
    forbidden: [
      { id: 'client-cache', a: 'client', b: 'cache', why: 'Clients should never talk to the cache directly; the server controls what is cached.' },
      { id: 'client-db', a: 'client', b: 'db', why: 'Clients must not connect straight to the database.' },
    ],
    wrong: {
      'message-queue': 'A queue defers work; reads need the data right now, so it does not help here.',
      'search-index': 'Search is not the bottleneck: the problem is repeated reads of the same posts.',
      'websocket-server': 'Real-time push is not required for a blog.',
    },
    hints: [
      'The same data is requested over and over and rarely changes.',
      'Which component keeps hot data in memory so the database is asked less often?',
      'Place a cache and connect it to the web server (the server checks it before the DB).',
    ],
    explanation:
      'This is a read-heavy workload with a small hot set. A cache (Redis/Memcached) in front of the database turns most reads into memory lookups. ' +
      'The web server uses cache-aside: look in the cache, on a miss read the DB and fill the cache with a TTL (or invalidate on edit).',
    solution: {
      nodes: [{ id: 'n1', type: 'cache' }],
      edges: [['web', 'n1']],
    },
  },
  {
    id: 'b2-photo-uploads',
    level: 'beginner',
    title: 'Profile photo uploads',
    scenario:
      'A social app lets 500k users upload profile photos. Photos are stored as blobs inside the users database, which has grown to 2 TB, ' +
      'makes backups very slow, and photos load slowly for users on other continents.',
    goals: ['Take large files out of the database', 'Deliver images quickly worldwide'],
    fixed: [
      { id: 'client', type: 'client', label: 'Mobile users', x: 40, y: 230 },
      { id: 'app', type: 'app-server', label: 'App Server', x: 330, y: 230 },
      { id: 'db', type: 'database', label: 'Users DB', x: 650, y: 330 },
    ],
    fixedEdges: [['client', 'app'], ['app', 'db']],
    palette: ['object-storage', 'cdn', 'cache', 'message-queue', 'graph-database'],
    required: [
      {
        id: 'app-store',
        a: 'app', b: 'object-storage',
        label: 'Image files should be saved in storage built for large files',
        why: 'Object storage (S3) is cheap, durable and scales to petabytes. The database keeps only the photo URL/key.',
      },
      {
        id: 'cdn-origin',
        a: 'cdn', b: 'object-storage',
        label: 'Global delivery should pull images from that storage',
        why: 'A CDN uses the bucket as its origin and caches photos at edge locations near users.',
      },
      {
        id: 'client-cdn',
        a: 'client', b: 'cdn',
        label: 'Users should download photos through the edge network',
        why: 'Clients fetch images from the nearest CDN edge, which cuts latency and offloads your servers.',
      },
    ],
    forbidden: [
      { id: 'client-db', a: 'client', b: 'db', why: 'Clients must not connect straight to the database.' },
    ],
    wrong: {
      'graph-database': 'Photos are large files, not relationship data; a graph DB would not help.',
    },
    hints: [
      'Two problems: file size in the database, and distance to users.',
      'Large binary files belong in object storage; the DB stores just a reference.',
      'Put a CDN in front of the storage and have clients read through it.',
    ],
    explanation:
      'Never store large blobs in your relational database. Upload to object storage (S3) and save its key in the DB. ' +
      'Serve downloads through a CDN whose origin is the bucket so images are cached close to users.',
    solution: {
      nodes: [{ id: 'n1', type: 'object-storage' }, { id: 'n2', type: 'cdn' }],
      edges: [['app', 'n1'], ['n2', 'n1'], ['client', 'n2']],
    },
  },
  {
    id: 'b3-traffic-spike',
    level: 'beginner',
    title: 'Black Friday traffic spike',
    scenario:
      'An online shop runs on one web server that hits 100% CPU during sales. The team has deployed a second, identical web server ' +
      'but clients still only know the address of the first one. Both servers share one database.',
    goals: ['Spread traffic across both servers', 'Keep the shop up if one server fails'],
    fixed: [
      { id: 'client', type: 'client', label: 'Shoppers', x: 40, y: 230 },
      { id: 'web1', type: 'web-server', label: 'Web Server 1', x: 500, y: 110 },
      { id: 'web2', type: 'web-server', label: 'Web Server 2', x: 500, y: 350 },
      { id: 'db', type: 'database', label: 'Shop DB', x: 780, y: 230 },
    ],
    fixedEdges: [['web1', 'db'], ['web2', 'db']],
    palette: ['load-balancer', 'cache', 'cdn', 'search-index'],
    required: [
      {
        id: 'client-lb',
        a: 'client', b: 'load-balancer',
        label: 'Shoppers should reach the shop through one entry point',
        why: 'The load balancer exposes a single address so clients do not need to know about individual servers.',
      },
      {
        id: 'lb-web1',
        a: 'load-balancer', b: 'web1',
        label: 'Web Server 1 should receive traffic from that entry point',
        why: 'Each backend must be registered with the balancer to share the load.',
      },
      {
        id: 'lb-web2',
        a: 'load-balancer', b: 'web2',
        label: 'Web Server 2 should receive traffic from that entry point',
        why: 'With health checks the balancer stops sending traffic to a failed server, so one crash is not an outage.',
      },
    ],
    forbidden: [
      { id: 'client-web1', a: 'client', b: 'web1', why: 'Clients connecting straight to a server bypasses the load balancer.' },
      { id: 'client-web2', a: 'client', b: 'web2', why: 'Clients connecting straight to a server bypasses the load balancer.' },
      { id: 'client-db', a: 'client', b: 'db', why: 'Clients must not connect straight to the database.' },
    ],
    wrong: {
      'search-index': 'Search does not address CPU saturation across servers.',
    },
    hints: [
      'You have two servers but nothing decides which one gets each request.',
      'Which component distributes requests and detects dead servers?',
      'Place a load balancer between the shoppers and both web servers.',
    ],
    explanation:
      'Horizontal scaling needs a load balancer: it presents one address, distributes requests (round-robin/least-connections) across servers and ' +
      'uses health checks to drop failed ones, removing the single point of failure at the web tier.',
    solution: {
      nodes: [{ id: 'n1', type: 'load-balancer' }],
      edges: [['client', 'n1'], ['n1', 'web1'], ['n1', 'web2']],
    },
  },
  {
    id: 'b4-signup-emails',
    level: 'beginner',
    title: 'Slow signup emails',
    scenario:
      'When a user signs up, the API calls the email provider and waits for it before replying, so signup takes 6 seconds and fails whenever the ' +
      'provider is slow. A fixed Email Worker already knows how to send welcome emails; it just needs to be fed jobs.',
    goals: ['Make signup respond immediately', 'Do not lose emails if the worker is busy or down'],
    fixed: [
      { id: 'client', type: 'client', label: 'New users', x: 40, y: 230 },
      { id: 'api', type: 'app-server', label: 'Signup API', x: 270, y: 230 },
      { id: 'db', type: 'database', label: 'Users DB', x: 270, y: 440 },
      { id: 'mailer', type: 'service', label: 'Email Worker', x: 780, y: 230 },
    ],
    fixedEdges: [['client', 'api'], ['api', 'db']],
    palette: ['message-queue', 'cache', 'load-balancer', 'websocket-server'],
    required: [
      {
        id: 'api-queue',
        a: 'api', b: 'message-queue',
        label: 'The API should hand the email job off instead of doing it inline',
        why: 'Publishing a job to a queue takes milliseconds, so the signup request can return right away.',
      },
      {
        id: 'queue-mailer',
        a: 'message-queue', b: 'mailer',
        label: 'The Email Worker should receive jobs from the buffer',
        why: 'The worker consumes at its own pace; the queue stores jobs durably if the worker is slow or restarting.',
      },
    ],
    forbidden: [
      { id: 'client-mailer', a: 'client', b: 'mailer', why: 'Clients must not talk to internal workers.' },
      { id: 'client-queue', a: 'client', b: 'message-queue', why: 'Clients must not publish to internal queues directly.' },
      { id: 'api-mailer', a: 'api', b: 'mailer', why: 'Calling the worker directly keeps the request waiting, which is the original problem.' },
    ],
    wrong: {
      'websocket-server': 'Real-time push is not the problem; the API is blocking on a slow task.',
    },
    hints: [
      'The API is waiting for something that does not need to finish before replying.',
      'Which component decouples a producer from a slower consumer?',
      'API → queue → Email Worker.',
    ],
    explanation:
      'Move slow, non-critical work off the request path (asynchronous processing). The API enqueues a "send welcome email" message and responds; ' +
      'the Email Worker consumes it later. The queue also absorbs spikes and retains messages if the worker is down.',
    solution: {
      nodes: [{ id: 'n1', type: 'message-queue' }],
      edges: [['api', 'n1'], ['n1', 'mailer']],
    },
  },

  // ─────────────────────────── INTERMEDIATE ───────────────────────────
  {
    id: 'i1-url-shortener',
    level: 'intermediate',
    title: 'URL shortener at 10k RPS',
    scenario:
      'A URL shortener must handle 10,000 redirects per second with a 100:1 read-to-write ratio and 99.9% availability. Two API servers and one ' +
      'primary database exist today. The primary is overloaded and a single API address is hard-coded in clients.',
    goals: ['Remove single points of failure at the API tier', 'Serve hot links without touching the DB', 'Take read traffic off the primary'],
    fixed: [
      { id: 'client', type: 'client', label: 'Users', x: 30, y: 230 },
      { id: 'api1', type: 'app-server', label: 'API Server 1', x: 480, y: 80 },
      { id: 'api2', type: 'app-server', label: 'API Server 2', x: 480, y: 380 },
      { id: 'db', type: 'database', label: 'Primary DB', x: 780, y: 230 },
    ],
    fixedEdges: [['api1', 'db'], ['api2', 'db']],
    palette: ['load-balancer', 'cache', 'read-replica', 'message-queue', 'cdn', 'graph-database'],
    required: [
      { id: 'client-lb', a: 'client', b: 'load-balancer', label: 'Clients need a single, stable entry point', why: 'A load balancer gives one address and spreads 10k RPS across API servers.' },
      { id: 'lb-api1', a: 'load-balancer', b: 'api1', label: 'API Server 1 must sit behind the entry point', why: 'Health checks let the balancer route around a failed server.' },
      { id: 'lb-api2', a: 'load-balancer', b: 'api2', label: 'API Server 2 must sit behind the entry point', why: 'Both servers share the load, so one failure does not take the service down.' },
      { id: 'cache-api1', a: 'cache', b: 'api1', label: 'API Server 1 should check a shared in-memory store first', why: 'A few popular links make up most traffic; caching them absorbs the vast majority of reads.' },
      { id: 'cache-api2', a: 'cache', b: 'api2', label: 'API Server 2 should use the same shared in-memory store', why: 'A shared cache (not per-server memory) keeps hit rates high and data consistent across servers.' },
      { id: 'replica-primary', a: 'read-replica', b: 'db', label: 'Read capacity should be copied from the primary', why: 'A replica stays in sync with the primary through replication.' },
      { id: 'api-replica', a: 'read-replica', b: 'api1', label: 'API servers should be able to read from that copy on cache misses', why: 'Misses go to a replica so the primary is reserved for writes (creating links).' },
      { id: 'api2-replica', a: 'read-replica', b: 'api2', label: 'Both API servers should be able to read from that copy', why: 'Both servers need a path to the replica; otherwise one still loads the primary.' },
    ],
    forbidden: [
      { id: 'client-api1', a: 'client', b: 'api1', why: 'Direct client→server links bypass the load balancer.' },
      { id: 'client-api2', a: 'client', b: 'api2', why: 'Direct client→server links bypass the load balancer.' },
      { id: 'client-db', a: 'client', b: 'db', why: 'Clients must not connect straight to the database.' },
      { id: 'client-cache', a: 'client', b: 'cache', why: 'Clients must not talk to the cache directly.' },
    ],
    wrong: {
      'graph-database': 'URL lookups are simple key→value reads, not relationship queries.',
    },
    hints: [
      'Three separate problems: entry point, hot reads, primary overload.',
      'A load balancer for the API tier, a cache both servers share, and a copy of the DB for reads.',
      'Wire: Users→LB→both APIs; both APIs→Cache; both APIs→Replica; Replica↔Primary.',
    ],
    explanation:
      'Scale reads in layers: a load balancer for availability, a shared cache for the hot set, and read replicas so cache misses do not hit the primary. ' +
      'Writes (new short links) go to the primary, which replicates to the replica.',
    solution: {
      nodes: [{ id: 'lb', type: 'load-balancer' }, { id: 'c', type: 'cache' }, { id: 'r', type: 'read-replica' }],
      edges: [['client', 'lb'], ['lb', 'api1'], ['lb', 'api2'], ['api1', 'c'], ['api2', 'c'], ['r', 'db'], ['r', 'api1'], ['r', 'api2']],
    },
  },
  {
    id: 'i2-order-notifications',
    level: 'intermediate',
    title: 'Reliable order notifications',
    scenario:
      'After checkout the Order Service calls an SMS/email provider directly. When the provider has an outage, checkout slows down and notifications ' +
      'are lost. The provider also rate-limits bursts. You must make notifications reliable and keep checkout fast, including inspecting messages that keep failing.',
    goals: ['Decouple checkout from the provider', 'Process notifications with background workers', 'Do not lose messages that fail repeatedly'],
    fixed: [
      { id: 'order', type: 'service', label: 'Order Service', x: 30, y: 230 },
      { id: 'db', type: 'database', label: 'Orders DB', x: 30, y: 430 },
      { id: 'provider', type: 'external-service', label: 'SMS / Email Provider', x: 790, y: 230 },
    ],
    fixedEdges: [['order', 'db']],
    palette: ['message-queue', 'worker', 'dead-letter-queue', 'cache', 'api-gateway', 'websocket-server'],
    required: [
      { id: 'order-queue', a: 'order', b: 'message-queue', label: 'Checkout should publish a notification job and move on', why: 'Publishing is fast and survives a provider outage; the order is not blocked.' },
      { id: 'queue-worker', a: 'message-queue', b: 'worker', label: 'Background workers should pull the jobs', why: 'Workers consume at a controlled rate, which also respects the provider rate limit.' },
      { id: 'worker-provider', a: 'worker', b: 'provider', label: 'Only the workers should call the provider', why: 'Workers can retry with backoff without affecting checkout.' },
      { id: 'queue-dlq', a: 'message-queue', b: 'dead-letter-queue', label: 'Messages that fail repeatedly need a safe place to land', why: 'A dead letter queue keeps poison messages for inspection and replay instead of blocking the main queue or dropping them.' },
    ],
    forbidden: [
      { id: 'order-provider', a: 'order', b: 'provider', why: 'A direct call keeps checkout coupled to provider availability.' },
      { id: 'order-worker', a: 'order', b: 'worker', why: 'The Order Service should hand work to the queue, not to workers directly.' },
    ],
    wrong: {
      'websocket-server': 'Notifications here are SMS/email, not live in-app push.',
    },
    hints: [
      'Checkout should not wait for an external provider.',
      'Producer → durable buffer → consumers → provider. What do you do with messages that never succeed?',
      'Order → Queue → Worker → Provider, and Queue → Dead Letter Queue.',
    ],
    explanation:
      'Use asynchronous, queue-based delivery: the Order Service enqueues; workers pull, call the provider with retries and backoff; messages exceeding the retry limit are moved to a dead letter queue for inspection and replay.',
    solution: {
      nodes: [{ id: 'q', type: 'message-queue' }, { id: 'w', type: 'worker' }, { id: 'd', type: 'dead-letter-queue' }],
      edges: [['order', 'q'], ['q', 'w'], ['w', 'provider'], ['q', 'd']],
    },
  },
  {
    id: 'i3-video-pipeline',
    level: 'intermediate',
    title: 'Video upload & streaming',
    scenario:
      'Creators upload 1 GB videos that must be transcoded into several resolutions before viewers can watch them. Today the API transcodes during the upload ' +
      'request, which times out, and viewers far from the data centre see constant buffering. A Transcoder service and a Metadata DB already exist.',
    goals: ['Store large videos durably', 'Transcode asynchronously', 'Stream to viewers worldwide with low latency'],
    fixed: [
      { id: 'client', type: 'client', label: 'Creators & Viewers', x: 30, y: 230 },
      { id: 'api', type: 'app-server', label: 'API Server', x: 270, y: 230 },
      { id: 'meta', type: 'database', label: 'Metadata DB', x: 270, y: 450 },
      { id: 'transcoder', type: 'service', label: 'Transcoder Workers', x: 770, y: 450 },
    ],
    fixedEdges: [['client', 'api'], ['api', 'meta']],
    palette: ['object-storage', 'message-queue', 'cdn', 'cache', 'search-index', 'graph-database'],
    required: [
      { id: 'api-storage', a: 'api', b: 'object-storage', label: 'Uploaded video files need durable large-file storage', why: 'Object storage holds the raw upload and the transcoded renditions; metadata stays in the DB.' },
      { id: 'api-queue', a: 'api', b: 'message-queue', label: 'Uploading should trigger background work instead of transcoding inline', why: 'The API publishes a "transcode this video" job and returns immediately.' },
      { id: 'queue-transcoder', a: 'message-queue', b: 'transcoder', label: 'Transcoders should receive their jobs from a buffer', why: 'Jobs wait in the queue; add more transcoders to scale throughput.' },
      { id: 'transcoder-storage', a: 'transcoder', b: 'object-storage', label: 'Transcoders must read raw videos and write results to storage', why: 'They download the original, produce 240p–1080p renditions and store them back.' },
      { id: 'cdn-storage', a: 'cdn', b: 'object-storage', label: 'Streaming should be delivered from the edge, sourced from storage', why: 'The CDN caches video segments near viewers and uses object storage as origin.' },
      { id: 'client-cdn', a: 'client', b: 'cdn', label: 'Viewers should watch through the edge network', why: 'Streaming from the CDN cuts buffering and keeps traffic off your API.' },
    ],
    forbidden: [
      { id: 'api-transcoder', a: 'api', b: 'transcoder', why: 'Calling the transcoder synchronously reproduces the timeout.' },
      { id: 'client-transcoder', a: 'client', b: 'transcoder', why: 'Clients must not reach internal workers.' },
      { id: 'client-meta', a: 'client', b: 'meta', why: 'Clients must not connect straight to the database.' },
      { id: 'meta-storage', a: 'meta', b: 'object-storage', why: 'The database only stores references; it should not be wired to the file store.' },
    ],
    wrong: {
      'graph-database': 'Videos are blobs plus simple metadata, not a graph problem.',
      'search-index': 'Search could be added later, but it does not solve upload, transcoding or streaming.',
    },
    hints: [
      'Three jobs: store big files, do heavy work in the background, deliver globally.',
      'Raw video → storage; upload event → queue → transcoder; viewers → CDN → storage.',
      'The transcoder both reads from and writes to object storage.',
    ],
    explanation:
      'Use a classic media pipeline: upload to object storage, publish a job to a queue, transcoders consume it and write renditions back to storage, ' +
      'and a CDN with the bucket as origin serves segments to viewers. The API stays fast and each tier scales independently.',
    solution: {
      nodes: [{ id: 's', type: 'object-storage' }, { id: 'q', type: 'message-queue' }, { id: 'c', type: 'cdn' }],
      edges: [['api', 's'], ['api', 'q'], ['q', 'transcoder'], ['transcoder', 's'], ['c', 's'], ['client', 'c']],
    },
  },
  {
    id: 'i4-public-api',
    level: 'intermediate',
    title: 'Public API platform',
    scenario:
      'You expose Users and Payments services to thousands of third-party apps. Today each service is called directly, authentication is inconsistent, and one ' +
      'abusive client recently took Payments down. Rate-limit counters must be shared and fast because several gateway instances will run.',
    goals: ['One controlled entry point (auth/routing)', 'Throttle abusive callers', 'Share rate-limit counters across instances'],
    fixed: [
      { id: 'client', type: 'client', label: 'Third-party apps', x: 30, y: 230 },
      { id: 'users', type: 'service', label: 'Users Service', x: 780, y: 100 },
      { id: 'payments', type: 'service', label: 'Payments Service', x: 780, y: 360 },
    ],
    fixedEdges: [],
    palette: ['api-gateway', 'rate-limiter', 'cache', 'load-balancer', 'message-queue', 'websocket-server'],
    required: [
      { id: 'client-gw', a: 'client', b: 'api-gateway', label: 'All external calls should enter through a single front door', why: 'The gateway centralises authentication, routing and logging.' },
      { id: 'gw-users', a: 'api-gateway', b: 'users', label: 'The front door must route to the Users Service', why: 'The gateway forwards authorised requests to the right internal service.' },
      { id: 'gw-payments', a: 'api-gateway', b: 'payments', label: 'The front door must route to the Payments Service', why: 'Payments is no longer exposed directly, so abuse is stopped before it arrives.' },
      { id: 'rl-gw', a: 'rate-limiter', b: 'api-gateway', label: 'The front door should enforce per-client quotas', why: 'Throttling at the edge rejects abusive callers with 429 before they reach any service.' },
      { id: 'rl-cache', a: 'rate-limiter', b: 'cache', label: 'Quota counters should live in a fast shared store', why: 'In-memory counters (e.g. Redis INCR with expiry) are shared by every gateway instance, so limits are global and accurate.' },
    ],
    forbidden: [
      { id: 'client-users', a: 'client', b: 'users', why: 'Direct access bypasses authentication and throttling.' },
      { id: 'client-payments', a: 'client', b: 'payments', why: 'Direct access bypasses authentication and throttling.' },
      { id: 'client-rl', a: 'client', b: 'rate-limiter', why: 'Clients must not talk to the rate limiter directly; the gateway consults it.' },
    ],
    wrong: {
      'websocket-server': 'Long-lived connections are unrelated to request throttling here.',
    },
    hints: [
      'Nothing should be reachable except through one controlled entry point.',
      'Throttling needs counters that every gateway instance can see quickly.',
      'Client → Gateway → Users & Payments; Rate Limiter ↔ Gateway; Rate Limiter ↔ Cache.',
    ],
    explanation:
      'An API gateway fronts internal services and handles authentication and routing. A rate limiter attached to it enforces quotas using counters in a shared cache (e.g. Redis), ' +
      'which keeps limits consistent when several gateway instances run.',
    solution: {
      nodes: [{ id: 'g', type: 'api-gateway' }, { id: 'r', type: 'rate-limiter' }, { id: 'c', type: 'cache' }],
      edges: [['client', 'g'], ['g', 'users'], ['g', 'payments'], ['r', 'g'], ['r', 'c']],
    },
  },
];

export function getCase(id) {
  return CASES.find((c) => c.id === id);
}
