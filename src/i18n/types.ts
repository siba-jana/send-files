export type Locale =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "zh"
  | "ja"
  | "hi"
  | "pt"
  | "ar"
  | "ru";

export type Direction = "ltr" | "rtl";

export interface LocaleMeta {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  dir: Direction;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface ChatGptToPdfDictionary {
  title: string;
  subtitle: string;
  pasteButton: string;
  uploadButton: string;
  sampleButton: string;
  clearButton: string;
  downloadPdf: string;
  generatingPdf: string;
  printButton: string;
  settingsButton: string;
  readyStatus: string;
  wordsCount: string;
  emptyHint: string;
  autoFormatNotice: string;
  placeholder: string;
  dropOverlay: string;
  previewTitle?: string;
  settingsTitle?: string;
  settingsDesc?: string;
}

export interface HubDictionary {
  badge: string;
  titlePre: string;
  titleHighlight: string;
  titlePost: string;
  subtitle: string;
  metaTitle: string;
  metaDesc: string;
  toolsTitle: string;
  toolsSubtitle: string;
  transferCardTitle: string;
  transferCardDesc: string;
  transferCardBadge: string;
  transferCardCta: string;
  transferFeat1: string;
  transferFeat2: string;
  transferFeat3: string;
  transferFeat4: string;
  chatGptCardTitle: string;
  chatGptCardDesc: string;
  chatGptCardBadge: string;
  chatGptCardCta: string;
  chatGptFeat1: string;
  chatGptFeat2: string;
  chatGptFeat3: string;
  chatGptFeat4: string;
  faqHeading: string;
  faqSubheading: string;
  faqItems: FaqItem[];
}

export interface Dictionary {
  common: {
    sendFiles: string;
    receiveFiles: string;
    howItWorks: string;
    security: string;
    faq: string;
    terms: string;
    privacy: string;
    dmca: string;
    copied: string;
    failedToCopy: string;
    close: string;
    cancel: string;
    loading: string;
    error: string;
  };
  header: {
    send: string;
    howItWorks: string;
    security: string;
    faq: string;
    sendFiles: string;
    selectLanguage: string;
    toggleTheme: string;
    openMenu: string;
    closeMenu: string;
  };
  hero: {
    badge: string;
    titlePre: string;
    titleHighlight: string;
    titlePost: string;
    subtitle: string;
    sendFiles: string;
    receiveFiles: string;
    trustE2e: string;
    trustP2p: string;
    trustNoSignup: string;
    trustSha256: string;
  };
  stats: {
    title: string;
    transfersCreated: string;
    deliveriesCompleted: string;
    filesDelivered: string;
    dataMoved: string;
    footerNote: string;
  };
  howItWorks: {
    heading: string;
    subheading: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
  };
  security: {
    heading: string;
    subheading: string;
    feat1Title: string;
    feat1Desc: string;
    feat2Title: string;
    feat2Desc: string;
    feat3Title: string;
    feat3Desc: string;
    feat4Title: string;
    feat4Desc: string;
    feat5Title: string;
    feat5Desc: string;
    feat6Title: string;
    feat6Desc: string;
  };
  faq: {
    heading: string;
    subheading: string;
    items: FaqItem[];
  };
  footer: {
    tagline: string;
    sendAndReceive: string;
    sendLargeFiles: string;
    howItWorks: string;
    security: string;
    faq: string;
    terms: string;
    privacy: string;
    dmca: string;
    admin: string;
    copyright: string;
    disclaimer: string;
  };
  transfer: {
    sendTab: string;
    receiveTab: string;
    // Send panel
    dropzoneTitle: string;
    dropzoneSubtitle: string;
    dropzoneActive: string;
    addFiles: string;
    addFolder: string;
    selectedFiles: string;
    clearAll: string;
    totalSize: string;
    passwordProtect: string;
    passwordPlaceholder: string;
    passwordHint: string;
    expiryTime: string;
    hours1: string;
    hours6: string;
    hours24: string;
    days3: string;
    days7: string;
    relayFallback: string;
    relayFallbackHint: string;
    startTransferBtn: string;
    creatingTransfer: string;
    transferReady: string;
    transferReadyDesc: string;
    transferCodeLabel: string;
    copyCode: string;
    shareLinkLabel: string;
    copyLink: string;
    showQr: string;
    scanQr: string;
    waitingRecipient: string;
    expiresIn: string;
    cancelTransfer: string;
    newTransfer: string;
    transferring: string;
    completed: string;
    failed: string;
    // Receive panel
    receiveTitle: string;
    receiveSubtitle: string;
    codeOrLinkPlaceholder: string;
    connectAndDownload: string;
    connecting: string;
    transferNotFound: string;
    transferExpired: string;
    passwordRequired: string;
    enterPasswordDesc: string;
    unlockAndDownload: string;
    invalidPassword: string;
    incomingFiles: string;
    downloadAllZip: string;
    downloadFile: string;
    downloading: string;
    downloadComplete: string;
    saveFile: string;
    saveAll: string;
    sha256Verified: string;
    // Progress & connection badges
    directP2p: string;
    secureRelay: string;
    speed: string;
    timeLeft: string;
    remaining: string;
    pause: string;
    resume: string;
    cancel: string;
    historyTitle: string;
    historyEmpty: string;
    historyClear: string;
  };
  chatgptToPdf?: ChatGptToPdfDictionary;
  hub?: HubDictionary;
}

